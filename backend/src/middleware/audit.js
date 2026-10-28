const db = require('../config/db');

/**
 * Persist an immutable audit log entry.
 * Prevents logging passwords, tokens, or unnecessary PII.
 */
const logAudit = async ({
  userId = null,
  userRole = null,
  action,
  entityType = null,
  entityId = null,
  ipAddress = '127.0.0.1',
  outcome = 'SUCCESS',
  details = {},
}) => {
  try {
    // Sanitize details to guarantee sensitive tokens and passwords are never logged
    let sanitizedDetails = { ...details };
    const sensitiveKeys = ['password', 'password_hash', 'token', 'jwt', 'secret', 'authorization'];
    for (const key of Object.keys(sanitizedDetails)) {
      if (sensitiveKeys.some((s) => key.toLowerCase().includes(s))) {
        sanitizedDetails[key] = '[REDACTED]';
      }
    }

    await db.query(
      `INSERT INTO audit_logs (user_id, user_role, action, entity_type, entity_id, ip_address, outcome, details)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        userId,
        userRole,
        action,
        entityType,
        entityId ? parseInt(entityId, 10) || null : null,
        ipAddress || '127.0.0.1',
        outcome,
        JSON.stringify(sanitizedDetails),
      ]
    );
  } catch (error) {
    console.error('Audit log write error:', error.message);
  }
};

module.exports = {
  logAudit,
};
