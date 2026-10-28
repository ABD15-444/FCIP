const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { logAudit } = require('../middleware/audit');

const SALT_ROUNDS = 10;
const VALID_ROLES = ['investigator', 'admin', 'compliance_officer'];

// Register new user
const register = async (req, res) => {
  try {
    const { first_name, last_name, email, password, role } = req.body;

    if (!first_name || !last_name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'First name, last name, email, and password are required.',
      });
    }

    const assignedRole = role || 'investigator';
    if (!VALID_ROLES.includes(assignedRole)) {
      return res.status(400).json({
        success: false,
        message: `Invalid role. Allowed roles are: ${VALID_ROLES.join(', ')}`,
      });
    }

    // Check if user already exists
    const existingUserResult = await db.query(
      'SELECT id FROM users WHERE LOWER(email) = LOWER($1)',
      [email.trim()]
    );

    if (existingUserResult.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'A user with this email address already exists.',
      });
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, SALT_ROUNDS);

    // Insert user
    const insertResult = await db.query(
      `INSERT INTO users (first_name, last_name, email, password_hash, role, status)
       VALUES ($1, $2, $3, $4, $5, 'active')
       RETURNING id, first_name, last_name, email, role, status, created_at`,
      [first_name.trim(), last_name.trim(), email.trim().toLowerCase(), password_hash, assignedRole]
    );

    const newUser = insertResult.rows[0];

    // Log registration
    await logAudit({
      userId: newUser.id,
      userRole: newUser.role,
      action: 'USER_REGISTERED',
      entityType: 'user',
      entityId: newUser.id,
      ipAddress: req.ip,
      outcome: 'SUCCESS',
      details: { email: newUser.email, role: newUser.role },
    });

    // Generate JWT token
    const token = jwt.sign(
      {
        id: newUser.id,
        email: newUser.email,
        role: newUser.role,
        first_name: newUser.first_name,
        last_name: newUser.last_name,
      },
      process.env.JWT_SECRET || 'fcip_super_secret_jwt_key_2026_financial_crime_intel',
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    return res.status(201).json({
      success: true,
      message: 'User registered successfully.',
      token,
      user: newUser,
    });
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while registering user.',
    });
  }
};

// Login user
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required.',
      });
    }

    const userResult = await db.query(
      'SELECT id, first_name, last_name, email, password_hash, role, status, created_at FROM users WHERE LOWER(email) = LOWER($1)',
      [email.trim()]
    );

    if (userResult.rows.length === 0) {
      await logAudit({
        userId: null,
        userRole: null,
        action: 'USER_LOGIN_FAILED',
        entityType: 'auth',
        ipAddress: req.ip,
        outcome: 'FAILURE',
        details: { attemptedEmail: email.trim(), reason: 'User not found' },
      });

      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    const user = userResult.rows[0];

    if (user.status !== 'active') {
      await logAudit({
        userId: user.id,
        userRole: user.role,
        action: 'USER_LOGIN_FAILED',
        entityType: 'auth',
        entityId: user.id,
        ipAddress: req.ip,
        outcome: 'FAILURE',
        details: { email: user.email, reason: `Account status is ${user.status}` },
      });

      return res.status(403).json({
        success: false,
        message: `Account is ${user.status}. Please contact administrator.`,
      });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      await logAudit({
        userId: user.id,
        userRole: user.role,
        action: 'USER_LOGIN_FAILED',
        entityType: 'auth',
        entityId: user.id,
        ipAddress: req.ip,
        outcome: 'FAILURE',
        details: { email: user.email, reason: 'Invalid password credentials' },
      });

      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        first_name: user.first_name,
        last_name: user.last_name,
      },
      process.env.JWT_SECRET || 'fcip_super_secret_jwt_key_2026_financial_crime_intel',
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    await logAudit({
      userId: user.id,
      userRole: user.role,
      action: 'USER_LOGIN_SUCCESS',
      entityType: 'auth',
      entityId: user.id,
      ipAddress: req.ip,
      outcome: 'SUCCESS',
      details: { email: user.email, role: user.role },
    });

    const { password_hash, ...safeUser } = user;

    return res.status(200).json({
      success: true,
      message: 'Logged in successfully.',
      token,
      user: safeUser,
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while logging in.',
    });
  }
};

// Get current profile
const getProfile = async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, first_name, last_name, email, role, status, created_at FROM users WHERE id = $1',
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found.',
      });
    }

    return res.status(200).json({
      success: true,
      user: result.rows[0],
    });
  } catch (error) {
    console.error('Profile fetch error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while fetching profile.',
    });
  }
};

module.exports = {
  register,
  login,
  getProfile,
};
