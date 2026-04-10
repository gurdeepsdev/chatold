const mysql = require('mysql2/promise');
require('dotenv').config();

// ── Primary DB: crm_chat ───────────────────────────────────────
const pool = mysql.createPool({
  host:     process.env.DB_HOST     || '160.153.172.237',
  port:     process.env.DB_PORT     || 3306,
  user:     process.env.DB_USER     || 'crm_user',
  password: process.env.DB_PASSWORD || 'Clickorbits@123',
  database: process.env.DB_NAME     || 'crm_chat',
  waitForConnections: true,
  // FIX #1: Increased from 5 → 15. With transactions, socket queries, and
  // concurrent API requests all sharing 5 connections, the pool was
  // guaranteed to exhaust under real load.
  connectionLimit: 25,
  queueLimit: 0,          // FIX #2: Cap the queue — don't let requests pile up forever
  connectTimeout: 10000, 
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,  // FIX #3: Fail fast (10s) instead of hanging indefinitely
  timezone: '+00:00',
  decimalNumbers: true,
  // FIX #4: Reduced from 300000 (5 min) → 60000 (60s). The 5-minute idle
  // timeout was a direct match for the "dies after 5-10 minutes" symptom —
  // stale connections were being reused after MySQL's own wait_timeout
  // killed them server-side.
  idleTimeout: 60000,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000, // FIX #5: Give connections 10s before first keepalive
});

// FIX #6: Do NOT call process.exit(1) here. A transient startup DB
// hiccup should not bring down the entire server. Log the error clearly
// and let the pool's reconnect logic handle it.
pool.getConnection()
  .then(conn => { console.log('✅ CRM Chat DB connected'); conn.release(); })
  .catch(err => {
    console.error('❌ CRM Chat DB connection test failed:', err.message);
    console.error('   Server will continue — pool will retry connections on demand.');
    // Do NOT process.exit(1) here
  });

// ── Secondary DB: CRM campaigns source ────────────────────────
let crmPool = null;

crmPool = mysql.createPool({
  host:     process.env.CRM_DB_HOST     || '160.153.172.237',
  port:     process.env.CRM_DB_PORT     || 3306,
  user:     process.env.CRM_DB_USER     || process.env.DB_USER     || 'clickorbtits',
  password: process.env.CRM_DB_PASSWORD || process.env.DB_PASSWORD || 'Clickorbits@123',
  database: process.env.CRM_DB_NAME     || 'crmclickorbits',
  waitForConnections: true,
  connectionLimit: 25,
  queueLimit: 20,
  connectTimeout: 10000,
  timezone: '+00:00',
  decimalNumbers: true,
  idleTimeout: 60000,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
});

// FIX #7: Secondary DB failure must never crash the server.
crmPool.getConnection()
  .then(conn => { console.log('✅ CRM Source DB connected'); conn.release(); })
  .catch(err => {
    console.warn('⚠️  CRM Source DB not available:', err.message);
    crmPool = null;
  });

module.exports = pool;
module.exports.crmPool = crmPool;
