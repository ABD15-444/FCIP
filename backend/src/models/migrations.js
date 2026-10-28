const db = require('../config/db');

const runMigrations = async () => {
  try {
    // 1. Expand alerts status constraint to support 'under_investigation'
    await db.query(`
      ALTER TABLE alerts DROP CONSTRAINT IF EXISTS alerts_status_check;
      ALTER TABLE alerts ADD CONSTRAINT alerts_status_check 
        CHECK (status IN ('open', 'acknowledged', 'under_investigation', 'closed'));
    `);

    // 2. Add closure_reason and investigator_notes columns to alerts
    await db.query(`
      ALTER TABLE alerts ADD COLUMN IF NOT EXISTS closure_reason TEXT;
      ALTER TABLE alerts ADD COLUMN IF NOT EXISTS investigator_notes TEXT;
    `);

    // 3. Add dedup index for transactions
    await db.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_dedup 
        ON transactions (from_account_id, to_account_id, amount, transaction_date);
      CREATE INDEX IF NOT EXISTS idx_transactions_rapid 
        ON transactions (from_account_id, transaction_date);
    `);

    console.log('✓ Database schema migrations applied successfully.');
  } catch (err) {
    console.error('Migration error:', err);
    throw err;
  }
};

if (require.main === module) {
  runMigrations()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { runMigrations };

