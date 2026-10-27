const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticateToken } = require('../middleware/auth');

// GET /api/dashboard/stats
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const txCount = await db.query('SELECT COUNT(*) FROM transactions');
    const flaggedCount = await db.query('SELECT COUNT(DISTINCT transaction_id) FROM suspicious_flags');
    const openAlerts = await db.query("SELECT COUNT(*) FROM alerts WHERE status = 'open'");
    const openCases = await db.query("SELECT COUNT(*) FROM cases WHERE status IN ('open', 'in_progress')");
    const highRisk = await db.query("SELECT COUNT(DISTINCT entity_id) FROM risk_scores WHERE risk_level = 'High'");

    res.status(200).json({
      success: true,
      stats: {
        totalTransactions: parseInt(txCount.rows[0].count, 10),
        flaggedTransactions: parseInt(flaggedCount.rows[0].count, 10),
        openAlerts: parseInt(openAlerts.rows[0].count, 10),
        openCases: parseInt(openCases.rows[0].count, 10),
        highRiskEntities: parseInt(highRisk.rows[0].count, 10),
      },
    });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve dashboard stats.' });
  }
});

// GET /api/dashboard/risk-chart - pie chart breakdown (low, medium, high)
router.get('/risk-chart', authenticateToken, async (req, res) => {
  try {
    const riskRes = await db.query(`
      SELECT
        COALESCE(rs.risk_level, 'Low') as risk_level,
        COUNT(t.id) as count
      FROM transactions t
      LEFT JOIN risk_scores rs ON rs.entity_type = 'transaction' AND rs.entity_id = t.id
      GROUP BY COALESCE(rs.risk_level, 'Low')
    `);

    const distribution = { Low: 0, Medium: 0, High: 0 };
    riskRes.rows.forEach((r) => {
      distribution[r.risk_level] = parseInt(r.count, 10);
    });

    res.status(200).json({ success: true, distribution });
  } catch (error) {
    console.error('Risk chart error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate risk chart data.' });
  }
});

// GET /api/dashboard/transaction-volume - daily counts for last 30 days
router.get('/transaction-volume', authenticateToken, async (req, res) => {
  try {
    const volRes = await db.query(`
      SELECT
        TO_CHAR(transaction_date, 'YYYY-MM-DD') as date,
        COUNT(id) as count,
        SUM(amount) as total_volume
      FROM transactions
      GROUP BY TO_CHAR(transaction_date, 'YYYY-MM-DD')
      ORDER BY date DESC
      LIMIT 30
    `);

    res.status(200).json({ success: true, volume: volRes.rows.reverse() });
  } catch (error) {
    console.error('Transaction volume error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve volume history.' });
  }
});

// GET /api/dashboard/recent-alerts - return last 5 alerts
router.get('/recent-alerts', authenticateToken, async (req, res) => {
  try {
    const alertsRes = await db.query(`
      SELECT a.*, dr.rule_name, t.amount, t.currency
      FROM alerts a
      LEFT JOIN detection_rules dr ON a.rule_id = dr.id
      LEFT JOIN transactions t ON a.transaction_id = t.id
      ORDER BY a.created_at DESC
      LIMIT 5
    `);

    res.status(200).json({ success: true, alerts: alertsRes.rows });
  } catch (error) {
    console.error('Recent alerts error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve recent alerts.' });
  }
});

module.exports = router;
