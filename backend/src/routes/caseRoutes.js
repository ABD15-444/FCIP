const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticateToken } = require('../middleware/auth');

// GET /api/cases - get all cases
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { status, priority } = req.query;
    let query = `
      SELECT
        c.*,
        a.description as alert_description,
        a.severity as alert_severity,
        u.first_name as assignee_first_name,
        u.last_name as assignee_last_name,
        cb.first_name as creator_first_name,
        cb.last_name as creator_last_name,
        COUNT(cn.id) as note_count
      FROM cases c
      LEFT JOIN alerts a ON c.alert_id = a.id
      LEFT JOIN users u ON c.assigned_to = u.id
      LEFT JOIN users cb ON c.created_by = cb.id
      LEFT JOIN case_notes cn ON cn.case_id = c.id
      WHERE 1=1
    `;
    const params = [];

    if (status && status !== 'all') {
      params.push(status);
      query += ` AND c.status = $${params.length}`;
    }

    if (priority && priority !== 'all') {
      params.push(priority);
      query += ` AND c.priority = $${params.length}`;
    }

    query += ` GROUP BY c.id, a.id, u.id, cb.id ORDER BY c.created_at DESC`;
    const result = await db.query(query, params);

    res.status(200).json({ success: true, count: result.rows.length, cases: result.rows });
  } catch (error) {
    console.error('Fetch cases error:', error);
    res.status(500).json({ success: false, message: 'Server error retrieving cases.' });
  }
});

// POST /api/cases - create a new case from an alert
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { title, description, priority, alert_id, assigned_to } = req.body;
    if (!title) {
      return res.status(400).json({ success: false, message: 'Case title is required.' });
    }

    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      const caseRes = await client.query(
        `INSERT INTO cases (title, description, status, priority, alert_id, assigned_to, created_by)
         VALUES ($1, $2, 'open', $3, $4, $5, $6) RETURNING *`,
        [title, description || '', priority || 'medium', alert_id || null, assigned_to || req.user.id, req.user.id]
      );
      const newCase = caseRes.rows[0];

      // Add audit history
      await client.query(
        `INSERT INTO case_history (case_id, action, changed_by)
         VALUES ($1, 'Case opened and dossier initiated', $2)`,
        [newCase.id, req.user.id]
      );

      // If linked to alert, acknowledge alert
      if (alert_id) {
        await client.query("UPDATE alerts SET status = 'acknowledged' WHERE id = $1", [alert_id]);
      }

      await client.query('COMMIT');
      res.status(201).json({ success: true, message: 'Case created successfully.', case: newCase });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Create case error:', error);
    res.status(500).json({ success: false, message: 'Error creating case.' });
  }
});

// GET /api/cases/:id - get case with notes and history
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const caseId = parseInt(req.params.id, 10);
    const caseRes = await db.query(`
      SELECT
        c.*,
        a.description as alert_description,
        a.severity as alert_severity,
        a.transaction_id,
        t.amount as transaction_amount,
        t.currency as transaction_currency,
        t.transaction_date,
        u.first_name as assignee_first_name,
        u.last_name as assignee_last_name,
        cb.first_name as creator_first_name,
        cb.last_name as creator_last_name
      FROM cases c
      LEFT JOIN alerts a ON c.alert_id = a.id
      LEFT JOIN transactions t ON a.transaction_id = t.id
      LEFT JOIN users u ON c.assigned_to = u.id
      LEFT JOIN users cb ON c.created_by = cb.id
      WHERE c.id = $1
    `, [caseId]);

    if (caseRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Case not found.' });
    }

    const caseData = caseRes.rows[0];

    // Notes
    const notesRes = await db.query(`
      SELECT cn.*, u.first_name, u.last_name, u.role
      FROM case_notes cn
      LEFT JOIN users u ON cn.created_by = u.id
      WHERE cn.case_id = $1
      ORDER BY cn.created_at ASC
    `, [caseId]);

    // History
    const historyRes = await db.query(`
      SELECT ch.*, u.first_name, u.last_name
      FROM case_history ch
      LEFT JOIN users u ON ch.changed_by = u.id
      WHERE ch.case_id = $1
      ORDER BY ch.changed_at DESC
    `, [caseId]);

    caseData.notes = notesRes.rows;
    caseData.history = historyRes.rows;

    res.status(200).json({ success: true, case: caseData });
  } catch (error) {
    console.error('Fetch case detail error:', error);
    res.status(500).json({ success: false, message: 'Error retrieving case details.' });
  }
});

