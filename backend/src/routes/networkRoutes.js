const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticateToken } = require('../middleware/auth');

// GET /api/network/erd - return PostgreSQL database schema, foreign-key relationships and live record counts
router.get('/erd', authenticateToken, async (req, res) => {
  try {
    const tableNames = [
      'customers',
      'accounts',
      'transactions',
      'detection_rules',
      'alerts',
      'risk_scores',
      'cases',
      'case_notes',
      'case_history',
      'reports',
      'compliance_reviews',
      'audit_logs',
      'users'
    ];

    const tables = [];
    for (const tbl of tableNames) {
      const countRes = await db.query(`SELECT COUNT(*) as count FROM ${tbl}`);
      const rowCount = parseInt(countRes.rows[0].count, 10);

      const colRes = await db.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
        ORDER BY ordinal_position ASC
      `, [tbl]);

      const fkRes = await db.query(`
        SELECT
          kcu.column_name,
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name,
          tc.constraint_type
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        LEFT JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
        WHERE tc.table_schema = 'public' AND tc.table_name = $1
      `, [tbl]);

      tables.push({
        name: tbl,
        rowCount,
        columns: colRes.rows,
        keys: fkRes.rows,
      });
    }

    const relationships = [
      { from: 'customers', to: 'accounts', type: '1:N', label: 'customer_id' },
      { from: 'accounts', to: 'transactions', type: '1:N', label: 'from_account_id / to_account_id' },
      { from: 'transactions', to: 'alerts', type: '1:1', label: 'transaction_id' },
      { from: 'detection_rules', to: 'alerts', type: '1:N', label: 'rule_id' },
      { from: 'transactions', to: 'risk_scores', type: '1:1', label: 'entity_id' },
      { from: 'alerts', to: 'cases', type: '1:N', label: 'alert_id' },
      { from: 'cases', to: 'case_notes', type: '1:N', label: 'case_id' },
      { from: 'cases', to: 'case_history', type: '1:N', label: 'case_id' },
      { from: 'cases', to: 'compliance_reviews', type: '1:N', label: 'case_id' },
      { from: 'cases', to: 'reports', type: '1:N', label: 'case_id' },
      { from: 'users', to: 'cases', type: '1:N', label: 'assigned_to / created_by' },
      { from: 'users', to: 'audit_logs', type: '1:N', label: 'user_id' },
    ];

    res.status(200).json({
      success: true,
      database: process.env.DB_NAME || 'fcip_db',
      timestamp: new Date().toISOString(),
      tables,
      relationships,
    });
  } catch (error) {
    console.error('ERD schema fetch error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve database schema ERD.' });
  }
});

// GET /api/network/graph - return global network overview across recent transactions
router.get('/graph', authenticateToken, async (req, res) => {
  try {
    const txRes = await db.query(`
      SELECT
        t.id, t.from_account_id, t.to_account_id, t.amount, t.currency, t.transaction_date,
        fa.account_number as from_acc_num, ta.account_number as to_acc_num,
        fc.first_name as from_first_name, fc.last_name as from_last_name,
        tc.first_name as to_first_name, tc.last_name as to_last_name,
        rs.score as tx_risk_score, rs.risk_level as tx_risk_level
      FROM transactions t
      LEFT JOIN accounts fa ON t.from_account_id = fa.id
      LEFT JOIN customers fc ON fa.customer_id = fc.id
      LEFT JOIN accounts ta ON t.to_account_id = ta.id
      LEFT JOIN customers tc ON ta.customer_id = tc.id
      LEFT JOIN risk_scores rs ON rs.entity_type = 'transaction' AND rs.entity_id = t.id
      ORDER BY t.transaction_date DESC
      LIMIT 100
    `);

    const nodeMap = new Map();
    const links = [];

    for (const t of txRes.rows) {
      if (t.from_account_id) {
        const fromNodeId = `acc_${t.from_account_id}`;
        if (!nodeMap.has(fromNodeId)) {
          nodeMap.set(fromNodeId, {
            id: fromNodeId,
            name: t.from_acc_num || `Acc #${t.from_account_id}`,
            label: `${t.from_acc_num || `Acc #${t.from_account_id}`} (${t.from_first_name || 'Sender'})`,
            type: 'account',
            accountId: t.from_account_id,
            riskLevel: t.tx_risk_level || 'Low',
            riskScore: t.tx_risk_score || 30,
          });
        }
      }

      if (t.to_account_id) {
        const toNodeId = `acc_${t.to_account_id}`;
        if (!nodeMap.has(toNodeId)) {
          nodeMap.set(toNodeId, {
            id: toNodeId,
            name: t.to_acc_num || `Acc #${t.to_account_id}`,
            label: `${t.to_acc_num || `Acc #${t.to_account_id}`} (${t.to_first_name || 'Recipient'})`,
            type: 'account',
            accountId: t.to_account_id,
            riskLevel: t.tx_risk_level || 'Low',
            riskScore: t.tx_risk_score || 30,
          });
        }
      }

      if (t.from_account_id && t.to_account_id) {
        links.push({
          id: `tx_${t.id}`,
          source: `acc_${t.from_account_id}`,
          target: `acc_${t.to_account_id}`,
          amount: parseFloat(t.amount),
          currency: t.currency,
          date: t.transaction_date,
          riskLevel: t.tx_risk_level || 'Low',
        });
      }
    }

    return res.status(200).json({
      success: true,
      nodes: Array.from(nodeMap.values()),
      links,
      centerAccount: nodeMap.size > 0 ? Array.from(nodeMap.values())[0] : null,
    });
  } catch (error) {
    console.error('Global graph build error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate global network graph.' });
  }
});

