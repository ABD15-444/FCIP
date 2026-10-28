const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const { logAudit } = require('../middleware/audit');

// GET /api/compliance/stats - Summary metrics for Compliance Dashboard
router.get('/stats', authenticateToken, authorizeRoles('compliance_officer', 'admin'), async (req, res) => {
  try {
    const { fromDate, toDate, timeRange } = req.query;
    let dateFilter = '';
    const params = [];
    if (timeRange === '7d') {
      dateFilter += ` AND created_at >= CURRENT_TIMESTAMP - INTERVAL '7 days'`;
    } else if (timeRange === '30d') {
      dateFilter += ` AND created_at >= CURRENT_TIMESTAMP - INTERVAL '30 days'`;
    }
    if (fromDate) {
      params.push(fromDate);
      dateFilter += ` AND created_at >= $${params.length}`;
    }
    if (toDate) {
      params.push(toDate);
      dateFilter += ` AND created_at <= $${params.length}`;
    }

    // 1. Cases awaiting review (submitted_for_review + under_compliance_review)
    const awaitingCaseReviews = await db.query(
      `SELECT COUNT(*) FROM cases WHERE status IN ('submitted_for_review', 'under_compliance_review') ${dateFilter}`,
      params
    );

    // 2. Reports awaiting review / approval (pending_approval or draft attached to submitted cases)
    const awaitingReports = await db.query(
      `SELECT COUNT(*) FROM reports WHERE review_status IN ('pending_approval', 'draft') ${dateFilter}`,
      params
    );

    // 3. Reports approved internally
    const approvedReports = await db.query(
      `SELECT COUNT(*) FROM reports WHERE review_status = 'approved' ${dateFilter}`,
      params
    );

    // 4. Reports / cases returned for correction
    const returnedItems = await db.query(
      `SELECT COUNT(*) FROM cases WHERE status = 'returned_for_correction' ${dateFilter}`,
      params
    );

    // 5. Overdue reviews (deadline passed & not closed/approved)
    const overdueReviews = await db.query(
      `SELECT COUNT(*) FROM cases 
       WHERE review_deadline IS NOT NULL 
         AND review_deadline < CURRENT_TIMESTAMP 
         AND status NOT IN ('compliance_accepted', 'closed') ${dateFilter}`,
      params
    );

    // 6. Cases escalated for compliance attention
    const escalatedCases = await db.query(
      `SELECT COUNT(*) FROM cases WHERE status = 'escalated' ${dateFilter}`,
      params
    );

    // 7. Recent compliance review activities
    const recentActivity = await db.query(`
      SELECT 
        cr.*, 
        cr.decision_notes as comments,
        u.first_name as first_name, 
        u.last_name as last_name,
        u.first_name as reviewer_first_name, 
        u.last_name as reviewer_last_name, 
        u.role as reviewer_role,
        c.title as case_title
      FROM compliance_reviews cr
      LEFT JOIN users u ON cr.reviewer_id = u.id
      LEFT JOIN cases c ON cr.case_id = c.id
      ORDER BY cr.created_at DESC
      LIMIT 6
    `);

    // 8. Workload distribution across compliance statuses
    const workloadDist = await db.query(
      `SELECT status, COUNT(*) as count
       FROM cases
       WHERE status IN ('submitted_for_review', 'under_compliance_review', 'returned_for_correction', 'compliance_accepted', 'escalated') ${dateFilter}
       GROUP BY status`,
      params
    );

    const distribution = {
      submitted_for_review: 0,
      under_compliance_review: 0,
      returned_for_correction: 0,
      compliance_accepted: 0,
      escalated: 0,
    };
    workloadDist.rows.forEach((r) => {
      distribution[r.status] = parseInt(r.count, 10);
    });

    // 9. Pending high priority cases
    const pendingHighPriority = await db.query(`
      SELECT c.*, u.first_name || ' ' || u.last_name as investigator_name,
        CASE WHEN c.alert_id IS NOT NULL THEN 1 ELSE 0 END as alert_count
      FROM cases c
      LEFT JOIN users u ON c.created_by = u.id
      WHERE c.status IN ('submitted_for_review', 'under_compliance_review')
        AND c.priority IN ('critical', 'high')
      ORDER BY c.review_deadline ASC NULLS LAST, c.created_at DESC
      LIMIT 5
    `);

    const cases_awaiting = parseInt(awaitingCaseReviews.rows[0].count, 10);
    const reports_awaiting = parseInt(awaitingReports.rows[0].count, 10);
    const reports_app = parseInt(approvedReports.rows[0].count, 10);
    const reports_ret = parseInt(returnedItems.rows[0].count, 10);
    const overdue = parseInt(overdueReviews.rows[0].count, 10);
    const escalated = parseInt(escalatedCases.rows[0].count, 10);

    res.status(200).json({
      success: true,
      cards: {
        cases_awaiting_review: cases_awaiting,
        reports_awaiting_review: reports_awaiting,
        reports_approved: reports_app,
        reports_returned: reports_ret,
        overdue_reviews: overdue,
        cases_escalated: escalated,
      },
      workload: {
        submitted: distribution.submitted_for_review,
        under_review: distribution.under_compliance_review,
        returned: distribution.returned_for_correction,
        accepted: distribution.compliance_accepted,
        escalated: distribution.escalated,
      },
      stats: {
        casesAwaitingReview: cases_awaiting,
        reportsAwaitingReview: reports_awaiting,
        reportsApproved: reports_app,
        reportsReturned: reports_ret,
        overdueReviews: overdue,
        escalatedCases: escalated,
        workloadDistribution: distribution,
      },
      pendingHighPriority: pendingHighPriority.rows,
      recentActivity: recentActivity.rows,
    });
  } catch (error) {
    console.error('Compliance stats error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve compliance metrics.' });
  }
});

