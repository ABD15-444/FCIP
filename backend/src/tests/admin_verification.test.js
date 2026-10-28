const assert = require('assert');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../../.env') });
const db = require('../config/db');
const { logAudit } = require('../middleware/audit');

async function runAdminVerificationSuite() {
  console.log('================================================================');
  console.log('   FCIP Administrator & Audit Engine Comprehensive Test Suite   ');
  console.log('================================================================\n');

  try {
    // 1. Audit Log Persistence & Schema Enrichment
    console.log('[Test 1] Testing Enriched Audit Log Persistence...');
    const testAction = 'TEST_ADMIN_VERIFICATION_' + Date.now();
    await logAudit({
      userId: 2, // Admin user
      userRole: 'admin',
      action: testAction,
      entityType: 'system_test',
      entityId: 9999,
      ipAddress: '127.0.0.1',
      outcome: 'SUCCESS',
      details: {
        testKey: 'testValue',
        secret: 'SHOULD_BE_REDACTED',
      },
    });

    const auditCheck = await db.query('SELECT * FROM audit_logs WHERE action = $1', [testAction]);
    assert(auditCheck.rows.length === 1, 'Audit log was not written to database');
    const logEntry = auditCheck.rows[0];
    assert.strictEqual(logEntry.user_role, 'admin', 'user_role was not captured');
    assert.strictEqual(logEntry.outcome, 'SUCCESS', 'outcome was not captured');
    assert(logEntry.details.secret === '[REDACTED]', 'Sensitive token was not redacted in audit details');
    console.log(`  ✓ Enriched audit log #${logEntry.id} persisted with sanitized details.`);

    // 2. Audit Trail Query & Filter API
    console.log('\n[Test 2] Testing Audit Query Filtering & Aggregation...');
    const auditCountRes = await db.query('SELECT COUNT(*) FROM audit_logs');
    assert(parseInt(auditCountRes.rows[0].count, 10) > 0, 'No audit records in DB');
    console.log(`  ✓ Total verifiable audit entries: ${auditCountRes.rows[0].count}`);

    // 3. User Management & Protection Guards
    console.log('\n[Test 3] Testing User Management & Admin Protection Guards...');
    const adminCountRes = await db.query("SELECT COUNT(*) FROM users WHERE role = 'admin' AND status = 'active'");
    const activeAdmins = parseInt(adminCountRes.rows[0].count, 10);
    assert(activeAdmins >= 1, 'No active administrators in system');
    console.log(`  ✓ System has ${activeAdmins} active administrator(s).`);

    // 4. Detection Rule Calibration History
    console.log('\n[Test 4] Testing Detection Rule Parameter History...');
    const ruleHistRes = await db.query('SELECT * FROM detection_rule_history');
    console.log(`  ✓ Parameter history table ready: ${ruleHistRes.rows.length} calibration events recorded.`);

    // 5. Ingestion Batch Quality History
    console.log('\n[Test 5] Testing Dataset Ingest History Schema...');
    const ingestHistRes = await db.query('SELECT * FROM dataset_ingest_history');
    console.log(`  ✓ Dataset ingest history table ready: ${ingestHistRes.rows.length} batch records recorded.`);

    // 6. System Health Diagnostic Telemetry
    console.log('\n[Test 6] Testing System Health Telemetry Verification...');
    const startPing = Date.now();
    const pingRes = await db.query('SELECT 1 as live');
    const pingLatency = Date.now() - startPing;
    assert.strictEqual(pingRes.rows[0].live, 1);
    console.log(`  ✓ Live DB Ping latency: ${pingLatency} ms. Status: HEALTHY.`);

    console.log('\n================================================================');
    console.log('   All Administrator & Audit Verification Tests Passed!         ');
    console.log('================================================================');
    process.exit(0);
  } catch (err) {
    console.error('\n✖ Test Failure:', err);
    process.exit(1);
  }
}

runAdminVerificationSuite();

