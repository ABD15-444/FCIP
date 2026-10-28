const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

// GET /api/audit - return audit logs with parameterized filter, search, sorting and pagination (admin only)
router.get('/', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const {
      userId,
      action,
      entityType,
      outcome,
      fromDate,
      toDate,
      search,
      sortBy = 'timestamp',
      sortOrder = 'DESC',
      limit = 25,
      offset = 0,
    } = req.query;

    let baseQuery = `
      FROM audit_logs l
      LEFT JOIN users u ON l.user_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (userId) {
      params.push(parseInt(userId, 10));
      baseQuery += ` AND l.user_id = $${params.length}`;
    }

    if (action && action !== 'all') {
      params.push(action);
      baseQuery += ` AND l.action = $${params.length}`;
    }

    if (entityType && entityType !== 'all') {
      params.push(entityType);
      baseQuery += ` AND l.entity_type = $${params.length}`;
    }

    if (outcome && outcome !== 'all') {
      params.push(outcome);
      baseQuery += ` AND l.outcome = $${params.length}`;
    }

    if (fromDate) {
      params.push(fromDate);
      baseQuery += ` AND l.timestamp >= $${params.length}`;
    }

    if (toDate) {
      params.push(toDate);
      baseQuery += ` AND l.timestamp <= $${params.length}`;
    }

    if (search) {
      params.push(`%${search.trim()}%`);
      const pIdx = params.length;
      baseQuery += ` AND (l.action ILIKE $${pIdx} OR l.entity_type ILIKE $${pIdx} OR u.email ILIKE $${pIdx} OR u.first_name ILIKE $${pIdx} OR u.last_name ILIKE $${pIdx} OR l.details::text ILIKE $${pIdx})`;
    }

    const countRes = await db.query(`SELECT COUNT(l.id) as total ${baseQuery}`, params);
    const total = parseInt(countRes.rows[0].total, 10);

    const allowedSort = {
      timestamp: 'l.timestamp',
      id: 'l.id',
      action: 'l.action',
      outcome: 'l.outcome',
    };
    const orderCol = allowedSort[sortBy] || 'l.timestamp';
    const orderDir = String(sortOrder).toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const selectQuery = `
      SELECT
        l.id,
        l.user_id,
        COALESCE(l.user_role, u.role) as user_role,
        l.action,
        l.entity_type,
        l.entity_id,
        l.ip_address,
        COALESCE(l.outcome, 'SUCCESS') as outcome,
        l.timestamp,
        l.details,
        u.first_name,
        u.last_name,
        u.email
      ${baseQuery}
      ORDER BY ${orderCol} ${orderDir}
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    params.push(parseInt(limit, 10), parseInt(offset, 10));
    const result = await db.query(selectQuery, params);

    res.status(200).json({
      success: true,
      total,
      count: result.rows.length,
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10),
      logs: result.rows,
    });
  } catch (error) {
    console.error('Audit query error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve audit logs.' });
  }
});

// GET /api/audit/actions - distinct action list for filtering
router.get('/actions', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const actRes = await db.query('SELECT DISTINCT action FROM audit_logs ORDER BY action ASC');
    res.status(200).json({ success: true, actions: actRes.rows.map((r) => r.action) });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to retrieve actions.' });
  }
});

module.exports = router;
