import axios from 'axios';

// Create axios instance
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000/api',
  timeout: 30000, // Increased timeout for registration (email sending can take time)
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  login: (credentials) => api.post('/auth/login', credentials),
  register: (data) => api.post('/auth/register', data),
  verifyEmail: (token) => api.get('/auth/verify-email', { params: { token } }),
  resendVerification: (email) => api.post('/auth/resend-verification', { email }),
  logout: () => api.post('/auth/logout'),
  getProfile: () => api.get('/auth/profile'),
  updateProfile: (data) => api.put('/auth/profile', data),
  changePassword: (data) => api.put('/auth/change-password', data),
  getPermissions: () => api.get('/auth/permissions'),
};

// Dashboard API
export const dashboardAPI = {
  getOverview: () => api.get('/dashboard/overview'),
  getQuickStats: () => api.get('/dashboard/quick-stats'),
  getNotifications: () => api.get('/dashboard/notifications'),
  markNotificationRead: (id) => api.put(`/dashboard/notifications/${id}/read`),
  getRecentProjects: () => api.get('/dashboard/recent-projects'),
  getRecentInvoices: () => api.get('/dashboard/recent-invoices'),
};

// Clients API
export const clientsAPI = {
  getAll: (params) => api.get('/clients', { params }),
  getById: (id) => api.get(`/clients/${id}`),
  create: (data) => api.post('/clients', data),
  update: (id, data) => api.put(`/clients/${id}`, data),
  delete: (id) => api.delete(`/clients/${id}`),
  getStats: () => api.get('/clients/stats/overview'),
};

// Projects API
export const projectsAPI = {
  getAll: (params) => api.get('/projects', { params }),
  getById: (id) => api.get(`/projects/${id}`),
  create: (data) => api.post('/projects', data),
  update: (id, data) => api.put(`/projects/${id}`, data),
  delete: (id) => api.delete(`/projects/${id}`),
  getStats: () => api.get('/projects/stats/overview'),
};

// Quotations API
export const quotationsAPI = {
  getAll: (params) => api.get('/quotations', { params }),
  getById: (id) => api.get(`/quotations/${id}`),
  create: (data) => api.post('/quotations', data),
  update: (id, data) => api.put(`/quotations/${id}`, data),
  delete: (id) => api.delete(`/quotations/${id}`),
  convertToInvoice: (id) => api.post(`/quotations/${id}/convert-to-invoice`),
};

// Invoices API
export const invoicesAPI = {
  getAll: (params) => api.get('/invoices', { params }),
  getById: (id) => api.get(`/invoices/${id}`),
  create: (data) => api.post('/invoices', data),
  update: (id, data) => api.put(`/invoices/${id}`, data),
  delete: (id) => api.delete(`/invoices/${id}`),
  markAsPaid: (id, data) => api.put(`/invoices/${id}/mark-paid`, data),
  recordPayment: (id, data) => api.post(`/invoices/${id}/payment`, data),
  download: (id) => api.get(`/invoices/${id}/download`, { responseType: 'blob' }),
};

