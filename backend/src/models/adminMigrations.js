const db = require('../config/db');

const runAdminMigrations = async () => {
  try {
    // 1. Audit logs enrichment (role, outcome)
    await db.query(`
      ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS user_role VARCHAR(50);
      ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS outcome VARCHAR(20) DEFAULT 'SUCCESS';
    `);

    // 2. Detection run history
    await db.query(`
      CREATE TABLE IF NOT EXISTS detection_run_history (
        id SERIAL PRIMARY KEY,
        initiated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        total_scanned INTEGER NOT NULL,
        flagged_count INTEGER NOT NULL,
        new_alerts_count INTEGER NOT NULL,
        updated_alerts_count INTEGER NOT NULL,
        status VARCHAR(50) DEFAULT 'COMPLETED',
        error_message TEXT,
        executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 3. Dataset ingest history
    await db.query(`
      CREATE TABLE IF NOT EXISTS dataset_ingest_history (
        id SERIAL PRIMARY KEY,
        uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        filename VARCHAR(255),
        rows_parsed INTEGER NOT NULL,
        transactions_created INTEGER NOT NULL,
        duplicates_ignored INTEGER NOT NULL,
        rejected_count INTEGER NOT NULL,
        status VARCHAR(50) DEFAULT 'SUCCESS',
        error_details JSONB,
        ingested_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 4. Detection rule update history
    await db.query(`
      CREATE TABLE IF NOT EXISTS detection_rule_history (
        id SERIAL PRIMARY KEY,
        rule_id INTEGER REFERENCES detection_rules(id) ON DELETE CASCADE,
        changed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        previous_threshold NUMERIC(15, 2),
        new_threshold NUMERIC(15, 2),
        previous_status VARCHAR(50),
        new_status VARCHAR(50),
        previous_risk_level VARCHAR(50),
        new_risk_level VARCHAR(50),
        change_reason TEXT,
        changed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log('✓ Admin platform migration applied successfully.');
  } catch (err) {
    console.error('Migration error:', err);
    throw err;
  }
};

if (require.main === module) {
  runAdminMigrations()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { runAdminMigrations };