// GET /api/compliance/queue - Review Queue of cases and SAR reports submitted for review
router.get('/queue', authenticateToken, authorizeRoles('compliance_officer', 'admin'), async (req, res) => {
  try {
    const { status, priority, type = 'all', sortBy = 'deadline', search, page = 1, limit = 25, offset } = req.query;
    const limitNum = parseInt(limit, 10) || 25;
    const offsetNum = offset !== undefined ? parseInt(offset, 10) : (Math.max(1, parseInt(page, 10) || 1) - 1) * limitNum;

    let items = [];

    if (type !== 'reports') {
      let baseCaseQuery = `
        FROM cases c
        LEFT JOIN users sub ON c.submitted_by = sub.id
        LEFT JOIN users ass ON c.assigned_to = ass.id
        LEFT JOIN users cb ON c.created_by = cb.id
        LEFT JOIN alerts a ON c.alert_id = a.id
        LEFT JOIN transactions t ON a.transaction_id = t.id
        LEFT JOIN risk_scores rs ON rs.entity_type = 'transaction' AND rs.entity_id = t.id
        WHERE (c.status IN ('submitted_for_review', 'under_compliance_review', 'returned_for_correction', 'compliance_accepted', 'escalated') OR c.submitted_at IS NOT NULL)
      `;
      const caseParams = [];

      if (status && status !== 'all') {
        caseParams.push(status);
        baseCaseQuery += ` AND c.status = $${caseParams.length}`;
      }

      if (priority && priority !== 'all') {
        caseParams.push(priority);
        baseCaseQuery += ` AND c.priority = $${caseParams.length}`;
      }

      if (search) {
        caseParams.push(`%${search.trim()}%`);
        const pIdx = caseParams.length;
        baseCaseQuery += ` AND (c.title ILIKE $${pIdx} OR c.description ILIKE $${pIdx} OR sub.first_name ILIKE $${pIdx} OR sub.last_name ILIKE $${pIdx} OR CAST(c.id AS TEXT) ILIKE $${pIdx})`;
      }

      const selectCaseQuery = `
        SELECT
          c.*,
          'case' as item_type,
          sub.first_name as submitter_first_name,
          sub.last_name as submitter_last_name,
          sub.email as submitter_email,
          ass.first_name as assignee_first_name,
          ass.last_name as assignee_last_name,
          COALESCE(sub.first_name || ' ' || sub.last_name, ass.first_name || ' ' || ass.last_name, cb.first_name || ' ' || cb.last_name, 'Assigned Agent') as investigator_name,
          CASE WHEN c.alert_id IS NOT NULL THEN 1 ELSE 0 END as alert_count,
          a.severity as alert_severity,
          a.alert_type,
          t.amount as transaction_amount,
          t.currency as transaction_currency,
          rs.score as risk_score,
          rs.risk_level,
          (SELECT COUNT(*) FROM case_notes cn WHERE cn.case_id = c.id) as note_count,
          (SELECT COUNT(*) FROM reports rep WHERE rep.case_id = c.id) as report_count
        ${baseCaseQuery}
      `;
      const caseRes = await db.query(selectCaseQuery, caseParams);
      items.push(...caseRes.rows);
    }

    if (type === 'reports') {
      let baseRepQuery = `
        FROM reports r
        LEFT JOIN cases c ON r.case_id = c.id
        LEFT JOIN users u ON r.generated_by = u.id
        WHERE 1=1
      `;
      const repParams = [];
      if (status && status !== 'all') {
        repParams.push(status);
        baseRepQuery += ` AND r.review_status = $${repParams.length}`;
      }
      if (priority && priority !== 'all') {
        repParams.push(priority);
        baseRepQuery += ` AND c.priority = $${repParams.length}`;
      }
      if (search) {
        repParams.push(`%${search.trim()}%`);
        const pIdx = repParams.length;
        baseRepQuery += ` AND (r.title ILIKE $${pIdx} OR c.title ILIKE $${pIdx} OR u.first_name ILIKE $${pIdx} OR u.last_name ILIKE $${pIdx} OR CAST(r.id AS TEXT) ILIKE $${pIdx})`;
      }
      const selectRepQuery = `
        SELECT
          r.id,
          r.case_id,
          r.title,
          COALESCE(r.review_status, 'draft') as status,
          COALESCE(c.priority, 'high') as priority,
          'report' as item_type,
          u.first_name as submitter_first_name,
          u.last_name as submitter_last_name,
          COALESCE(u.first_name || ' ' || u.last_name, 'System Operator') as investigator_name,
          CASE WHEN c.alert_id IS NOT NULL THEN 1 ELSE 0 END as alert_count,
          r.created_at as submitted_at,
          c.review_deadline
        ${baseRepQuery}
      `;
      const repRes = await db.query(selectRepQuery, repParams);
      items.push(...repRes.rows);
    }

    // Apply sortBy ('deadline', 'submission', 'priority')
    const priorityRank = { critical: 1, high: 2, medium: 3, low: 4 };
    items.sort((a, b) => {
      if (sortBy === 'priority') {
        const pa = priorityRank[a.priority] || 5;
        const pb = priorityRank[b.priority] || 5;
        if (pa !== pb) return pa - pb;
      } else if (sortBy === 'submission') {
        const da = new Date(a.submitted_at || a.created_at || 0).getTime();
        const dbTime = new Date(b.submitted_at || b.created_at || 0).getTime();
        if (dbTime !== da) return dbTime - da;
      } else {
        // Default: deadline ascending (nulls last), then status rank
        const dla = a.review_deadline ? new Date(a.review_deadline).getTime() : Infinity;
        const dlb = b.review_deadline ? new Date(b.review_deadline).getTime() : Infinity;
        if (dla !== dlb) return dla - dlb;
      }
      const statusRank = { submitted_for_review: 1, under_compliance_review: 2, escalated: 3, returned_for_correction: 4 };
      return (statusRank[a.status] || 5) - (statusRank[b.status] || 5);
    });

    const total = items.length;
    const paginated = items.slice(offsetNum, offsetNum + limitNum);

    res.status(200).json({
      success: true,
      total,
      count: paginated.length,
      limit: limitNum,
      offset: offsetNum,
      items: paginated,
      queue: paginated,
    });
  } catch (error) {
    console.error('Review queue error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve compliance review queue.' });
  }
});

