const path = require('path');
const bcrypt = require('bcrypt');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const db = require('../config/db');
const { runDetectionEngine } = require('../services/detectionEngine');

async function runDemoReset() {
  console.log('====================================================');
  console.log('   FCIP LIVE DEMONSTRATION DATA RESET & SEEDING     ');
  console.log('====================================================');

  // 1. Safety Guard Checks
  const hasConfirm = process.argv.includes('--confirm') || process.env.DEMO_RESET === 'true';
  if (!hasConfirm) {
    console.error('❌ SAFETY ABORT: Demo reset requires the explicit confirmation flag.');
    console.error('Usage: npm run demo:reset');
    console.error('Or:    node backend/src/scripts/demoReset.js --confirm');
    process.exit(1);
  }

  const isProd = process.env.NODE_ENV === 'production';
  if (isProd) {
    console.error('❌ SAFETY ABORT: Demo reset cannot run when NODE_ENV is set to "production".');
    process.exit(1);
  }

  const dbName = process.env.DB_NAME || 'fcip_db';
  const dbHost = process.env.DB_HOST || 'localhost';
  console.log(`[Safety Check] Target Database: '${dbName}' on ${dbHost} (Non-production verified)`);

  const client = await db.pool.connect();

  try {
    await client.query('BEGIN');
    console.log('[1/6] Transaction initiated. Cleaning obsolete demonstration records...');

    // Delete in reverse foreign key order
    await client.query('DELETE FROM compliance_reviews');
    await client.query('DELETE FROM reports');
    await client.query('DELETE FROM case_notes');
    await client.query('DELETE FROM case_history');
    await client.query('DELETE FROM cases');
    await client.query('DELETE FROM suspicious_flags');
    await client.query('DELETE FROM alerts');
    await client.query('DELETE FROM risk_factors');
    await client.query('DELETE FROM risk_scores');
    await client.query('DELETE FROM entity_relationships');
    await client.query('DELETE FROM transactions');
    await client.query('DELETE FROM accounts');
    await client.query('DELETE FROM customers');
    await client.query('DELETE FROM dataset_ingest_history');
    await client.query('DELETE FROM detection_run_history');
    await client.query('DELETE FROM audit_logs');

    // Reset sequences for clean predictable IDs
    await client.query('ALTER SEQUENCE IF EXISTS customers_id_seq RESTART WITH 1');
    await client.query('ALTER SEQUENCE IF EXISTS accounts_id_seq RESTART WITH 1');
    await client.query('ALTER SEQUENCE IF EXISTS transactions_id_seq RESTART WITH 1');
    await client.query('ALTER SEQUENCE IF EXISTS alerts_id_seq RESTART WITH 1');
    await client.query('ALTER SEQUENCE IF EXISTS cases_id_seq RESTART WITH 1');
    await client.query('ALTER SEQUENCE IF EXISTS reports_id_seq RESTART WITH 1');
    await client.query('ALTER SEQUENCE IF EXISTS case_notes_id_seq RESTART WITH 1');
    await client.query('ALTER SEQUENCE IF EXISTS case_history_id_seq RESTART WITH 1');
    await client.query('ALTER SEQUENCE IF EXISTS compliance_reviews_id_seq RESTART WITH 1');
    await client.query('ALTER SEQUENCE IF EXISTS audit_logs_id_seq RESTART WITH 1');

    console.log('✓ Cleared previous operational cases, alerts, transactions, and audit records (sequences reset to 1).');

    // 2. Preserve & Standardize Demo Users
    console.log('[2/6] Verifying canonical demonstration users...');
    const defaultPassword = 'Password123!';
    const passwordHash = await bcrypt.hash(defaultPassword, 10);

    const demoUsers = [
      {
        email: 'admin@fcip.agency',
        first_name: 'Admin',
        last_name: 'Supervisor',
        role: 'admin',
        status: 'active'
      },
      {
        email: 'test.adminstrator@fcip.agency',
        first_name: 'Roshan',
        last_name: 'Bilal',
        role: 'admin',
        status: 'active'
      },
      {
        email: 'test.investigator@fcip.agency',
        first_name: 'Abraham',
        last_name: 'David',
        role: 'investigator',
        status: 'active'
      },
      {
        email: 'test.compliance@fcip.agency',
        first_name: 'Arahat',
        last_name: 'Gaikwad',
        role: 'compliance_officer',
        status: 'active'
      }
    ];

    const userMap = {};
    for (const u of demoUsers) {
      const existing = await client.query('SELECT id FROM users WHERE email = $1', [u.email]);
      let userId;
      if (existing.rows.length > 0) {
        userId = existing.rows[0].id;
        await client.query(
          `UPDATE users SET first_name = $1, last_name = $2, role = $3, status = $4, password_hash = $5 WHERE id = $6`,
          [u.first_name, u.last_name, u.role, u.status, passwordHash, userId]
        );
      } else {
        const inserted = await client.query(
          `INSERT INTO users (first_name, last_name, email, password_hash, role, status)
           VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
          [u.first_name, u.last_name, u.email, passwordHash, u.role, u.status]
        );
        userId = inserted.rows[0].id;
      }
      userMap[u.role] = userId;
      userMap[u.email] = userId;
    }
    console.log('✓ 4 demo users verified (Investigator, Compliance Officer, Admin). Default password: Password123!');

    // 3. Seed Synthetic Customers & Entities (10 Entities)
    console.log('[3/6] Seeding synthetic entities and commercial accounts...');
    const customersData = [
      { name: 'Vortex Global Trading Ltd', phone: '+357-25-104920', address: 'Limassol Commercial Port Nexus, Cyprus', country: 'Cyprus' },
      { name: 'Apex Horizon Logistics Corp', phone: '+44-20-79460912', address: 'Canary Wharf Maritime Docklands, London, UK', country: 'United Kingdom' },
      { name: 'Dr. Julian Sterling', phone: '+41-22-8199201', address: 'Rue du Rhone Private Chambers, Geneva, Switzerland', country: 'Switzerland' },
      { name: 'Helena Vance', phone: '+1-212-5550183', address: '742 Broadway Commercial Suites, New York, NY, USA', country: 'United States' },
      { name: 'Kasper Thorne', phone: '+1-312-5550144', address: 'Wacker Drive Financial Tower, Chicago, IL, USA', country: 'United States' },
      { name: 'Beacon Import-Export FZE', phone: '+971-4-8812900', address: 'Jebel Ali Free Zone Authority, Dubai, UAE', country: 'United Arab Emirates' },
      { name: 'Solomon Cruz', phone: '+1-415-5550198', address: 'Montgomery Financial Plaza, San Francisco, CA, USA', country: 'United States' },
      { name: 'Aura Digital Ventures GmbH', phone: '+49-69-9750012', address: 'Mainzer Landstrasse Banking Quarter, Frankfurt, Germany', country: 'Germany' },
      { name: 'Seraphina Zhang', phone: '+65-67120934', address: 'Marina Bay Financial Centre, Singapore', country: 'Singapore' },
      { name: 'Nautical Prime Shipping LLC', phone: '+1-713-5550167', address: 'Port of Houston Maritime Terminal, Houston, TX, USA', country: 'United States' },
    ];

    const customerIds = [];
    for (const c of customersData) {
      const names = c.name.split(' ');
      const firstName = names[0];
      const lastName = names.slice(1).join(' ') || 'Corp';
      const email = `${firstName.toLowerCase().replace(/[^a-z0-9]/g, '')}@synthetic-client.com`;
      const res = await client.query(
        `INSERT INTO customers (first_name, last_name, email, phone, address, nationality, status, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, 'active', CURRENT_TIMESTAMP - INTERVAL '60 days') RETURNING id`,
        [firstName, lastName, email, c.phone, c.address, c.country]
      );
      customerIds.push(res.rows[0].id);
    }

    // Seed 10 Matching Accounts
    const accountsData = [
      { num: 'ACC-1001-VORTEX', custIdx: 0, cur: 'USD', type: 'checking' },
      { num: 'ACC-1002-APEX', custIdx: 1, cur: 'USD', type: 'checking' },
      { num: 'ACC-1003-STERLING', custIdx: 2, cur: 'EUR', type: 'checking' },
      { num: 'ACC-1004-VANCE', custIdx: 3, cur: 'USD', type: 'checking' },
      { num: 'ACC-1005-THORNE', custIdx: 4, cur: 'USD', type: 'checking' },
      { num: 'ACC-1006-BEACON', custIdx: 5, cur: 'USD', type: 'checking' },
      { num: 'ACC-1007-CRUZ', custIdx: 6, cur: 'USD', type: 'checking' },
      { num: 'ACC-1008-AURA', custIdx: 7, cur: 'EUR', type: 'checking' },
      { num: 'ACC-1009-ZHANG', custIdx: 8, cur: 'USD', type: 'checking' },
      { num: 'ACC-1010-NAUTICAL', custIdx: 9, cur: 'USD', type: 'checking' },
    ];

    const accountIds = [];
    for (const a of accountsData) {
      const res = await client.query(
        `INSERT INTO accounts (customer_id, account_number, account_type, currency, status, open_date)
         VALUES ($1, $2, $3, $4, 'active', CURRENT_TIMESTAMP - INTERVAL '60 days') RETURNING id`,
        [customerIds[a.custIdx], a.num, a.type, a.cur]
      );
      accountIds.push(res.rows[0].id);
    }
    console.log(`✓ Seeded ${customersData.length} customers and ${accountsData.length} financial accounts.`);

    // 4. Seed Synthetic Transactions (18 Transactions covering 5 core AML patterns)
    console.log('[4/6] Seeding 18 calibrated multi-scenario financial transactions...');
    
    const now = new Date();
    const tMinusHours = (h) => new Date(now.getTime() - h * 3600 * 1000).toISOString();
    const tMinusMinutes = (m) => new Date(now.getTime() - m * 60 * 1000).toISOString();

    const transactionsData = [
      // SCENARIO 1: Circular Laundering Loop (ACC-1001 -> ACC-1002 -> ACC-1006 -> ACC-1001)
      { from: 0, to: 1, amount: 25000.00, cur: 'USD', type: 'transfer', chan: 'wire', date: tMinusHours(48), desc: 'Consulting Settlement Batch 1' },
      { from: 1, to: 5, amount: 24500.00, cur: 'USD', type: 'transfer', chan: 'wire', date: tMinusHours(44), desc: 'Logistics Subcontract Fee' },
      { from: 5, to: 0, amount: 24000.00, cur: 'USD', type: 'transfer', chan: 'wire', date: tMinusHours(40), desc: 'Management Retainer Rebate' }, // Loop back to 0!

      // SCENARIO 2: Exorbitant Large Amount Cross-Border Transfers
      { from: 2, to: 7, amount: 75000.00, cur: 'EUR', type: 'wire_transfer', chan: 'wire', date: tMinusHours(36), desc: 'Cross-Border Capital Injection' },
      { from: 7, to: 0, amount: 68000.00, cur: 'EUR', type: 'wire_transfer', chan: 'wire', date: tMinusHours(30), desc: 'Offshore Escrow Allocation' },

      // SCENARIO 3: High-Frequency Structuring Velocity Burst (ACC-1005 sends 4 rapid transactions within 8 mins)
      { from: 4, to: 3, amount: 3200.00, cur: 'USD', type: 'transfer', chan: 'mobile', date: tMinusMinutes(180), desc: 'Expedited Merchant Payout A' },
      { from: 4, to: 3, amount: 3400.00, cur: 'USD', type: 'transfer', chan: 'mobile', date: tMinusMinutes(178), desc: 'Expedited Merchant Payout B' },
      { from: 4, to: 6, amount: 3100.00, cur: 'USD', type: 'transfer', chan: 'mobile', date: tMinusMinutes(175), desc: 'Contractor Expense Disbursement' },
      { from: 4, to: 8, amount: 3500.00, cur: 'USD', type: 'transfer', chan: 'mobile', date: tMinusMinutes(172), desc: 'International Service Staging' }, // 4th rapid tx!

      // SCENARIO 4: Suspicious Round Number Denominations
      { from: 6, to: 8, amount: 10000.00, cur: 'USD', type: 'transfer', chan: 'online', date: tMinusHours(20), desc: 'Private Liquidity Advance' },
      { from: 8, to: 9, amount: 15000.00, cur: 'USD', type: 'transfer', chan: 'wire', date: tMinusHours(18), desc: 'Maritime Vessel Charter Advance' },

      // SCENARIO 5: Benign Commercial Operations (Control Baseline - No triggers)
      { from: 3, to: 6, amount: 345.50, cur: 'USD', type: 'payment', chan: 'pos', date: tMinusHours(24), desc: 'Office Supply Merchant Order' },
      { from: 6, to: 3, amount: 120.00, cur: 'USD', type: 'payment', chan: 'mobile', date: tMinusHours(22), desc: 'Courier Reimbursement' },
      { from: 9, to: 1, amount: 2450.75, cur: 'USD', type: 'transfer', chan: 'wire', date: tMinusHours(16), desc: 'Container Demurrage Fee' },
      { from: 7, to: 2, amount: 1820.40, cur: 'EUR', type: 'transfer', chan: 'online', date: tMinusHours(14), desc: 'Enterprise SaaS Annual License' },
      { from: 1, to: 4, amount: 4120.00, cur: 'USD', type: 'transfer', chan: 'wire', date: tMinusHours(12), desc: 'Quarterly Supply Chain Audit' },
      { from: 8, to: 3, amount: 890.25, cur: 'USD', type: 'payment', chan: 'online', date: tMinusHours(8), desc: 'Commercial Invoice Settlement' },
      { from: 5, to: 9, amount: 3750.60, cur: 'USD', type: 'transfer', chan: 'wire', date: tMinusHours(4), desc: 'Port Authority Harbor Clearance' },
    ];

    const transactionIds = [];
    for (const t of transactionsData) {
      const res = await client.query(
        `INSERT INTO transactions (from_account_id, to_account_id, amount, currency, transaction_type, channel, transaction_date, description)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
        [accountIds[t.from], accountIds[t.to], t.amount, t.cur, t.type, t.chan, t.date, t.desc]
      );
      transactionIds.push(res.rows[0].id);
    }
    console.log(`✓ Seeded ${transactionsData.length} calibrated transactions.`);

    // 5. Seed Entity Relationships for Network Visualizer
    for (let i = 0; i < transactionsData.length; i++) {
      const t = transactionsData[i];
      await client.query(
        `INSERT INTO entity_relationships (entity_type_1, entity_id_1, entity_type_2, entity_id_2, relationship_type, transaction_count, total_amount)
         VALUES ('account', $1, 'account', $2, 'transacted_with', 1, $3)`,
        [accountIds[t.from], accountIds[t.to], t.amount]
      );
    }

    await client.query('COMMIT');
    console.log('✓ Base records committed successfully.');

    // 6. Run authoritative Detection Engine
    console.log('[5/6] Executing FCIP Detection Engine across seeded dataset...');
    const detectionResult = await runDetectionEngine();
    console.log(`✓ Detection engine complete: ${detectionResult.flaggedTransactions} flagged transactions, ${detectionResult.newAlerts} alerts generated.`);

    // 7. Seed Demonstration Cases in Distinct Lifecycle Stages
    console.log('[6/6] Seeding demonstration cases in distinct governance lifecycle stages...');

    const alertsRes = await db.query('SELECT a.*, dr.rule_name, t.amount, t.currency FROM alerts a LEFT JOIN detection_rules dr ON a.rule_id = dr.id LEFT JOIN transactions t ON a.transaction_id = t.id ORDER BY a.id ASC');
    const alerts = alertsRes.rows;
    console.log(`✓ Fetched ${alerts.length} generated surveillance alerts.`);

    const investigatorId = userMap['test.investigator@fcip.agency'];
    const complianceId = userMap['test.compliance@fcip.agency'];

    // CASE 1: Ready for Investigator Live Demo (status = in_progress)
    const alertStructuring = alerts.find(a => a.alert_type?.includes('Velocity') || a.description?.includes('rapid')) || alerts[0];
    const c1Res = await db.query(
      `INSERT INTO cases (title, description, status, priority, alert_id, assigned_to, created_by, created_at)
       VALUES ($1, $2, 'in_progress', 'high', $3, $4, $4, CURRENT_TIMESTAMP - INTERVAL '6 hours') RETURNING id`,
      [
        'Investigation: Rapid Structuring Velocity Burst',
        'Investigator dossier: 4 rapid outflows detected from Account ACC-1005-THORNE within an 8-minute window. Ready for live compliance referral.',
        alertStructuring ? alertStructuring.id : null,
        investigatorId
      ]
    );
    const c1Id = c1Res.rows[0].id;
    await db.query(
      `INSERT INTO case_notes (case_id, note_text, created_by, created_at)
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP - INTERVAL '4 hours')`,
      [c1Id, 'Investigator finding: Rapid sequence of transfers just below typical KYC thresholds indicates deliberate structuring behavior.', investigatorId]
    );
    await db.query(
      `INSERT INTO case_history (case_id, action, changed_by, changed_at)
       VALUES ($1, 'Case opened from rapid velocity alert', $2, CURRENT_TIMESTAMP - INTERVAL '6 hours')`,
      [c1Id, investigatorId]
    );

    // CASE 2: Awaiting Compliance Review in Intake Queue (status = submitted_for_review)
    const alertCircular = alerts.find(a => a.alert_type?.includes('Circular') || a.description?.includes('Circular')) || alerts[1] || alerts[0];
    const c2Res = await db.query(
      `INSERT INTO cases (title, description, status, priority, alert_id, assigned_to, created_by, created_at, submitted_at, submitted_by, review_deadline)
       VALUES ($1, $2, 'submitted_for_review', 'high', $3, $4, $4, CURRENT_TIMESTAMP - INTERVAL '2 days', CURRENT_TIMESTAMP - INTERVAL '1 day', $4, CURRENT_TIMESTAMP + INTERVAL '6 days') RETURNING id`,
      [
        'Investigation: Swiss-Dubai Circular Laundering Syndicate',
        'Directional fund movement tracing confirmed a closed 3-hop loop transferring $25k capital between Vortex, Apex, and Beacon before returning to origin.',
        alertCircular ? alertCircular.id : null,
        investigatorId
      ]
    );
    const c2Id = c2Res.rows[0].id;
    await db.query(
      `INSERT INTO case_notes (case_id, note_text, created_by, created_at)
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP - INTERVAL '1 day')`,
      [c2Id, 'Investigator analysis: Loop completed within 8 hours. Potential layering scheme utilizing offshore shell accounts.', investigatorId]
    );
    await db.query(
      `INSERT INTO case_history (case_id, action, changed_by, changed_at)
       VALUES ($1, 'Submitted case for formal Compliance Review with 7-day SLA', $2, CURRENT_TIMESTAMP - INTERVAL '1 day')`,
      [c2Id, investigatorId]
    );

    // CASE 3: Under Active Compliance Review (status = under_compliance_review)
    const alertLarge = alerts.find(a => a.alert_type?.includes('Exorbitant') || a.amount >= 50000) || alerts[2] || alerts[0];
    const c3Res = await db.query(
      `INSERT INTO cases (title, description, status, priority, alert_id, assigned_to, created_by, created_at, submitted_at, submitted_by, review_deadline)
       VALUES ($1, $2, 'under_compliance_review', 'high', $3, $4, $4, CURRENT_TIMESTAMP - INTERVAL '3 days', CURRENT_TIMESTAMP - INTERVAL '2 days', $4, CURRENT_TIMESTAMP + INTERVAL '4 days') RETURNING id`,
      [
        'Investigation: Exorbitant Cross-Border Capital Wire',
        'High Net-Worth Individual Dr. Julian Sterling transferred EUR 75,000 to Aura Digital Ventures without documented commercial contract.',
        alertLarge ? alertLarge.id : null,
        investigatorId
      ]
    );
    const c3Id = c3Res.rows[0].id;
    await db.query(
      `INSERT INTO case_notes (case_id, note_text, created_by, created_at)
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP - INTERVAL '2 days')`,
      [c3Id, 'Adjudication in progress: Wire amount exceeds 5x median account velocity.', complianceId]
    );

    // CASE 4: Returned for Correction Demo (status = returned_for_correction)
    const c4Res = await db.query(
      `INSERT INTO cases (title, description, status, priority, alert_id, assigned_to, created_by, created_at, submitted_at, submitted_by, return_reason, compliance_notes)
       VALUES ($1, $2, 'returned_for_correction', 'medium', $3, $4, $4, CURRENT_TIMESTAMP - INTERVAL '4 days', CURRENT_TIMESTAMP - INTERVAL '3 days', $4, $5, $6) RETURNING id`,
      [
        'Investigation: Maritime Freight Invoice Discrepancy',
        'Discrepancy identified between bill of lading declaration and vessel charter advance wire.',
        alerts[3] ? alerts[3].id : alerts[0].id,
        investigatorId,
        'Investigator must attach bill of lading and export customs declaration before compliance board sign-off.',
        'Returned on 2026-10-28 for documentary corroboration.'
      ]
    );
    const c4Id = c4Res.rows[0].id;
    await db.query(
      `INSERT INTO compliance_reviews (case_id, reviewer_id, action, decision_notes, previous_status, new_status, created_at)
       VALUES ($1, $2, 'RETURNED_FOR_CORRECTION', 'Investigator must attach bill of lading and customs clearance.', 'submitted_for_review', 'returned_for_correction', CURRENT_TIMESTAMP - INTERVAL '3 days')`,
      [c4Id, complianceId]
    );

    // CASE 5: Overdue Review SLA Warning Demo (status = submitted_for_review, review_deadline in PAST)
    const c5Res = await db.query(
      `INSERT INTO cases (title, description, status, priority, alert_id, assigned_to, created_by, created_at, submitted_at, submitted_by, review_deadline)
       VALUES ($1, $2, 'submitted_for_review', 'high', $3, $4, $4, CURRENT_TIMESTAMP - INTERVAL '10 days', CURRENT_TIMESTAMP - INTERVAL '8 days', $4, CURRENT_TIMESTAMP - INTERVAL '2 days') RETURNING id`,
      [
        'Investigation: Unregistered Offshore Liquidity Pool',
        'Substantial unbacked transfer identified involving foreign entity without registered beneficial ownership. Critical statutory deadline breached.',
        alerts[1] ? alerts[1].id : alerts[0].id,
        investigatorId
      ]
    );

    // CASE 6: Accepted / Completed Dossier (status = compliance_accepted)
    const c6Res = await db.query(
      `INSERT INTO cases (title, description, status, priority, alert_id, assigned_to, created_by, created_at, submitted_at, submitted_by, closed_at)
       VALUES ($1, $2, 'compliance_accepted', 'high', $3, $4, $4, CURRENT_TIMESTAMP - INTERVAL '5 days', CURRENT_TIMESTAMP - INTERVAL '4 days', $4, CURRENT_TIMESTAMP - INTERVAL '1 day') RETURNING id`,
      [
        'Investigation: Closed Syndicate Layering Case',
        'Full investigation into corporate structuring syndicate completed, approved, and escalated for Suspicious Activity Report (SAR) filing.',
        alerts[0].id,
        investigatorId
      ]
    );
    const c6Id = c6Res.rows[0].id;
    await db.query(
      `INSERT INTO compliance_reviews (case_id, reviewer_id, action, decision_notes, previous_status, new_status, created_at)
       VALUES ($1, $2, 'COMPLIANCE_ACCEPTED', 'Formal review accepted and endorsed for regulatory filing.', 'under_compliance_review', 'compliance_accepted', CURRENT_TIMESTAMP - INTERVAL '1 day')`,
      [c6Id, complianceId]
    );

    // Seed SAR Dossier Reports
    // 1. Approved Report (ready for PDF export demo)
    const report1Data = {
      case: { id: c6Id, title: 'Closed Syndicate Layering Case', status: 'compliance_accepted', priority: 'high', description: 'Complete investigation into corporate structuring syndicate.' },
      alert: { id: alerts[0].id, alert_type: alerts[0].alert_type, severity: alerts[0].severity, description: alerts[0].description },
      transaction: { amount: '25000.00', currency: 'USD', channel: 'wire', transaction_type: 'transfer' },
      riskScore: { score: '85.00', risk_level: 'High' },
      notes: [{ note_text: 'Corporate nexus Zurich-London confirmed. Escalated to regulatory filings.' }],
      generatedBy: 'test.investigator@fcip.agency',
      generatedAt: new Date(now.getTime() - 24 * 3600 * 1000).toISOString()
    };
    await db.query(
      `INSERT INTO reports (case_id, title, report_data, generated_by, review_status, reviewed_by, reviewed_at, review_comments, version, created_at)
       VALUES ($1, $2, $3, $4, 'approved', $5, CURRENT_TIMESTAMP - INTERVAL '1 day', 'SAR filing authorized by compliance officer.', 1, CURRENT_TIMESTAMP - INTERVAL '2 days')`,
      [c6Id, 'SAR Report #1: Formal Structuring & Layering Dossier', JSON.stringify(report1Data), investigatorId, complianceId]
    );

    // 2. Pending Approval Report
    const report2Data = {
      case: { id: c2Id, title: 'Swiss-Dubai Circular Laundering Syndicate', status: 'submitted_for_review', priority: 'high', description: 'Circular fund movement tracing across 3 foreign entities.' },
      alert: { id: alertCircular ? alertCircular.id : alerts[0].id, alert_type: 'Circular Laundering Loop', severity: 'high', description: 'Capital returned to origin sender.' },
      transaction: { amount: '24000.00', currency: 'USD', channel: 'wire', transaction_type: 'transfer' },
      riskScore: { score: '90.00', risk_level: 'Critical' },
      notes: [{ note_text: 'Circular loop completed within 8 hours. Layering scheme confirmed.' }],
      generatedBy: 'test.investigator@fcip.agency',
      generatedAt: new Date(now.getTime() - 12 * 3600 * 1000).toISOString()
    };
    await db.query(
      `INSERT INTO reports (case_id, title, report_data, generated_by, review_status, version, created_at)
       VALUES ($1, $2, $3, $4, 'pending_approval', 1, CURRENT_TIMESTAMP - INTERVAL '12 hours')`,
      [c2Id, 'SAR Report #2: Swiss-Dubai Circular Flow Dossier', JSON.stringify(report2Data), investigatorId]
    );

    // Seed Initial Genuine Audit Logs
    const auditLogs = [
      { userId: investigatorId, role: 'investigator', action: 'USER_LOGIN', entity: 'session', outcome: 'SUCCESS', details: { role: 'investigator' } },
      { userId: investigatorId, role: 'investigator', action: 'DATA_INGEST_COMPLETED', entity: 'dataset', outcome: 'SUCCESS', details: { records: 18 } },
      { userId: investigatorId, role: 'investigator', action: 'CASE_CREATED', entity: 'case', entityId: c1Id, outcome: 'SUCCESS', details: { caseId: c1Id } },
      { userId: investigatorId, role: 'investigator', action: 'CASE_SUBMITTED_COMPLIANCE', entity: 'case', entityId: c2Id, outcome: 'SUCCESS', details: { caseId: c2Id, deadlineDays: 7 } },
      { userId: complianceId, role: 'compliance_officer', action: 'COMPLIANCE_DECISION_START_REVIEW', entity: 'case', entityId: c3Id, outcome: 'SUCCESS', details: { caseId: c3Id } },
      { userId: complianceId, role: 'compliance_officer', action: 'COMPLIANCE_DECISION_RETURN_FOR_CORRECTION', entity: 'case', entityId: c4Id, outcome: 'SUCCESS', details: { caseId: c4Id, reason: 'Missing bill of lading' } },
      { userId: complianceId, role: 'compliance_officer', action: 'COMPLIANCE_DECISION_ACCEPT_CASE', entity: 'case', entityId: c6Id, outcome: 'SUCCESS', details: { caseId: c6Id } },
      { userId: complianceId, role: 'compliance_officer', action: 'SAR_REPORT_APPROVED', entity: 'report', outcome: 'SUCCESS', details: { reportTitle: 'SAR Report #1' } },
    ];

    for (const log of auditLogs) {
      await db.query(
        `INSERT INTO audit_logs (user_id, user_role, action, entity_type, entity_id, outcome, ip_address, details, timestamp)
         VALUES ($1, $2, $3, $4, $5, $6, '127.0.0.1', $7, CURRENT_TIMESTAMP - INTERVAL '1 hour')`,
        [log.userId, log.role, log.action, log.entity, log.entityId || null, log.outcome, JSON.stringify(log.details)]
      );
    }
    console.log(`✓ Seeded ${auditLogs.length} initial audit ledger events.`);

    console.log('\n====================================================');
    console.log('   DEMO RESET & SEEDING COMPLETED SUCCESSFULLY!     ');
    console.log('====================================================');
    console.log('Summary of Clean Demo Records:');
    console.log(' - Synthetic Customers: 10');
    console.log(' - Synthetic Accounts:  10');
    console.log(' - Transactions:        18 (Covering Circular, Large, Rapid, Round, & Benign)');
    console.log(` - Generated Alerts:    ${alerts.length}`);
    console.log(' - Demo Cases:          6 (In Progress, Submitted, Under Review, Returned, Overdue, Accepted)');
    console.log(' - SAR Dossiers:        2 (Approved [ready for PDF export], Pending Approval)');
    console.log(' - Audit Events:        ' + auditLogs.length + ' baseline entries');
    console.log('====================================================');

    process.exit(0);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Demo reset failed. Transaction rolled back cleanly:', error);
    process.exit(1);
  } finally {
    client.release();
  }
}

runDemoReset();
