const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../utils/db');
const { auth } = require('../middleware/auth');

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    if (!rows.length) return res.status(401).json({ error: 'Invalid credentials' });

    const user = rows[0];
    
    // Check if user has password_hash
    if (!user.password_hash) {
      return res.status(401).json({ error: 'User has no password set. Please contact admin.' });
    }

    // Verify password with bcrypt
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '7d' }
    );

    // Update online status
    await db.query('UPDATE users SET is_online = TRUE WHERE id = ?', [user.id]);

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        full_name: user.full_name,
        email: user.email,
        role: user.role,
        avatar_url: user.avatar_url
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get current user
router.get('/me', auth, async (req, res) => {
  res.json({ user: req.user });
});

// Logout
router.post('/logout', auth, async (req, res) => {
  await db.query('UPDATE users SET is_online = FALSE, last_seen = NOW() WHERE id = ?', [req.user.id]);
  res.json({ message: 'Logged out' });
});

// Get all users (for adding to groups)
router.get('/users', auth, async (req, res) => {
  const [rows] = await db.query(
    'SELECT id, username, full_name, email, role, is_online, last_seen FROM users ORDER BY full_name'
  );
  res.json({ users: rows });
});

// Set/Update password (for admin or self)
router.post('/set-password', auth, async (req, res) => {
  try {
    const { email, password, userId } = req.body;
    
    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    let targetUserId;
    
    // Admin can set password for any user
    if (req.user.role === 'admin' && userId) {
      targetUserId = userId;
    } 
    // User can only set their own password
    else if (!userId) {
      targetUserId = req.user.userId;
    } 
    // Non-admin trying to set password for other users
    else {
      return res.status(403).json({ error: 'Not authorized to set password for other users' });
    }

    // Hash the password
    const password_hash = await bcrypt.hash(password, 10);

    // Update password
    await db.query(
      'UPDATE users SET password_hash = ? WHERE id = ?',
      [password_hash, targetUserId]
    );

    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Temporary: Set initial passwords for all users (REMOVE IN PRODUCTION)
router.post('/setup-initial-passwords', async (req, res) => {
  try {
    const { defaultPassword = 'password123' } = req.body;
    
    // Get all users without passwords
    const [users] = await db.query(
      'SELECT id, email, username FROM users WHERE password_hash IS NULL'
    );

    if (users.length === 0) {
      return res.json({ message: 'All users already have passwords set' });
    }

    // Set default password for all users
    const password_hash = await bcrypt.hash(defaultPassword, 10);
    
    for (const user of users) {
      await db.query(
        'UPDATE users SET password_hash = ? WHERE id = ?',
        [password_hash, user.id]
      );
    }

    res.json({ 
      message: `Set initial password for ${users.length} users`,
      users: users.map(u => ({ id: u.id, email: u.email, username: u.username })),
      defaultPassword
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
