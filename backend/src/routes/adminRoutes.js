const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const db = require('../config/db');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const { logAudit } = require('../middleware/audit');

const SALT_ROUNDS = 10;
const VALID_ROLES = ['investigator', 'admin', 'compliance_officer'];
const VALID_STATUSES = ['active', 'suspended', 'inactive'];

// GET /api/admin/stats - Dedicated Admin summary telemetry
router.get('/stats', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const userStats = await db.query(`
      SELECT
        COUNT(*) as total_users,
        COUNT(*) FILTER (WHERE status = 'active') as active_users,
        COUNT(*) FILTER (WHERE status != 'active') as inactive_users,
        COUNT(*) FILTER (WHERE role = 'admin') as admin_count,
        COUNT(*) FILTER (WHERE role = 'investigator') as investigator_count,
        COUNT(*) FILTER (WHERE role = 'compliance_officer') as compliance_count
      FROM users
    `);

    const txStats = await db.query('SELECT COUNT(*) as total_transactions FROM transactions');
    const ingestStats = await db.query('SELECT COUNT(*) as total_ingests FROM dataset_ingest_history');
    const detectionStats = await db.query(`
      SELECT 
        COUNT(*) as total_runs,
        COUNT(*) FILTER (WHERE status = 'FAILED') as failed_runs
      FROM detection_run_history
    `);

    const openAlerts = await db.query("SELECT COUNT(*) as open_alerts FROM alerts WHERE status != 'closed'");
    const openCases = await db.query("SELECT COUNT(*) as open_cases FROM cases WHERE status != 'closed'");
    const totalAuditEvents = await db.query('SELECT COUNT(*) as total_events FROM audit_logs');

    // Recent administrative actions
    const recentActivity = await db.query(`
      SELECT l.*, u.first_name, u.last_name, u.email
      FROM audit_logs l
      LEFT JOIN users u ON l.user_id = u.id
      ORDER BY l.timestamp DESC
      LIMIT 6
    `);

    res.status(200).json({
      success: true,
      stats: {
        users: {
          total: parseInt(userStats.rows[0].total_users, 10),
          active: parseInt(userStats.rows[0].active_users, 10),
          inactive: parseInt(userStats.rows[0].inactive_users, 10),
          byRole: {
            admin: parseInt(userStats.rows[0].admin_count, 10),
            investigator: parseInt(userStats.rows[0].investigator_count, 10),
            compliance_officer: parseInt(userStats.rows[0].compliance_count, 10),
          },
        },
        transactions: {
          total: parseInt(txStats.rows[0].total_transactions, 10),
          totalIngests: parseInt(ingestStats.rows[0].total_ingests, 10),
        },
        detection: {
          totalRuns: parseInt(detectionStats.rows[0].total_runs, 10),
          failedRuns: parseInt(detectionStats.rows[0].failed_runs, 10),
        },
        security: {
          openAlerts: parseInt(openAlerts.rows[0].open_alerts, 10),
          openCases: parseInt(openCases.rows[0].open_cases, 10),
          auditEventCount: parseInt(totalAuditEvents.rows[0].total_events, 10),
        },
      },
      recentActivity: recentActivity.rows,
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve administrator statistics.' });
  }
});

