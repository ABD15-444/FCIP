const db = require('../config/db');

// Seed default rules if none exist
const initDetectionRules = async () => {
  const existing = await db.query('SELECT COUNT(*) FROM detection_rules');
  if (parseInt(existing.rows[0].count, 10) === 0) {
    const defaultRules = [
      {
        rule_name: 'Large Amount Rule',
        condition_type: 'large_amount',
        threshold_value: 10000.0,
        risk_level: 'high',
        status: 'active',
      },
      {
        rule_name: 'Rapid Transfer Rule',
        condition_type: 'rapid_transfer',
        threshold_value: 3.0,
        risk_level: 'high',
        status: 'active',
      },
      {
        rule_name: 'Circular Transaction Rule',
        condition_type: 'circular_transaction',
        threshold_value: 5.0,
        risk_level: 'high',
        status: 'active',
      },
      {
        rule_name: 'Suspicious Round Number Flow',
        condition_type: 'round_number',
        threshold_value: 5000.0,
        risk_level: 'medium',
        status: 'active',
      },
    ];

    for (const r of defaultRules) {
      await db.query(
        `INSERT INTO detection_rules (rule_name, condition_type, threshold_value, risk_level, status)
         VALUES ($1, $2, $3, $4, $5)`,
        [r.rule_name, r.condition_type, r.threshold_value, r.risk_level, r.status]
      );
    }
  }
};

/**
 * Checks whether an amount is considered a round number:
 * An amount >= threshold that ends in two or more zeros (or exact multiples of 1,000 / 5,000 / 10,000 with no cents).
 */
const isRoundNumber = (amount, threshold) => {
  const num = parseFloat(amount);
  if (isNaN(num) || num < threshold) return false;
  // Must be an integer or have .00
  if (Math.floor(num) !== num) return false;
  // Ends in at least three zeros (multiple of 1,000) or two zeros (multiple of 100) above $5,000
  return num % 1000 === 0 || (num >= 5000 && num % 500 === 0);
};

