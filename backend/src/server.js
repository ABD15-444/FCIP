const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { initDatabase } = require('./models/schema');
const { initDetectionRules } = require('./services/detectionEngine');
const { auditMiddleware, logAudit } = require('./middleware/audit');

const authRoutes = require('./routes/authRoutes');
const dataRoutes = require('./routes/dataRoutes');
const detectionRoutes = require('./routes/detectionRoutes');
const alertRoutes = require('./routes/alertRoutes');
const networkRoutes = require('./routes/networkRoutes');
const caseRoutes = require('./routes/caseRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const reportRoutes = require('./routes/reportRoutes');
const auditRoutes = require('./routes/auditRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Phase 8 Global Automatic Audit Interceptors for state mutations
app.use('/api/alerts/:id/status', auditMiddleware('ALERT_STATUS_UPDATE', 'alert'));
app.use('/api/cases', (req, res, next) => {
  if (req.method === 'POST') return auditMiddleware('CASE_CREATED', 'case')(req, res, next);
  if (req.method === 'PUT') return auditMiddleware('CASE_UPDATED', 'case')(req, res, next);
  next();
});
app.use('/api/reports/generate', auditMiddleware('REPORT_GENERATED', 'report'));
app.use('/api/detection/rules', (req, res, next) => {
  if (req.method === 'POST') return auditMiddleware('RULE_CREATED', 'detection_rule')(req, res, next);
  next();
});

// Mounted Routes
app.use('/api/auth', authRoutes);
app.use('/api', dataRoutes); // /upload, /transactions, /customers, /accounts
app.use('/api/detection', detectionRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/network', networkRoutes);
app.use('/api/cases', caseRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/audit', auditRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    platform: 'Financial Crime Intelligence Platform (FCIP)',
    version: '2.0.0',
    phases_supported: 'Phase 1 - Phase 8 Complete',
    timestamp: new Date().toISOString(),
  });
});

// Initialize database and start server
const startServer = async () => {
  try {
    await initDatabase();
    await initDetectionRules();
    app.listen(PORT, () => {
      console.log(`====================================================`);
      console.log(` FCIP Intelligence Backend Online - Port ${PORT}`);
      console.log(` Health:    http://localhost:${PORT}/api/health`);
      console.log(` Endpoints: Auth, Data, Detection, Alerts, Network, Cases, Dashboard, Reports, Audit`);
      console.log(`====================================================`);
    });
  } catch (error) {
    console.error('Fatal: Could not initialize database before server start', error);
    process.exit(1);
  }
};

startServer();
