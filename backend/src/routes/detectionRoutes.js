const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const { runDetectionEngine, initDetectionRules } = require('../services/detectionEngine');
const { logAudit } = require('../middleware/audit');

// POST /api/detection/run - trigger detection on all transactions
router.post('/run', authenticateToken, async (req, res) => {
  try {
    const summary = await runDetectionEngine();

    // Log run history in detection_run_history table
    await db.query(
      `INSERT INTO detection_run_history (initiated_by, total_scanned, flagged_count, new_alerts_count, updated_alerts_count, status)
       VALUES ($1, $2, $3, $4, $5, 'COMPLETED')`,
      [req.user.id, summary.totalTransactions, summary.flaggedCount, summary.newAlertsCount, summary.updatedAlertsCount]
    );

    // Audit log
    await logAudit({
      userId: req.user.id,
      userRole: req.user.role,
      action: 'DETECTION_RUN_EXECUTED',
      entityType: 'detection_engine',
      ipAddress: req.ip,
      outcome: 'SUCCESS',
      details: summary,
    });

    return res.status(200).json(summary);
  } catch (error) {
    console.error('Run detection error:', error);
    await db.query(
      `INSERT INTO detection_run_history (initiated_by, total_scanned, flagged_count, new_alerts_count, updated_alerts_count, status, error_message)
       VALUES ($1, 0, 0, 0, 0, 'FAILED', $2)`,
      [req.user.id, error.message]
    );

    await logAudit({
      userId: req.user.id,
      userRole: req.user.role,
      action: 'DETECTION_RUN_EXECUTED',
      entityType: 'detection_engine',
      ipAddress: req.ip,
      outcome: 'FAILURE',
      details: { error: error.message },
    });

    res.status(500).json({ success: false, message: 'Detection engine failure.', error: error.message });
  }
});

// GET /api/detection/rules - get all rules
router.get('/rules', authenticateToken, async (req, res) => {
  try {
    await initDetectionRules();
    const result = await db.query('SELECT * FROM detection_rules ORDER BY id ASC');
    res.status(200).json({ success: true, count: result.rows.length, rules: result.rows });
  } catch (error) {
    console.error('Get rules error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve rules.' });
  }
});

// POST /api/detection/rules - create a new rule (admin only)
router.post('/rules', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const { rule_name, condition_type, threshold_value, risk_level, status } = req.body;
    if (!rule_name || !condition_type || threshold_value === undefined || !risk_level) {
      return res.status(400).json({ success: false, message: 'Missing required detection rule attributes.' });
    }

    const insertRes = await db.query(
      `INSERT INTO detection_rules (rule_name, condition_type, threshold_value, risk_level, status)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [rule_name, condition_type, threshold_value, risk_level.toLowerCase(), status || 'active']
    );

    await logAudit({
      userId: req.user.id,
      userRole: req.user.role,
      action: 'DETECTION_RULE_CREATED',
      entityType: 'detection_rule',
      entityId: insertRes.rows[0].id,
      ipAddress: req.ip,
      outcome: 'SUCCESS',
      details: { ruleName: rule_name, condition_type, threshold_value, risk_level },
    });

    res.status(201).json({ success: true, message: 'Detection rule created.', rule: insertRes.rows[0] });
  } catch (error) {
    console.error('Create rule error:', error);
    res.status(500).json({ success: false, message: 'Error saving rule.' });
  }
});

// GET /api/risk/:entityType/:entityId - get risk score for entity
router.get('/risk/:entityType/:entityId', authenticateToken, async (req, res) => {
  try {
    const { entityType, entityId } = req.params;
    const scoreRes = await db.query(
      'SELECT * FROM risk_scores WHERE entity_type = $1 AND entity_id = $2 ORDER BY calculated_at DESC LIMIT 1',
      [entityType, entityId]
    );

    if (scoreRes.rows.length === 0) {
      return res.status(200).json({
        success: true,
        score: {
          entity_type: entityType,
          entity_id: parseInt(entityId, 10),
          score: 0,
          risk_level: 'Low',
          calculated_at: new Date().toISOString(),
          factors: [],
        },
      });
    }

    const score = scoreRes.rows[0];
    const factorsRes = await db.query(
      'SELECT * FROM risk_factors WHERE risk_score_id = $1',
      [score.id]
    );

    score.factors = factorsRes.rows;

    return res.status(200).json({ success: true, score });
  } catch (error) {
    console.error('Risk fetch error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve risk score.' });
  }
});

module.exports = router;