// Files API
export const filesAPI = {
  getAll: (params) => api.get('/files', { params }),
  getById: (id) => api.get(`/files/${id}`),
  upload: (formData) => api.post('/files/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  }),
  update: (id, data) => api.put(`/files/${id}`, data),
  delete: (id) => api.delete(`/files/${id}`),
  download: (id) => api.get(`/files/${id}/download`, { responseType: 'blob' }),
};

// Credentials API
export const credentialsAPI = {
  getAll: (params) => api.get('/credentials', { params }),
  getById: (id) => api.get(`/credentials/${id}`),
  create: (data) => api.post('/credentials', data),
  update: (id, data) => api.put(`/credentials/${id}`, data),
  delete: (id) => api.delete(`/credentials/${id}`),
};

// Conversations API
export const conversationsAPI = {
  getAll: (params) => api.get('/conversations', { params }),
  getById: (id) => api.get(`/conversations/${id}`),
  create: (data) => api.post('/conversations', data),
  update: (id, data) => api.put(`/conversations/${id}`, data),
  delete: (id) => api.delete(`/conversations/${id}`),
};

// Users API
export const usersAPI = {
  getAll: (params) => api.get('/users', { params }),
  getById: (id) => api.get(`/users/${id}`),
  create: (data) => api.post('/users', data),
  update: (id, data) => api.put(`/users/${id}`, data),
  delete: (id) => api.delete(`/users/${id}`),
  assignProjects: (id, projectIds) => api.post(`/users/${id}/projects`, { project_ids: projectIds }),
};

// Roles API
export const rolesAPI = {
  getAll: () => api.get('/roles'),
  getById: (id) => api.get(`/roles/${id}`),
  create: (data) => api.post('/roles', data),
  update: (id, data) => api.put(`/roles/${id}`, data),
  delete: (id) => api.delete(`/roles/${id}`),
  getPermissions: () => api.get('/roles/permissions/list'),
  updatePermissions: (id, permissionIds) => api.put(`/roles/${id}/permissions`, { permission_ids: permissionIds }),
  assignToUser: (id, userId) => api.post(`/roles/${id}/assign-user`, { user_id: userId }),
  removeFromUser: (id, userId) => api.delete(`/roles/${id}/assign-user/${userId}`),
};

// Reports API
export const reportsAPI = {
  getFinancial: (params) => api.get('/reports/financial', { params }),
  getClientPerformance: (params) => api.get('/reports/client-performance', { params }),
  getProjectPerformance: (params) => api.get('/reports/project-performance', { params }),
  getInvoices: (params) => api.get('/reports/invoices', { params }),
  getSummary: () => api.get('/reports/summary'),
};

// Health check
export const healthAPI = {
  check: () => api.get('/health'),
};

// Project Management API
export const pmAPI = {
  // Workspaces
  getWorkspaces: () => api.get('/pm/workspaces'),
  getWorkspaceById: (id) => api.get(`/pm/workspaces/${id}`),
  getWorkspaceByProject: (projectId) => api.get(`/pm/workspaces/project/${projectId}`),
  createWorkspace: (data) => api.post('/pm/workspaces', data),
  updateWorkspace: (id, data) => api.put(`/pm/workspaces/${id}`, data),
  deleteWorkspace: (id) => api.delete(`/pm/workspaces/${id}`),
  // User Stories
  getUserStories: (workspaceId, params) => api.get(`/pm/user-stories/workspace/${workspaceId}`, { params }),
  getUserStoryById: (id) => api.get(`/pm/user-stories/${id}`),
  createUserStory: (data) => api.post('/pm/user-stories', data),
  updateUserStory: (id, data) => api.put(`/pm/user-stories/${id}`, data),
  deleteUserStory: (id) => api.delete(`/pm/user-stories/${id}`),
  // Tasks
  getTasks: (storyId) => api.get(`/pm/tasks/user-story/${storyId}`),
  getTaskById: (id) => api.get(`/pm/tasks/${id}`),
  createTask: (data) => api.post('/pm/tasks', data),
  updateTask: (id, data) => api.put(`/pm/tasks/${id}`, data),
  deleteTask: (id) => api.delete(`/pm/tasks/${id}`),
  // Comments
  getComments: (entityType, entityId) => api.get(`/pm/comments/${entityType}/${entityId}`),
  createComment: (entityType, entityId, data) => api.post(`/pm/comments/${entityType}/${entityId}`, data),
  updateComment: (id, data) => api.put(`/pm/comments/${id}`, data),
  deleteComment: (id) => api.delete(`/pm/comments/${id}`),
  // Sprints
  getSprints: (workspaceId, params) => api.get(`/pm/sprints/workspace/${workspaceId}`, { params }),
  getSprintById: (id) => api.get(`/pm/sprints/${id}`),
  getSprintBurndown: (id) => api.get(`/pm/sprints/${id}/burndown`),
  createSprint: (data) => api.post('/pm/sprints', data),
  updateSprint: (id, data) => api.put(`/pm/sprints/${id}`, data),
  deleteSprint: (id) => api.delete(`/pm/sprints/${id}`),
  startSprint: (id) => api.post(`/pm/sprints/${id}/start`),
  completeSprint: (id) => api.post(`/pm/sprints/${id}/complete`),
  // Reports
  getVelocity: (workspaceId) => api.get(`/pm/reports/workspace/${workspaceId}/velocity`),
  getCycleTime: (workspaceId) => api.get(`/pm/reports/workspace/${workspaceId}/cycle-time`),
  getThroughput: (workspaceId) => api.get(`/pm/reports/workspace/${workspaceId}/throughput`),
  getCumulativeFlow: (workspaceId, params) => api.get(`/pm/reports/workspace/${workspaceId}/cumulative-flow`, { params }),
  getWorkload: (workspaceId) => api.get(`/pm/reports/workspace/${workspaceId}/workload`),
  getSummary: (workspaceId) => api.get(`/pm/reports/workspace/${workspaceId}/summary`),
  // Settings
  getWorkspaceSettings: (workspaceId) => api.get(`/pm/settings/workspace/${workspaceId}`),
  updateWorkspaceSettings: (workspaceId, data) => api.put(`/pm/settings/workspace/${workspaceId}`, data),
  addWorkspaceMember: (workspaceId, data) => api.post(`/pm/settings/workspace/${workspaceId}/members`, data),
  updateWorkspaceMember: (workspaceId, memberId, data) => api.put(`/pm/settings/workspace/${workspaceId}/members/${memberId}`, data),
  removeWorkspaceMember: (workspaceId, memberId) => api.delete(`/pm/settings/workspace/${workspaceId}/members/${memberId}`),
  getUsersForWorkspace: (workspaceId, search) => api.get('/pm/settings/users', { params: { workspace_id: workspaceId, search } }),
  // Epics
  getEpics: (workspaceId, params) => api.get(`/pm/epics/workspace/${workspaceId}`, { params }),
  getEpicById: (id) => api.get(`/pm/epics/${id}`),
  createEpic: (data) => api.post('/pm/epics', data),
  updateEpic: (id, data) => api.put(`/pm/epics/${id}`, data),
  deleteEpic: (id) => api.delete(`/pm/epics/${id}`),
  // Time Logs
  getTimeLogsByTask: (taskId) => api.get(`/pm/time-logs/task/${taskId}`),
  getTimeLogsByUserStory: (storyId) => api.get(`/pm/time-logs/user-story/${storyId}`),
  getTimeLogsByWorkspace: (workspaceId, params) => api.get(`/pm/time-logs/workspace/${workspaceId}`, { params }),
  createTimeLog: (data) => api.post('/pm/time-logs', data),
  updateTimeLog: (id, data) => api.put(`/pm/time-logs/${id}`, data),
  deleteTimeLog: (id) => api.delete(`/pm/time-logs/${id}`),
  // Attachments
  getAttachments: (entityType, entityId) => api.get(`/pm/attachments/${entityType}/${entityId}`),
  uploadAttachment: (entityType, entityId, formData) => api.post(`/pm/attachments/${entityType}/${entityId}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  downloadAttachment: (id) => api.get(`/pm/attachments/download/${id}`, { responseType: 'blob' }),
  deleteAttachment: (id) => api.delete(`/pm/attachments/${id}`),
  // Task Links
  getTaskLinks: (taskId) => api.get(`/pm/task-links/task/${taskId}`),
  getAvailableTasksForLinking: (taskId, search) => api.get(`/pm/task-links/available/${taskId}`, { params: { search } }),
  createTaskLink: (data) => api.post('/pm/task-links', data),
  deleteTaskLink: (id) => api.delete(`/pm/task-links/${id}`),
  // Activities
  getActivities: (workspaceId, params) => api.get(`/pm/activities/workspace/${workspaceId}`, { params }),
  getEntityActivities: (entityType, entityId) => api.get(`/pm/activities/entity/${entityType}/${entityId}`),
  getRecentActivities: (workspaceId, limit) => api.get(`/pm/activities/workspace/${workspaceId}/recent`, { params: { limit } }),
  // CI/CD
  getCicdIntegrations: (workspaceId) => api.get(`/pm/cicd/workspace/${workspaceId}`),
  getCicdIntegration: (id) => api.get(`/pm/cicd/${id}`),
  createCicdIntegration: (data) => api.post('/pm/cicd', data),
  updateCicdIntegration: (id, data) => api.put(`/pm/cicd/${id}`, data),
  deleteCicdIntegration: (id) => api.delete(`/pm/cicd/${id}`),
  getTaskCicdLinks: (taskId) => api.get(`/pm/cicd/task/${taskId}/links`),
  createTaskCicdLink: (taskId, data) => api.post(`/pm/cicd/task/${taskId}/links`, data),
  updateTaskCicdLink: (linkId, data) => api.put(`/pm/cicd/links/${linkId}`, data),
  deleteTaskCicdLink: (linkId) => api.delete(`/pm/cicd/links/${linkId}`),
  // Reference Numbers
  lookupReference: (referenceNumber) => api.get(`/pm/reference/${referenceNumber}`),
  // Chat
  getChatRoom: (workspaceId) => api.get(`/pm/chat/workspace/${workspaceId}/room`),
  getChatMessages: (roomId, params) => api.get(`/pm/chat/room/${roomId}/messages`, { params }),
  sendChatMessage: (roomId, data) => api.post(`/pm/chat/room/${roomId}/messages`, data),
  markMessagesAsRead: (roomId, messageIds) => api.post(`/pm/chat/room/${roomId}/messages/read`, { message_ids: messageIds }),
  getWorkspaceMembersForMentions: (workspaceId, search) => api.get(`/pm/chat/workspace/${workspaceId}/members`, { params: { search } }),
  getUnreadMessageCount: (roomId) => api.get(`/pm/chat/room/${roomId}/unread-count`),
  // Assignments
  getAssignableUsers: (workspaceId, search) => api.get(`/pm/assignments/workspace/${workspaceId}/users`, { params: { search } }),
  assignUserStory: (storyId, assigneeId) => api.post(`/pm/assignments/user-stories/${storyId}/assign`, { assignee_id: assigneeId }),
  assignTask: (taskId, assigneeId) => api.post(`/pm/assignments/tasks/${taskId}/assign`, { assignee_id: assigneeId }),
  getAssignmentHistory: (entityType, entityId) => api.get(`/pm/assignments/history/${entityType}/${entityId}`),
};

// Settings API
export const settingsAPI = {
  getSettings: () => api.get('/settings'),
  updateSmtpSettings: (data) => api.put('/settings/smtp', data),
  testSmtpConnection: (data) => api.post('/settings/smtp/test', data),
};

export default api;