// GET /api/admin/users - Search, filter, pagination of users
router.get('/users', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const { search, role, status, limit = 20, offset = 0 } = req.query;

    let baseQuery = 'FROM users WHERE 1=1';
    const params = [];

    if (search) {
      params.push(`%${search.trim()}%`);
      const pIdx = params.length;
      baseQuery += ` AND (first_name ILIKE $${pIdx} OR last_name ILIKE $${pIdx} OR email ILIKE $${pIdx})`;
    }

    if (role && role !== 'all') {
      params.push(role);
      baseQuery += ` AND role = $${params.length}`;
    }

    if (status && status !== 'all') {
      params.push(status);
      baseQuery += ` AND status = $${params.length}`;
    }

    const countRes = await db.query(`SELECT COUNT(*) as total ${baseQuery}`, params);
    const total = parseInt(countRes.rows[0].total, 10);

    const selectQuery = `
      SELECT id, first_name, last_name, email, role, status, created_at
      ${baseQuery}
      ORDER BY id ASC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;
    params.push(parseInt(limit, 10), parseInt(offset, 10));

    const result = await db.query(selectQuery, params);

    res.status(200).json({
      success: true,
      total,
      count: result.rows.length,
      users: result.rows,
    });
  } catch (error) {
    console.error('Fetch users error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve users.' });
  }
});

// POST /api/admin/users - Create new user account with role
router.post('/users', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const { first_name, last_name, email, password, role, status } = req.body;

    if (!first_name || !last_name || !email || !password) {
      return res.status(400).json({ success: false, message: 'First name, last name, email, and password are required.' });
    }

    const assignedRole = role || 'investigator';
    if (!VALID_ROLES.includes(assignedRole)) {
      return res.status(400).json({ success: false, message: `Invalid role. Allowed: ${VALID_ROLES.join(', ')}` });
    }

    const existing = await db.query('SELECT id FROM users WHERE LOWER(email) = LOWER($1)', [email.trim()]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ success: false, message: 'A user with this email address already exists.' });
    }

    const password_hash = await bcrypt.hash(password, SALT_ROUNDS);
    const insertRes = await db.query(
      `INSERT INTO users (first_name, last_name, email, password_hash, role, status)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, first_name, last_name, email, role, status, created_at`,
      [first_name.trim(), last_name.trim(), email.trim().toLowerCase(), password_hash, assignedRole, status || 'active']
    );

    const newUser = insertRes.rows[0];

    await logAudit({
      userId: req.user.id,
      userRole: req.user.role,
      action: 'USER_CREATED',
      entityType: 'user',
      entityId: newUser.id,
      ipAddress: req.ip,
      outcome: 'SUCCESS',
      details: { createdUserId: newUser.id, email: newUser.email, role: newUser.role },
    });

    res.status(201).json({ success: true, message: 'User created successfully.', user: newUser });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ success: false, message: 'Error creating user.' });
  }
});

// PUT /api/admin/users/:id - Update permitted user profile & role
router.put('/users/:id', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const targetUserId = parseInt(req.params.id, 10);
    const { first_name, last_name, email, role, status } = req.body;

    const userRes = await db.query('SELECT * FROM users WHERE id = $1', [targetUserId]);
    if (userRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }
    const current = userRes.rows[0];

    // Protection: Prevent demoting or deactivating the last active administrator
    if (current.role === 'admin' && (role !== 'admin' || (status && status !== 'active'))) {
      const adminCountRes = await db.query("SELECT COUNT(*) FROM users WHERE role = 'admin' AND status = 'active'");
      const adminCount = parseInt(adminCountRes.rows[0].count, 10);
      if (adminCount <= 1) {
        return res.status(400).json({
          success: false,
          message: 'Cannot demote or deactivate the last remaining active Administrator.',
        });
      }
    }

    const fields = [];
    const params = [targetUserId];

    if (first_name) {
      params.push(first_name.trim());
      fields.push(`first_name = $${params.length}`);
    }
    if (last_name) {
      params.push(last_name.trim());
      fields.push(`last_name = $${params.length}`);
    }
    if (email) {
      params.push(email.trim().toLowerCase());
      fields.push(`email = $${params.length}`);
    }
    if (role) {
      if (!VALID_ROLES.includes(role)) {
        return res.status(400).json({ success: false, message: `Invalid role '${role}'.` });
      }
      params.push(role);
      fields.push(`role = $${params.length}`);
    }
    if (status) {
      if (!VALID_STATUSES.includes(status)) {
        return res.status(400).json({ success: false, message: `Invalid status '${status}'.` });
      }
      params.push(status);
      fields.push(`status = $${params.length}`);
    }

    if (fields.length === 0) {
      return res.status(400).json({ success: false, message: 'No fields provided to update.' });
    }

    const updateQuery = `UPDATE users SET ${fields.join(', ')} WHERE id = $1 RETURNING id, first_name, last_name, email, role, status, created_at`;
    const updateRes = await db.query(updateQuery, params);

    await logAudit({
      userId: req.user.id,
      userRole: req.user.role,
      action: 'USER_UPDATED',
      entityType: 'user',
      entityId: targetUserId,
      ipAddress: req.ip,
      outcome: 'SUCCESS',
      details: {
        targetUserId,
        previousRole: current.role,
        newRole: role || current.role,
        previousStatus: current.status,
        newStatus: status || current.status,
      },
    });

    res.status(200).json({ success: true, message: 'User updated successfully.', user: updateRes.rows[0] });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ success: false, message: 'Error updating user.' });
  }
});

// POST /api/admin/users/:id/reset-password - Secure password reset by Administrator
router.post('/users/:id/reset-password', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const targetUserId = parseInt(req.params.id, 10);
    const { new_password } = req.body;

    if (!new_password || new_password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters long.' });
    }

    const userRes = await db.query('SELECT id, email FROM users WHERE id = $1', [targetUserId]);
    if (userRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const password_hash = await bcrypt.hash(new_password, SALT_ROUNDS);
    await db.query('UPDATE users SET password_hash = $1 WHERE id = $2', [password_hash, targetUserId]);

    await logAudit({
      userId: req.user.id,
      userRole: req.user.role,
      action: 'PASSWORD_RESET',
      entityType: 'user',
      entityId: targetUserId,
      ipAddress: req.ip,
      outcome: 'SUCCESS',
      details: { targetUserId, targetEmail: userRes.rows[0].email },
    });

    res.status(200).json({ success: true, message: `Password reset successfully for user #${targetUserId}.` });
  } catch (error) {
    console.error('Password reset error:', error);
    res.status(500).json({ success: false, message: 'Error resetting password.' });
  }
});

