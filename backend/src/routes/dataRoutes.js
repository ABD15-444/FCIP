const express = require('express');
const router = express.Router();
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const db = require('../config/db');
const { authenticateToken } = require('../middleware/auth');
const { rebuildEntityRelationships, runDetectionEngine } = require('../services/detectionEngine');
const { logAudit } = require('../middleware/audit');

const upload = multer({
  dest: 'uploads/',
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are permitted.'));
    }
  },
});

// POST /api/upload - Parse CSV with robust validation & deduplication
router.post('/upload', authenticateToken, upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No CSV file provided.' });
  }

  const results = [];
  const rejectedRows = [];

  fs.createReadStream(req.file.path)
    .pipe(csv())
    .on('data', (data) => results.push(data))
    .on('end', async () => {
      // Clean up uploaded temp file
      try {
        fs.unlinkSync(req.file.path);
      } catch (err) {
        console.error('File cleanup error:', err);
      }

      if (results.length === 0) {
        return res.status(400).json({ success: false, message: 'CSV file is empty.' });
      }

      const client = await db.pool.connect();
      try {
        await client.query('BEGIN');

        let customersCreated = 0;
        let accountsCreated = 0;
        let transactionsCreated = 0;
        let duplicateRowsIgnored = 0;

        for (let i = 0; i < results.length; i++) {
          const row = results[i];
          const rowNumber = i + 2; // Accounting for 1-based header

          // Normalize row keys
          const normalized = {};
          for (const key of Object.keys(row)) {
            normalized[key.trim().toLowerCase().replace(/[\s-]/g, '_')] = row[key]?.trim();
          }

          // Validate required fields
          const fromAccNum = normalized.from_account || normalized.from_account_number || normalized.account_number;
          const toAccNum = normalized.to_account || normalized.to_account_number;
          const rawAmount = normalized.amount || normalized.transaction_amount;
          const amount = parseFloat(rawAmount);

          if (!fromAccNum || !toAccNum) {
            rejectedRows.push({ row: rowNumber, reason: 'Missing from_account or to_account identifier.' });
            continue;
          }

          if (isNaN(amount) || amount <= 0) {
            rejectedRows.push({ row: rowNumber, reason: `Invalid transaction amount '${rawAmount}'. Must be positive number.` });
            continue;
          }

          // Validate date
          const rawDate = normalized.transaction_date || normalized.date;
          let parsedDate = rawDate ? new Date(rawDate) : new Date();
          if (isNaN(parsedDate.getTime())) {
            rejectedRows.push({ row: rowNumber, reason: `Invalid transaction date '${rawDate}'.` });
            continue;
          }

          // 1. Process Customer (Sender)
          let customerId = null;
          const senderEmail = normalized.sender_email || normalized.customer_email || null;
          if (senderEmail) {
            const custRes = await client.query('SELECT id FROM customers WHERE email = $1', [senderEmail]);
            if (custRes.rows.length > 0) {
              customerId = custRes.rows[0].id;
            } else {
              const insertCust = await client.query(
                `INSERT INTO customers (first_name, last_name, email, phone, address, nationality, status)
                 VALUES ($1, $2, $3, $4, $5, $6, 'active') RETURNING id`,
                [
                  normalized.sender_first_name || normalized.first_name || 'Unidentified',
                  normalized.sender_last_name || normalized.last_name || 'Entity',
                  senderEmail,
                  normalized.phone || null,
                  normalized.address || null,
                  normalized.nationality || 'Unknown',
                ]
              );
              customerId = insertCust.rows[0].id;
              customersCreated++;
            }
          }

          // 2. Process From Account
          let fromAccountId = null;
          const fromAccRes = await client.query('SELECT id FROM accounts WHERE account_number = $1', [fromAccNum]);
          if (fromAccRes.rows.length > 0) {
            fromAccountId = fromAccRes.rows[0].id;
            // Link customer to account if account customer was previously null
            if (customerId) {
              await client.query('UPDATE accounts SET customer_id = $1 WHERE id = $2 AND customer_id IS NULL', [customerId, fromAccountId]);
            }
          } else {
            const insertAcc = await client.query(
              `INSERT INTO accounts (account_number, customer_id, account_type, currency, status)
               VALUES ($1, $2, $3, $4, 'active') RETURNING id`,
              [fromAccNum, customerId, normalized.account_type || 'checking', normalized.currency || 'USD']
            );
            fromAccountId = insertAcc.rows[0].id;
            accountsCreated++;
          }

          // 3. Process To Account (Receiver)
          let toAccountId = null;
          const toAccRes = await client.query('SELECT id FROM accounts WHERE account_number = $1', [toAccNum]);
          if (toAccRes.rows.length > 0) {
            toAccountId = toAccRes.rows[0].id;
          } else {
            const insertAcc = await client.query(
              `INSERT INTO accounts (account_number, customer_id, account_type, currency, status)
               VALUES ($1, NULL, $2, $3, 'active') RETURNING id`,
              [toAccNum, 'savings', normalized.currency || 'USD']
            );
            toAccountId = insertAcc.rows[0].id;
            accountsCreated++;
          }

          // 4. Process Transaction with Deduplication
          const txRes = await client.query(
            `INSERT INTO transactions (from_account_id, to_account_id, amount, currency, transaction_type, transaction_date, channel, description)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             ON CONFLICT (from_account_id, to_account_id, amount, transaction_date) DO NOTHING
             RETURNING id`,
            [
              fromAccountId,
              toAccountId,
              amount,
              normalized.currency || 'USD',
              normalized.transaction_type || normalized.type || 'wire_transfer',
              parsedDate.toISOString(),
              normalized.channel || 'wire',
              normalized.description || 'Interbank transfer batch',
            ]
          );

          if (txRes.rows.length > 0) {
            transactionsCreated++;
          } else {
            duplicateRowsIgnored++;
          }
        }

        await client.query('COMMIT');
        await rebuildEntityRelationships();

        // Record ingest history
        await db.query(
          `INSERT INTO dataset_ingest_history (uploaded_by, filename, rows_parsed, transactions_created, duplicates_ignored, rejected_count, status, error_details)
           VALUES ($1, $2, $3, $4, $5, $6, 'SUCCESS', $7)`,
          [
            req.user.id,
            req.file.originalname || 'dataset.csv',
            results.length,
            transactionsCreated,
            duplicateRowsIgnored,
            rejectedRows.length,
            JSON.stringify(rejectedRows.slice(0, 10)),
          ]
        );

        await logAudit({
          userId: req.user.id,
          userRole: req.user.role,
          action: 'DATASET_INGESTED',
          entityType: 'dataset',
          ipAddress: req.ip,
          outcome: 'SUCCESS',
          details: {
            filename: req.file.originalname,
            rowsParsed: results.length,
            transactionsCreated,
            duplicateRowsIgnored,
            rejectedCount: rejectedRows.length,
          },
        });

        return res.status(200).json({
          success: true,
          message: `Processed dataset with ${results.length} row(s). Created ${transactionsCreated} new transaction(s), ignored ${duplicateRowsIgnored} duplicate(s).`,
          summary: {
            rowsParsed: results.length,
            acceptedRows: transactionsCreated + duplicateRowsIgnored,
            rejectedRowsCount: rejectedRows.length,
            rejectedRows: rejectedRows.slice(0, 10), // Preview first 10 rejected errors
            customersCreated,
            accountsCreated,
            transactionsCreated,
            duplicateRowsIgnored,
          },
        });
      } catch (dbErr) {
        await client.query('ROLLBACK');
        console.error('CSV import DB error:', dbErr);
        return res.status(500).json({ success: false, message: 'Database error importing CSV records.', error: dbErr.message });
      } finally {
        client.release();
      }
    })
    .on('error', (parseErr) => {
      console.error('CSV parse error:', parseErr);
      res.status(400).json({ success: false, message: 'Malformed CSV file format.', error: parseErr.message });
    });
});