// POST /api/compliance/cases/:id/submit - Investigator submits case for compliance review
router.post('/cases/:id/submit', authenticateToken, async (req, res) => {
  try {
    const caseId = parseInt(req.params.id, 10);
    const { deadline_days = 7 } = req.body;

    const caseRes = await db.query('SELECT * FROM cases WHERE id = $1', [caseId]);
    if (caseRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Case not found.' });
    }
    const current = caseRes.rows[0];

    // Compute review deadline
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + parseInt(deadline_days, 10));

    const updateRes = await db.query(
      `UPDATE cases 
       SET status = 'submitted_for_review', 
           submitted_at = CURRENT_TIMESTAMP, 
           submitted_by = $1, 
           review_deadline = $2
       WHERE id = $3 RETURNING *`,
      [req.user.id, deadline.toISOString(), caseId]
    );

    // Record review ledger action
    await db.query(
      `INSERT INTO compliance_reviews (case_id, reviewer_id, action, decision_notes, previous_status, new_status)
       VALUES ($1, $2, 'SUBMITTED', 'Investigator submitted dossier for official compliance review', $3, 'submitted_for_review')`,
      [caseId, req.user.id, current.status]
    );

    // Record case timeline history
    await db.query(
      `INSERT INTO case_history (case_id, action, changed_by)
       VALUES ($1, 'Case officially submitted to Compliance Review Queue', $2)`,
      [caseId, req.user.id]
    );

    await logAudit({
      userId: req.user.id,
      userRole: req.user.role,
      action: 'CASE_SUBMITTED_FOR_REVIEW',
      entityType: 'case',
      entityId: caseId,
      ipAddress: req.ip,
      outcome: 'SUCCESS',
      details: { caseId, submittedBy: req.user.email, deadline: deadline.toISOString() },
    });

    res.status(200).json({
      success: true,
      message: `Case #${caseId} submitted for compliance review successfully.`,
      case: updateRes.rows[0],
    });
  } catch (error) {
    console.error('Case submission error:', error);
    res.status(500).json({ success: false, message: 'Failed to submit case for review.' });
  }
});

