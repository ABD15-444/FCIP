const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticateToken } = require('../middleware/auth');
const { logAudit } = require('../middleware/audit');

// GET /api/cases - get all cases with optional filters
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { status, priority, search } = req.query;
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

    if (search) {
      params.push(`%${search.trim()}%`);
      const pIdx = params.length;
      query += ` AND (c.title ILIKE $${pIdx} OR c.description ILIKE $${pIdx})`;
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

    // Check if a case already exists for this alert to prevent duplicate case creation
    if (alert_id) {
      const existingCase = await db.query('SELECT id, title FROM cases WHERE alert_id = $1', [alert_id]);
      if (existingCase.rows.length > 0) {
        return res.status(409).json({
          success: false,
          message: `Case #${existingCase.rows[0].id} already exists for Alert #${alert_id}: "${existingCase.rows[0].title}".`,
          existingCaseId: existingCase.rows[0].id,
        });
      }
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

      // If linked to alert, move alert to 'under_investigation'
      if (alert_id) {
        await client.query(
          "UPDATE alerts SET status = 'under_investigation' WHERE id = $1",
          [alert_id]
        );
      }

      await client.query('COMMIT');

      await logAudit(
        req.user.id,
        'CASE_CREATED',
        'case',
        newCase.id,
        req.ip || '127.0.0.1',
        { caseId: newCase.id, title, alert_id }
      );

      res.status(201).json({ success: true, message: 'Case created successfully.', case: newCase });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Create case error:', error);
    res.status(500).json({ success: false, message: error.message || 'Error creating case.' });
  }
});

// GET /api/cases/:id - get case with notes, history, linked transaction & accounts
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const caseId = parseInt(req.params.id, 10);
    const caseRes = await db.query(
      `
      SELECT
        c.*,
        a.description as alert_description,
        a.severity as alert_severity,
        a.transaction_id,
        t.amount as transaction_amount,
        t.currency as transaction_currency,
        t.transaction_date,
        t.channel as transaction_channel,
        t.transaction_type,
        fa.account_number as from_account,
        ta.account_number as to_account,
        u.first_name as assignee_first_name,
        u.last_name as assignee_last_name,
        cb.first_name as creator_first_name,
        cb.last_name as creator_last_name
      FROM cases c
      LEFT JOIN alerts a ON c.alert_id = a.id
      LEFT JOIN transactions t ON a.transaction_id = t.id
      LEFT JOIN accounts fa ON t.from_account_id = fa.id
      LEFT JOIN accounts ta ON t.to_account_id = ta.id
      LEFT JOIN users u ON c.assigned_to = u.id
      LEFT JOIN users cb ON c.created_by = cb.id
      WHERE c.id = $1
    `,
      [caseId]
    );

    if (caseRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Case not found.' });
    }

    const caseData = caseRes.rows[0];

    // Notes
    const notesRes = await db.query(
      `
      SELECT cn.*, u.first_name, u.last_name, u.role
      FROM case_notes cn
      LEFT JOIN users u ON cn.created_by = u.id
      WHERE cn.case_id = $1
      ORDER BY cn.created_at ASC
    `,
      [caseId]
    );

    // History
    const historyRes = await db.query(
      `
      SELECT ch.*, u.first_name, u.last_name
      FROM case_history ch
      LEFT JOIN users u ON ch.changed_by = u.id
      WHERE ch.case_id = $1
      ORDER BY ch.changed_at DESC
    `,
      [caseId]
    );

    caseData.notes = notesRes.rows;
    caseData.history = historyRes.rows;

    res.status(200).json({ success: true, case: caseData });
  } catch (error) {
    console.error('Fetch case detail error:', error);
    res.status(500).json({ success: false, message: 'Error retrieving case details.' });
  }
});

// PUT /api/cases/:id - update case status, priority, or reopen closed case
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const caseId = parseInt(req.params.id, 10);
    const { status, priority, assigned_to } = req.body;

    const currentCase = await db.query('SELECT * FROM cases WHERE id = $1', [caseId]);
    if (currentCase.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Case not found.' });
    }

    const fields = [];
    const params = [caseId];

    if (status) {
      params.push(status);
      fields.push(`status = $${params.length}`);
      if (status === 'closed') {
        fields.push(`closed_at = CURRENT_TIMESTAMP`);
      } else if (currentCase.rows[0].status === 'closed' && status !== 'closed') {
        // Explicit case reopening
        fields.push(`closed_at = NULL`);
      }
    }
    if (priority) {
      params.push(priority);
      fields.push(`priority = $${params.length}`);
    }
    if (assigned_to !== undefined) {
      params.push(assigned_to);
      fields.push(`assigned_to = $${params.length}`);
    }

    if (fields.length === 0) {
      return res.status(400).json({ success: false, message: 'No fields to update.' });
    }

    const query = `UPDATE cases SET ${fields.join(', ')} WHERE id = $1 RETURNING *`;
    const updateRes = await db.query(query, params);

    // Log history
    const changeDesc = [];
    if (status) changeDesc.push(`Status changed from '${currentCase.rows[0].status}' to '${status}'`);
    if (priority) changeDesc.push(`Priority changed to '${priority}'`);
    if (assigned_to) changeDesc.push(`Assigned investigator updated`);

    await db.query(
      `INSERT INTO case_history (case_id, action, changed_by)
       VALUES ($1, $2, $3)`,
      [caseId, changeDesc.join('; '), req.user.id]
    );

    await logAudit(
      req.user.id,
      'CASE_UPDATED',
      'case',
      caseId,
      req.ip || '127.0.0.1',
      { caseId, status, priority, assigned_to }
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

module.exports = router;