// GET /api/network/graph/:accountId - return nodes and edges for network around given account
router.get('/graph/:accountId', authenticateToken, async (req, res) => {
  try {
    const accountId = parseInt(req.params.accountId, 10);

    // 1. Get center account
    const centerRes = await db.query(`
      SELECT a.*, c.first_name, c.last_name, c.email as customer_email, rs.score, rs.risk_level
      FROM accounts a
      LEFT JOIN customers c ON a.customer_id = c.id
      LEFT JOIN risk_scores rs ON rs.entity_type = 'account' AND rs.entity_id = a.id
      WHERE a.id = $1
    `, [accountId]);

    if (centerRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Account not found.' });
    }

    const centerAcc = centerRes.rows[0];

    // 2. Find direct inbound & outbound transactions
    const txRes = await db.query(`
      SELECT
        t.id, t.from_account_id, t.to_account_id, t.amount, t.currency, t.transaction_date,
        fa.account_number as from_acc_num, ta.account_number as to_acc_num,
        fc.first_name as from_first_name, fc.last_name as from_last_name,
        tc.first_name as to_first_name, tc.last_name as to_last_name,
        rs.score as tx_risk_score, rs.risk_level as tx_risk_level
      FROM transactions t
      LEFT JOIN accounts fa ON t.from_account_id = fa.id
      LEFT JOIN customers fc ON fa.customer_id = fc.id
      LEFT JOIN accounts ta ON t.to_account_id = ta.id
      LEFT JOIN customers tc ON ta.customer_id = tc.id
      LEFT JOIN risk_scores rs ON rs.entity_type = 'transaction' AND rs.entity_id = t.id
      WHERE t.from_account_id = $1 OR t.to_account_id = $1
      LIMIT 100
    `, [accountId]);

    const nodeMap = new Map();
    const links = [];

    // Add center node
    const centerNodeId = `acc_${centerAcc.id}`;
    nodeMap.set(centerNodeId, {
      id: centerNodeId,
      name: centerAcc.account_number,
      label: `${centerAcc.account_number} (${centerAcc.first_name || 'Holder'})`,
      type: 'account',
      accountId: centerAcc.id,
      riskLevel: centerAcc.risk_level || 'Medium',
      riskScore: centerAcc.score || 55,
      currency: centerAcc.currency,
      isCenter: true,
    });

    for (const t of txRes.rows) {
      // From Node
      if (t.from_account_id) {
        const fromNodeId = `acc_${t.from_account_id}`;
        if (!nodeMap.has(fromNodeId)) {
          nodeMap.set(fromNodeId, {
            id: fromNodeId,
            name: t.from_acc_num || `Acc #${t.from_account_id}`,
            label: `${t.from_acc_num || `Acc #${t.from_account_id}`} (${t.from_first_name || 'Sender'})`,
            type: 'account',
            accountId: t.from_account_id,
            riskLevel: t.tx_risk_level || 'Low',
            riskScore: t.tx_risk_score || 30,
          });
        }
      }

      // To Node
      if (t.to_account_id) {
        const toNodeId = `acc_${t.to_account_id}`;
        if (!nodeMap.has(toNodeId)) {
          nodeMap.set(toNodeId, {
            id: toNodeId,
            name: t.to_acc_num || `Acc #${t.to_account_id}`,
            label: `${t.to_acc_num || `Acc #${t.to_account_id}`} (${t.to_first_name || 'Recipient'})`,
            type: 'account',
            accountId: t.to_account_id,
            riskLevel: t.tx_risk_level || 'Low',
            riskScore: t.tx_risk_score || 30,
          });
        }
      }

      // Edge
      if (t.from_account_id && t.to_account_id) {
        links.push({
          id: `tx_${t.id}`,
          source: `acc_${t.from_account_id}`,
          target: `acc_${t.to_account_id}`,
          amount: parseFloat(t.amount),
          currency: t.currency,
          date: t.transaction_date,
          riskLevel: t.tx_risk_level || 'Low',
        });
      }
    }

    return res.status(200).json({
      success: true,
      nodes: Array.from(nodeMap.values()),
      links,
      centerAccount: centerAcc,
    });
  } catch (error) {
    console.error('Graph build error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate network graph.' });
  }
});

