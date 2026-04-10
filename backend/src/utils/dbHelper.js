const db = require('./db');

const safeQuery = async (query, values = []) => {
  try {
    return await db.query(query, values);
  } catch (err) {
    console.error('DB Error:', err.message);
    return [[], null];
  }
};

module.exports = { safeQuery };