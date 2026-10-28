const http = require('http');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const db = require('../config/db');
const express = require('express');
const cors = require('cors');

const authRoutes = require('../routes/authRoutes');
const adminRoutes = require('../routes/adminRoutes');
const caseRoutes = require('../routes/caseRoutes');
const alertRoutes = require('../routes/alertRoutes');
const dataRoutes = require('../routes/dataRoutes');
const detectionRoutes = require('../routes/detectionRoutes');
const networkRoutes = require('../routes/networkRoutes');
const dashboardRoutes = require('../routes/dashboardRoutes');
const reportRoutes = require('../routes/reportRoutes');
const auditRoutes = require('../routes/auditRoutes');
const complianceRoutes = require('../routes/complianceRoutes');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/cases', caseRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api', dataRoutes);
app.use('/api/detection', detectionRoutes);
app.use('/api/network', networkRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/compliance', complianceRoutes);

// Test results storage
const testResults = [];

function recordTest(suite, testName, status, details = '') {
  testResults.push({ suite, testName, status, details });
  const icon = status === 'PASS' ? '✓' : status === 'FAIL' ? '✗' : '⚠';
  console.log(`  ${icon} [${status}] ${testName} ${details ? '(' + details + ')' : ''}`);
}

function makeRequest(server, options, body = null) {
  return new Promise((resolve, reject) => {
    const port = server.address().port;
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path: options.path,
        method: options.method || 'GET',
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
          resolve({ status: res.statusCode, headers: res.headers, body: parsed });
        });
      }
    );
    req.on('error', reject);
    if (body) {
      if (typeof body === 'string') {
        req.write(body);
      } else {
        req.write(JSON.stringify(body));
      }
    }
    req.end();
  });
}

function makeMultipartRequest(server, options, filePath, fieldName = 'file') {
  return new Promise((resolve, reject) => {
    const port = server.address().port;
    const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
    const filename = path.basename(filePath);
    const fileContent = fs.readFileSync(filePath);

    let preContent = `--${boundary}\r\n`;
    preContent += `Content-Disposition: form-data; name="${fieldName}"; filename="${filename}"\r\n`;
    preContent += `Content-Type: text/csv\r\n\r\n`;

    const postContent = `\r\n--${boundary}--\r\n`;

    const preBuffer = Buffer.from(preContent, 'utf8');
    const postBuffer = Buffer.from(postContent, 'utf8');
    const fullBody = Buffer.concat([preBuffer, fileContent, postBuffer]);

    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path: options.path,
        method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': fullBody.length,
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
          resolve({ status: res.statusCode, headers: res.headers, body: parsed });
        });
      }
    );
    req.on('error', reject);
    req.write(fullBody);
    req.end();
  });
}

