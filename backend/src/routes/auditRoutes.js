const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

// GET /api/audit/logs - return audit logs with filter by user, action, and date (admin only)
router.get('/logs', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const { userId, action, fromDate, toDate, limit = 100, offset = 0 } = req.query;

    let query = `
      SELECT
        l.*,
        u.first_name,
        u.last_name,
        u.email,
        u.role
      FROM audit_logs l
      LEFT JOIN users u ON l.user_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (userId) {
      params.push(parseInt(userId, 10));
      query += ` AND l.user_id = $${params.length}`;
    }

    if (action) {
      params.push(`%${action}%`);
      query += ` AND l.action ILIKE $${params.length}`;
    }

    if (fromDate) {
      params.push(fromDate);
      query += ` AND l.timestamp >= $${params.length}`;
    }

    if (toDate) {
      params.push(toDate);
      query += ` AND l.timestamp <= $${params.length}`;
    }

    query += ` ORDER BY l.timestamp DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit, 10), parseInt(offset, 10));

    const result = await db.query(query, params);
    const countRes = await db.query('SELECT COUNT(*) FROM audit_logs');

    res.status(200).json({
      success: true,
      total: parseInt(countRes.rows[0].count, 10),
      count: result.rows.length,
      logs: result.rows,
    });
  } catch (error) {
    console.error('Audit query error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve audit logs.' });
  }
});

module.exports = router;