// POST /api/compliance/cases/:id/decision - Compliance Officer makes a review decision
router.post('/cases/:id/decision', authenticateToken, authorizeRoles('compliance_officer', 'admin'), async (req, res) => {
  try {
    const caseId = parseInt(req.params.id, 10);
    const { action, comments, reason, return_reason } = req.body;
    const effectiveReason = return_reason || reason;
    // Allowed actions: 'START_REVIEW', 'ACCEPT_CASE', 'RETURN_FOR_CORRECTION', 'ESCALATE'

    const caseRes = await db.query('SELECT * FROM cases WHERE id = $1', [caseId]);
    if (caseRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Case not found.' });
    }
    const current = caseRes.rows[0];

    let newStatus = current.status;
    let actionDesc = '';

    if (action === 'START_REVIEW') {
      newStatus = 'under_compliance_review';
      actionDesc = 'Compliance Officer initiated active review of the dossier.';
    } else if (action === 'ACCEPT_CASE') {
      newStatus = 'compliance_accepted';
      actionDesc = comments || 'Dossier findings validated and accepted for formal regulatory filing.';
    } else if (action === 'RETURN_FOR_CORRECTION') {
      newStatus = 'returned_for_correction';
      if (!comments && !effectiveReason) {
        return res.status(400).json({ success: false, message: 'A return reason or correction comment is required.' });
      }
      actionDesc = `Returned for correction: ${effectiveReason || comments}`;
    } else if (action === 'ESCALATE') {
      newStatus = 'escalated';
      actionDesc = `Escalated for senior compliance panel review: ${comments || 'High complexity'}`;
    } else {
      return res.status(400).json({ success: false, message: `Invalid compliance decision action: ${action}` });
    }

    const updateRes = await db.query(
      `UPDATE cases 
       SET status = $1, 
           return_reason = $2, 
           compliance_notes = $3
       WHERE id = $4 RETURNING *`,
      [
        newStatus,
        action === 'RETURN_FOR_CORRECTION' ? effectiveReason || comments : current.return_reason,
        comments || current.compliance_notes,
        caseId,
      ]
    );

    // Insert compliance review record
    await db.query(
      `INSERT INTO compliance_reviews (case_id, reviewer_id, action, decision_notes, previous_status, new_status)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [caseId, req.user.id, action, actionDesc, current.status, newStatus]
    );

    // Append to case history
    await db.query(
      `INSERT INTO case_history (case_id, action, changed_by)
       VALUES ($1, $2, $3)`,
      [caseId, `Compliance Officer Decision: ${action.replace('_', ' ')} (${actionDesc})`, req.user.id]
    );

    await logAudit({
      userId: req.user.id,
      userRole: req.user.role,
      action: `COMPLIANCE_DECISION_${action}`,
      entityType: 'case',
      entityId: caseId,
      ipAddress: req.ip,
      outcome: 'SUCCESS',
      details: { caseId, action, newStatus, comments: actionDesc },
    });

    res.status(200).json({
      success: true,
      message: `Compliance decision '${action.replace('_', ' ')}' recorded successfully.`,
      case: updateRes.rows[0],
    });
  } catch (error) {
    console.error('Compliance decision error:', error);
    res.status(500).json({ success: false, message: 'Failed to record compliance decision.' });
  }
});

// GET /api/compliance/reports - List dossiers with review status for SAR review
router.get('/reports', authenticateToken, authorizeRoles('compliance_officer', 'admin'), async (req, res) => {
  try {
    const statusFilter = req.query.review_status || req.query.status;
    let query = `
      SELECT 
        r.*,
        c.title as case_title,
        c.priority as case_priority,
        c.status as case_status,
        u.first_name as generator_first_name,
        u.last_name as generator_last_name,
        COALESCE(u.first_name || ' ' || u.last_name, 'System Operator') as author_name,
        rev.first_name as reviewer_first_name,
        rev.last_name as reviewer_last_name,
        CASE WHEN rev.id IS NOT NULL THEN rev.first_name || ' ' || rev.last_name ELSE NULL END as reviewed_by_name
      FROM reports r
      LEFT JOIN cases c ON r.case_id = c.id
      LEFT JOIN users u ON r.generated_by = u.id
      LEFT JOIN users rev ON r.reviewed_by = rev.id
      WHERE 1=1
    `;
    const params = [];
    if (statusFilter && statusFilter !== 'all') {
      params.push(statusFilter);
      query += ` AND r.review_status = $${params.length}`;
    }

    query += ' ORDER BY r.created_at DESC';
    const result = await db.query(query, params);

    const synthesizedReports = result.rows.map(r => {
      let narrative = r.report_data?.summary || null;
      if (!narrative && r.report_data) {
        const d = r.report_data;
        const c = d.case || {};
        const a = d.alert || {};
        const t = d.transaction || {};
        const rs = d.riskScore || {};
        const notes = (d.notes || []).map(n => '  • ' + n.note_text).join('\n');
        
        const sections = [];
        sections.push('FINANCIAL CRIME INTELLIGENCE PLATFORM — SAR INVESTIGATION DOSSIER');
        sections.push('SUBJECT CASE: ' + (c.title || r.title || 'Official Case Record') + ' [Status: ' + (c.status || 'Active') + ', Priority: ' + (c.priority || 'High') + ']');
        if (c.description) sections.push('EXECUTIVE SUMMARY & FINDINGS:\n' + c.description);
        if (a.alert_type) sections.push('CORROBORATING ALERT:\n' + a.alert_type + ' [Severity: ' + (a.severity || 'High') + '] — ' + (a.description || 'Threshold rule exceeded'));
        if (t.amount) sections.push('PRIMARY TRANSACTION:\nAmount: ' + (t.currency || 'USD') + ' ' + Number(t.amount).toLocaleString() + ' | Channel: ' + (t.channel || 'wire') + ' | Date: ' + (t.transaction_date || 'N/A'));
        if (rs.score) sections.push('COMPLIANCE RISK INDEX:\nComposite Score: ' + rs.score + '/100 (' + (rs.risk_level || 'High') + ')');
        if (notes) sections.push('INVESTIGATIVE INTELLIGENCE NOTES:\n' + notes);
        narrative = sections.join('\n\n');
      }
      return {
        ...r,
        summary: narrative || 'Dossier compiled with linked transaction evidence, alert timeline, and audit verification.',
        content: narrative || 'Dossier compiled with linked transaction evidence, alert timeline, and audit verification.'
      };
    });

    res.status(200).json({
      success: true,
      count: synthesizedReports.length,
      reports: synthesizedReports,
    });
  } catch (error) {
    console.error('Compliance reports fetch error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve reports.' });
  }
});

// POST /api/compliance/reports/:id/decision - Approve, reject, or return a SAR report
router.post('/reports/:id/decision', authenticateToken, authorizeRoles('compliance_officer', 'admin'), async (req, res) => {
  try {
    const reportId = parseInt(req.params.id, 10);
    const { decision, comments } = req.body;
    // Allowed decisions: 'approved', 'rejected', 'returned'

    if (!['approved', 'rejected', 'returned'].includes(decision)) {
      return res.status(400).json({ success: false, message: 'Invalid report decision. Allowed: approved, rejected, returned' });
    }

    const repRes = await db.query('SELECT * FROM reports WHERE id = $1', [reportId]);
    if (repRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Report not found.' });
    }
    const currentRep = repRes.rows[0];

    const updateRes = await db.query(
      `UPDATE reports 
       SET review_status = $1, 
           reviewed_by = $2, 
           reviewed_at = CURRENT_TIMESTAMP, 
           review_comments = $3
       WHERE id = $4 RETURNING *`,
      [decision, req.user.id, comments || null, reportId]
    );

    // Record in compliance_reviews ledger
    await db.query(
      `INSERT INTO compliance_reviews (case_id, report_id, reviewer_id, action, decision_notes, previous_status, new_status)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        currentRep.case_id,
        reportId,
        req.user.id,
        `REPORT_${decision.toUpperCase()}`,
        comments || `Report review concluded with decision: ${decision}`,
        currentRep.review_status,
        decision,
      ]
    );

    await logAudit({
      userId: req.user.id,
      userRole: req.user.role,
      action: `REPORT_DECISION_${decision.toUpperCase()}`,
      entityType: 'report',
      entityId: reportId,
      ipAddress: req.ip,
      outcome: 'SUCCESS',
      details: { reportId, caseId: currentRep.case_id, decision, comments },
    });

    res.status(200).json({
      success: true,
      message: `Report #${reportId} ${decision} successfully.`,
      report: updateRes.rows[0],
    });
  } catch (error) {
    console.error('Report decision error:', error);
    res.status(500).json({ success: false, message: 'Failed to record report approval decision.' });
  }
});