// GET /api/network/money-flow/:accountId - return the path of money movement from a given account
router.get('/money-flow/:accountId', authenticateToken, async (req, res) => {
  try {
    const accountId = parseInt(req.params.accountId, 10);
    const flowRes = await db.query(`
      WITH RECURSIVE flow_chain AS (
        SELECT
          t.id as tx_id,
          t.from_account_id,
          t.to_account_id,
          t.amount,
          t.currency,
          t.transaction_date,
          1 as hop_level,
          ARRAY[t.from_account_id, t.to_account_id] as visited_accounts
        FROM transactions t
        WHERE t.from_account_id = $1

        UNION ALL

        SELECT
          t2.id,
          t2.from_account_id,
          t2.to_account_id,
          t2.amount,
          t2.currency,
          t2.transaction_date,
          fc.hop_level + 1,
          fc.visited_accounts || t2.to_account_id
        FROM transactions t2
        JOIN flow_chain fc ON t2.from_account_id = fc.to_account_id
        WHERE fc.hop_level < 5
          AND NOT (t2.to_account_id = ANY(fc.visited_accounts))
          AND t2.transaction_date >= fc.transaction_date
      )
      SELECT
        fc.*,
        fa.account_number as from_account,
        ta.account_number as to_account
      FROM flow_chain fc
      LEFT JOIN accounts fa ON fc.from_account_id = fa.id
      LEFT JOIN accounts ta ON fc.to_account_id = ta.id
      ORDER BY fc.hop_level ASC, fc.transaction_date ASC
      LIMIT 100;
    `, [accountId]);

    res.status(200).json({
      success: true,
      originAccountId: accountId,
      pathLength: flowRes.rows.length,
      flows: flowRes.rows,
    });
  } catch (error) {
    console.error('Money flow error:', error);
    res.status(500).json({ success: false, message: 'Failed to compute money flow trace.' });
  }
});

module.exports = router;
