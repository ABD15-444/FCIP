const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticateToken } = require('../middleware/auth');

// GET /api/alerts - filter by status and severity
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { status, severity, limit = 50, offset = 0 } = req.query;
    let query = `
      SELECT
        a.*,
        t.amount as transaction_amount,
        t.currency as transaction_currency,
        t.transaction_date,
        fa.account_number as from_account,
        ta.account_number as to_account,
        dr.rule_name,
        dr.risk_level as rule_risk_level,
        u.first_name as assignee_first_name,
        u.last_name as assignee_last_name
      FROM alerts a
      LEFT JOIN transactions t ON a.transaction_id = t.id
      LEFT JOIN accounts fa ON t.from_account_id = fa.id
      LEFT JOIN accounts ta ON t.to_account_id = ta.id
      LEFT JOIN detection_rules dr ON a.rule_id = dr.id
      LEFT JOIN users u ON a.assigned_to = u.id
      WHERE 1=1
    `;
    const params = [];

    if (status && status !== 'all') {
      params.push(status);
      query += ` AND a.status = $${params.length}`;
    }

    if (severity && severity !== 'all') {
      params.push(severity.toLowerCase());
      query += ` AND a.severity = $${params.length}`;
    }

    query += ` ORDER BY a.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit, 10), parseInt(offset, 10));

    const result = await db.query(query, params);
    const countRes = await db.query('SELECT COUNT(*) FROM alerts');

    return res.status(200).json({
      success: true,
      total: parseInt(countRes.rows[0].count, 10),
      count: result.rows.length,
      alerts: result.rows,
    });
  } catch (error) {
    console.error('Fetch alerts error:', error);
    res.status(500).json({ success: false, message: 'Server error retrieving alerts.' });
  }
});

// GET /api/alerts/:id - single alert with full details
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const alertId = parseInt(req.params.id, 10);
    const alertRes = await db.query(`
      SELECT
        a.*,
        t.amount,
        t.currency,
        t.transaction_date,
        t.transaction_type,
        t.channel,
        t.description as transaction_description,
        fa.account_number as from_account,
        ta.account_number as to_account,
        dr.rule_name,
        dr.condition_type,
        dr.threshold_value,
        u.first_name as assignee_first_name,
        u.last_name as assignee_last_name
      FROM alerts a
      LEFT JOIN transactions t ON a.transaction_id = t.id
      LEFT JOIN accounts fa ON t.from_account_id = fa.id
      LEFT JOIN accounts ta ON t.to_account_id = ta.id
      LEFT JOIN detection_rules dr ON a.rule_id = dr.id
      LEFT JOIN users u ON a.assigned_to = u.id
      WHERE a.id = $1
    `, [alertId]);

    if (alertRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Alert not found.' });
    }

    const alert = alertRes.rows[0];

    // Fetch Risk Score & Contributing Factors
    if (alert.transaction_id) {
      const riskRes = await db.query(
        "SELECT * FROM risk_scores WHERE entity_type = 'transaction' AND entity_id = $1 ORDER BY calculated_at DESC LIMIT 1",
        [alert.transaction_id]
      );
      if (riskRes.rows.length > 0) {
        alert.risk_score = riskRes.rows[0];
        const factorsRes = await db.query(
          'SELECT * FROM risk_factors WHERE risk_score_id = $1',
          [riskRes.rows[0].id]
        );
        alert.risk_factors = factorsRes.rows;
      }
    }

    return res.status(200).json({ success: true, alert });
  } catch (error) {
    console.error('Fetch alert detail error:', error);
    res.status(500).json({ success: false, message: 'Server error retrieving alert detail.' });
  }
});

// PUT /api/alerts/:id/status - update alert status
router.put('/:id/status', authenticateToken, async (req, res) => {
  try {
    const alertId = parseInt(req.params.id, 10);
    const { status } = req.body;
    if (!['open', 'acknowledged', 'closed'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid alert status value.' });
    }

    const updateRes = await db.query(
      'UPDATE alerts SET status = $1 WHERE id = $2 RETURNING *',
      [status, alertId]
    );

    if (updateRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Alert not found.' });
    }

    res.status(200).json({ success: true, message: `Alert status updated to ${status}.`, alert: updateRes.rows[0] });
  } catch (error) {
    console.error('Update alert status error:', error);
    res.status(500).json({ success: false, message: 'Error updating alert status.' });
  }
});

// POST /api/alerts/:id/assign - assign alert to investigator
router.post('/:id/assign', authenticateToken, async (req, res) => {
  try {
    const alertId = parseInt(req.params.id, 10);
    const { userId } = req.body;

    const updateRes = await db.query(
      'UPDATE alerts SET assigned_to = $1 WHERE id = $2 RETURNING *',
      [userId || req.user.id, alertId]
    );

    if (updateRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Alert not found.' });
    }

    res.status(200).json({ success: true, message: 'Alert assigned successfully.', alert: updateRes.rows[0] });
  } catch (error) {
    console.error('Assign alert error:', error);
    res.status(500).json({ success: false, message: 'Error assigning alert.' });
  }
});

module.exports = router;
