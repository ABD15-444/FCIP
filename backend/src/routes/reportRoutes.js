const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticateToken } = require('../middleware/auth');
const { logAudit } = require('../middleware/audit');

// POST /api/reports/generate - generate report for a case
router.post('/generate', authenticateToken, async (req, res) => {
  try {
    const { case_id, title, is_official_sar = false } = req.body;
    if (!case_id) {
      return res.status(400).json({ success: false, message: 'case_id is required to compile a report.' });
    }

    // Gather Case Data
    const caseRes = await db.query('SELECT * FROM cases WHERE id = $1', [case_id]);
    if (caseRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Case not found.' });
    }
    const currentCase = caseRes.rows[0];

    // Linked Alert & Transaction Details
    let alertData = null;
    let transactionData = null;
    let riskScoreData = null;
    let riskFactorsData = [];

    if (currentCase.alert_id) {
      const aRes = await db.query(
        `
        SELECT a.*, dr.rule_name, dr.condition_type, dr.threshold_value 
        FROM alerts a 
        LEFT JOIN detection_rules dr ON a.rule_id = dr.id 
        WHERE a.id = $1
      `,
        [currentCase.alert_id]
      );

      if (aRes.rows.length > 0) {
        alertData = aRes.rows[0];
        if (alertData.transaction_id) {
          const tRes = await db.query(
            `
            SELECT 
              t.*,
              fa.account_number as from_account,
              ta.account_number as to_account,
              fc.first_name as sender_first_name,
              fc.last_name as sender_last_name,
              fc.email as sender_email,
              tc.first_name as recipient_first_name,
              tc.last_name as recipient_last_name,
              tc.email as recipient_email
            FROM transactions t
            LEFT JOIN accounts fa ON t.from_account_id = fa.id
            LEFT JOIN customers fc ON fa.customer_id = fc.id
            LEFT JOIN accounts ta ON t.to_account_id = ta.id
            LEFT JOIN customers tc ON ta.customer_id = tc.id
            WHERE t.id = $1
          `,
            [alertData.transaction_id]
          );
          if (tRes.rows.length > 0) transactionData = tRes.rows[0];

          const rsRes = await db.query(
            "SELECT * FROM risk_scores WHERE entity_type = 'transaction' AND entity_id = $1 ORDER BY calculated_at DESC LIMIT 1",
            [alertData.transaction_id]
          );
          if (rsRes.rows.length > 0) {
            riskScoreData = rsRes.rows[0];
            const rfRes = await db.query('SELECT * FROM risk_factors WHERE risk_score_id = $1', [rsRes.rows[0].id]);
            riskFactorsData = rfRes.rows;
          }
        }
      }
    }

    // Notes & Timeline
    const notesRes = await db.query(
      `
      SELECT cn.*, u.first_name, u.last_name, u.role 
      FROM case_notes cn 
      LEFT JOIN users u ON cn.created_by = u.id 
      WHERE cn.case_id = $1 
      ORDER BY cn.created_at ASC
    `,
      [case_id]
    );

    const histRes = await db.query(
      `
      SELECT ch.*, u.first_name, u.last_name 
      FROM case_history ch 
      LEFT JOIN users u ON ch.changed_by = u.id 
      WHERE ch.case_id = $1 
      ORDER BY ch.changed_at ASC
    `,
      [case_id]
    );

    const reportTypeLabel = is_official_sar ? 'Official Suspicious Activity Report (SAR)' : 'Internal Investigation Dossier';

    const reportPayload = {
      reportType: reportTypeLabel,
      isOfficialSAR: Boolean(is_official_sar),
      case: currentCase,
      alert: alertData,
      transaction: transactionData,
      riskScore: riskScoreData,
      riskFactors: riskFactorsData,
      notes: notesRes.rows,
      timeline: histRes.rows,
      generatedAt: new Date().toISOString(),
      generatedBy: req.user.email,
      authorName: `${req.user.first_name || ''} ${req.user.last_name || ''}`.trim() || req.user.email,
      authorRole: req.user.role,
    };

    const reportTitle = title || `${reportTypeLabel} — Case #${currentCase.id}: ${currentCase.title}`;
    const insertRes = await db.query(
      `INSERT INTO reports (case_id, title, report_data, generated_by)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [case_id, reportTitle, JSON.stringify(reportPayload), req.user.id]
    );

    await logAudit(
      req.user.id,
      'REPORT_GENERATED',
      'report',
      insertRes.rows[0].id,
      req.ip || '127.0.0.1',
      { reportId: insertRes.rows[0].id, caseId: case_id, isOfficialSAR: is_official_sar }
    );

    res.status(201).json({ success: true, message: `${reportTypeLabel} compiled successfully.`, report: insertRes.rows[0] });
  } catch (error) {
    console.error('Generate report error:', error);
    res.status(500).json({ success: false, message: 'Failed to compile report.' });
  }
});

// GET /api/reports - list all reports
router.get('/', authenticateToken, async (req, res) => {
  try {
    const listRes = await db.query(`
      SELECT 
        r.id, 
        r.case_id, 
        r.title, 
        r.created_at, 
        r.report_data->>'reportType' as report_type,
        r.report_data->>'isOfficialSAR' as is_official_sar,
        u.first_name, 
        u.last_name, 
        c.priority,
        c.status as case_status
      FROM reports r
      LEFT JOIN users u ON r.generated_by = u.id
      LEFT JOIN cases c ON r.case_id = c.id
      ORDER BY r.created_at DESC
    `);
    res.status(200).json({ success: true, count: listRes.rows.length, reports: listRes.rows });
  } catch (error) {
    console.error('Fetch reports error:', error);
    res.status(500).json({ success: false, message: 'Error retrieving reports.' });
  }
});

// GET /api/reports/:id/export - printable view with PDF-ready styling and authenticated access
router.get('/:id/export', authenticateToken, async (req, res) => {
  try {
    const reportId = parseInt(req.params.id, 10);
    if (isNaN(reportId)) {
      return res.status(400).json({ success: false, message: 'Invalid report ID provided.' });
    }

    const repRes = await db.query('SELECT * FROM reports WHERE id = $1', [reportId]);
    if (repRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Case report not found.' });
    }

    const report = repRes.rows[0];
    const d = report.report_data;

    const isSAR = d.isOfficialSAR;

    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="utf-8" />
        <title>${report.title} — FCIP Intelligence Report</title>
        <style>
          @page { size: A4; margin: 20mm; }
          body { 
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; 
            background: #070b14; 
            color: #e2e8f0; 
            padding: 40px; 
            margin: 0; 
            line-height: 1.5;
          }
          .header { 
            border-bottom: 2px solid ${isSAR ? '#ef4444' : '#06b6d4'}; 
            padding-bottom: 20px; 
            margin-bottom: 30px; 
            display: flex; 
            justify-content: space-between; 
            align-items: flex-start; 
          }
          .title { font-size: 22px; font-weight: 800; color: #fff; margin: 4px 0; }
          .classification {
            font-size: 11px;
            font-weight: 800;
            letter-spacing: 1.5px;
            text-transform: uppercase;
            color: ${isSAR ? '#ef4444' : '#38bdf8'};
          }
          .card { background: #0f172a; border: 1px solid #334155; border-radius: 10px; padding: 20px; margin-bottom: 20px; }
          h2 { color: #38bdf8; font-size: 14px; margin-top: 0; border-bottom: 1px solid #1e293b; padding-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
          .label { font-size: 11px; text-transform: uppercase; color: #94a3b8; font-family: monospace; }
          .val { font-size: 13px; font-weight: 600; color: #f8fafc; margin-top: 2px; }
          .factor-item { padding: 8px 12px; border-radius: 6px; background: #1e293b; margin-top: 6px; font-size: 12px; }
          .print-btn { 
            background: #06b6d4; 
            color: #000; 
            border: none; 
            padding: 10px 20px; 
            font-weight: bold; 
            border-radius: 8px; 
            cursor: pointer;
            box-shadow: 0 4px 12px rgba(6, 182, 212, 0.3);
          }
          .sar-banner {
            background: rgba(239, 68, 68, 0.15);
            border: 1px solid #ef4444;
            border-radius: 8px;
            padding: 12px;
            margin-bottom: 20px;
            font-size: 12px;
            color: #fca5a5;
          }
          @media print { 
            .print-btn { display: none; } 
            body { background: #fff !important; color: #000 !important; padding: 0; } 
            .card { background: #f8fafc !important; border-color: #cbd5e1 !important; page-break-inside: avoid; } 
            h2 { color: #0284c7 !important; border-color: #e2e8f0 !important; } 
            .val { color: #000 !important; } 
            .label { color: #64748b !important; }
            .factor-item { background: #f1f5f9 !important; border: 1px solid #e2e8f0; }
            .sar-banner { background: #fee2e2 !important; color: #991b1b !important; border-color: #f87171 !important; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="classification">FINANCIAL CRIME INTELLIGENCE PLATFORM • ${d.reportType || 'INVESTIGATION DOSSIER'}</div>
            <h1 class="title">${report.title}</h1>
            <p style="font-size: 12px; color: #94a3b8; margin: 4px 0 0 0; font-family: monospace;">
              Generated: ${new Date(d.generatedAt).toLocaleString()} | Author: ${d.authorName} (${d.authorRole})
            </p>
          </div>
          <div>
            <button class="print-btn" onclick="window.print()">Print / Export PDF</button>
          </div>
        </div>

        ${isSAR ? `
        <div class="sar-banner">
          <strong>CONFIDENTIAL / LAW ENFORCEMENT SENSITIVE:</strong> This Suspicious Activity Report (SAR) contains sensitive financial intelligence compiled under AML/CFT surveillance protocols. Unauthorized disclosure is prohibited by law.
        </div>
        ` : ''}

        <div class="card">
          <h2>Case Dossier Details</h2>
          <div class="grid">
            <div><div class="label">Case Identifier</div><div class="val">CASE #${d.case?.id}</div></div>
            <div><div class="label">Investigation Priority & Status</div><div class="val">${d.case?.priority?.toUpperCase()} / ${d.case?.status?.toUpperCase()}</div></div>
            <div style="grid-column: span 2;"><div class="label">Hypothesis & Overview</div><div class="val">${d.case?.description || 'N/A'}</div></div>
          </div>
        </div>

        ${d.alert ? `
        <div class="card">
          <h2>Triggering Alert & Detection Rule</h2>
          <div class="grid">
            <div><div class="label">Alert Reference</div><div class="val">ALERT #${d.alert.id} (${d.alert.severity?.toUpperCase()})</div></div>
            <div><div class="label">Rule Matched</div><div class="val">${d.alert.rule_name || d.alert.alert_type}</div></div>
            <div style="grid-column: span 2;"><div class="label">Detection Rule Condition</div><div class="val">${d.alert.condition_type} (Threshold: ${d.alert.threshold_value})</div></div>
            <div style="grid-column: span 2;"><div class="label">Alert Narrative</div><div class="val">${d.alert.description}</div></div>
          </div>
        </div>
        ` : ''}

        ${d.transaction ? `
        <div class="card">
          <h2>Financial Transaction Under Surveillance</h2>
          <div class="grid">
            <div><div class="label">Transaction Amount</div><div class="val">$${parseFloat(d.transaction.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })} ${d.transaction.currency}</div></div>
            <div><div class="label">Date & Channel</div><div class="val">${new Date(d.transaction.transaction_date).toLocaleString()} (${d.transaction.channel} / ${d.transaction.transaction_type})</div></div>
            <div><div class="label">Sender Account</div><div class="val">${d.transaction.from_account || 'N/A'} (${d.transaction.sender_first_name ? `${d.transaction.sender_first_name} ${d.transaction.sender_last_name}` : 'Unassigned Holder'})</div></div>
            <div><div class="label">Recipient Account</div><div class="val">${d.transaction.to_account || 'N/A'} (${d.transaction.recipient_first_name ? `${d.transaction.recipient_first_name} ${d.transaction.recipient_last_name}` : 'Unassigned Holder'})</div></div>
            <div style="grid-column: span 2;">
              <div class="label">Calculated Risk Score</div>
              <div class="val">${d.riskScore ? `${d.riskScore.score} / 100 (${d.riskScore.risk_level} Risk)` : 'Unevaluated'}</div>
            </div>
          </div>
          ${d.riskFactors?.length > 0 ? `
            <div style="margin-top: 15px;">
              <div class="label">Contributing Detection Factors (${d.riskFactors.length})</div>
              ${d.riskFactors.map(f => `
                <div class="factor-item">
                  <strong>${f.factor_name}</strong> (+${f.contribution} pts) — <span>${f.description}</span>
                </div>
              `).join('')}
            </div>
          ` : ''}
        </div>
        ` : ''}

        <div class="card">
          <h2>Investigator Intelligence Notes (${d.notes?.length || 0})</h2>
          ${d.notes?.length > 0 ? d.notes.map(n => `
            <div style="border-left: 3px solid #38bdf8; padding-left: 12px; margin-bottom: 12px;">
              <div style="font-size: 11px; color: #94a3b8; font-family: monospace;">${new Date(n.created_at).toLocaleString()} • ${n.first_name} ${n.last_name} (${n.role})</div>
              <div style="font-size: 13px; color: #e2e8f0; margin-top: 3px;">${n.note_text}</div>
            </div>
          `).join('') : '<p style="font-size: 12px; color: #64748b;">No investigator notes appended to this case.</p>'}
        </div>

        <div class="card">
          <h2>Chain of Custody & Case Timeline (${d.timeline?.length || 0})</h2>
          ${d.timeline?.length > 0 ? d.timeline.map(h => `
            <div style="font-size: 12px; margin-bottom: 6px; display: flex; justify-content: space-between; font-family: monospace;">
              <span>• ${h.action}</span>
              <span style="color: #94a3b8;">${new Date(h.changed_at).toLocaleString()}</span>
            </div>
          `).join('') : '<p style="font-size: 12px; color: #64748b;">No timeline entries recorded.</p>'}
        </div>

        <footer style="margin-top: 40px; font-size: 10px; color: #64748b; text-align: center; font-family: monospace; border-top: 1px solid #1e293b; padding-top: 15px;">
          Financial Crime Intelligence Platform • Cryptographic Record ID #${report.id} • Generated by FCIP Automated AML Engine
        </footer>
      </body>
      </html>
    `;

    const safeFilename = (report.title || `fcip-report-${report.id}`)
      .replace(/[^a-z0-9\-_. ]/gi, '_')
      .trim();

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition', `inline; filename="${safeFilename}.html"`);
    res.send(html);
  } catch (error) {
    console.error('Export report error:', error);
    res.status(500).json({ success: false, message: 'Error generating printable report.' });
  }
});

module.exports = router;
