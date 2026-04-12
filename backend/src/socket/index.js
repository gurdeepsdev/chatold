// const jwt = require('jsonwebtoken');
// const db = require('../utils/db');

// module.exports = (io) => {
//   // Auth middleware for sockets
//   io.use(async (socket, next) => {
//     try {
//       const token = socket.handshake.auth.token;
//       if (!token) return next(new Error('Authentication required'));
      
//       const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
//       const [rows] = await db.query('SELECT id, full_name, role FROM users WHERE id = ?', [decoded.userId]);
//       if (!rows.length) return next(new Error('User not found'));
      
//       socket.user = rows[0];
//       next();
//     } catch (err) {
//       next(new Error('Invalid token'));
//     }
//   });

//   io.on('connection', async (socket) => {
//     const userId = socket.user.id;

//     // Update online status asynchronously with retry logic (non-blocking connection)
//     setImmediate(async () => {
//       let retryCount = 0;
//       const maxRetries = 3;
//       const baseDelay = 500; // 500ms base delay
      
//       while (retryCount < maxRetries) {
//         try {
//     await db.query('UPDATE users SET is_online = TRUE WHERE id = ?', [userId]);
//           break; // Success - exit retry loop
//         } catch (err) {
//           if (err.code === 'ER_LOCK_WAIT_TIMEOUT' && retryCount < maxRetries - 1) {
//             retryCount++;
//             const delay = baseDelay * Math.pow(2, retryCount - 1);
//             await new Promise(resolve => setTimeout(resolve, delay));
//             continue;
//           } else {
//             console.error('Failed to update socket online status (non-critical):', err.message);
//             break; // Don't throw - non-critical operation
//           }
//         }
//       }
//     });
    
// // Join user's groups
// const [groups] = await db.query(
//   'SELECT group_id FROM group_members WHERE user_id = ?', [userId]
// );
// console.log(`🔍 User ${socket.user.full_name} groups to join:`, groups.map(g => g.group_id));
// groups.forEach(g => {
//   console.log(`🔍 User ${socket.user.full_name} joining room: group_${g.group_id}`);
//   socket.join(`group_${g.group_id}`);
// });

// // Join personal room
// console.log(`🔍 User ${socket.user.full_name} joining personal room: user_${userId}`);
// socket.join(`user_${userId}`);

//     // Broadcast online status
//     io.emit('user_status', { user_id: userId, is_online: true });

//     // Handle joining a group room
//     socket.on('join_group', async (groupId) => {
//       const [membership] = await db.query(
//         'SELECT id FROM group_members WHERE group_id = ? AND user_id = ?',
//         [groupId, userId]
//       );
//       if (membership.length || socket.user.role === 'admin') {
//         socket.join(`group_${groupId}`);
//         socket.emit('joined_group', { groupId });
//       }
//     });

//     // Handle typing indicator
//     socket.on('typing', ({ groupId, isTyping }) => {
//       socket.to(`group_${groupId}`).emit('user_typing', {
//         user_id: userId,
//         user_name: socket.user.full_name,
//         groupId,
//         isTyping
//       });
//     });

//     // Handle task assignment notification
//     socket.on('task_assigned', ({ task, assignedUserId }) => {
//       // Send to assigned user's personal room
//       io.to(`user_${assignedUserId}`).emit('task_assigned', {
//         task,
//         assigned_by: socket.user.full_name,
//         message: `New task assigned to you by ${socket.user.full_name}`
//       });
//     });

//     // Handle message seen
//     socket.on('message_seen', async ({ messageId, groupId }) => {
//       try {
//         await db.query(
//           'INSERT IGNORE INTO message_status (message_id, user_id, status) VALUES (?, ?, ?)',
//           [messageId, userId, 'seen']
//         );
//         socket.to(`group_${groupId}`).emit('message_status_update', {
//           message_id: messageId,
//           user_id: userId,
//           status: 'seen'
//         });
//       } catch (err) {}
//     });

//     // Handle disconnect
//     socket.on('disconnect', async () => {
//       console.log(`🔌 User disconnected: ${socket.user.full_name}`);
//       // FIX: wrap in try/catch so a DB error (e.g. pool exhausted) does not
//       // leave the status event un-emitted and does not produce an unhandled
//       // rejection that silently swallows the stack trace.
//       try {
//         await db.query(
//           'UPDATE users SET is_online = FALSE, last_seen = NOW() WHERE id = ?',
//           [userId]
//         );
//       } catch (err) {
//         console.error('Failed to update offline status (non-critical):', err.message);
//       }
//       io.emit('user_status', { user_id: userId, is_online: false, last_seen: new Date() });
//     });
//   });
// };
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

    // Update online status asynchronously with retry logic (non-blocking connection)
    setImmediate(async () => {
      let retryCount = 0;
      const maxRetries = 3;
      const baseDelay = 500; // 500ms base delay
      
      while (retryCount < maxRetries) {
        try {
    await db.query('UPDATE users SET is_online = TRUE WHERE id = ?', [userId]);
          break; // Success - exit retry loop
        } catch (err) {
          if (err.code === 'ER_LOCK_WAIT_TIMEOUT' && retryCount < maxRetries - 1) {
            retryCount++;
            const delay = baseDelay * Math.pow(2, retryCount - 1);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          } else {
            console.error('Failed to update socket online status (non-critical):', err.message);
            break; // Don't throw - non-critical operation
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

    // Broadcast online status
    io.emit('user_status', { user_id: userId, is_online: true });

    // Handle joining a group room
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
        console.error('[socket] join_group DB error (non-critical):', err.message);
        // Don't crash the handler — client will retry on reconnect
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
      } catch (err) {
        console.error('[socket] message_seen DB error (non-critical):', err.message);
      }
    });

    // Handle disconnect
    socket.on('disconnect', async () => {
      console.log(`🔌 User disconnected: ${socket.user.full_name}`);
      // FIX: wrap in try/catch so a DB error (e.g. pool exhausted) does not
      // leave the status event un-emitted and does not produce an unhandled
      // rejection that silently swallows the stack trace.
      try {
        await db.query(
          'UPDATE users SET is_online = FALSE, last_seen = NOW() WHERE id = ?',
          [userId]
        );
      } catch (err) {
        console.error('Failed to update offline status (non-critical):', err.message);
      }
      io.emit('user_status', { user_id: userId, is_online: false, last_seen: new Date() });
    });
  });
};
