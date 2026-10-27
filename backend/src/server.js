const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { initDatabase } = require('./models/schema');
const authRoutes = require('./routes/authRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// API Routes
app.use('/api/auth', authRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    platform: 'Financial Crime Intelligence Platform (FCIP)',
    version: '1.0.0',
    phase: 'Phase 1 - Project Setup & Authentication',
    timestamp: new Date().toISOString(),
  });
});

// Initialize database and start server
const startServer = async () => {
  try {
    await initDatabase();
    app.listen(PORT, () => {
      console.log(`====================================================`);
      console.log(` FCIP Backend is running on port ${PORT}`);
      console.log(` Health: http://localhost:${PORT}/api/health`);
      console.log(` Auth:   http://localhost:${PORT}/api/auth`);
      console.log(`====================================================`);
    });
  } catch (error) {
    console.error('Fatal: Could not initialize database before server start', error);
    process.exit(1);
  }
};

startServer();
