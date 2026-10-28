import axios from 'axios';

const API_BASE = '/api';

// Create Axios Instance
const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor for JWT Bearer Token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('fcip_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Authentication Services
export const authService = {
  login: async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    return res.data;
  },
  register: async (userData) => {
    const res = await api.post('/auth/register', userData);
    return res.data;
  },
  getCurrentUser: async () => {
    const res = await api.get('/auth/me');
    return res.data;
  },
};

// Administrator Services (Phase 2, 4, 5, 6, 8, 9)
export const adminService = {
  getStats: async () => {
    const res = await api.get('/admin/stats');
    return res.data;
  },
  getUsers: async (params = {}) => {
    const res = await api.get('/admin/users', { params });
    return res.data;
  },
  createUser: async (userData) => {
    const res = await api.post('/admin/users', userData);
    return res.data;
  },
  updateUser: async (id, userData) => {
    const res = await api.put(`/admin/users/${id}`, userData);
    return res.data;
  },
  resetUserPassword: async (id, new_password) => {
    const res = await api.post(`/admin/users/${id}/reset-password`, { new_password });
    return res.data;
  },
  getRulesWithHistory: async () => {
    const res = await api.get('/admin/rules');
    return res.data;
  },
  updateRule: async (id, ruleData) => {
    const res = await api.put(`/admin/rules/${id}`, ruleData);
    return res.data;
  },
  getDataHistory: async () => {
    const res = await api.get('/admin/data-history');
    return res.data;
  },
  getSystemHealth: async () => {
    const res = await api.get('/admin/health');
    return res.data;
  },
};

// Data Management Services
export const dataService = {
  uploadCSV: async (formData) => {
    const res = await api.post('/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },
  getTransactions: async (params = {}) => {
    const res = await api.get('/transactions', { params });
    return res.data;
  },
  getTransactionDetail: async (id) => {
    const res = await api.get(`/transactions/${id}`);
    return res.data;
  },
  evaluateTransaction: async (id) => {
    const res = await api.post(`/transactions/${id}/evaluate`);
    return res.data;
  },
  getCustomers: async () => {
    const res = await api.get('/customers');
    return res.data;
  },
  getAccounts: async () => {
    const res = await api.get('/accounts');
    return res.data;
  },
};

// Detection Engine Services
export const detectionService = {
  runDetection: async () => {
    const res = await api.post('/detection/run');
    return res.data;
  },
  getRules: async () => {
    const res = await api.get('/detection/rules');
    return res.data;
  },
  createRule: async (ruleData) => {
    const res = await api.post('/detection/rules', ruleData);
    return res.data;
  },
  getRiskScore: async (entityType, entityId) => {
    const res = await api.get(`/detection/risk/${entityType}/${entityId}`);
    return res.data;
  },
};

// Alert System Services
export const alertService = {
  getAlerts: async (params = {}) => {
    const res = await api.get('/alerts', { params });
    return res.data;
  },
  getAlertDetail: async (id) => {
    const res = await api.get(`/alerts/${id}`);
    return res.data;
  },
  updateStatus: async (id, status, details = {}) => {
    const res = await api.put(`/alerts/${id}/status`, { status, ...details });
    return res.data;
  },
  assignAlert: async (id, userId) => {
    const res = await api.post(`/alerts/${id}/assign`, { userId });
    return res.data;
  },
};

// Network Graph Services
export const networkService = {
  getGraph: async (accountId) => {
    const res = await api.get(`/network/graph/${accountId}`);
    return res.data;
  },
  getMoneyFlow: async (accountId) => {
    const res = await api.get(`/network/money-flow/${accountId}`);
    return res.data;
  },
};

// Case Management Services
export const caseService = {
  getCases: async (params = {}) => {
    const res = await api.get('/cases', { params });
    return res.data;
  },
  createCase: async (caseData) => {
    const res = await api.post('/cases', caseData);
    return res.data;
  },
  getCaseDetail: async (id) => {
    const res = await api.get(`/cases/${id}`);
    return res.data;
  },
  updateCase: async (id, updateData) => {
    const res = await api.put(`/cases/${id}`, updateData);
    return res.data;
  },
  addNote: async (id, note_text) => {
    const res = await api.post(`/cases/${id}/notes`, { note_text });
    return res.data;
  },
};

// Dashboard & Reports Services
export const dashboardService = {
  getStats: async (params = {}) => {
    const res = await api.get('/dashboard/stats', { params });
    return res.data;
  },
  getRiskChart: async () => {
    const res = await api.get('/dashboard/risk-chart');
    return res.data;
  },
  getTransactionVolume: async (params = {}) => {
    const res = await api.get('/dashboard/transaction-volume', { params });
    return res.data;
  },
  getRecentAlerts: async () => {
    const res = await api.get('/dashboard/recent-alerts');
    return res.data;
  },
  getSystemHealth: async () => {
    const res = await api.get('/health');
    return res.data;
  },
};

export const reportService = {
  generateReport: async (case_id, title, is_official_sar = false) => {
    const res = await api.post('/reports/generate', { case_id, title, is_official_sar });
    return res.data;
  },
  getReports: async () => {
    const res = await api.get('/reports');
    return res.data;
  },
  // Authenticated download: sends Bearer token, receives HTML blob, triggers browser download.
  // Do NOT use window.open() or <a href> — they strip the Authorization header.
  downloadExport: async (id, filename = `fcip-report-${id}.html`) => {
    const res = await api.get(`/reports/${id}/export`, {
      responseType: 'blob',
    });

    // Detect if server returned a JSON error packed inside a Blob
    if (res.data.type === 'application/json' || res.data.type === 'text/plain') {
      const text = await res.data.text();
      let parsed;
      try { parsed = JSON.parse(text); } catch { parsed = { message: text }; }
      throw new Error(parsed.message || 'Report export failed.');
    }

    const url = URL.createObjectURL(res.data);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  },
  // Kept for backward compatibility — no longer used for authenticated download
  getExportUrl: (id) => `${API_BASE}/reports/${id}/export`,
};

// Audit Trail Services
export const auditService = {
  getLogs: async (params = {}) => {
    const res = await api.get('/audit', { params });
    return res.data;
  },
  getActions: async () => {
    const res = await api.get('/audit/actions');
    return res.data;
  },
};

// Compliance Officer Services
export const complianceService = {
  getStats: async (params = {}) => {
    const res = await api.get('/compliance/stats', { params });
    return res.data;
  },
  getQueue: async (params = {}) => {
    const res = await api.get('/compliance/queue', { params });
    return res.data;
  },
  submitCase: async (id, payload) => {
    const res = await api.post(`/compliance/cases/${id}/submit`, payload);
    return res.data;
  },
  makeCaseDecision: async (id, payload) => {
    const res = await api.post(`/compliance/cases/${id}/decision`, payload);
    return res.data;
  },
  getReports: async (params = {}) => {
    const res = await api.get('/compliance/reports', { params });
    return res.data;
  },
  makeReportDecision: async (id, payload) => {
    const res = await api.post(`/compliance/reports/${id}/decision`, payload);
    return res.data;
  },
  getRiskOversight: async () => {
    const res = await api.get('/compliance/risk-oversight');
    return res.data;
  },
  getAuditHistory: async (params = {}) => {
    const res = await api.get('/compliance/audit-history', { params });
    return res.data;
  },
};

export default api;
