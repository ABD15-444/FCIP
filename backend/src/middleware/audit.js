const db = require('../config/db');

/**
 * Persist an immutable audit log entry.
 * Prevents logging passwords, tokens, or unnecessary PII.
 * Supports both named object signature logAudit({ ... }) and legacy positional args logAudit(userId, action, ...)
 */
const logAudit = async (
  arg1,
  arg2,
  arg3,
  arg4,
  arg5,
  arg6
) => {
  try {
    let userId = null;
    let userRole = null;
    let action = null;
    let entityType = null;
    let entityId = null;
    let ipAddress = '127.0.0.1';
    let outcome = 'SUCCESS';
    let details = {};

    if (arg1 && typeof arg1 === 'object') {
      userId = arg1.userId || null;
      userRole = arg1.userRole || null;
      action = arg1.action || 'UNKNOWN_ACTION';
      entityType = arg1.entityType || null;
      entityId = arg1.entityId || null;
      ipAddress = arg1.ipAddress || '127.0.0.1';
      outcome = arg1.outcome || 'SUCCESS';
      details = arg1.details || {};
    } else {
      // Positional: (userId, action, entityType, entityId, ipAddress, details)
      userId = arg1 || null;
      action = arg2 || 'UNKNOWN_ACTION';
      entityType = arg3 || null;
      entityId = arg4 || null;
      ipAddress = arg5 || '127.0.0.1';
      details = arg6 || {};
    }

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
