// const mysql = require('mysql2/promise');
// require('dotenv').config();

// // ── Primary DB: crm_chat ───────────────────────────────────────
// const pool = mysql.createPool({
//   host:     process.env.DB_HOST     || 'localhost',
//   port:     process.env.DB_PORT     || 8889,
//   user:     process.env.DB_USER     || 'root',
//   password: process.env.DB_PASSWORD || 'root',
//   database: process.env.DB_NAME     || 'crm_chat',
//   waitForConnections: true,
//   connectionLimit: 20,
//   queueLimit: 0,
//   timezone: '+00:00',
//   decimalNumbers: true,
// });

// pool.getConnection()
//   .then(conn => { console.log('✅ CRM Chat DB connected'); conn.release(); })
//   .catch(err => { console.error('❌ CRM Chat DB failed:', err.message); process.exit(1); });

// // ── Secondary DB: CRM campaigns source ────────────────────────
// // Only connects if CRM_DB_HOST is set in .env
// let crmPool = null;
// // if (process.env.CRM_DB_HOST) {
//   crmPool = mysql.createPool({
//     host:     process.env.CRM_DB_HOST ||  'localhost',
//     port:     process.env.CRM_DB_PORT     || 8889,
//     user:     process.env.CRM_DB_USER     || process.env.DB_USER || 'root',
//     password: process.env.CRM_DB_PASSWORD || process.env.DB_PASSWORD || 'root',
//     database: process.env.CRM_DB_NAME     || 'crm',
//     waitForConnections: true,
//     connectionLimit: 5,
//     queueLimit: 0,
//     timezone: '+00:00',
//     decimalNumbers: true,
//   });
//   crmPool.getConnection()
//     .then(conn => { console.log('✅ CRM Source DB connected'); conn.release(); })
//     .catch(err => { console.warn('⚠️  CRM Source DB not available:', err.message); crmPool = null; });


// module.exports = pool;
// module.exports.crmPool = crmPool;
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
  connectionLimit: 20,
  queueLimit: 0,
  timezone: '+00:00',
  decimalNumbers: true,
});

pool.getConnection()
  .then(conn => { console.log('✅ CRM Chat DB connected'); conn.release(); })
  .catch(err => { console.error('❌ CRM Chat DB failed:', err.message); process.exit(1); });

// ── Secondary DB: CRM campaigns source ────────────────────────
// Only connects if CRM_DB_HOST is set in .env
let crmPool = null;
// if (process.env.CRM_DB_HOST) {
  crmPool = mysql.createPool({
    host:     process.env.CRM_DB_HOST ||  '160.153.172.237',
    port:     process.env.CRM_DB_PORT     || 3306,
    user:     process.env.CRM_DB_USER     || process.env.DB_USER || 'clickorbtits',
    password: process.env.CRM_DB_PASSWORD || process.env.DB_PASSWORD || 'Clickorbits@123',
    database: process.env.CRM_DB_NAME     || 'crmclickorbits',
    waitForConnections: true,
    connectionLimit: 5,
    queueLimit: 0,
    timezone: '+00:00',
    decimalNumbers: true,
  });
  crmPool.getConnection()
    .then(conn => { console.log('✅ CRM Source DB connected'); conn.release(); })
    .catch(err => { console.warn('⚠️  CRM Source DB not available:', err.message); crmPool = null; });


module.exports = pool;
module.exports.crmPool = crmPool;