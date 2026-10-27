const db = require('../config/db');

const initDatabase = async () => {
  const queryText = `
    -- Users Table (Phase 1)
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      first_name VARCHAR(100) NOT NULL,
      last_name VARCHAR(100) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(50) NOT NULL CHECK (role IN ('investigator', 'admin', 'compliance_officer')),
      status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'inactive')),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

    -- Phase 2 Tables: Data Management
    CREATE TABLE IF NOT EXISTS customers (
      id SERIAL PRIMARY KEY,
      first_name VARCHAR(100) NOT NULL,
      last_name VARCHAR(100) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      phone VARCHAR(50),
      address TEXT,
      nationality VARCHAR(100),
      status VARCHAR(50) DEFAULT 'active',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS accounts (
      id SERIAL PRIMARY KEY,
      account_number VARCHAR(100) UNIQUE NOT NULL,
      customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
      account_type VARCHAR(50) DEFAULT 'checking',
      currency VARCHAR(10) DEFAULT 'USD',
      status VARCHAR(50) DEFAULT 'active',
      open_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id SERIAL PRIMARY KEY,
      from_account_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
      to_account_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
      amount NUMERIC(15, 2) NOT NULL,
      currency VARCHAR(10) DEFAULT 'USD',
      transaction_type VARCHAR(50) DEFAULT 'transfer',
      transaction_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      channel VARCHAR(50) DEFAULT 'online',
      description TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_transactions_from_acc ON transactions(from_account_id);
    CREATE INDEX IF NOT EXISTS idx_transactions_to_acc ON transactions(to_account_id);
    CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(transaction_date);

    -- Phase 3 Tables: Detection Rules & Risk Scoring
    CREATE TABLE IF NOT EXISTS detection_rules (
      id SERIAL PRIMARY KEY,
      rule_name VARCHAR(150) NOT NULL,
      condition_type VARCHAR(100) NOT NULL,
      threshold_value NUMERIC(15, 2) NOT NULL,
      risk_level VARCHAR(50) NOT NULL CHECK (risk_level IN ('low', 'medium', 'high')),
      status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'inactive'))
    );

    CREATE TABLE IF NOT EXISTS suspicious_flags (
      id SERIAL PRIMARY KEY,
      transaction_id INTEGER REFERENCES transactions(id) ON DELETE CASCADE,
      rule_id INTEGER REFERENCES detection_rules(id) ON DELETE CASCADE,
      flagged_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS risk_scores (
      id SERIAL PRIMARY KEY,
      entity_type VARCHAR(50) NOT NULL CHECK (entity_type IN ('transaction', 'account', 'customer')),
      entity_id INTEGER NOT NULL,
      score NUMERIC(5, 2) NOT NULL,
      risk_level VARCHAR(50) NOT NULL CHECK (risk_level IN ('Low', 'Medium', 'High')),
      calculated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS risk_factors (
      id SERIAL PRIMARY KEY,
      risk_score_id INTEGER REFERENCES risk_scores(id) ON DELETE CASCADE,
      factor_name VARCHAR(150) NOT NULL,
      contribution NUMERIC(5, 2) NOT NULL,
      description TEXT
    );

    -- Phase 4 Tables: Alerts System
    CREATE TABLE IF NOT EXISTS alerts (
      id SERIAL PRIMARY KEY,
      transaction_id INTEGER REFERENCES transactions(id) ON DELETE CASCADE,
      rule_id INTEGER REFERENCES detection_rules(id) ON DELETE SET NULL,
      alert_type VARCHAR(100) NOT NULL,
      severity VARCHAR(50) NOT NULL CHECK (severity IN ('low', 'medium', 'high')),
      description TEXT,
      status VARCHAR(50) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'acknowledged', 'closed')),
      assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(status);
    CREATE INDEX IF NOT EXISTS idx_alerts_severity ON alerts(severity);

    -- Phase 5 Tables: Network Graph
    CREATE TABLE IF NOT EXISTS entity_relationships (
      id SERIAL PRIMARY KEY,
      entity_type_1 VARCHAR(50) NOT NULL,
      entity_id_1 INTEGER NOT NULL,
      entity_type_2 VARCHAR(50) NOT NULL,
      entity_id_2 INTEGER NOT NULL,
      relationship_type VARCHAR(50) NOT NULL,
      transaction_count INTEGER DEFAULT 1,
      total_amount NUMERIC(15, 2) DEFAULT 0,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_entity_rel_1 ON entity_relationships(entity_type_1, entity_id_1);
    CREATE INDEX IF NOT EXISTS idx_entity_rel_2 ON entity_relationships(entity_type_2, entity_id_2);

    -- Phase 6 Tables: Case Management
    CREATE TABLE IF NOT EXISTS cases (
      id SERIAL PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      status VARCHAR(50) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'closed', 'escalated')),
      priority VARCHAR(50) NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
      alert_id INTEGER REFERENCES alerts(id) ON DELETE SET NULL,
      assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      closed_at TIMESTAMP WITH TIME ZONE
    );

    CREATE TABLE IF NOT EXISTS case_notes (
      id SERIAL PRIMARY KEY,
      case_id INTEGER REFERENCES cases(id) ON DELETE CASCADE,
      note_text TEXT NOT NULL,
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS case_history (
      id SERIAL PRIMARY KEY,
      case_id INTEGER REFERENCES cases(id) ON DELETE CASCADE,
      action VARCHAR(255) NOT NULL,
      changed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      changed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    -- Phase 7 Reports Table
    CREATE TABLE IF NOT EXISTS reports (
      id SERIAL PRIMARY KEY,
      case_id INTEGER REFERENCES cases(id) ON DELETE SET NULL,
      title VARCHAR(255) NOT NULL,
      report_data JSONB NOT NULL,
      generated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    -- Phase 8 Tables: Audit Logs
    CREATE TABLE IF NOT EXISTS audit_logs (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      action VARCHAR(100) NOT NULL,
      entity_type VARCHAR(100),
      entity_id INTEGER,
      ip_address VARCHAR(50),
      timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      details JSONB
    );

    CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);
  `;

  try {
    await db.query(queryText);
    console.log('✓ All FCIP PostgreSQL tables initialized successfully (Phases 1 - 8).');
  } catch (error) {
    console.error('Failed to initialize database tables:', error);
    throw error;
  }
};

module.exports = { initDatabase };