const runDetectionEngine = async (singleTxId = null) => {
  await initDetectionRules();

  // Fetch active rules
  const rulesRes = await db.query("SELECT * FROM detection_rules WHERE status = 'active'");
  const rules = rulesRes.rows;

  // Fetch transactions (either a single transaction or all transactions)
  let txQuery = `
    SELECT t.*, fa.account_number as from_acc_num, ta.account_number as to_acc_num
    FROM transactions t
    LEFT JOIN accounts fa ON t.from_account_id = fa.id
    LEFT JOIN accounts ta ON t.to_account_id = ta.id
  `;
  const txParams = [];
  if (singleTxId) {
    txQuery += ' WHERE t.id = $1';
    txParams.push(singleTxId);
  }
  txQuery += ' ORDER BY t.transaction_date ASC';

  const txRes = await db.query(txQuery, txParams);
  const transactions = txRes.rows;

  let flaggedCount = 0;
  let newAlertsCount = 0;
  let updatedAlertsCount = 0;

  for (const tx of transactions) {
    const factors = [];
    let totalScore = 0;

    for (const rule of rules) {
      let isFlagged = false;
      let factorDesc = '';

      // 1. Large Amount Rule (> threshold)
      if (rule.condition_type === 'large_amount' && parseFloat(tx.amount) > parseFloat(rule.threshold_value)) {
        isFlagged = true;
        factorDesc = `Transaction amount of $${parseFloat(tx.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })} exceeds threshold of $${parseFloat(rule.threshold_value).toLocaleString('en-US', { minimumFractionDigits: 2 })}.`;
        factors.push({
          name: 'Exorbitant Transaction Amount',
          contribution: 45,
          description: factorDesc,
          rule_id: rule.id,
          severity: rule.risk_level,
        });
        totalScore += 45;
      }

      // 2. Rapid Transfer Rule (> threshold count within trailing 10-minute window)
      if (rule.condition_type === 'rapid_transfer' && tx.from_account_id) {
        const rapidRes = await db.query(
          `
          SELECT COUNT(*) FROM transactions
          WHERE from_account_id = $1
            AND transaction_date <= $2
            AND transaction_date >= ($2::timestamp - INTERVAL '10 minutes')
        `,
          [tx.from_account_id, tx.transaction_date]
        );

        const count = parseInt(rapidRes.rows[0].count, 10);
        const threshold = parseInt(rule.threshold_value, 10);
        if (count > threshold) {
          isFlagged = true;
          factorDesc = `Account sent ${count} rapid transactions within a 10-minute trailing window (threshold: > ${threshold} transactions).`;
          factors.push({
            name: 'High Frequency Rapid Velocity',
            contribution: 35,
            description: factorDesc,
            rule_id: rule.id,
            severity: rule.risk_level,
          });
          totalScore += 35;
        }
      }

      // 3. Circular Transaction Rule (money returns to origin sender within <= threshold hops)
      if (rule.condition_type === 'circular_transaction' && tx.from_account_id && tx.to_account_id) {
        const cycleRes = await db.query(
          `
          WITH RECURSIVE tx_path(origin, current_node, depth, visited, last_date) AS (
            SELECT from_account_id, to_account_id, 1, ARRAY[from_account_id, to_account_id], transaction_date
            FROM transactions
            WHERE id = $1
            UNION ALL
            SELECT p.origin, t.to_account_id, p.depth + 1, p.visited || t.to_account_id, t.transaction_date
            FROM transactions t
            JOIN tx_path p ON t.from_account_id = p.current_node
            WHERE p.depth < $2
              AND t.transaction_date >= p.last_date
              AND (
                NOT (t.to_account_id = ANY(p.visited))
                OR (t.to_account_id = p.origin AND p.depth >= 2)
              )
          )
          SELECT depth FROM tx_path WHERE current_node = origin AND depth > 1 LIMIT 1;
        `,
          [tx.id, parseInt(rule.threshold_value, 10)]
        );

        if (cycleRes.rows.length > 0) {
          isFlagged = true;
          const hops = cycleRes.rows[0].depth;
          factorDesc = `Circular fund flow detected: capital returned to origin sender within ${hops} hops.`;
          factors.push({
            name: 'Circular Laundering Loop',
            contribution: 50,
            description: factorDesc,
            rule_id: rule.id,
            severity: rule.risk_level,
          });
          totalScore += 50;
        }
      }

      // 4. Suspicious Round Number Flow (amount >= threshold and perfectly rounded)
      if (rule.condition_type === 'round_number') {
        const threshold = parseFloat(rule.threshold_value);
        if (isRoundNumber(tx.amount, threshold)) {
          isFlagged = true;
          factorDesc = `Transaction amount of $${parseFloat(tx.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })} is a high-denomination rounded sum meeting or exceeding threshold $${threshold.toLocaleString('en-US', { minimumFractionDigits: 2 })}.`;
          factors.push({
            name: 'Suspicious Round Number Flow',
            contribution: 25,
            description: factorDesc,
            rule_id: rule.id,
            severity: rule.risk_level,
          });
          totalScore += 25;
        }
      }

      // Record flags
      if (isFlagged) {
        const existingFlag = await db.query(
          'SELECT id FROM suspicious_flags WHERE transaction_id = $1 AND rule_id = $2',
          [tx.id, rule.id]
        );
        if (existingFlag.rows.length === 0) {
          await db.query(
            'INSERT INTO suspicious_flags (transaction_id, rule_id) VALUES ($1, $2)',
            [tx.id, rule.id]
          );
          flaggedCount++;
        }
      }
    }

    // Determine final score capped between 0 and 100
    const finalScore = Math.min(100, Math.max(factors.length > 0 ? 10 : 0, totalScore));
    let riskLevel = 'Low';
    if (finalScore >= 71) riskLevel = 'High';
    else if (finalScore >= 41) riskLevel = 'Medium';

    // Upsert risk score for this transaction
    const existingScore = await db.query(
      "SELECT id FROM risk_scores WHERE entity_type = 'transaction' AND entity_id = $1",
      [tx.id]
    );

    let scoreId;
    if (existingScore.rows.length > 0) {
      scoreId = existingScore.rows[0].id;
      await db.query(
        'UPDATE risk_scores SET score = $1, risk_level = $2, calculated_at = CURRENT_TIMESTAMP WHERE id = $3',
        [finalScore, riskLevel, scoreId]
      );
      await db.query('DELETE FROM risk_factors WHERE risk_score_id = $1', [scoreId]);
    } else {
      const scoreRes = await db.query(
        "INSERT INTO risk_scores (entity_type, entity_id, score, risk_level) VALUES ('transaction', $1, $2, $3) RETURNING id",
        [tx.id, finalScore, riskLevel]
      );
      scoreId = scoreRes.rows[0].id;
    }

    // Insert risk factor evidence items
    for (const f of factors) {
      await db.query(
        'INSERT INTO risk_factors (risk_score_id, factor_name, contribution, description) VALUES ($1, $2, $3, $4)',
        [scoreId, f.name, f.contribution, f.description]
      );

      // Create or update alert (prevent duplicate alerts)
      const existingAlert = await db.query(
        'SELECT id, status FROM alerts WHERE transaction_id = $1 AND rule_id = $2',
        [tx.id, f.rule_id]
      );
      if (existingAlert.rows.length === 0) {
        await db.query(
          `INSERT INTO alerts (transaction_id, rule_id, alert_type, severity, description, status)
           VALUES ($1, $2, $3, $4, $5, 'open')`,
          [tx.id, f.rule_id, f.name, f.severity.toLowerCase(), f.description]
        );
        newAlertsCount++;
      } else {
        // If alert already exists, keep its existing status and update description if changed
        await db.query(
          'UPDATE alerts SET description = $1, severity = $2 WHERE id = $3',
          [f.description, f.severity.toLowerCase(), existingAlert.rows[0].id]
        );
        updatedAlertsCount++;
      }
    }
  }

  // Update entity relationships
  await rebuildEntityRelationships();

  return {
    success: true,
    message: `Detection run completed. Examined ${transactions.length} transaction(s). New flags: ${flaggedCount}, New alerts: ${newAlertsCount}, Updated alerts: ${updatedAlertsCount}.`,
    totalTransactions: transactions.length,
    flaggedCount,
    newAlertsCount,
    updatedAlertsCount,
    executedAt: new Date().toISOString(),
  };
};

const rebuildEntityRelationships = async () => {
  await db.query('DELETE FROM entity_relationships');
  await db.query(`
    INSERT INTO entity_relationships (entity_type_1, entity_id_1, entity_type_2, entity_id_2, relationship_type, transaction_count, total_amount)
    SELECT
      'account',
      from_account_id,
      'account',
      to_account_id,
      'fund_transfer',
      COUNT(id),
      SUM(amount)
    FROM transactions
    WHERE from_account_id IS NOT NULL AND to_account_id IS NOT NULL
    GROUP BY from_account_id, to_account_id
  `);
};

module.exports = {
  runDetectionEngine,
  initDetectionRules,
  rebuildEntityRelationships,
};
