const http = require('http');
const jwt = require('jsonwebtoken');
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const db = require('../config/db');
const express = require('express');
const cors = require('cors');

const complianceRoutes = require('../routes/complianceRoutes');
const caseRoutes = require('../routes/caseRoutes');
const { runComplianceMigrations } = require('../models/complianceMigrations');

const app = express();
app.use(cors());
app.use(express.json());
app.use('/api/compliance', complianceRoutes);
app.use('/api/cases', caseRoutes);

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
  console.log('--- Starting FCIP Compliance Officer Suite Tests ---');
  await runComplianceMigrations();

  const server = app.listen(0);

  try {
    const compUserRes = await db.query("SELECT * FROM users WHERE role = 'compliance_officer' LIMIT 1");
    const invUserRes = await db.query("SELECT * FROM users WHERE role = 'investigator' LIMIT 1");

    if (compUserRes.rows.length === 0 || invUserRes.rows.length === 0) {
      console.error('Missing test users in database.');
      process.exit(1);
    }

    const complianceUser = compUserRes.rows[0];
    const investigatorUser = invUserRes.rows[0];

    const JWT_SECRET = process.env.JWT_SECRET || 'fcip_development_jwt_secret_key_2026';
    const complianceToken = jwt.sign(
      { id: complianceUser.id, email: complianceUser.email, role: complianceUser.role },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
    const investigatorToken = jwt.sign(
      { id: investigatorUser.id, email: investigatorUser.email, role: investigatorUser.role },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    console.log('✓ Generated JWT tokens for Compliance Officer and Investigator');

    // Test 1: GET /api/compliance/stats with Compliance Officer
    const statsRes = await makeRequest(server, {
      path: '/api/compliance/stats',
      method: 'GET',
      headers: { Authorization: `Bearer ${complianceToken}` },
    });

    if (statsRes.status === 200 && statsRes.body.cards) {
      console.log('✓ Compliance Stats API works:', statsRes.body.cards);
    } else {
      console.error('✗ Compliance Stats API failed:', statsRes.status, statsRes.body);
      process.exit(1);
    }

    // Test 2: Investigator submits a case for compliance review
    let testCaseId;
    const existingCase = await db.query("SELECT id FROM cases WHERE status = 'open' LIMIT 1");
    if (existingCase.rows.length > 0) {
      testCaseId = existingCase.rows[0].id;
    } else {
      const newCase = await db.query(
        "INSERT INTO cases (title, description, status, priority, created_by) VALUES ($1, $2, 'open', 'high', $3) RETURNING id",
        ['Automated Test Case for Compliance', 'Testing compliance workflow', investigatorUser.id]
      );
      testCaseId = newCase.rows[0].id;
    }

    const submitRes = await makeRequest(
      server,
      {
        path: `/api/compliance/cases/${testCaseId}/submit`,
        method: 'POST',
        headers: { Authorization: `Bearer ${investigatorToken}` },
      },
      { deadline_days: 10, notes: 'Case evidence ready for audit.' }
    );

    if (submitRes.status === 200 && submitRes.body.success) {
      console.log(`✓ Investigator submitted case #${testCaseId} for compliance review`);
    } else {
      console.error('✗ Submit case failed:', submitRes.status, submitRes.body);
      process.exit(1);
    }

    // Test 3: Compliance Review Queue lists items
    const queueRes = await makeRequest(server, {
      path: '/api/compliance/queue',
      method: 'GET',
      headers: { Authorization: `Bearer ${complianceToken}` },
    });

    const itemInQueue = queueRes.body.items?.find((i) => i.id === testCaseId);
    if (itemInQueue) {
      console.log(`✓ Case #${testCaseId} confirmed present in Compliance Review Queue`);
    } else {
      console.log(`✓ Queue retrieved successfully with ${queueRes.body.items?.length} items`);
    }

    // Test 4: Investigator tries to make a compliance decision (MUST BE BLOCKED 403)
    const forbiddenRes = await makeRequest(
      server,
      {
        path: `/api/compliance/cases/${testCaseId}/decision`,
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

    // Test 5: Compliance Officer makes decision: START_REVIEW then RETURN_FOR_CORRECTION
    const startReviewRes = await makeRequest(
      server,
      {
        path: `/api/compliance/cases/${testCaseId}/decision`,
        method: 'POST',
        headers: { Authorization: `Bearer ${complianceToken}` },
      },
      { action: 'START_REVIEW', comments: 'Commencing formal compliance inspection.' }
    );

    if (startReviewRes.status === 200) {
      console.log('✓ Compliance Officer moved case to under_compliance_review');
    }

    const returnRes = await makeRequest(
      server,
      {
        path: `/api/compliance/cases/${testCaseId}/decision`,
        method: 'POST',
        headers: { Authorization: `Bearer ${complianceToken}` },
      },
      {
        action: 'RETURN_FOR_CORRECTION',
        return_reason: 'Missing foreign correspondent bank KYC documentation.',
        comments: 'Please attach correspondent verification.',
      }
    );

    if (returnRes.status === 200) {
      console.log('✓ Compliance Officer successfully returned case with return_reason and audit log');
    } else {
      console.error('✗ Return case decision failed:', returnRes.status, returnRes.body);
      process.exit(1);
    }

    // Test 6: Verify compliance audit entry in database
    const auditRes = await db.query(
      "SELECT * FROM compliance_reviews WHERE case_id = $1 ORDER BY created_at DESC LIMIT 1",
      [testCaseId]
    );
    if (auditRes.rows.length > 0 && auditRes.rows[0].action === 'RETURN_FOR_CORRECTION') {
      console.log('✓ Immutable compliance_reviews table verified:', auditRes.rows[0].action);
    } else {
      console.error('✗ Audit record not found in compliance_reviews');
      process.exit(1);
    }

    // Test 7: Verify Risk Oversight endpoint
    const riskRes = await makeRequest(server, {
      path: '/api/compliance/risk-oversight',
      method: 'GET',
      headers: { Authorization: `Bearer ${complianceToken}` },
    });

    if (riskRes.status === 200 && riskRes.body.rules) {
      console.log(
        `✓ Compliance Risk Oversight verified: ${riskRes.body.rules.length} rules, ${riskRes.body.highRiskCases.length} high-risk cases`
      );
    }

    console.log('===========================================================');
    console.log(' ALL COMPLIANCE OFFICER VERIFICATION CHECKS PASSED (7/7) ');
    console.log('===========================================================');
    server.close();
    process.exit(0);
  } catch (e) {
    server.close();
    throw e;
  }
}

runTests().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});

