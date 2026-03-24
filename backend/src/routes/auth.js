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
    // For demo: password is 'password123' for all test users
    // In production use bcrypt.compare(password, user.password_hash)
    const validPassword = password === 'password123' || await bcrypt.compare(password, user.password_hash || '');
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

module.exports = router;
