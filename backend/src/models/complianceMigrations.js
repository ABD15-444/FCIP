const db = require('../config/db');

const runComplianceMigrations = async () => {
  try {
    // 1. Expand cases status check to support compliance workflow:
    // 'open', 'in_progress', 'submitted_for_review', 'under_compliance_review', 'returned_for_correction', 'compliance_accepted', 'escalated', 'closed'
    await db.query(`
      ALTER TABLE cases DROP CONSTRAINT IF EXISTS cases_status_check;
      ALTER TABLE cases ADD CONSTRAINT cases_status_check
        CHECK (status IN (
          'open', 
          'in_progress', 
          'submitted_for_review', 
          'under_compliance_review', 
          'returned_for_correction', 
          'compliance_accepted', 
          'escalated', 
          'closed'
        ));
    `);

    // 2. Add review metadata columns to cases
    await db.query(`
      ALTER TABLE cases ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMP WITH TIME ZONE;
      ALTER TABLE cases ADD COLUMN IF NOT EXISTS submitted_by INTEGER REFERENCES users(id) ON DELETE SET NULL;
      ALTER TABLE cases ADD COLUMN IF NOT EXISTS return_reason TEXT;
      ALTER TABLE cases ADD COLUMN IF NOT EXISTS compliance_notes TEXT;
      ALTER TABLE cases ADD COLUMN IF NOT EXISTS review_deadline TIMESTAMP WITH TIME ZONE;
    `);

    // 3. Add review status & decision columns to reports
    await db.query(`
      ALTER TABLE reports ADD COLUMN IF NOT EXISTS review_status VARCHAR(50) DEFAULT 'draft'
        CHECK (review_status IN ('draft', 'pending_approval', 'approved', 'returned', 'rejected'));
      ALTER TABLE reports ADD COLUMN IF NOT EXISTS reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL;
      ALTER TABLE reports ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP WITH TIME ZONE;
      ALTER TABLE reports ADD COLUMN IF NOT EXISTS review_comments TEXT;
      ALTER TABLE reports ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;
    `);

    // 4. Create compliance_reviews ledger table
    await db.query(`
      CREATE TABLE IF NOT EXISTS compliance_reviews (
        id SERIAL PRIMARY KEY,
        case_id INTEGER REFERENCES cases(id) ON DELETE CASCADE,
        report_id INTEGER REFERENCES reports(id) ON DELETE SET NULL,
        reviewer_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        action VARCHAR(100) NOT NULL, -- 'SUBMITTED', 'START_REVIEW', 'RETURNED_FOR_CORRECTION', 'COMPLIANCE_ACCEPTED', 'REPORT_APPROVED', 'REPORT_REJECTED', 'ESCALATED'
        decision_notes TEXT,
        previous_status VARCHAR(50),
        new_status VARCHAR(50),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_compliance_reviews_case ON compliance_reviews(case_id);
      CREATE INDEX IF NOT EXISTS idx_compliance_reviews_reviewer ON compliance_reviews(reviewer_id);
    `);

    console.log('✓ Compliance platform migration applied successfully.');
  } catch (err) {
    console.error('Compliance migration error:', err);
    throw err;
  }
};

if (require.main === module) {
  runComplianceMigrations()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { runComplianceMigrations };