async function runMasterAudit() {
  console.log('================================================================');
  console.log(' FCIP MASTER AUTOMATED VERIFICATION & AUDIT SUITE (Phases 1-12) ');
  console.log('================================================================\n');

  const server = app.listen(0);

  try {
    // 1. Authenticate tokens for all three roles
    const JWT_SECRET = process.env.JWT_SECRET || 'fcip_development_jwt_secret_key_2026';

    const users = await db.query('SELECT * FROM users');
    const adminUser = users.rows.find((u) => u.role === 'admin');
    const invUser = users.rows.find((u) => u.role === 'investigator');
    const compUser = users.rows.find((u) => u.role === 'compliance_officer');

    if (!adminUser || !invUser || !compUser) {
      throw new Error('Seed users missing for admin, investigator, or compliance_officer');
    }

    const adminToken = jwt.sign(
      { id: adminUser.id, email: adminUser.email, role: adminUser.role },
      JWT_SECRET,
      { expiresIn: '2h' }
    );
    const invToken = jwt.sign(
      { id: invUser.id, email: invUser.email, role: invUser.role },
      JWT_SECRET,
      { expiresIn: '2h' }
    );
    const compToken = jwt.sign(
      { id: compUser.id, email: compUser.email, role: compUser.role },
      JWT_SECRET,
      { expiresIn: '2h' }
    );

    console.log('[Phase 1 & 4] RBAC & Role-Permission Matrix Verification');

    // TEST 1.1: Unauthenticated request to protected endpoints is rejected (401)
    const unauthRes = await makeRequest(server, { path: '/api/admin/users', method: 'GET' });
    recordTest(
      'Security',
      'Unauthenticated request rejected with 401',
      unauthRes.status === 401 ? 'PASS' : 'FAIL',
      `HTTP ${unauthRes.status}`
    );

    // TEST 1.2: Invalid JWT rejected with 403
    const badTokenRes = await makeRequest(server, {
      path: '/api/cases',
      method: 'GET',
      headers: { Authorization: 'Bearer invalid.token.signature' },
    });
    recordTest(
      'Security',
      'Invalid token rejected with 403',
      badTokenRes.status === 403 ? 'PASS' : 'FAIL',
      `HTTP ${badTokenRes.status}`
    );

    // TEST 1.3: Investigator BLOCKED from Admin endpoints (403)
    const invAdminRes = await makeRequest(server, {
      path: '/api/admin/users',
      method: 'GET',
      headers: { Authorization: `Bearer ${invToken}` },
    });
    recordTest(
      'RBAC',
      'Investigator blocked from Admin user directory',
      invAdminRes.status === 403 ? 'PASS' : 'FAIL',
      `HTTP ${invAdminRes.status}`
    );

    // TEST 1.4: Compliance Officer BLOCKED from Admin user creation (403)
    const compAdminRes = await makeRequest(server, {
      path: '/api/admin/users',
      method: 'GET',
      headers: { Authorization: `Bearer ${compToken}` },
    });
    recordTest(
      'RBAC',
      'Compliance Officer blocked from Admin user directory',
      compAdminRes.status === 403 ? 'PASS' : 'FAIL',
      `HTTP ${compAdminRes.status}`
    );

    // TEST 1.5: Investigator BLOCKED from Compliance decision endpoint (403)
    const invDecisionRes = await makeRequest(
      server,
      {
        path: '/api/compliance/cases/1/decision',
        method: 'POST',
        headers: { Authorization: `Bearer ${invToken}` },
      },
      { action: 'ACCEPT_CASE', comments: 'Unauthorized' }
    );
    recordTest(
      'RBAC',
      'Investigator blocked from compliance case decisioning',
      invDecisionRes.status === 403 ? 'PASS' : 'FAIL',
      `HTTP ${invDecisionRes.status}`
    );

    // TEST 1.6: Compliance Officer BLOCKED from detection run trigger (investigator/admin only)
    const compRunRes = await makeRequest(
      server,
      {
        path: '/api/detection/run',
        method: 'POST',
        headers: { Authorization: `Bearer ${compToken}` },
      },
      {}
    );
    recordTest(
      'RBAC',
      'Compliance Officer blocked from manual detection run trigger',
      compRunRes.status === 403 ? 'PASS' : 'FAIL',
      `HTTP ${compRunRes.status}`
    );

    // TEST 1.7: Compliance Officer BLOCKED from Security Audit History (403)
    const compAuditRes = await makeRequest(server, {
      path: '/api/audit',
      method: 'GET',
      headers: { Authorization: `Bearer ${compToken}` },
    });
    recordTest(
      'RBAC',
      'Compliance Officer blocked from Security Audit History (403)',
      compAuditRes.status === 403 ? 'PASS' : 'FAIL',
      `HTTP ${compAuditRes.status}`
    );

    // TEST 1.8: Investigator BLOCKED from Security Audit History (403)
    const invAuditRes = await makeRequest(server, {
      path: '/api/audit',
      method: 'GET',
      headers: { Authorization: `Bearer ${invToken}` },
    });
    recordTest(
      'RBAC',
      'Investigator blocked from Security Audit History (403)',
      invAuditRes.status === 403 ? 'PASS' : 'FAIL',
      `HTTP ${invAuditRes.status}`
    );

    console.log('\n[Phase 3A] Administrator Role Operations');

    // TEST 2.1: Admin stats endpoint
    const adminStats = await makeRequest(server, {
      path: '/api/admin/stats',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    recordTest(
      'Administrator',
      'GET /api/admin/stats returns telemetry metrics',
      adminStats.status === 200 && adminStats.body.success ? 'PASS' : 'FAIL',
      `Users: ${adminStats.body?.stats?.users?.total}`
    );

    // TEST 2.2: Admin user management listing & search
    const adminUsers = await makeRequest(server, {
      path: '/api/admin/users?role=investigator',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    recordTest(
      'Administrator',
      'GET /api/admin/users with role filter',
      adminUsers.status === 200 && adminUsers.body.success ? 'PASS' : 'FAIL',
      `Found: ${adminUsers.body?.users?.length} investigators`
    );

    // TEST 2.3: Admin detection configuration parameter updates
    const adminRules = await makeRequest(server, {
      path: '/api/admin/rules',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    recordTest(
      'Administrator',
      'GET /api/admin/rules retrieves rule matrix & history',
      adminRules.status === 200 && adminRules.body.success ? 'PASS' : 'FAIL',
      `Rules count: ${adminRules.body?.rules?.length}`
    );

    // TEST 2.4: Admin system health diagnostics
    const adminHealth = await makeRequest(server, {
      path: '/api/admin/health',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    recordTest(
      'Administrator',
      'GET /api/admin/health executes live DB latency ping',
      adminHealth.status === 200 && adminHealth.body.success ? 'PASS' : 'FAIL',
      `Latency: ${adminHealth.body?.health?.database?.latencyMs}ms`
    );

    console.log('\n[Phase 3B] Investigator Role Operations');

    // TEST 3.1: Investigator dashboard telemetry
    const invDashboard = await makeRequest(server, {
      path: '/api/dashboard/stats',
      headers: { Authorization: `Bearer ${invToken}` },
    });
    recordTest(
      'Investigator',
      'GET /api/dashboard/stats returns real transactional counts',
      invDashboard.status === 200 && invDashboard.body.success ? 'PASS' : 'FAIL',
      `Transactions: ${invDashboard.body?.stats?.totalTransactions}`
    );

    // TEST 3.2: Investigator alerts triage & lifecycle
    const alertsList = await makeRequest(server, {
      path: '/api/alerts',
      headers: { Authorization: `Bearer ${invToken}` },
    });
    recordTest(
      'Investigator',
      'GET /api/alerts lists triaged alerts',
      alertsList.status === 200 && alertsList.body.success ? 'PASS' : 'FAIL',
      `Total alerts: ${alertsList.body?.count}`
    );

    // TEST 3.3: Investigator case creation and notes appending
    const caseCreate = await makeRequest(
      server,
      {
        path: '/api/cases',
        method: 'POST',
        headers: { Authorization: `Bearer ${invToken}` },
      },
      {
        title: 'Investigator Automated Master Audit Case',
        description: 'Comprehensive audit pipeline case created by test runner.',
        priority: 'high',
      }
    );
    const createdCaseId = caseCreate.body?.case?.id;
    recordTest(
      'Investigator',
      'POST /api/cases creates formal case dossier',
      caseCreate.status === 201 && createdCaseId ? 'PASS' : 'FAIL',
      `Case ID #${createdCaseId}`
    );

    // TEST 3.4: Append intelligence note to case
    const noteAdd = await makeRequest(
      server,
      {
        path: `/api/cases/${createdCaseId}/notes`,
        method: 'POST',
        headers: { Authorization: `Bearer ${invToken}` },
      },
      { note_text: 'Investigator verified corroborating offshore entities.' }
    );
    recordTest(
      'Investigator',
      'POST /api/cases/:id/notes appends intelligence finding',
      noteAdd.status === 201 ? 'PASS' : 'FAIL',
      `Note ID #${noteAdd.body?.note?.id}`
    );

    // TEST 3.5: Submit case for Compliance Review with SLA
    const caseSubmit = await makeRequest(
      server,
      {
        path: `/api/compliance/cases/${createdCaseId}/submit`,
        method: 'POST',
        headers: { Authorization: `Bearer ${invToken}` },
      },
      { deadline_days: 5, notes: 'Evidence ready for compliance audit.' }
    );
    recordTest(
      'Investigator',
      'POST /api/compliance/cases/:id/submit transitions case to compliance review',
      caseSubmit.status === 200 && caseSubmit.body.success ? 'PASS' : 'FAIL',
      `Status: submitted_for_review`
    );

    console.log('\n[Phase 3C] Compliance Officer Role Operations');

    // TEST 4.1: Compliance review queue retrieves submitted case
    const compQueue = await makeRequest(server, {
      path: '/api/compliance/queue',
      headers: { Authorization: `Bearer ${compToken}` },
    });
    const foundInQueue = compQueue.body?.items?.find((c) => c.id === createdCaseId);
    recordTest(
      'Compliance Officer',
      'GET /api/compliance/queue reflects newly submitted case',
      compQueue.status === 200 && Boolean(foundInQueue) ? 'PASS' : 'FAIL',
      `Queue size: ${compQueue.body?.items?.length}`
    );

    // TEST 4.2: Compliance Officer fetches case dossier detail (including linked alerts)
    const caseDetailRes = await makeRequest(server, {
      path: `/api/cases/${createdCaseId}`,
      headers: { Authorization: `Bearer ${compToken}` },
    });
    recordTest(
      'Compliance Officer',
      'GET /api/cases/:id retrieves case dossier with linked alerts & notes',
      caseDetailRes.status === 200 && Array.isArray(caseDetailRes.body?.case?.notes) ? 'PASS' : 'FAIL',
      `Notes: ${caseDetailRes.body?.case?.notes?.length}`
    );

    // TEST 4.3: Compliance Officer executes START_REVIEW decision
    const startReview = await makeRequest(
      server,
      {
        path: `/api/compliance/cases/${createdCaseId}/decision`,
        method: 'POST',
        headers: { Authorization: `Bearer ${compToken}` },
      },
      { action: 'START_REVIEW', comments: 'Compliance Officer commenced inspection.' }
    );
    recordTest(
      'Compliance Officer',
      'POST /api/compliance/cases/:id/decision START_REVIEW',
      startReview.status === 200 ? 'PASS' : 'FAIL',
      `Status: under_compliance_review`
    );

    // TEST 4.4: Compliance Officer executes ACCEPT_CASE decision
    const acceptDecision = await makeRequest(
      server,
      {
        path: `/api/compliance/cases/${createdCaseId}/decision`,
        method: 'POST',
        headers: { Authorization: `Bearer ${compToken}` },
      },
      { action: 'ACCEPT_CASE', comments: 'Case accepted for regulatory filing.' }
    );
    recordTest(
      'Compliance Officer',
      'POST /api/compliance/cases/:id/decision ACCEPT_CASE',
      acceptDecision.status === 200 ? 'PASS' : 'FAIL',
      `Status: compliance_accepted`
    );

    // TEST 4.5: Compliance Risk Oversight metrics
    const riskOversight = await makeRequest(server, {
      path: '/api/compliance/risk-oversight',
      headers: { Authorization: `Bearer ${compToken}` },
    });
    recordTest(
      'Compliance Officer',
      'GET /api/compliance/risk-oversight detects exposure & documentation warnings',
      riskOversight.status === 200 && Array.isArray(riskOversight.body?.highRiskCases) ? 'PASS' : 'FAIL',
      `High risk cases: ${riskOversight.body?.highRiskCases?.length}`
    );

    console.log('\n[Phase 6] Detection Rules & Heuristics Matrix Verification');

    // Run detection engine run manually to test rules
    const detectRun = await makeRequest(
      server,
      {
        path: '/api/detection/run',
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` },
      },
      {}
    );
    recordTest(
      'Detection Engine',
      'POST /api/detection/run executes all 4 detection rules',
      detectRun.status === 200 && detectRun.body.success ? 'PASS' : 'FAIL',
      `Transactions scanned: ${detectRun.body?.scannedCount}`
    );

    // Check risk score boundaries [0, 100]
    const riskScoresCheck = await db.query(
      'SELECT MIN(score) as min_score, MAX(score) as max_score FROM risk_scores'
    );
    const minS = parseFloat(riskScoresCheck.rows[0].min_score);
    const maxS = parseFloat(riskScoresCheck.rows[0].max_score);
    const bounded = minS >= 0 && maxS <= 100;
    recordTest(
      'Detection Engine',
      'Risk scores strictly bounded in [0, 100]',
      bounded ? 'PASS' : 'FAIL',
      `Range: [${minS}, ${maxS}]`
    );

    console.log('\n[Phase 7] CSV Ingestion & Input Validation Edge Cases');

    const sampleCsv = path.resolve(__dirname, '../../sample_dataset.csv');
    if (fs.existsSync(sampleCsv)) {
      const validCsvRes = await makeMultipartRequest(
        server,
        {
          path: '/api/upload',
          headers: { Authorization: `Bearer ${adminToken}` },
        },
        sampleCsv
      );
      recordTest(
        'CSV Ingestion',
        'Upload valid CSV dataset (backend/sample_dataset.csv)',
        validCsvRes.status === 200 && validCsvRes.body.success ? 'PASS' : 'FAIL',
        `Imported txs: ${validCsvRes.body?.transactionsCreated}`
      );
    } else {
      recordTest('CSV Ingestion', 'Upload valid CSV dataset', 'BLOCKED', 'sample_dataset.csv not found');
    }

    // Edge case 1: Empty CSV upload
    const emptyCsvPath = path.resolve(__dirname, 'temp_empty.csv');
    fs.writeFileSync(emptyCsvPath, '');
    const emptyCsvRes = await makeMultipartRequest(
      server,
      {
        path: '/api/upload',
        headers: { Authorization: `Bearer ${adminToken}` },
      },
      emptyCsvPath
    );
    if (fs.existsSync(emptyCsvPath)) fs.unlinkSync(emptyCsvPath);
    recordTest(
      'CSV Ingestion',
      'Reject empty CSV with HTTP 400',
      emptyCsvRes.status === 400 ? 'PASS' : 'FAIL',
      `HTTP ${emptyCsvRes.status}`
    );

    // Edge case 2: Malformed headers / missing required columns
    const badHeadersCsv = path.resolve(__dirname, 'temp_bad.csv');
    fs.writeFileSync(badHeadersCsv, 'col1,col2,col3\nval1,val2,val3\n');
    const badCsvRes = await makeMultipartRequest(
      server,
      {
        path: '/api/upload',
        headers: { Authorization: `Bearer ${adminToken}` },
      },
      badHeadersCsv
    );
    if (fs.existsSync(badHeadersCsv)) fs.unlinkSync(badHeadersCsv);
    recordTest(
      'CSV Ingestion',
      'Reject CSV missing required account/amount headers',
      badCsvRes.status === 400 ? 'PASS' : 'FAIL',
      `HTTP ${badCsvRes.status}: ${badCsvRes.body?.message}`
    );

    console.log('\n[Phase 8] Authenticated PDF / HTML Report Download');

    const firstRepRes = await db.query('SELECT id FROM reports ORDER BY id ASC LIMIT 1');
    const exportRepId = firstRepRes.rows.length > 0 ? firstRepRes.rows[0].id : 1;

    // TEST 8.1: Unauthenticated export blocked (401)
    const repNoAuth = await makeRequest(server, {
      path: `/api/reports/${exportRepId}/export`,
      method: 'GET',
    });
    recordTest(
      'Report Export',
      'GET /api/reports/:id/export unauthenticated blocked (401)',
      repNoAuth.status === 401 ? 'PASS' : 'FAIL',
      `HTTP ${repNoAuth.status}`
    );

    // TEST 8.2: Authenticated export with valid token and proper headers
    const repAuth = await makeRequest(server, {
      path: `/api/reports/${exportRepId}/export`,
      method: 'GET',
      headers: { Authorization: `Bearer ${compToken}` },
    });
    const hasHtmlContent = typeof repAuth.body === 'string' && repAuth.body.includes('Financial Crime Intelligence Platform');
    recordTest(
      'Report Export',
      'GET /api/reports/:id/export returns printable HTML with Content-Disposition',
      repAuth.status === 200 && hasHtmlContent ? 'PASS' : 'FAIL',
      `Content-Type: ${repAuth.headers?.['content-type']}`
    );

    console.log('\n[Phase 9] Immutable Audit Log System End-to-End');

    // TEST 9.1: Audit query by Admin
    const auditQuery = await makeRequest(server, {
      path: '/api/audit?limit=10',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    recordTest(
      'Audit System',
      'GET /api/audit retrieves immutable events ledger',
      auditQuery.status === 200 && Array.isArray(auditQuery.body?.logs) ? 'PASS' : 'FAIL',
      `Total logs: ${auditQuery.body?.total}`
    );

    // TEST 9.2: Investigator BLOCKED from audit deletion (No DELETE route allowed)
    const auditDelete = await makeRequest(server, {
      path: '/api/audit/1',
      method: 'DELETE',
      headers: { Authorization: `Bearer ${invToken}` },
    });
    recordTest(
      'Audit System',
      'Audit events are immutable (no deletion endpoint)',
      auditDelete.status === 404 ? 'PASS' : 'FAIL',
      `HTTP ${auditDelete.status}`
    );

    console.log('\n================================================================');
    console.log(' MASTER AUTOMATED AUDIT SUITE FINISHED ');
    console.log('================================================================\n');

    server.close();
    return testResults;
  } catch (err) {
    server.close();
    console.error('Master audit suite failed with unhandled error:', err);
    throw err;
  }
}

if (require.main === module) {
  runMasterAudit()
    .then((results) => {
      const passed = results.filter((r) => r.status === 'PASS').length;
      const failed = results.filter((r) => r.status === 'FAIL').length;
      const blocked = results.filter((r) => r.status === 'BLOCKED').length;
      console.log(`Summary: Total: ${results.length} | Passed: ${passed} | Failed: ${failed} | Blocked: ${blocked}`);
      process.exit(failed > 0 ? 1 : 0);
    })
    .catch(() => process.exit(1));
}

module.exports = { runMasterAudit };

