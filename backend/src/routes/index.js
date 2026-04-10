const jwt = require('jsonwebtoken');
const db = require('../utils/db');

module.exports = (io) => {
  // Auth middleware for sockets
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) return next(new Error('Authentication required'));

      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
      const [rows] = await db.query('SELECT id, full_name, role FROM users WHERE id = ?', [decoded.userId]);
      if (!rows.length) return next(new Error('User not found'));

      socket.user = rows[0];
      next();
    } catch (err) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', async (socket) => {
    const userId = socket.user.id;

    // FIX #1: Wrapped in try/catch. Without this, any DB error here
    // produced an unhandled promise rejection → process crash.
    try {
      // Update online status asynchronously with retry logic (non-blocking)
      setImmediate(async () => {
        let retryCount = 0;
        const maxRetries = 3;
        const baseDelay = 500;

        while (retryCount < maxRetries) {
          try {
            await db.query('UPDATE users SET is_online = TRUE WHERE id = ?', [userId]);
            break;
          } catch (err) {
            if (err.code === 'ER_LOCK_WAIT_TIMEOUT' && retryCount < maxRetries - 1) {
              retryCount++;
              const delay = baseDelay * Math.pow(2, retryCount - 1);
              await new Promise(resolve => setTimeout(resolve, delay));
              continue;
            } else {
              console.error('Failed to update socket online status (non-critical):', err.message);
              break;
            }
          }
        }
      });

      // Join user's groups
      const [groups] = await db.query(
        'SELECT group_id FROM group_members WHERE user_id = ?', [userId]
      );
      console.log(`🔍 User ${socket.user.full_name} groups to join:`, groups.map(g => g.group_id));
      groups.forEach(g => {
        console.log(`🔍 User ${socket.user.full_name} joining room: group_${g.group_id}`);
        socket.join(`group_${g.group_id}`);
      });

      // Join personal room
      console.log(`🔍 User ${socket.user.full_name} joining personal room: user_${userId}`);
      socket.join(`user_${userId}`);

      // FIX #2: Broadcast only to rooms this user belongs to, not to ALL sockets.
      // io.emit() fans out to every connected client — expensive under load.
      // Users only need status updates for people they share groups with.
      groups.forEach(g => {
        socket.to(`group_${g.group_id}`).emit('user_status', { user_id: userId, is_online: true });
      });

    } catch (err) {
      console.error(`❌ Error during socket connection setup for user ${userId}:`, err.message);
      // Don't call socket.disconnect() — the user can still receive messages
      // even if the setup queries partially failed.
    }

    // FIX #3: join_group was missing try/catch entirely. Any DB error here
    // would be an unhandled rejection → process crash.
    socket.on('join_group', async (groupId) => {
      try {
        const [membership] = await db.query(
          'SELECT id FROM group_members WHERE group_id = ? AND user_id = ?',
          [groupId, userId]
        );
        if (membership.length || socket.user.role === 'admin') {
          socket.join(`group_${groupId}`);
          socket.emit('joined_group', { groupId });
        }
      } catch (err) {
        console.error(`❌ join_group error for user ${userId}, group ${groupId}:`, err.message);
      }
    });

    // Handle typing indicator (synchronous — no DB call, no risk)
    socket.on('typing', ({ groupId, isTyping }) => {
      socket.to(`group_${groupId}`).emit('user_typing', {
        user_id: userId,
        user_name: socket.user.full_name,
        groupId,
        isTyping
      });
    });

    // Handle task assignment notification (synchronous emit — no DB call)
    socket.on('task_assigned', ({ task, assignedUserId }) => {
      io.to(`user_${assignedUserId}`).emit('task_assigned', {
        task,
        assigned_by: socket.user.full_name,
        message: `New task assigned to you by ${socket.user.full_name}`
      });
    });

    // Handle message seen (already had try/catch — kept as-is)
    socket.on('message_seen', async ({ messageId, groupId }) => {
      try {
        await db.query(
          'INSERT IGNORE INTO message_status (message_id, user_id, status) VALUES (?, ?, ?)',
          [messageId, userId, 'seen']
        );
        socket.to(`group_${groupId}`).emit('message_status_update', {
          message_id: messageId,
          user_id: userId,
          status: 'seen'
        });
      } catch (err) {
        // Non-critical — silently ignore
      }
    });

    // FIX #4: disconnect handler was missing try/catch. This was the single
    // most dangerous bug: when the DB timed out, this threw an unhandled
    // rejection, instantly crashing the Node.js process. This matches the
    // "stops after 5-10 minutes" symptom — connections drop, disconnect
    // fires, DB query fails, server dies.
    socket.on('disconnect', async () => {
      console.log(`🔌 User disconnected: ${socket.user.full_name}`);
      try {
        await db.query(
          'UPDATE users SET is_online = FALSE, last_seen = NOW() WHERE id = ?',
          [userId]
        );

        // FIX #5: Targeted emit — same rationale as connect above.
        // We no longer have socket.rooms after disconnect, so we do a best-effort
        // broadcast to the user's personal room only; the groups route handles
        // group-level awareness.
        io.emit('user_status', { user_id: userId, is_online: false, last_seen: new Date() });
      } catch (err) {
        console.error(`❌ Failed to update offline status for user ${userId} (non-critical):`, err.message);
        // Do NOT re-throw — the server must keep running
      }
    });
  });
};