// GET /api/transactions with search, filter, pagination, and sorting
router.get('/transactions', authenticateToken, async (req, res) => {
  try {
    const {
      search,
      fromDate,
      toDate,
      minAmount,
      maxAmount,
      transactionType,
      channel,
      riskLevel,
      account,
      sortBy = 'transaction_date',
      sortOrder = 'DESC',
      limit = 25,
      offset = 0,
    } = req.query;

    let baseQuery = `
      FROM transactions t
      LEFT JOIN accounts fa ON t.from_account_id = fa.id
      LEFT JOIN customers fc ON fa.customer_id = fc.id
      LEFT JOIN accounts ta ON t.to_account_id = ta.id
      LEFT JOIN customers tc ON ta.customer_id = tc.id
      LEFT JOIN risk_scores rs ON rs.entity_type = 'transaction' AND rs.entity_id = t.id
      WHERE 1=1
    `;
    const params = [];

    if (search) {
      params.push(`%${search.trim()}%`);
      const pIdx = params.length;
      baseQuery += ` AND (fa.account_number ILIKE $${pIdx} OR ta.account_number ILIKE $${pIdx} OR t.description ILIKE $${pIdx} OR fc.first_name ILIKE $${pIdx} OR fc.last_name ILIKE $${pIdx})`;
    }

    if (account) {
      params.push(account.trim());
      const pIdx = params.length;
      baseQuery += ` AND (fa.account_number = $${pIdx} OR ta.account_number = $${pIdx})`;
    }

    if (fromDate) {
      params.push(fromDate);
      baseQuery += ` AND t.transaction_date >= $${params.length}`;
    }

    if (toDate) {
      params.push(toDate);
      baseQuery += ` AND t.transaction_date <= $${params.length}`;
    }

    if (minAmount) {
      params.push(parseFloat(minAmount));
      baseQuery += ` AND t.amount >= $${params.length}`;
    }

    if (maxAmount) {
      params.push(parseFloat(maxAmount));
      baseQuery += ` AND t.amount <= $${params.length}`;
    }

    if (transactionType && transactionType !== 'all') {
      params.push(transactionType);
      baseQuery += ` AND t.transaction_type = $${params.length}`;
    }

    if (channel && channel !== 'all') {
      params.push(channel);
      baseQuery += ` AND t.channel = $${params.length}`;
    }

    if (riskLevel && riskLevel !== 'all') {
      if (riskLevel === 'Unevaluated') {
        baseQuery += ` AND rs.risk_level IS NULL`;
      } else {
        params.push(riskLevel);
        baseQuery += ` AND rs.risk_level = $${params.length}`;
      }
    }

    // Total matching count
    const countRes = await db.query(`SELECT COUNT(t.id) as total ${baseQuery}`, params);
    const total = parseInt(countRes.rows[0].total, 10);

    // Validate sorting column to prevent SQL injection
    const allowedSortColumns = {
      id: 't.id',
      amount: 't.amount',
      transaction_date: 't.transaction_date',
      risk_score: 'rs.score',
      risk_level: 'rs.risk_level',
    };
    const orderCol = allowedSortColumns[sortBy] || 't.transaction_date';
    const orderDir = String(sortOrder).toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const selectQuery = `
      SELECT
        t.id,
        t.amount,
        t.currency,
        t.transaction_type,
        t.transaction_date,
        t.channel,
        t.description,
        t.from_account_id,
        t.to_account_id,
        fa.account_number as from_account,
        ta.account_number as to_account,
        fc.first_name as sender_first_name,
        fc.last_name as sender_last_name,
        tc.first_name as recipient_first_name,
        tc.last_name as recipient_last_name,
        rs.score as risk_score,
        rs.risk_level
      ${baseQuery}
      ORDER BY ${orderCol} ${orderDir}
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    params.push(parseInt(limit, 10), parseInt(offset, 10));
    const result = await db.query(selectQuery, params);

    return res.status(200).json({
      success: true,
      total,
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10),
      count: result.rows.length,
      transactions: result.rows,
    });
  } catch (error) {
    console.error('Fetch transactions error:', error);
    res.status(500).json({ success: false, message: 'Server error retrieving transactions.' });
  }
});

// GET /api/transactions/:id - transaction detail with risk explanation
router.get('/transactions/:id', authenticateToken, async (req, res) => {
  try {
    const txId = parseInt(req.params.id, 10);
    const txRes = await db.query(
      `
      SELECT
        t.*,
        fa.account_number as from_account,
        fa.customer_id as from_customer_id,
        ta.account_number as to_account,
        ta.customer_id as to_customer_id,
        fc.first_name as sender_first_name,
        fc.last_name as sender_last_name,
        fc.email as sender_email,
        tc.first_name as recipient_first_name,
        tc.last_name as recipient_last_name,
        tc.email as recipient_email,
        rs.id as risk_score_id,
        rs.score as risk_score,
        rs.risk_level,
        rs.calculated_at
      FROM transactions t
      LEFT JOIN accounts fa ON t.from_account_id = fa.id
      LEFT JOIN customers fc ON fa.customer_id = fc.id
      LEFT JOIN accounts ta ON t.to_account_id = ta.id
      LEFT JOIN customers tc ON ta.customer_id = tc.id
      LEFT JOIN risk_scores rs ON rs.entity_type = 'transaction' AND rs.entity_id = t.id
      WHERE t.id = $1
    `,
      [txId]
    );

    if (txRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Transaction not found.' });
    }

    const tx = txRes.rows[0];
    let factors = [];
    if (tx.risk_score_id) {
      const fRes = await db.query('SELECT * FROM risk_factors WHERE risk_score_id = $1', [tx.risk_score_id]);
      factors = fRes.rows;
    }
    tx.factors = factors;

    return res.status(200).json({ success: true, transaction: tx });
  } catch (error) {
    console.error('Fetch transaction detail error:', error);
    res.status(500).json({ success: false, message: 'Server error retrieving transaction detail.' });
  }
});

// POST /api/transactions/:id/evaluate - Evaluate a single transaction
router.post('/transactions/:id/evaluate', authenticateToken, async (req, res) => {
  try {
    const txId = parseInt(req.params.id, 10);
    const result = await runDetectionEngine(txId);
    return res.status(200).json({
      success: true,
      message: `Transaction #${txId} evaluated successfully.`,
      result,
    });
  } catch (error) {
    console.error('Single transaction evaluation error:', error);
    res.status(500).json({ success: false, message: 'Failed to evaluate transaction.' });
  }
});

