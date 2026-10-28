const db = require('../config/db');

async function testQuery() {
  try {
    const caseId = 8;
    console.log('Testing case 8...');
    const caseRes = await db.query(
      `SELECT c.*, a.description as alert_description, a.severity as alert_severity, a.transaction_id,
        t.amount as transaction_amount, t.currency as transaction_currency, t.transaction_date,
        t.channel as transaction_channel, t.transaction_type, fa.account_number as from_account,
        ta.account_number as to_account, u.first_name as assignee_first_name, u.last_name as assignee_last_name,
        cb.first_name as creator_first_name, cb.last_name as creator_last_name
      FROM cases c
      LEFT JOIN alerts a ON c.alert_id = a.id
      LEFT JOIN transactions t ON a.transaction_id = t.id
      LEFT JOIN accounts fa ON t.from_account_id = fa.id
      LEFT JOIN accounts ta ON t.to_account_id = ta.id
      LEFT JOIN users u ON c.assigned_to = u.id
      LEFT JOIN users cb ON c.created_by = cb.id
      WHERE c.id = $1`, [caseId]
    );
    console.log('Case Query OK:', caseRes.rows.length);

    const notesRes = await db.query(
      `SELECT cn.*, u.first_name, u.last_name, u.role
      FROM case_notes cn
      LEFT JOIN users u ON cn.created_by = u.id
      WHERE cn.case_id = $1
      ORDER BY cn.created_at ASC`, [caseId]
    );
    console.log('Notes Query OK:', notesRes.rows.length);

    const historyRes = await db.query(
      `SELECT ch.*, u.first_name, u.last_name
      FROM case_history ch
      LEFT JOIN users u ON ch.changed_by = u.id
      WHERE ch.case_id = $1
      ORDER BY ch.changed_at DESC`, [caseId]
    );
    console.log('History Query OK:', historyRes.rows.length);

    console.log('alert_id is:', caseRes.rows[0].alert_id);
    const alertQuery = await db.query(
      `SELECT a.*, dr.rule_name, dr.rule_code, dr.severity as rule_severity,
              t.amount, t.currency, t.transaction_date,
              rs.score as severity_score
       FROM alerts a
       LEFT JOIN detection_rules dr ON a.rule_id = dr.id
       LEFT JOIN transactions t ON a.transaction_id = t.id
       LEFT JOIN risk_scores rs ON rs.entity_type = 'transaction' AND rs.entity_id = t.id
       WHERE a.id = $1`, [caseRes.rows[0].alert_id]
    );
    console.log('Alert Query OK:', alertQuery.rows.length);
  } catch(e) {
    console.error('FAILED WITH ERROR:', e);
  } finally {
    process.exit(0);
  }
}
testQuery();
