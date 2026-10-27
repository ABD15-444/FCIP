const express = require('express');
const router = express.Router();
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const db = require('../config/db');
const { authenticateToken } = require('../middleware/auth');
const { rebuildEntityRelationships } = require('../services/detectionEngine');

const upload = multer({ dest: 'uploads/' });

// POST /api/upload - Parse CSV and insert customers, accounts, transactions
router.post('/upload', authenticateToken, upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No CSV file provided.' });
  }

  const results = [];
  fs.createReadStream(req.file.path)
    .pipe(csv())
    .on('data', (data) => results.push(data))
    .on('end', async () => {
      // Clean up uploaded file
      try {
        fs.unlinkSync(req.file.path);
      } catch (err) {
        console.error('File cleanup error:', err);
      }

      const client = await db.pool.connect();
      try {
        await client.query('BEGIN');

        let customersCreated = 0;
        let accountsCreated = 0;
        let transactionsCreated = 0;

        for (const row of results) {
          // Normalize row keys
          const normalized = {};
          for (const key of Object.keys(row)) {
            normalized[key.trim().toLowerCase().replace(/[\s-]/g, '_')] = row[key]?.trim();
          }

          // 1. Process Customer (Sender)
          let customerId = null;
          const senderEmail = normalized.sender_email || normalized.customer_email || (normalized.from_account ? `customer_${normalized.from_account}@fcip.internal` : null);
          if (senderEmail) {
            const custRes = await client.query('SELECT id FROM customers WHERE email = $1', [senderEmail]);
            if (custRes.rows.length > 0) {
              customerId = custRes.rows[0].id;
            } else {
              const insertCust = await client.query(
                `INSERT INTO customers (first_name, last_name, email, phone, address, nationality, status)
                 VALUES ($1, $2, $3, $4, $5, $6, 'active') RETURNING id`,
                [
                  normalized.sender_first_name || normalized.first_name || 'Anonymous',
                  normalized.sender_last_name || normalized.last_name || 'Holder',
                  senderEmail,
                  normalized.phone || '+1-555-0199',
                  normalized.address || 'Financial District',
                  normalized.nationality || 'US',
                ]
              );
              customerId = insertCust.rows[0].id;
              customersCreated++;
            }
          }

          // 2. Process From Account
          let fromAccountId = null;
          const fromAccNum = normalized.from_account || normalized.from_account_number || normalized.account_number;
          if (fromAccNum) {
            const accRes = await client.query('SELECT id FROM accounts WHERE account_number = $1', [fromAccNum]);
            if (accRes.rows.length > 0) {
              fromAccountId = accRes.rows[0].id;
            } else {
              const insertAcc = await client.query(
                `INSERT INTO accounts (account_number, customer_id, account_type, currency, status)
                 VALUES ($1, $2, $3, $4, 'active') RETURNING id`,
                [fromAccNum, customerId, normalized.account_type || 'checking', normalized.currency || 'USD']
              );
              fromAccountId = insertAcc.rows[0].id;
              accountsCreated++;
            }
          }

          // 3. Process To Account (Receiver)
          let toAccountId = null;
          const toAccNum = normalized.to_account || normalized.to_account_number;
          if (toAccNum) {
            const accRes = await client.query('SELECT id FROM accounts WHERE account_number = $1', [toAccNum]);
            if (accRes.rows.length > 0) {
              toAccountId = accRes.rows[0].id;
            } else {
              const insertAcc = await client.query(
                `INSERT INTO accounts (account_number, customer_id, account_type, currency, status)
                 VALUES ($1, NULL, $2, $3, 'active') RETURNING id`,
                [toAccNum, 'savings', normalized.currency || 'USD']
              );
              toAccountId = insertAcc.rows[0].id;
              accountsCreated++;
            }
          }

          // 4. Process Transaction
          const amount = parseFloat(normalized.amount || normalized.transaction_amount || 0);
          if (amount > 0) {
            const txDate = normalized.transaction_date || normalized.date || new Date().toISOString();
            await client.query(
              `INSERT INTO transactions (from_account_id, to_account_id, amount, currency, transaction_type, transaction_date, channel, description)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
              [
                fromAccountId,
                toAccountId,
                amount,
                normalized.currency || 'USD',
                normalized.transaction_type || normalized.type || 'wire_transfer',
                txDate,
                normalized.channel || 'wire',
                normalized.description || 'Interbank transfer batch',
              ]
            );
            transactionsCreated++;
          }
        }

        await client.query('COMMIT');
        await rebuildEntityRelationships();

        return res.status(200).json({
          success: true,
          message: `Successfully processed CSV with ${results.length} rows.`,
          summary: {
            rowsParsed: results.length,
            customersCreated,
            accountsCreated,
            transactionsCreated,
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
      res.status(400).json({ success: false, message: 'Malformed CSV file format.' });
    });
});

// GET /api/transactions with search & filter
router.get('/transactions', authenticateToken, async (req, res) => {
  try {
    const { search, fromDate, toDate, minAmount, maxAmount, account, limit = 100, offset = 0 } = req.query;

    let query = `
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
        rs.score as risk_score,
        rs.risk_level
      FROM transactions t
      LEFT JOIN accounts fa ON t.from_account_id = fa.id
      LEFT JOIN customers fc ON fa.customer_id = fc.id
      LEFT JOIN accounts ta ON t.to_account_id = ta.id
      LEFT JOIN risk_scores rs ON rs.entity_type = 'transaction' AND rs.entity_id = t.id
      WHERE 1=1
    `;
    const params = [];

    if (search) {
      params.push(`%${search.trim()}%`);
      const pIdx = params.length;
      query += ` AND (fa.account_number ILIKE $${pIdx} OR ta.account_number ILIKE $${pIdx} OR t.description ILIKE $${pIdx} OR fc.first_name ILIKE $${pIdx} OR fc.last_name ILIKE $${pIdx})`;
    }

    if (account) {
      params.push(account.trim());
      const pIdx = params.length;
      query += ` AND (fa.account_number = $${pIdx} OR ta.account_number = $${pIdx})`;
    }

    if (fromDate) {
      params.push(fromDate);
      query += ` AND t.transaction_date >= $${params.length}`;
    }

    if (toDate) {
      params.push(toDate);
      query += ` AND t.transaction_date <= $${params.length}`;
    }

    if (minAmount) {
      params.push(parseFloat(minAmount));
      query += ` AND t.amount >= $${params.length}`;
    }

    if (maxAmount) {
      params.push(parseFloat(maxAmount));
      query += ` AND t.amount <= $${params.length}`;
    }

    query += ` ORDER BY t.transaction_date DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit, 10), parseInt(offset, 10));

    const result = await db.query(query, params);
    const countRes = await db.query('SELECT COUNT(*) FROM transactions');

    return res.status(200).json({
      success: true,
      total: parseInt(countRes.rows[0].count, 10),
      count: result.rows.length,
      transactions: result.rows,
    });
  } catch (error) {
    console.error('Fetch transactions error:', error);
    res.status(500).json({ success: false, message: 'Server error retrieving transactions.' });
  }
});

// GET /api/customers
router.get('/customers', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT c.*, COUNT(a.id) as account_count
      FROM customers c
      LEFT JOIN accounts a ON a.customer_id = c.id
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
      SELECT a.*, c.first_name, c.last_name, c.email as customer_email
      FROM accounts a
      LEFT JOIN customers c ON a.customer_id = c.id
      ORDER BY a.open_date DESC
    `);
    res.status(200).json({ success: true, count: result.rows.length, accounts: result.rows });
  } catch (error) {
    console.error('Fetch accounts error:', error);
    res.status(500).json({ success: false, message: 'Server error retrieving accounts.' });
  }
});

module.exports = router;
