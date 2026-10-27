const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticateToken } = require('../middleware/auth');

// POST /api/reports/generate - generate report for a case
router.post('/generate', authenticateToken, async (req, res) => {
  try {
    const { case_id, title } = req.body;
    if (!case_id) {
      return res.status(400).json({ success: false, message: 'case_id is required to compile a report.' });
    }

    // Gather Case Data
    const caseRes = await db.query('SELECT * FROM cases WHERE id = $1', [case_id]);
    if (caseRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Case not found.' });
    }
    const currentCase = caseRes.rows[0];

    // Linked Alert
    let alertData = null;
    let transactionData = null;
    let riskScoreData = null;

    if (currentCase.alert_id) {
      const aRes = await db.query('SELECT * FROM alerts WHERE id = $1', [currentCase.alert_id]);
      if (aRes.rows.length > 0) {
        alertData = aRes.rows[0];
        if (alertData.transaction_id) {
          const tRes = await db.query('SELECT * FROM transactions WHERE id = $1', [alertData.transaction_id]);
          if (tRes.rows.length > 0) transactionData = tRes.rows[0];

          const rsRes = await db.query(
            "SELECT * FROM risk_scores WHERE entity_type = 'transaction' AND entity_id = $1 ORDER BY calculated_at DESC LIMIT 1",
            [alertData.transaction_id]
          );
          if (rsRes.rows.length > 0) riskScoreData = rsRes.rows[0];
        }
      }
    }

    // Notes & Timeline
    const notesRes = await db.query('SELECT * FROM case_notes WHERE case_id = $1 ORDER BY created_at ASC', [case_id]);
    const histRes = await db.query('SELECT * FROM case_history WHERE case_id = $1 ORDER BY changed_at ASC', [case_id]);

    const reportPayload = {
      case: currentCase,
      alert: alertData,
      transaction: transactionData,
      riskScore: riskScoreData,
      notes: notesRes.rows,
      timeline: histRes.rows,
      generatedAt: new Date().toISOString(),
      generatedBy: req.user.email,
    };

    const reportTitle = title || `Dossier #${currentCase.id}: ${currentCase.title}`;
    const insertRes = await db.query(
      `INSERT INTO reports (case_id, title, report_data, generated_by)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [case_id, reportTitle, JSON.stringify(reportPayload), req.user.id]
    );

    res.status(201).json({ success: true, message: 'Compliance dossier generated.', report: insertRes.rows[0] });
  } catch (error) {
    console.error('Generate report error:', error);
    res.status(500).json({ success: false, message: 'Failed to compile report.' });
  }
});

// GET /api/reports - list all reports
router.get('/', authenticateToken, async (req, res) => {
  try {
    const listRes = await db.query(`
      SELECT r.id, r.case_id, r.title, r.created_at, u.first_name, u.last_name, c.priority
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

// GET /api/reports/:id/export - return report as printable HTML
router.get('/:id/export', authenticateToken, async (req, res) => {
  try {
    const reportId = parseInt(req.params.id, 10);
    const repRes = await db.query('SELECT * FROM reports WHERE id = $1', [reportId]);
    if (repRes.rows.length === 0) {
      return res.status(404).send('Report not found.');
    }

    const report = repRes.rows[0];
    const d = report.report_data;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>${report.title} - FCIP Intelligence Report</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #070b14; color: #e2e8f0; padding: 40px; margin: 0; }
          .header { border-bottom: 2px solid #06b6d4; padding-bottom: 20px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: center; }
          .title { font-size: 24px; font-weight: bold; color: #fff; margin: 0; }
          .badge { display: inline-block; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: bold; text-transform: uppercase; }
          .badge-high { background: rgba(239, 68, 68, 0.2); color: #f87171; border: 1px solid #ef4444; }
          .badge-open { background: rgba(6, 182, 212, 0.2); color: #38bdf8; border: 1px solid #06b6d4; }
          .card { background: #0f172a; border: 1px solid #334155; border-radius: 10px; padding: 20px; margin-bottom: 20px; }
          h2 { color: #38bdf8; font-size: 16px; margin-top: 0; border-bottom: 1px solid #1e293b; padding-bottom: 8px; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
          .label { font-size: 11px; text-transform: uppercase; color: #94a3b8; }
          .val { font-size: 14px; font-weight: 600; color: #f8fafc; margin-top: 2px; }
          .print-btn { background: #06b6d4; color: #000; border: none; padding: 8px 16px; font-weight: bold; border-radius: 6px; cursor: pointer; }
          @media print { .print-btn { display: none; } body { background: #fff; color: #000; } .card { background: #f8fafc; border-color: #cbd5e1; } h2 { color: #0284c7; } .val { color: #000; } }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div style="font-size: 11px; color: #38bdf8; letter-spacing: 1.5px; font-weight: bold;">FINANCIAL CRIME INTELLIGENCE PLATFORM</div>
            <h1 class="title">${report.title}</h1>
            <p style="font-size: 12px; color: #94a3b8; margin: 4px 0 0 0;">Generated by: ${d.generatedBy} on ${new Date(d.generatedAt).toLocaleString()}</p>
          </div>
          <div>
            <button class="print-btn" onclick="window.print()">Print / Export PDF</button>
          </div>
        </div>

        <div class="card">
          <h2>Case Intelligence Overview</h2>
          <div class="grid">
            <div><div class="label">Case ID</div><div class="val">#${d.case?.id}</div></div>
            <div><div class="label">Priority / Status</div><div class="val">${d.case?.priority?.toUpperCase()} / ${d.case?.status?.toUpperCase()}</div></div>
            <div style="grid-column: span 2;"><div class="label">Description</div><div class="val">${d.case?.description || 'N/A'}</div></div>
          </div>
        </div>

        ${d.alert ? `
        <div class="card">
          <h2>Triggered Alert & Matched Rule</h2>
          <div class="grid">
            <div><div class="label">Alert ID</div><div class="val">#${d.alert.id}</div></div>
            <div><div class="label">Severity</div><div class="val">${d.alert.severity?.toUpperCase()}</div></div>
            <div style="grid-column: span 2;"><div class="label">Alert Type</div><div class="val">${d.alert.alert_type}</div></div>
            <div style="grid-column: span 2;"><div class="label">Reasoning</div><div class="val">${d.alert.description}</div></div>
          </div>
        </div>
        ` : ''}

        ${d.transaction ? `
        <div class="card">
          <h2>Financial Transaction Under Surveillance</h2>
          <div class="grid">
            <div><div class="label">Transaction Amount</div><div class="val">$${parseFloat(d.transaction.amount).toLocaleString()} ${d.transaction.currency}</div></div>
            <div><div class="label">Channel / Type</div><div class="val">${d.transaction.channel} / ${d.transaction.transaction_type}</div></div>
            <div><div class="label">Timestamp</div><div class="val">${new Date(d.transaction.transaction_date).toLocaleString()}</div></div>
            <div><div class="label">Calculated Risk Score</div><div class="val">${d.riskScore ? `${d.riskScore.score} / 100 (${d.riskScore.risk_level})` : 'Unscored'}</div></div>
          </div>
        </div>
        ` : ''}

        <div class="card">
          <h2>Investigator Dossier Notes (${d.notes?.length || 0})</h2>
          ${d.notes?.length > 0 ? d.notes.map(n => `
            <div style="border-left: 2px solid #38bdf8; padding-left: 12px; margin-bottom: 12px;">
              <div style="font-size: 11px; color: #94a3b8;">${new Date(n.created_at).toLocaleString()}</div>
              <div style="font-size: 13px; color: #e2e8f0; margin-top: 3px;">${n.note_text}</div>
            </div>
          `).join('') : '<p style="font-size: 12px; color: #64748b;">No notes recorded for this dossier.</p>'}
        </div>
      </body>
      </html>
    `;

    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (error) {
    console.error('Export report error:', error);
    res.status(500).send('Error generating printable report.');
  }
});

module.exports = router;