// PUT /api/cases/:id - update case status or priority
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const caseId = parseInt(req.params.id, 10);
    const { status, priority } = req.body;

    const fields = [];
    const params = [caseId];

    if (status) {
      params.push(status);
      fields.push(`status = $${params.length}`);
      if (status === 'closed') {
        fields.push(`closed_at = CURRENT_TIMESTAMP`);
      }
    }
    if (priority) {
      params.push(priority);
      fields.push(`priority = $${params.length}`);
    }

    if (fields.length === 0) {
      return res.status(400).json({ success: false, message: 'No fields to update.' });
    }

    const query = `UPDATE cases SET ${fields.join(', ')} WHERE id = $1 RETURNING *`;
    const updateRes = await db.query(query, params);

    if (updateRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Case not found.' });
    }

    // Log history
    await db.query(
      `INSERT INTO case_history (case_id, action, changed_by)
       VALUES ($1, $2, $3)`,
      [caseId, `Status updated to '${status || 'unchanged'}' / priority '${priority || 'unchanged'}'`, req.user.id]
    );

    res.status(200).json({ success: true, message: 'Case updated successfully.', case: updateRes.rows[0] });
  } catch (error) {
    console.error('Update case error:', error);
    res.status(500).json({ success: false, message: 'Error updating case.' });
  }
});

// POST /api/cases/:id/notes - add note to a case
router.post('/:id/notes', authenticateToken, async (req, res) => {
  try {
    const caseId = parseInt(req.params.id, 10);
    const { note_text } = req.body;
    if (!note_text) {
      return res.status(400).json({ success: false, message: 'Note text cannot be empty.' });
    }

    const insertRes = await db.query(
      `INSERT INTO case_notes (case_id, note_text, created_by)
       VALUES ($1, $2, $3) RETURNING *`,
      [caseId, note_text, req.user.id]
    );

    await db.query(
      `INSERT INTO case_history (case_id, action, changed_by)
       VALUES ($1, 'Investigator added an intelligence note', $2)`,
      [caseId, req.user.id]
    );

    res.status(201).json({ success: true, message: 'Note added.', note: insertRes.rows[0] });
  } catch (error) {
    console.error('Add note error:', error);
    res.status(500).json({ success: false, message: 'Error adding case note.' });
  }
});

// POST /api/cases/:id/assign - assign case to investigator
router.post('/:id/assign', authenticateToken, async (req, res) => {
  try {
    const caseId = parseInt(req.params.id, 10);
    const { userId } = req.body;

    const updateRes = await db.query(
      'UPDATE cases SET assigned_to = $1 WHERE id = $2 RETURNING *',
      [userId || req.user.id, caseId]
    );

    if (updateRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Case not found.' });
    }

    await db.query(
      `INSERT INTO case_history (case_id, action, changed_by)
       VALUES ($1, $2, $3)`,
      [caseId, `Assigned to investigator ID #${userId || req.user.id}`, req.user.id]
    );

    res.status(200).json({ success: true, message: 'Case assigned.', case: updateRes.rows[0] });
  } catch (error) {
    console.error('Assign case error:', error);
    res.status(500).json({ success: false, message: 'Error assigning case.' });
  }
});

// GET /api/cases/:id/history - get full timeline of case
router.get('/:id/history', authenticateToken, async (req, res) => {
  try {
    const caseId = parseInt(req.params.id, 10);
    const historyRes = await db.query(`
      SELECT ch.*, u.first_name, u.last_name, u.role
      FROM case_history ch
      LEFT JOIN users u ON ch.changed_by = u.id
      WHERE ch.case_id = $1
      ORDER BY ch.changed_at DESC
    `, [caseId]);

    res.status(200).json({ success: true, count: historyRes.rows.length, history: historyRes.rows });
  } catch (error) {
    console.error('Fetch history error:', error);
    res.status(500).json({ success: false, message: 'Error retrieving case history.' });
  }
});

module.exports = router;