// GET /api/compliance/risk-oversight - Compliance Risk Oversight patterns
router.get('/risk-oversight', authenticateToken, authorizeRoles('compliance_officer', 'admin'), async (req, res) => {
  try {
    // High-risk submitted cases
    const highRiskCases = await db.query(`
      SELECT 
        c.*, 
        t.amount as transaction_amount, 
        t.currency, 
        rs.score as risk_score, 
        rs.risk_level,
        u.first_name as investigator_first_name,
        u.last_name as investigator_last_name,
        COALESCE(u.first_name || ' ' || u.last_name, cb.first_name || ' ' || cb.last_name, 'Assigned Agent') as investigator_name,
        CASE WHEN c.alert_id IS NOT NULL THEN 1 ELSE 0 END as alert_count
      FROM cases c
      LEFT JOIN alerts a ON c.alert_id = a.id
      LEFT JOIN transactions t ON a.transaction_id = t.id
      LEFT JOIN risk_scores rs ON rs.entity_type = 'transaction' AND rs.entity_id = t.id
      LEFT JOIN users u ON c.assigned_to = u.id
      LEFT JOIN users cb ON c.created_by = cb.id
      WHERE (rs.score >= 70 OR c.priority IN ('high', 'critical'))
      ORDER BY rs.score DESC NULLS LAST
      LIMIT 20
    `);

    // Incomplete documentation cases (no notes or empty description)
    const documentationWarnings = await db.query(`
      SELECT c.*, COUNT(cn.id) as note_count,
        COALESCE(u.first_name || ' ' || u.last_name, cb.first_name || ' ' || cb.last_name, 'Assigned Agent') as investigator_name
      FROM cases c
      LEFT JOIN case_notes cn ON cn.case_id = c.id
      LEFT JOIN users u ON c.assigned_to = u.id
      LEFT JOIN users cb ON c.created_by = cb.id
      WHERE (c.description IS NULL OR LENGTH(c.description) < 20 OR c.alert_id IS NULL)
      GROUP BY c.id, u.id, cb.id
      HAVING COUNT(cn.id) = 0 OR c.alert_id IS NULL
      LIMIT 10
    `);

    // Detection Rule Heuristics Oversight Summary
    const rulesSummary = await db.query(`
      SELECT dr.*, COUNT(a.id) as triggered_alerts_count
      FROM detection_rules dr
      LEFT JOIN alerts a ON a.rule_id = dr.id
      GROUP BY dr.id
      ORDER BY triggered_alerts_count DESC
    `);

    const mappedRules = rulesSummary.rows.map(r => ({
      id: r.id,
      name: r.rule_name,
      rule_name: r.rule_name,
      rule_code: r.rule_type || ('RULE-00' + r.id),
      severity: r.risk_level || 'medium',
      risk_level: r.risk_level || 'medium',
      is_active: r.status === 'active' || r.is_active === true,
      status: r.status,
      alert_count: parseInt(r.triggered_alerts_count, 10) || 0,
      triggered_alerts_count: parseInt(r.triggered_alerts_count, 10) || 0,
      description: r.description || ('Automated AML heuristic condition: ' + r.condition_type + ' (Threshold: ' + r.threshold_value + ')')
    }));

    res.status(200).json({
      success: true,
      highRiskCases: highRiskCases.rows,
      documentationWarnings: documentationWarnings.rows,
      documentationIssues: documentationWarnings.rows,
      rulesSummary: rulesSummary.rows,
      rules: mappedRules,
    });
  } catch (error) {
    console.error('Risk oversight error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve risk oversight telemetry.' });
  }
});

// GET /api/compliance/audit-history - Review actions & decisions audit trail (Administrator only)
router.get('/audit-history', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const historyRes = await db.query(`
      SELECT 
        cr.*,
        u.first_name,
        u.last_name,
        u.email,
        u.role,
        c.title as case_title,
        c.priority as case_priority,
        r.title as report_title
      FROM compliance_reviews cr
      LEFT JOIN users u ON cr.reviewer_id = u.id
      LEFT JOIN cases c ON cr.case_id = c.id
      LEFT JOIN reports r ON cr.report_id = r.id
      ORDER BY cr.created_at DESC
      LIMIT 100
    `);

    res.status(200).json({
      success: true,
      count: historyRes.rows.length,
      history: historyRes.rows,
    });
  } catch (error) {
    console.error('Compliance audit history error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve compliance audit history.' });
  }
});

module.exports = router;
