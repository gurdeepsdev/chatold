import axios from 'axios';

// Backend runs on :5000, frontend on :3000
const API_BASE = process.env.REACT_APP_API_URL || 'https://chat.pidmetric.com';

const api = axios.create({
  baseURL: `${API_BASE}/api`,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('crm_chat_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res.data,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('crm_chat_token');
      window.location.href = '/';
    }
    return Promise.reject(err.response?.data || { error: 'Network error' });
  }
);

// ✅ FIX: convert relative /uploads/path → full backend URL (port 5000, not 3000)
export function getFileUrl(filePath) {
  if (!filePath) return '';
  if (filePath.startsWith('http')) return filePath;
  return `${API_BASE}${filePath}`;
}

export const authAPI = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  me: () => api.get('/auth/me'),
  logout: () => api.post('/auth/logout'),
  getUsers: () => api.get('/auth/users'),
};

export const groupsAPI = {
  getAll: () => api.get('/groups'),
  getById: (id) => api.get(`/groups/${id}`),
  createFromCampaign: (data) => api.post('/groups/from-campaign', data),
  createFromCampaignData: (data) => api.post('/groups/from-campaign-data', data),
  createCustom: (data) => api.post('/groups/custom', data),
  addMember: (groupId, userId) => api.post(`/groups/${groupId}/members`, { user_id: userId }),
  removeMember: (groupId, userId) => api.delete(`/groups/${groupId}/members/${userId}`),
  getSummary: (groupId) => api.get(`/groups/${groupId}/summary`),
};

export const messagesAPI = {
  getMessages: (groupId, page = 1) => api.get(`/messages/${groupId}?page=${page}`),
  sendMessage: (groupId, data) => api.post(`/messages/${groupId}`, data),
  uploadFile: (groupId, formData) => api.post(`/messages/${groupId}/upload`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  deleteMessage: (groupId, messageId) => api.delete(`/messages/${groupId}/${messageId}`),
  addReaction: (groupId, messageId, emoji) => api.post(`/messages/${groupId}/${messageId}/reaction`, { emoji }),
  removeReaction: (groupId, messageId) => api.delete(`/messages/${groupId}/${messageId}/reaction`),
};

export const tasksAPI = {
  getByGroup: (groupId) => api.get(`/tasks/group/${groupId}`),
  create: (data) => {
    if (data instanceof FormData) {
      return api.post('/tasks', data, { headers: { 'Content-Type': 'multipart/form-data' } });
    }
    return api.post('/tasks', data);
  },
  updateStatus: (taskId, status, comment) => api.patch(`/tasks/${taskId}/status`, { status, comment }),
  getResponses: (taskId) => api.get(`/tasks/${taskId}/responses`),
  createFollowup: (data) => api.post('/tasks/followup', data),
  getFollowups: (groupId) => api.get(`/tasks/followups/group/${groupId}`),
};

export const campaignsAPI = {
  getAll: () => api.get('/campaigns'),
  getById: (id) => api.get(`/campaigns/${id}`),
  getCampaignData: () => api.get('/campaigns/campaign-data'),
  getPidStatus: (groupId) => api.get(`/campaigns/pid-status/group/${groupId}`),
  updatePidStatus: (data) => api.post('/campaigns/pid-status', data),
};

export const notificationsAPI = {
  getAll: () => api.get('/notifications'),
  getUnreadCount: () => api.get('/notifications/unread-count'),
  markRead: (id) => api.patch(`/notifications/${id}/read`),
  markAllRead: () => api.patch('/notifications/read-all'),
};

export default api;
