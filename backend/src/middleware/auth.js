// const jwt = require('jsonwebtoken');
// const db = require('../utils/db');

// const auth = async (req, res, next) => {
//   try {
//     const token = req.headers.authorization?.split(' ')[1];
//     if (!token) return res.status(401).json({ error: 'No token provided' });

//     const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
//     let rows;
//     try {
//       [rows] = await db.query('SELECT id, username, full_name, email, role FROM users WHERE id = ?', [decoded.userId]);
//     } catch (dbError) {
//       console.error('Database connection error in auth:', dbError);
//       // Retry once after a short delay
//       await new Promise(resolve => setTimeout(resolve, 100));
//       [rows] = await db.query('SELECT id, username, full_name, email, role FROM users WHERE id = ?', [decoded.userId]);
//     }
    
//     if (!rows.length) return res.status(401).json({ error: 'User not found' });
    
//     req.user = rows[0];
//     next();
//   } catch (err) {
//     console.error('Auth middleware error:', err);
//     if (err.name === 'JsonWebTokenError') {
//       return res.status(401).json({ error: 'Invalid token' });
//     }
//     return res.status(401).json({ error: 'Authentication failed' });
//   }
// };

// const requireRole = (...roles) => (req, res, next) => {
//   if (!roles.includes(req.user.role)) {
//     return res.status(403).json({ error: 'Insufficient permissions' });
//   }
//   next();
// };

// module.exports = { auth, requireRole };
const jwt = require('jsonwebtoken');
const db  = require('../utils/db');

const auth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token provided' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');

    // FIX: removed the unconditional retry on DB error.
    // The old code retried after ANY db error including EADDRNOTAVAIL (OS port
    // exhaustion). That retry opened a SECOND failing TCP connection immediately,
    // doubling the load on an already-exhausted port table and making recovery
    // take twice as long. The pool's own reconnect logic handles transient errors
    // correctly without help from application code.
    const [rows] = await db.query(
      'SELECT id, username, full_name, email, role FROM users WHERE id = ?',
      [decoded.userId]
    );

    if (!rows.length) return res.status(401).json({ error: 'User not found' });

    req.user = rows[0];
    next();
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    // DB errors (EADDRNOTAVAIL, ECONNRESET, pool queue limit, etc.)
    // Return 503 so the client knows to retry, not 401/500.
    if (err.code === 'EADDRNOTAVAIL' || err.code === 'ECONNRESET' ||
        err.message?.includes('Queue limit')) {
      console.error('[auth] DB unavailable:', err.code || err.message);
      return res.status(503).json({ error: 'Service temporarily unavailable — please retry' });
    }
    console.error('[auth] unexpected error:', err);
    return res.status(401).json({ error: 'Authentication failed' });
  }
};

const requireRole = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }
  next();
};

module.exports = { auth, requireRole };
