const http = require('http');
const jwt = require('jsonwebtoken');
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const db = require('../config/db');
const express = require('express');
const cors = require('cors');

const reportRoutes = require('../routes/reportRoutes');

const app = express();
app.use(cors());
app.use(express.json());
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
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: parsed,
          });
        });
      }
    );
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runReportTests() {
  console.log('=== FCIP Report Download & Authentication Tests ===\n');

  const server = app.listen(0);

  try {
    // 1. Get test users
    const invUser = await db.query("SELECT * FROM users WHERE role = 'investigator' LIMIT 1");
    const compUser = await db.query("SELECT * FROM users WHERE role = 'compliance_officer' LIMIT 1");
    const adminUser = await db.query("SELECT * FROM users WHERE role = 'admin' LIMIT 1");

    if (invUser.rows.length === 0) {
      throw new Error('Investigator test user missing in database');
    }

    const JWT_SECRET = process.env.JWT_SECRET || 'fcip_development_jwt_secret_key_2026';
    const invToken = jwt.sign(
      { id: invUser.rows[0].id, email: invUser.rows[0].email, role: invUser.rows[0].role },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
    const compToken = compUser.rows.length > 0 ? jwt.sign(
      { id: compUser.rows[0].id, email: compUser.rows[0].email, role: compUser.rows[0].role },
      JWT_SECRET,
      { expiresIn: '1h' }
    ) : null;
    const adminToken = adminUser.rows.length > 0 ? jwt.sign(
      { id: adminUser.rows[0].id, email: adminUser.rows[0].email, role: adminUser.rows[0].role },
      JWT_SECRET,
      { expiresIn: '1h' }
    ) : null;

    // Get an existing report or create one
    let reportId;
    const repCheck = await db.query('SELECT id FROM reports LIMIT 1');
    if (repCheck.rows.length > 0) {
      reportId = repCheck.rows[0].id;
    } else {
      // Create a test case and report
      const newCase = await db.query(
        "INSERT INTO cases (title, description, status, priority, created_by) VALUES ('Test Case for Report', 'Audit test', 'open', 'medium', $1) RETURNING id",
        [invUser.rows[0].id]
      );
      const newRep = await db.query(
        `INSERT INTO reports (case_id, title, report_data, generated_by)
         VALUES ($1, 'Test Investigation Report', $2, $3) RETURNING id`,
        [newCase.rows[0].id, JSON.stringify({ isOfficialSAR: false, reportType: 'Internal Dossier' }), invUser.rows[0].id]
      );
      reportId = newRep.rows[0].id;
    }

    console.log(`Using report ID: ${reportId}\n`);

    // TEST 1: Request WITHOUT token (Must be rejected with 401)
    console.log('[Test 1] Request without Authorization header...');
    const noTokenRes = await makeRequest(server, {
      path: `/api/reports/${reportId}/export`,
      method: 'GET',
    });
    if (noTokenRes.status === 401 && noTokenRes.body.success === false) {
      console.log('✓ PASS: Rejected with 401 Unauthorized (No token provided)\n');
    } else {
      throw new Error(`Test 1 Failed: Expected 401, got ${noTokenRes.status}`);
    }

    // TEST 2: Request with INVALID/EXPIRED token (Must be rejected with 403)
    console.log('[Test 2] Request with invalid token...');
    const invalidTokenRes = await makeRequest(server, {
      path: `/api/reports/${reportId}/export`,
      method: 'GET',
      headers: { Authorization: 'Bearer this.is.an.invalid.token' },
    });
    if (invalidTokenRes.status === 403 && invalidTokenRes.body.success === false) {
      console.log('✓ PASS: Rejected with 403 Forbidden (Invalid token)\n');
    } else {
      throw new Error(`Test 2 Failed: Expected 403, got ${invalidTokenRes.status}`);
    }

    // TEST 3: Request with NONEXISTENT report ID (Must be 404)
    console.log('[Test 3] Request for non-existent report ID 999999...');
    const notFoundRes = await makeRequest(server, {
      path: '/api/reports/999999/export',
      method: 'GET',
      headers: { Authorization: `Bearer ${invToken}` },
    });
    if (notFoundRes.status === 404) {
      console.log('✓ PASS: Returns 404 Not Found for non-existent report\n');
    } else {
      throw new Error(`Test 3 Failed: Expected 404, got ${notFoundRes.status}`);
    }

    // TEST 4: Request with INVALID report ID parameter (Must be 400)
    console.log('[Test 4] Request with invalid NaN report ID...');
    const badParamRes = await makeRequest(server, {
      path: '/api/reports/invalid-id/export',
      method: 'GET',
      headers: { Authorization: `Bearer ${invToken}` },
    });
    if (badParamRes.status === 400) {
      console.log('✓ PASS: Returns 400 Bad Request for non-numeric report ID\n');
    } else {
      throw new Error(`Test 4 Failed: Expected 400, got ${badParamRes.status}`);
    }

    // TEST 5: Authenticated Investigator downloads report
    console.log('[Test 5] Authenticated Investigator download...');
    const invDownloadRes = await makeRequest(server, {
      path: `/api/reports/${reportId}/export`,
      method: 'GET',
      headers: { Authorization: `Bearer ${invToken}` },
    });
    if (
      invDownloadRes.status === 200 &&
      invDownloadRes.headers['content-type'].includes('text/html') &&
      typeof invDownloadRes.body === 'string' &&
      invDownloadRes.body.includes('Financial Crime Intelligence Platform')
    ) {
      console.log('✓ PASS: Investigator received valid printable report content');
      console.log(`  Content-Type: ${invDownloadRes.headers['content-type']}`);
      console.log(`  Content-Disposition: ${invDownloadRes.headers['content-disposition']}\n`);
    } else {
      throw new Error(`Test 5 Failed: ${invDownloadRes.status}`);
    }

    // TEST 6: Authenticated Compliance Officer downloads report
    if (compToken) {
      console.log('[Test 6] Authenticated Compliance Officer download...');
      const compDownloadRes = await makeRequest(server, {
        path: `/api/reports/${reportId}/export`,
        method: 'GET',
        headers: { Authorization: `Bearer ${compToken}` },
      });
      if (compDownloadRes.status === 200) {
        console.log('✓ PASS: Compliance Officer successfully downloaded report\n');
      } else {
        throw new Error(`Test 6 Failed: ${compDownloadRes.status}`);
      }
    }

    // TEST 7: Authenticated Administrator downloads report
    if (adminToken) {
      console.log('[Test 7] Authenticated Administrator download...');
      const adminDownloadRes = await makeRequest(server, {
        path: `/api/reports/${reportId}/export`,
        method: 'GET',
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      if (adminDownloadRes.status === 200) {
        console.log('✓ PASS: Administrator successfully downloaded report\n');
      } else {
        throw new Error(`Test 7 Failed: ${adminDownloadRes.status}`);
      }
    }

    console.log('==================================================');
    console.log('  ALL REPORT DOWNLOAD AUTHENTICATION TESTS PASSED ');
    console.log('==================================================');

    server.close();
    process.exit(0);
  } catch (err) {
    server.close();
    console.error('Test execution failed:', err);
    process.exit(1);
  }
}

runReportTests();

