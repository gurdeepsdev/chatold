// const mysql = require('mysql2/promise');
// require('dotenv').config();

// // ── Primary DB: crm_chat ───────────────────────────────────────
// const pool = mysql.createPool({
//   host:     process.env.DB_HOST     || '160.153.172.237',
//   port:     process.env.DB_PORT     || 3306,
//   user:     process.env.DB_USER     || 'crm_user',
//   password: process.env.DB_PASSWORD || 'Clickorbits@123',
//   database: process.env.DB_NAME     || 'crm_chat',
//   waitForConnections: true,
//   // FIX #1: Increased from 5 → 15. With transactions, socket queries, and
//   // concurrent API requests all sharing 5 connections, the pool was
//   // guaranteed to exhaust under real load.
//   connectionLimit: 15,
//   queueLimit: 50,          // FIX #2: Cap the queue — don't let requests pile up forever
//   connectTimeout: 10000,   // FIX #3: Fail fast (10s) instead of hanging indefinitely
//   timezone: '+00:00',
//   decimalNumbers: true,
//   // FIX #4: Reduced from 300000 (5 min) → 60000 (60s). The 5-minute idle
//   // timeout was a direct match for the "dies after 5-10 minutes" symptom —
//   // stale connections were being reused after MySQL's own wait_timeout
//   // killed them server-side.
//   idleTimeout: 60000,
//   enableKeepAlive: true,
//   keepAliveInitialDelay: 10000, // FIX #5: Give connections 10s before first keepalive
// });

// // FIX #6: Do NOT call process.exit(1) here. A transient startup DB
// // hiccup should not bring down the entire server. Log the error clearly
// // and let the pool's reconnect logic handle it.
// pool.getConnection()
//   .then(conn => { console.log('✅ CRM Chat DB connected'); conn.release(); })
//   .catch(err => {
//     console.error('❌ CRM Chat DB connection test failed:', err.message);
//     console.error('   Server will continue — pool will retry connections on demand.');
//     // Do NOT process.exit(1) here
//   });

// // ── Secondary DB: CRM campaigns source ────────────────────────
// let crmPool = null;

// crmPool = mysql.createPool({
//   host:     process.env.CRM_DB_HOST     || '160.153.172.237',
//   port:     process.env.CRM_DB_PORT     || 3306,
//   user:     process.env.CRM_DB_USER     || process.env.DB_USER     || 'clickorbtits',
//   password: process.env.CRM_DB_PASSWORD || process.env.DB_PASSWORD || 'Clickorbits@123',
//   database: process.env.CRM_DB_NAME     || 'crmclickorbits',
//   waitForConnections: true,
//   connectionLimit: 15,
//   queueLimit: 50,
//   connectTimeout: 10000,
//   timezone: '+00:00',
//   decimalNumbers: true,
//   idleTimeout: 60000,
//   enableKeepAlive: true,
//   keepAliveInitialDelay: 10000,
// });

// // FIX #7: Secondary DB failure must never crash the server.
// crmPool.getConnection()
//   .then(conn => { console.log('✅ CRM Source DB connected'); conn.release(); })
//   .catch(err => {
//     console.warn('⚠️  CRM Source DB not available:', err.message);
//     crmPool = null;
//   });

// module.exports = pool;
// module.exports.crmPool = crmPool;


const mysql = require('mysql2/promise');
require('dotenv').config();

// ── Helper: build a pool with sensible production defaults ────────────────
function makePool(config) {
  const pool = mysql.createPool({
    waitForConnections: true,
    connectionLimit:    10,   // reduced from 15 — remote MySQL on shared host;
                              // fewer persistent TCP sockets = fewer EADDRNOTAVAIL
                              // events when the OS port table is under pressure.
    queueLimit:         30,   // hard cap — surface backpressure early
    connectTimeout:     8000, // 8 s — fail fast on network hiccup
    idleTimeout:        55000,// just under MySQL's default wait_timeout (60 s)
                              // so the pool retires idle connections before the
                              // server kills them, preventing "stale connection" errors
    enableKeepAlive:        true,
    keepAliveInitialDelay:  15000, // 15 s — first keepalive after connection settles
    timezone: '+00:00',
    decimalNumbers: true,
    ...config,
  });

  // ── Pool-level error handler ──────────────────────────────────────────────
  // Without this, an EADDRNOTAVAIL or ECONNRESET on an idle connection throws
  // an uncaught 'error' event that crashes the process.
  pool.on('error', (err) => {
    // EADDRNOTAVAIL: OS has exhausted ephemeral ports — usually a local dev
    // issue caused by too many rapid reconnects or a network interface restart.
    // ECONNRESET / ETIMEDOUT: remote server closed the connection.
    // In both cases: log and let the pool's built-in reconnect handle recovery.
    // DO NOT call process.exit() — the pool will retry on the next query.
    const recoverable = ['EADDRNOTAVAIL','ECONNRESET','ETIMEDOUT','PROTOCOL_CONNECTION_LOST'];
    if (recoverable.includes(err.code)) {
      console.warn(`[DB pool] recoverable connection error (${err.code}) — pool will reconnect`);
    } else {
      console.error('[DB pool] unexpected error:', err.message);
    }
  });

  return pool;
}

// ── Primary DB: crm_chat ──────────────────────────────────────────────────
const pool = makePool({
  host:     process.env.DB_HOST     || '160.153.172.237',
  port:     process.env.DB_PORT     || 3306,
  user:     process.env.DB_USER     || 'crm_user',
  password: process.env.DB_PASSWORD || 'Clickorbits@123',
  database: process.env.DB_NAME     || 'crm_chat',
});

pool.getConnection()
  .then(conn => { console.log('✅ CRM Chat DB connected'); conn.release(); })
  .catch(err => {
    console.error('❌ CRM Chat DB connection test failed:', err.message);
    console.error('   Server will continue — pool will retry on demand.');
  });

// ── Secondary DB: CRM source ──────────────────────────────────────────────
let crmPool = null;

crmPool = makePool({
  host:     process.env.CRM_DB_HOST     || '160.153.172.237',
  port:     process.env.CRM_DB_PORT     || 3306,
  user:     process.env.CRM_DB_USER     || process.env.DB_USER     || 'clickorbtits',
  password: process.env.CRM_DB_PASSWORD || process.env.DB_PASSWORD || 'Clickorbits@123',
  database: process.env.CRM_DB_NAME     || 'crmclickorbits',
  connectionLimit: 5, // CRM DB is read-only for lookups — fewer connections needed
});

crmPool.getConnection()
  .then(conn => { console.log('✅ CRM Source DB connected'); conn.release(); })
  .catch(err => {
    console.warn('⚠️  CRM Source DB not available:', err.message);
    crmPool = null;
  });

module.exports = pool;
module.exports.crmPool = crmPool;
