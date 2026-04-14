/**
 * Timezone utilities for Indian Standard Time (IST) - Frontend
 * IST = UTC + 5:30
 */

import { format, isToday, isYesterday } from 'date-fns';

// Convert UTC date string to IST Date object
function convertUTCToIST(utcDateString) {
  if (!utcDateString) return null;
  
  const utcDate = new Date(utcDateString);
  // Add 5:30 hours to convert UTC to IST
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istTime = new Date(utcDate.getTime() + istOffset);
  
  return istTime;
}

// Format time for display in IST
function formatTimeIST(dateStr) {
  if (!dateStr) return '';
  
  const istDate = convertUTCToIST(dateStr);
  if (!istDate) return '';
  
  if (isToday(istDate)) return format(istDate, 'HH:mm');
  if (isYesterday(istDate)) return 'Yesterday';
  return format(istDate, 'MMM d');
}

// Format full date for display in IST
function formatDateIST(dateStr, formatStr = 'MMM d, yyyy HH:mm') {
  if (!dateStr) return '';
  
  const istDate = convertUTCToIST(dateStr);
  if (!istDate) return '';
  
  return format(istDate, formatStr);
}

// Format date for group creation display
function formatGroupCreatedIST(dateStr) {
  return formatDateIST(dateStr, 'MMM d, yyyy');
}

// Format date for timeline display
function formatTimelineIST(dateStr) {
  return formatDateIST(dateStr, 'MMM d, HH:mm');
}

// Format date for PID status display
function formatPIDStatusIST(dateStr) {
  return formatDateIST(dateStr, 'MMM d HH:mm');
}

// Get current IST time
function getCurrentIST() {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  return new Date(now.getTime() + istOffset + (now.getTimezoneOffset() * 60 * 1000));
}

export {
  convertUTCToIST,
  formatTimeIST,
  formatDateIST,
  formatGroupCreatedIST,
  formatTimelineIST,
  formatPIDStatusIST,
  getCurrentIST
};
