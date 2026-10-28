const http = require('http');
const jwt = require('jsonwebtoken');
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const db = require('../config/db');
const express = require('express');
const cors = require('cors');

const authRoutes = require('../routes/authRoutes');
const complianceRoutes = require('../routes/complianceRoutes');
const caseRoutes = require('../routes/caseRoutes');
const auditRoutes = require('../routes/auditRoutes');
const adminRoutes = require('../routes/adminRoutes');
const reportRoutes = require('../routes/reportRoutes');
const { runComplianceMigrations } = require('../models/complianceMigrations');

const app = express();
app.use(cors());
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/compliance', complianceRoutes);
app.use('/api/cases', caseRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/reports', reportRoutes);

function makeRequest(server, options, body = null) {
  return new Promise((resolve, reject) => {
    const port = server.address().port;
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path: options.path,
        method: options.method,
        headers: {
          'Content-Type': 'application/json',
          ...(options.headers || {}),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          let parsed;
          try {
            parsed = JSON.parse(data);
          } catch {
            parsed = data;
          }
          resolve({ status: res.statusCode, body: parsed });
        });
      }
    );
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runTests() {
  console.log('--- Starting FCIP Compliance Officer Comprehensive Suite Tests ---');
  await runComplianceMigrations();

  const server = app.listen(0);
  let createdCaseId = null;

  try {
    // 1. Verify Compliance Officer Accounts in DB
    const compUsersRes = await db.query(
      "SELECT id, first_name, last_name, email, role, status FROM users WHERE role = 'compliance_officer' ORDER BY id ASC"
    );
    const invUserRes = await db.query("SELECT * FROM users WHERE role = 'investigator' AND status = 'active' LIMIT 1");
    const adminUserRes = await db.query("SELECT * FROM users WHERE role = 'admin' AND status = 'active' LIMIT 1");

    const activeCompUsers = compUsersRes.rows.filter((u) => u.status === 'active');
    const suspendedCompUser = compUsersRes.rows.find((u) => u.status === 'suspended');

    if (activeCompUsers.length === 0 || invUserRes.rows.length === 0) {
      console.error('Missing required active test users in database.');
      process.exit(1);
    }

    const complianceUser = activeCompUsers[0];
    const complianceUser2 = activeCompUsers[1] || activeCompUsers[0];
    const investigatorUser = invUserRes.rows[0];
    const adminUser = adminUserRes.rows[0];

    const JWT_SECRET = process.env.JWT_SECRET || 'fcip_super_secret_jwt_key_2026_financial_crime_intel';
    const complianceToken = jwt.sign(
      {
        id: complianceUser.id,
        email: complianceUser.email,
        role: complianceUser.role,
        first_name: complianceUser.first_name,
        last_name: complianceUser.last_name,
      },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
    const complianceToken2 = jwt.sign(
      {
        id: complianceUser2.id,
        email: complianceUser2.email,
        role: complianceUser2.role,
        first_name: complianceUser2.first_name,
        last_name: complianceUser2.last_name,
      },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
    const investigatorToken = jwt.sign(
      { id: investigatorUser.id, email: investigatorUser.email, role: investigatorUser.role },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
    const adminToken = jwt.sign(
      { id: adminUser.id, email: adminUser.email, role: adminUser.role },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    console.log(`✓ Verified ${compUsersRes.rows.length} Compliance Officer accounts (${activeCompUsers.length} active)`);

    // Test 1A: Verify /api/auth/profile returns isolated identity for each Compliance Officer
    const prof1 = await makeRequest(server, {
      path: '/api/auth/profile',
      method: 'GET',
      headers: { Authorization: `Bearer ${complianceToken}` },
    });
    const prof2 = await makeRequest(server, {
      path: '/api/auth/profile',
      method: 'GET',
      headers: { Authorization: `Bearer ${complianceToken2}` },
    });

    if (
      prof1.status === 200 &&
      prof1.body.user.id === complianceUser.id &&
      prof1.body.user.role === 'compliance_officer' &&
      prof2.status === 200 &&
      prof2.body.user.id === complianceUser2.id
    ) {
      console.log('✓ Compliance Officer session profile verification and account state isolation confirmed');
    } else {
      console.error('✗ Profile identity isolation check failed');
      process.exit(1);
    }

    // Test 1B: Suspended Compliance Officer account blocked at login (403)
    if (suspendedCompUser) {
      const suspLogin = await makeRequest(
        server,
        { path: '/api/auth/login', method: 'POST' },
        { email: suspendedCompUser.email, password: 'Password123!' }
      );
      if (suspLogin.status === 403) {
        console.log(`✓ Suspended Compliance Officer account (${suspendedCompUser.email}) rejected at login (HTTP 403)`);
      } else {
        console.error('✗ Suspended user login check failed:', suspLogin.status);
        process.exit(1);
      }
    }

    // Test 2: GET /api/compliance/stats with timeRange support and recentActivity field mapping
    const statsRes = await makeRequest(server, {
      path: '/api/compliance/stats?timeRange=30d',
      method: 'GET',
      headers: { Authorization: `Bearer ${complianceToken}` },
    });

    if (statsRes.status === 200 && statsRes.body.cards && Array.isArray(statsRes.body.recentActivity)) {
      console.log('✓ Compliance Stats API works (with timeRange=30d):', statsRes.body.cards);
    } else {
      console.error('✗ Compliance Stats API failed:', statsRes.status, statsRes.body);
      process.exit(1);
    }

    // Test 3: Investigator creates & submits an isolated test case for compliance review
    const newCase = await db.query(
      "INSERT INTO cases (title, description, status, priority, created_by, assigned_to) VALUES ($1, $2, 'open', 'high', $3, $3) RETURNING id",
      ['Audit Verification Case', 'Isolated test case for compliance workflow verification', investigatorUser.id]
    );
    createdCaseId = newCase.rows[0].id;

    const submitRes = await makeRequest(
      server,
      {
        path: `/api/compliance/cases/${createdCaseId}/submit`,
        method: 'POST',
        headers: { Authorization: `Bearer ${investigatorToken}` },
      },
      { deadline_days: 7, notes: 'Case evidence ready for audit.' }
    );

    if (submitRes.status === 200 && submitRes.body.success) {
      console.log(`✓ Investigator submitted case #${createdCaseId} for compliance review`);
    } else {
      console.error('✗ Submit case failed:', submitRes.status, submitRes.body);
      process.exit(1);
    }

    // Test 4: Compliance Review Queue lists items with investigator_name, alert_count, type filter, and sort
    const queueRes = await makeRequest(server, {
      path: '/api/compliance/queue?type=cases&sortBy=submission&page=1&limit=15',
      method: 'GET',
      headers: { Authorization: `Bearer ${complianceToken}` },
    });

    const itemInQueue = queueRes.body.items?.find((i) => i.id === createdCaseId);
    if (itemInQueue && itemInQueue.investigator_name && itemInQueue.item_type === 'case') {
      console.log(
        `✓ Case #${createdCaseId} present in Review Queue (Investigator: ${itemInQueue.investigator_name}, Type: ${itemInQueue.item_type})`
      );
    } else {
      console.error('✗ Case missing or incomplete in Review Queue:', itemInQueue);
      process.exit(1);
    }

    // Test 4B: Review Queue type=reports filter returns SAR report items
    const reportQueueRes = await makeRequest(server, {
      path: '/api/compliance/queue?type=reports',
      method: 'GET',
      headers: { Authorization: `Bearer ${complianceToken}` },
    });
    if (reportQueueRes.status === 200 && Array.isArray(reportQueueRes.body.items)) {
      console.log(`✓ Review Queue type=reports filter works (${reportQueueRes.body.items.length} SAR dossiers)`);
    } else {
      console.error('✗ Review Queue type=reports failed:', reportQueueRes.status);
      process.exit(1);
    }

    // Test 5: Case Reviews Dossier Retrieval (GET /api/cases and GET /api/cases/:id)
    const casesListRes = await makeRequest(server, {
      path: '/api/cases',
      method: 'GET',
      headers: { Authorization: `Bearer ${complianceToken}` },
    });
    const caseDetailRes = await makeRequest(server, {
      path: `/api/cases/${createdCaseId}`,
      method: 'GET',
      headers: { Authorization: `Bearer ${complianceToken}` },
    });

    if (
      casesListRes.status === 200 &&
      caseDetailRes.status === 200 &&
      caseDetailRes.body.case?.investigator_name &&
      caseDetailRes.body.case?.alert_count !== undefined
    ) {
      console.log(
        `✓ Case Dossier #${createdCaseId} retrieved with investigator_name (${caseDetailRes.body.case.investigator_name}) and alert_count`
      );
    } else {
      console.error('✗ Case detail retrieval failed:', caseDetailRes.status, caseDetailRes.body);
      process.exit(1);
    }

    // Test 6: Investigator blocked from compliance decisioning (403)
    const forbiddenRes = await makeRequest(
      server,
      {
        path: `/api/compliance/cases/${createdCaseId}/decision`,
        method: 'POST',
        headers: { Authorization: `Bearer ${investigatorToken}` },
      },
      { action: 'ACCEPT_CASE', comments: 'Unauthorized attempt' }
    );

    if (forbiddenRes.status === 403) {
      console.log('✓ RBAC Enforcement: Investigator blocked from case decisioning (HTTP 403)');
    } else {
      console.error('✗ RBAC vulnerability: Investigator not blocked:', forbiddenRes.status);
      process.exit(1);
    }

    // Test 7: Compliance Officer executes START_REVIEW then RETURN_FOR_CORRECTION with return_reason
    const startReviewRes = await makeRequest(
      server,
      {
        path: `/api/compliance/cases/${createdCaseId}/decision`,
        method: 'POST',
        headers: { Authorization: `Bearer ${complianceToken}` },
      },
      { action: 'START_REVIEW', comments: 'Commencing formal compliance inspection.' }
    );

    if (startReviewRes.status === 200 && startReviewRes.body.case.status === 'under_compliance_review') {
      console.log('✓ Compliance Officer moved case to under_compliance_review');
    } else {
      console.error('✗ START_REVIEW failed:', startReviewRes.body);
      process.exit(1);
    }

    const expectedReason = 'Missing foreign correspondent bank KYC documentation.';
    const returnRes = await makeRequest(
      server,
      {
        path: `/api/compliance/cases/${createdCaseId}/decision`,
        method: 'POST',
        headers: { Authorization: `Bearer ${complianceToken}` },
      },
      {
        action: 'RETURN_FOR_CORRECTION',
        return_reason: expectedReason,
        comments: 'Please attach correspondent verification.',
      }
    );

    if (
      returnRes.status === 200 &&
      returnRes.body.case.status === 'returned_for_correction' &&
      returnRes.body.case.return_reason === expectedReason
    ) {
      console.log('✓ Compliance Officer returned case and persisted exact return_reason in PostgreSQL');
    } else {
      console.error('✗ Return case decision or return_reason persistence failed:', returnRes.status, returnRes.body);
      process.exit(1);
    }

    // Test 8: Verify SAR & Dossier Review filter and author/reviewer fields
    const sarAllRes = await makeRequest(server, {
      path: '/api/compliance/reports?status=all',
      method: 'GET',
      headers: { Authorization: `Bearer ${complianceToken}` },
    });
    const sarApprovedRes = await makeRequest(server, {
      path: '/api/compliance/reports?status=approved',
      method: 'GET',
      headers: { Authorization: `Bearer ${complianceToken}` },
    });

    if (
      sarAllRes.status === 200 &&
      sarApprovedRes.status === 200 &&
      sarApprovedRes.body.reports.every((r) => r.review_status === 'approved' && r.author_name)
    ) {
      console.log(
        `✓ SAR Dossier Review endpoint & status filter verified (${sarAllRes.body.count} total, ${sarApprovedRes.body.count} approved)`
      );
    } else {
      console.error('✗ SAR Dossier Review filter failed:', sarApprovedRes.body);
      process.exit(1);
    }

    // Test 9: Verify Risk Oversight endpoint fields
    const riskRes = await makeRequest(server, {
      path: '/api/compliance/risk-oversight',
      method: 'GET',
      headers: { Authorization: `Bearer ${complianceToken}` },
    });

    if (
      riskRes.status === 200 &&
      Array.isArray(riskRes.body.rules) &&
      Array.isArray(riskRes.body.highRiskCases) &&
      riskRes.body.highRiskCases.every((c) => c.investigator_name && c.alert_count !== undefined)
    ) {
      console.log(
        `✓ Compliance Risk Oversight verified: ${riskRes.body.rules.length} rules, ${riskRes.body.highRiskCases.length} high-risk cases`
      );
    } else {
      console.error('✗ Risk Oversight check failed:', riskRes.status);
      process.exit(1);
    }

    // Test 10: Strict Administrator-Only Audit History Enforcement
    const compAudit1 = await makeRequest(server, {
      path: '/api/audit',
      method: 'GET',
      headers: { Authorization: `Bearer ${complianceToken}` },
    });
    const compAudit2 = await makeRequest(server, {
      path: '/api/audit/actions',
      method: 'GET',
      headers: { Authorization: `Bearer ${complianceToken}` },
    });
    const compAudit3 = await makeRequest(server, {
      path: '/api/compliance/audit-history',
      method: 'GET',
      headers: { Authorization: `Bearer ${complianceToken}` },
    });
    const adminAudit = await makeRequest(server, {
      path: '/api/audit',
      method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    if (
      compAudit1.status === 403 &&
      compAudit2.status === 403 &&
      compAudit3.status === 403 &&
      adminAudit.status === 200
    ) {
      console.log('✓ Strict Admin-Only Audit History enforced: Compliance Officer blocked (403) on all audit endpoints; Admin allowed (200)');
    } else {
      console.error(
        '✗ Audit History RBAC failed:',
        compAudit1.status,
        compAudit2.status,
        compAudit3.status,
        adminAudit.status
      );
      process.exit(1);
    }

    console.log('===================================================================');
    console.log(' ALL COMPLIANCE OFFICER PORTAL VERIFICATION CHECKS PASSED (12/12) ');
    console.log('===================================================================');
  } finally {
    // Clean up temporary test case so demo database stays pristine
    if (createdCaseId) {
      await db.query('DELETE FROM compliance_reviews WHERE case_id = $1', [createdCaseId]);
      await db.query('DELETE FROM case_history WHERE case_id = $1', [createdCaseId]);
      await db.query('DELETE FROM case_notes WHERE case_id = $1', [createdCaseId]);
      await db.query('DELETE FROM cases WHERE id = $1', [createdCaseId]);
      await db.query("DELETE FROM audit_logs WHERE entity_type = 'case' AND entity_id = $1", [createdCaseId]);
    }
    server.close();
  }
  process.exit(0);
}

runTests().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
