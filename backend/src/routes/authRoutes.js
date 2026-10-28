const express = require('express');
const router = express.Router();
const { register, login, getProfile } = require('../controllers/authController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

// Public routes
router.post('/register', register);
router.post('/login', login);

// Protected routes
router.get('/profile', authenticateToken, getProfile);
router.get('/me', authenticateToken, getProfile);

// Role testing demo route
router.get('/investigator-zone', authenticateToken, authorizeRoles('investigator', 'admin'), (req, res) => {
  res.json({ success: true, message: 'Welcome to Investigator Workspace', user: req.user });
});

router.get('/admin-zone', authenticateToken, authorizeRoles('admin'), (req, res) => {
  res.json({ success: true, message: 'Welcome to Admin Control Center', user: req.user });
});

router.get('/compliance-zone', authenticateToken, authorizeRoles('compliance_officer', 'admin'), (req, res) => {
  res.json({ success: true, message: 'Welcome to Compliance Vault', user: req.user });
});

module.exports = router;