// GET /api/customers
router.get('/customers', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        c.*, 
        COUNT(DISTINCT a.id) as account_count,
        COALESCE(SUM(t.amount), 0) as total_outbound_volume
      FROM customers c
      LEFT JOIN accounts a ON a.customer_id = c.id
      LEFT JOIN transactions t ON t.from_account_id = a.id
      GROUP BY c.id
      ORDER BY c.created_at DESC
    `);
    res.status(200).json({ success: true, count: result.rows.length, customers: result.rows });
  } catch (error) {
    console.error('Fetch customers error:', error);
    res.status(500).json({ success: false, message: 'Server error retrieving customers.' });
  }
});

// GET /api/accounts
router.get('/accounts', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        a.*, 
        c.first_name, 
        c.last_name, 
        c.email as customer_email,
        COUNT(DISTINCT t1.id) as sent_count,
        COUNT(DISTINCT t2.id) as received_count
      FROM accounts a
      LEFT JOIN customers c ON a.customer_id = c.id
      LEFT JOIN transactions t1 ON t1.from_account_id = a.id
      LEFT JOIN transactions t2 ON t2.to_account_id = a.id
      GROUP BY a.id, c.id
      ORDER BY a.open_date DESC
    `);
    res.status(200).json({ success: true, count: result.rows.length, accounts: result.rows });
  } catch (error) {
    console.error('Fetch accounts error:', error);
    res.status(500).json({ success: false, message: 'Server error retrieving accounts.' });
  }
});

module.exports = router;