// GET /api/admin/rules - Get rules with update audit history
router.get('/rules', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const rulesRes = await db.query('SELECT * FROM detection_rules ORDER BY id ASC');
    const historyRes = await db.query(`
      SELECT h.*, u.first_name, u.last_name, u.email
      FROM detection_rule_history h
      LEFT JOIN users u ON h.changed_by = u.id
      ORDER BY h.changed_at DESC
      LIMIT 50
    `);

    res.status(200).json({
      success: true,
      rules: rulesRes.rows,
      history: historyRes.rows,
    });
  } catch (error) {
    console.error('Admin rules fetch error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve detection rules.' });
  }
});

// PUT /api/admin/rules/:id - Update rule thresholds, status, risk level with history
router.put('/rules/:id', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const ruleId = parseInt(req.params.id, 10);
    const { threshold_value, risk_level, status, change_reason } = req.body;

    const currentRes = await db.query('SELECT * FROM detection_rules WHERE id = $1', [ruleId]);
    if (currentRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Rule not found.' });
    }
    const current = currentRes.rows[0];

    const fields = [];
    const params = [ruleId];

    if (threshold_value !== undefined) {
      const parsed = parseFloat(threshold_value);
      if (isNaN(parsed) || parsed <= 0) {
        return res.status(400).json({ success: false, message: 'Threshold value must be a positive number.' });
      }
      params.push(parsed);
      fields.push(`threshold_value = $${params.length}`);
    }

    if (risk_level) {
      if (!['low', 'medium', 'high'].includes(risk_level.toLowerCase())) {
        return res.status(400).json({ success: false, message: 'Risk level must be low, medium, or high.' });
      }
      params.push(risk_level.toLowerCase());
      fields.push(`risk_level = $${params.length}`);
    }

    if (status) {
      if (!['active', 'inactive'].includes(status.toLowerCase())) {
        return res.status(400).json({ success: false, message: 'Status must be active or inactive.' });
      }
      params.push(status.toLowerCase());
      fields.push(`status = $${params.length}`);
    }

    if (fields.length === 0) {
      return res.status(400).json({ success: false, message: 'No fields provided to update.' });
    }

    const updateQuery = `UPDATE detection_rules SET ${fields.join(', ')} WHERE id = $1 RETURNING *`;
    const updateRes = await db.query(updateQuery, params);
    const updated = updateRes.rows[0];

    // Record change history
    await db.query(
      `INSERT INTO detection_rule_history (rule_id, changed_by, previous_threshold, new_threshold, previous_status, new_status, previous_risk_level, new_risk_level, change_reason)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        ruleId,
        req.user.id,
        current.threshold_value,
        updated.threshold_value,
        current.status,
        updated.status,
        current.risk_level,
        updated.risk_level,
        change_reason || 'Administrative policy recalibration',
      ]
    );

    await logAudit({
      userId: req.user.id,
      userRole: req.user.role,
      action: 'DETECTION_RULE_CONFIGURED',
      entityType: 'detection_rule',
      entityId: ruleId,
      ipAddress: req.ip,
      outcome: 'SUCCESS',
      details: {
        ruleId,
        ruleName: current.rule_name,
        previousThreshold: current.threshold_value,
        newThreshold: updated.threshold_value,
        previousStatus: current.status,
        newStatus: updated.status,
        changeReason: change_reason,
      },
    });

    res.status(200).json({
      success: true,
      message: `Detection rule '${current.rule_name}' updated successfully.`,
      rule: updated,
    });
  } catch (error) {
    console.error('Update rule error:', error);
    res.status(500).json({ success: false, message: 'Failed to update detection rule.' });
  }
});

// GET /api/admin/data-history - Ingestion batches and data quality history
router.get('/data-history', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const ingestRes = await db.query(`
      SELECT h.*, u.first_name, u.last_name, u.email
      FROM dataset_ingest_history h
      LEFT JOIN users u ON h.uploaded_by = u.id
      ORDER BY h.ingested_at DESC
      LIMIT 50
    `);

    // Ingestion quality summaries
    const totalsRes = await db.query(`
      SELECT
        COALESCE(SUM(rows_parsed), 0) as total_rows,
        COALESCE(SUM(transactions_created), 0) as total_txs_created,
        COALESCE(SUM(duplicates_ignored), 0) as total_duplicates_suppressed,
        COALESCE(SUM(rejected_count), 0) as total_rejected_rows
      FROM dataset_ingest_history
    `);

    res.status(200).json({
      success: true,
      history: ingestRes.rows,
      summary: totalsRes.rows[0],
    });
  } catch (error) {
    console.error('Data history error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve data ingestion history.' });
  }
});

// GET /api/admin/health - Comprehensive system health telemetry
router.get('/health', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const startDb = Date.now();
    const dbTest = await db.query('SELECT 1 as live');
    const dbLatencyMs = Date.now() - startDb;

    const txCount = await db.query('SELECT COUNT(*) FROM transactions');
    const rulesCount = await db.query('SELECT COUNT(*) FROM detection_rules WHERE status = \'active\'');
    const userCount = await db.query('SELECT COUNT(*) FROM users');

    const lastDetection = await db.query('SELECT * FROM detection_run_history ORDER BY executed_at DESC LIMIT 1');
    const lastIngest = await db.query('SELECT * FROM dataset_ingest_history ORDER BY ingested_at DESC LIMIT 1');

    res.status(200).json({
      success: true,
      health: {
        status: 'HEALTHY',
        version: '2.4.0',
        environment: process.env.NODE_ENV || 'production',
        uptimeSeconds: Math.floor(process.uptime()),
        timestamp: new Date().toISOString(),
        database: {
          connected: true,
          latencyMs: dbLatencyMs,
          totalTransactions: parseInt(txCount.rows[0].count, 10),
          totalUsers: parseInt(userCount.rows[0].count, 10),
          activeRules: parseInt(rulesCount.rows[0].count, 10),
        },
        services: {
          detectionEngine: {
            operational: true,
            lastRun: lastDetection.rows[0] || null,
          },
          ingestionPipeline: {
            operational: true,
            lastBatch: lastIngest.rows[0] || null,
          },
          auditLedger: {
            operational: true,
          },
        },
      },
    });
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({
      success: false,
      health: {
        status: 'DEGRADED',
        error: error.message,
        timestamp: new Date().toISOString(),
      },
    });
  }
});

module.exports = router;

