/**
 * Timezone utilities for Indian Standard Time (IST)
 * IST = UTC + 5:30
 */

// Get current IST timestamp
function getISTDate() {
  const now = new Date();
  // Convert UTC to IST by adding 5 hours 30 minutes
  const istOffset = 5.5 * 60 * 60 * 1000; // 5.5 hours in milliseconds
  const istTime = new Date(now.getTime() + istOffset + (now.getTimezoneOffset() * 60 * 1000));
  return istTime;
}

// Format date for MySQL (YYYY-MM-DD HH:mm:ss) in IST
function formatISTForMySQL(date = null) {
  const istDate = date || getISTDate();
  const year = istDate.getFullYear();
  const month = String(istDate.getMonth() + 1).padStart(2, '0');
  const day = String(istDate.getDate()).padStart(2, '0');
  const hours = String(istDate.getHours()).padStart(2, '0');
  const minutes = String(istDate.getMinutes()).padStart(2, '0');
  const seconds = String(istDate.getSeconds()).padStart(2, '0');
  
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

// Convert UTC date from database to IST for frontend
function convertUTCToIST(utcDateString) {
  if (!utcDateString) return null;
  
  const utcDate = new Date(utcDateString);
  // Add 5:30 hours to convert UTC to IST
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istTime = new Date(utcDate.getTime() + istOffset);
  
  return istTime;
}

// Get IST timestamp string for socket events
function getISTTimestamp() {
  return getISTDate().toISOString();
}

module.exports = {
  getISTDate,
  formatISTForMySQL,
  convertUTCToIST,
  getISTTimestamp
};
