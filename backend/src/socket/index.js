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
    console.log(`🔌 User connected: ${socket.user.full_name} (${socket.id})`);

    // Update online status
    await db.query('UPDATE users SET is_online = TRUE WHERE id = ?', [userId]);
    
    // Join user's groups
    const [groups] = await db.query(
      'SELECT group_id FROM group_members WHERE user_id = ?', [userId]
    );
    groups.forEach(g => socket.join(`group_${g.group_id}`));

    // Join personal room
    socket.join(`user_${userId}`);

    // Broadcast online status
    io.emit('user_status', { user_id: userId, is_online: true });

    // Handle joining a group room
    socket.on('join_group', async (groupId) => {
      const [membership] = await db.query(
        'SELECT id FROM group_members WHERE group_id = ? AND user_id = ?',
        [groupId, userId]
      );
      if (membership.length || socket.user.role === 'admin') {
        socket.join(`group_${groupId}`);
        socket.emit('joined_group', { groupId });
      }
    });

    // Handle typing indicator
    socket.on('typing', ({ groupId, isTyping }) => {
      socket.to(`group_${groupId}`).emit('user_typing', {
        user_id: userId,
        user_name: socket.user.full_name,
        groupId,
        isTyping
      });
    });

    // Handle task assignment notification
    socket.on('task_assigned', ({ task, assignedUserId }) => {
      // Send to assigned user's personal room
      io.to(`user_${assignedUserId}`).emit('task_assigned', {
        task,
        assigned_by: socket.user.full_name,
        message: `New task assigned to you by ${socket.user.full_name}`
      });
    });

    // Handle message seen
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
      } catch (err) {}
    });

    // Handle disconnect
    socket.on('disconnect', async () => {
      console.log(`🔌 User disconnected: ${socket.user.full_name}`);
      await db.query(
        'UPDATE users SET is_online = FALSE, last_seen = NOW() WHERE id = ?',
        [userId]
      );
      io.emit('user_status', { user_id: userId, is_online: false, last_seen: new Date() });
    });
  });
};
