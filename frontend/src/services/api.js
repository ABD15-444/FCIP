import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('fcip_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('fcip_token');
      localStorage.removeItem('fcip_user');
      window.dispatchEvent(new Event('authChange'));
    }
    return Promise.reject(error);
  }
);

// Unified Platform Services for all 8 Phases
export const authService = {
  login: async (email, password) => (await api.post('/auth/login', { email, password })).data,
  register: async (userData) => (await api.post('/auth/register', userData)).data,
  getProfile: async () => (await api.get('/auth/profile')).data,
};

export const dataService = {
  uploadCSV: async (formData) => (await api.post('/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })).data,
  getTransactions: async (params) => (await api.get('/transactions', { params })).data,
  getCustomers: async () => (await api.get('/customers')).data,
  getAccounts: async () => (await api.get('/accounts')).data,
};

export const detectionService = {
  runDetection: async () => (await api.post('/detection/run')).data,
  getRules: async () => (await api.get('/detection/rules')).data,
  createRule: async (ruleData) => (await api.post('/detection/rules', ruleData)).data,
  getRiskScore: async (entityType, entityId) => (await api.get(`/detection/risk/${entityType}/${entityId}`)).data,
};

export const alertService = {
  getAlerts: async (params) => (await api.get('/alerts', { params })).data,
  getAlertDetail: async (id) => (await api.get(`/alerts/${id}`)).data,
  updateStatus: async (id, status) => (await api.put(`/alerts/${id}/status`, { status })).data,
  assignAlert: async (id, userId) => (await api.post(`/alerts/${id}/assign`, { userId })).data,
};

export const networkService = {
  getGraph: async (accountId) => (await api.get(`/network/graph/${accountId}`)).data,
  getMoneyFlow: async (accountId) => (await api.get(`/network/money-flow/${accountId}`)).data,
};

export const caseService = {
  getCases: async (params) => (await api.get('/cases', { params })).data,
  createCase: async (caseData) => (await api.post('/cases', caseData)).data,
  getCaseDetail: async (id) => (await api.get(`/cases/${id}`)).data,
  updateCase: async (id, data) => (await api.put(`/cases/${id}`, data)).data,
  addNote: async (id, note_text) => (await api.post(`/cases/${id}/notes`, { note_text })).data,
  assignCase: async (id, userId) => (await api.post(`/cases/${id}/assign`, { userId })).data,
  getHistory: async (id) => (await api.get(`/cases/${id}/history`)).data,
};

export const dashboardService = {
  getStats: async () => (await api.get('/dashboard/stats')).data,
  getRiskChart: async () => (await api.get('/dashboard/risk-chart')).data,
  getTransactionVolume: async () => (await api.get('/dashboard/transaction-volume')).data,
  getRecentAlerts: async () => (await api.get('/dashboard/recent-alerts')).data,
};

export const reportService = {
  generateReport: async (case_id, title) => (await api.post('/reports/generate', { case_id, title })).data,
  getReports: async () => (await api.get('/reports')).data,
  getExportUrl: (id) => `${API_BASE_URL}/reports/${id}/export`,
};

export const auditService = {
  getLogs: async (params) => (await api.get('/audit/logs', { params })).data,
};

export default api;
