const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { initDatabase } = require('./models/schema');
const { initDetectionRules } = require('./services/detectionEngine');
const { runAdminMigrations } = require('./models/adminMigrations');
const { runComplianceMigrations } = require('./models/complianceMigrations');
const { runMigrations } = require('./models/migrations');

const authRoutes = require('./routes/authRoutes');
const dataRoutes = require('./routes/dataRoutes');
const detectionRoutes = require('./routes/detectionRoutes');
const alertRoutes = require('./routes/alertRoutes');
const networkRoutes = require('./routes/networkRoutes');
const caseRoutes = require('./routes/caseRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const reportRoutes = require('./routes/reportRoutes');
const auditRoutes = require('./routes/auditRoutes');
const adminRoutes = require('./routes/adminRoutes');
const complianceRoutes = require('./routes/complianceRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

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
app.use('/api/admin', adminRoutes);
app.use('/api/compliance', complianceRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    platform: 'Financial Crime Intelligence Platform (FCIP)',
    version: '2.4.0',
    phases_supported: 'Full Enterprise Architecture + Dedicated Admin & Audit Engine',
    timestamp: new Date().toISOString(),
  });
});

// Initialize database and start server
const startServer = async () => {
  try {
    await initDatabase();
    await runMigrations();
    await runAdminMigrations();
    await runComplianceMigrations();
    await initDetectionRules();
    app.listen(PORT, () => {
      console.log(`====================================================`);
      console.log(` FCIP Intelligence Backend Online - Port ${PORT}`);
      console.log(` Health:    http://localhost:${PORT}/api/health`);
      console.log(` Endpoints: Auth, Admin, Data, Detection, Alerts, Network, Cases, Dashboard, Reports, Audit`);
      console.log(`====================================================`);
    });
  } catch (error) {
    console.error('Fatal: Could not initialize database before server start', error);
    process.exit(1);
  }
};

startServer();
