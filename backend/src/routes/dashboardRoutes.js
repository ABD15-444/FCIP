const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticateToken } = require('../middleware/auth');

// GET /api/dashboard/stats
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const { fromDate, toDate } = req.query;

    let txFilter = 'WHERE 1=1';
    const params = [];
    if (fromDate) {
      params.push(fromDate);
      txFilter += ` AND transaction_date >= $${params.length}`;
    }
    if (toDate) {
      params.push(toDate);
      txFilter += ` AND transaction_date <= $${params.length}`;
    }

    const txCount = await db.query(`SELECT COUNT(*) FROM transactions ${txFilter}`, params);
    
    // Flagged transactions within the date filter if any
    const flaggedCount = await db.query(`
      SELECT COUNT(DISTINCT sf.transaction_id) 
      FROM suspicious_flags sf
      JOIN transactions t ON sf.transaction_id = t.id
      ${txFilter.replace(/transaction_date/g, 't.transaction_date')}
    `, params);

    // Alerts broken down by lifecycle status
    const alertsStatusRes = await db.query(`
      SELECT 
        status, 
        COUNT(*) as count 
      FROM alerts 
      GROUP BY status
    `);

    const alertCounts = { open: 0, acknowledged: 0, under_investigation: 0, closed: 0, total: 0 };
    alertsStatusRes.rows.forEach(r => {
      alertCounts[r.status] = parseInt(r.count, 10);
      alertCounts.total += parseInt(r.count, 10);
    });

    // Cases broken down by active vs closed
    const casesRes = await db.query(`
      SELECT 
        COUNT(*) FILTER (WHERE status IN ('open', 'in_progress', 'escalated')) as active_cases,
        COUNT(*) FILTER (WHERE status = 'closed') as closed_cases,
        COUNT(*) as total_cases
      FROM cases
    `);

    // High risk entities (transactions with score >= 71)
    const highRiskTx = await db.query("SELECT COUNT(DISTINCT entity_id) FROM risk_scores WHERE entity_type = 'transaction' AND risk_level = 'High'");
    
    // High risk customers (customers associated with high risk transactions)
    const highRiskCust = await db.query(`
      SELECT COUNT(DISTINCT c.id) 
      FROM customers c
      JOIN accounts a ON a.customer_id = c.id
      JOIN transactions t ON t.from_account_id = a.id OR t.to_account_id = a.id
      JOIN risk_scores rs ON rs.entity_type = 'transaction' AND rs.entity_id = t.id
      WHERE rs.risk_level = 'High'
    `);

    res.status(200).json({
      success: true,
      stats: {
        totalTransactions: parseInt(txCount.rows[0].count, 10),
        flaggedTransactions: parseInt(flaggedCount.rows[0].count, 10),
        openAlerts: alertCounts.open,
        acknowledgedAlerts: alertCounts.acknowledged,
        underInvestigationAlerts: alertCounts.under_investigation,
        closedAlerts: alertCounts.closed,
        totalAlerts: alertCounts.total,
        openCases: parseInt(casesRes.rows[0].active_cases, 10),
        closedCases: parseInt(casesRes.rows[0].closed_cases, 10),
        totalCases: parseInt(casesRes.rows[0].total_cases, 10),
        highRiskEntities: parseInt(highRiskTx.rows[0].count, 10),
        highRiskCustomers: parseInt(highRiskCust.rows[0].count, 10),
      },
    });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve dashboard stats.' });
  }
});

// GET /api/dashboard/risk-chart - transaction and entity risk breakdown
router.get('/risk-chart', authenticateToken, async (req, res) => {
  try {
    const riskRes = await db.query(`
      SELECT
        COALESCE(rs.risk_level, 'Unevaluated') as risk_level,
        COUNT(t.id) as count
      FROM transactions t
      LEFT JOIN risk_scores rs ON rs.entity_type = 'transaction' AND rs.entity_id = t.id
      GROUP BY COALESCE(rs.risk_level, 'Unevaluated')
    `);

    const distribution = { Low: 0, Medium: 0, High: 0, Unevaluated: 0 };
    riskRes.rows.forEach((r) => {
      distribution[r.risk_level] = parseInt(r.count, 10);
    });

    res.status(200).json({ success: true, distribution });
  } catch (error) {
    console.error('Risk chart error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate risk chart data.' });
  }
});

// GET /api/dashboard/transaction-volume - daily counts with optional date filter
router.get('/transaction-volume', authenticateToken, async (req, res) => {
  try {
    const { fromDate, toDate } = req.query;
    let query = `
      SELECT
        TO_CHAR(transaction_date, 'YYYY-MM-DD') as date,
        COUNT(id) as count,
        SUM(amount) as total_volume
      FROM transactions
      WHERE 1=1
    `;
    const params = [];
    if (fromDate) {
      params.push(fromDate);
      query += ` AND transaction_date >= $${params.length}`;
    }
    if (toDate) {
      params.push(toDate);
      query += ` AND transaction_date <= $${params.length}`;
    }

    query += `
      GROUP BY TO_CHAR(transaction_date, 'YYYY-MM-DD')
      ORDER BY date ASC
      LIMIT 60
    `;

    const volRes = await db.query(query, params);

    res.status(200).json({ success: true, volume: volRes.rows });
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
      LIMIT 6
    `);

    res.status(200).json({ success: true, alerts: alertsRes.rows });
  } catch (error) {
    console.error('Recent alerts error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve recent alerts.' });
  }
});

module.exports = router;
