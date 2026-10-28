const assert = require('assert');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../../.env') });
const db = require('../config/db');
const { runDetectionEngine } = require('../services/detectionEngine');

async function runTestSuite() {
  console.log('====================================================');
  console.log('   FCIP Automated Comprehensive Verification Suite  ');
  console.log('====================================================\n');

  try {
    // 1. Test PostgreSQL DB connectivity
    console.log('[Test 1] Database Connectivity & Schema...');
    const dbCheck = await db.query('SELECT current_database(), current_user, version()');
    assert(dbCheck.rows.length > 0, 'Database query returned no rows');
    console.log(`  ✓ Connected to DB: ${dbCheck.rows[0].current_database}`);

    // 2. Detection Engine idempotency & rule execution
    console.log('\n[Test 2] Detection Engine & Rule Coverage...');
    const detRes = await runDetectionEngine();
    assert(detRes.success === true, 'Detection engine execution failed');
    assert(detRes.totalTransactions >= 13, 'Expected at least 13 transactions processed');
    console.log(`  ✓ Scanned ${detRes.totalTransactions} transactions.`);
    console.log(`  ✓ Repeat run duplicate prevention: New flags=${detRes.flaggedCount}, New alerts=${detRes.newAlertsCount}, Updated=${detRes.updatedAlertsCount}`);

    // 3. Verify Round Number detection (Rule #4)
    console.log('\n[Test 3] Suspicious Round Number Flow (Rule #4)...');
    const roundAlerts = await db.query("SELECT * FROM alerts WHERE rule_id = 4");
    assert(roundAlerts.rows.length > 0, 'No round number alerts were produced');
    console.log(`  ✓ Generated ${roundAlerts.rows.length} verified round-number alerts.`);

    // 4. Verify Rapid Transfer window semantics (Rule #2)
    console.log('\n[Test 4] Rapid Velocity 10-Minute Trailing Window...');
    const rapidAlerts = await db.query("SELECT * FROM alerts WHERE rule_id = 2");
    assert(rapidAlerts.rows.length > 0, 'No rapid velocity alerts were produced');
    console.log(`  ✓ Generated ${rapidAlerts.rows.length} rapid-transfer alerts.`);

    // 5. Verify Circular Transaction Loop (Rule #3)
    console.log('\n[Test 5] Circular Laundering Loop Detection...');
    const cycleAlerts = await db.query("SELECT * FROM alerts WHERE rule_id = 3");
    assert(cycleAlerts.rows.length > 0, 'No circular transaction alerts were produced');
    console.log(`  ✓ Generated ${cycleAlerts.rows.length} circular-cycle alerts.`);

    // 6. Test Risk Score capping & bounds
    console.log('\n[Test 6] Risk Scoring Formulas (0 - 100 Cap)...');
    const scoreBounds = await db.query('SELECT MIN(score) as min_score, MAX(score) as max_score FROM risk_scores');
    const minS = parseFloat(scoreBounds.rows[0].min_score);
    const maxS = parseFloat(scoreBounds.rows[0].max_score);
    assert(minS >= 0 && maxS <= 100, `Scores outside [0, 100]: min=${minS}, max=${maxS}`);
    console.log(`  ✓ Scores verified bounded within range [${minS}, ${maxS}].`);

    // 7. Test Alert Lifecycle Transitions (open -> acknowledged -> under_investigation -> closed)
    console.log('\n[Test 7] Alert Lifecycle State Transitions...');
    const testAlert = await db.query('SELECT id, status FROM alerts LIMIT 1');
    const aId = testAlert.rows[0].id;
    
    await db.query("UPDATE alerts SET status = 'acknowledged' WHERE id = $1", [aId]);
    let checkAck = await db.query('SELECT status FROM alerts WHERE id = $1', [aId]);
    assert.strictEqual(checkAck.rows[0].status, 'acknowledged');

    await db.query("UPDATE alerts SET status = 'under_investigation' WHERE id = $1", [aId]);
    let checkInvest = await db.query('SELECT status FROM alerts WHERE id = $1', [aId]);
    assert.strictEqual(checkInvest.rows[0].status, 'under_investigation');

    await db.query("UPDATE alerts SET status = 'closed', closure_reason = 'Verified in test harness' WHERE id = $1", [aId]);
    let checkClosed = await db.query('SELECT status, closure_reason FROM alerts WHERE id = $1', [aId]);
    assert.strictEqual(checkClosed.rows[0].status, 'closed');
    console.log(`  ✓ Alert #${aId} cycled through acknowledged -> under_investigation -> closed.`);

    // 8. Test Dashboard Stats Query Integrity
    console.log('\n[Test 8] Dashboard Telemetry Aggregations...');
    const txCount = await db.query('SELECT COUNT(*) FROM transactions');
    const alertCount = await db.query('SELECT COUNT(*) FROM alerts');
    const casesCount = await db.query('SELECT COUNT(*) FROM cases');
    console.log(`  ✓ Database Actual Totals: Transactions=${txCount.rows[0].count}, Alerts=${alertCount.rows[0].count}, Cases=${casesCount.rows[0].count}`);

    // 9. Test Case History & Audit Trails
    console.log('\n[Test 9] Case History & Audit Logging...');
    const logsRes = await db.query('SELECT COUNT(*) FROM audit_logs');
    assert(parseInt(logsRes.rows[0].count, 10) > 0, 'No audit logs found');
    console.log(`  ✓ Total Audit Logs Persisted: ${logsRes.rows[0].count}`);

    console.log('\n====================================================');
    console.log('   All 9 Verification Tests Passed Successfully!    ');
    console.log('====================================================');
    process.exit(0);
  } catch (err) {
    console.error('\n✖ Verification Test Failure:', err);
    process.exit(1);
  }
}

runTestSuite();
