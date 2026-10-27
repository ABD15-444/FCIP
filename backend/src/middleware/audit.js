const db = require('../config/db');

const logAudit = async (userId, action, entityType, entityId, ipAddress, details) => {
  try {
    await db.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, ip_address, details)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        userId || null,
        action,
        entityType || null,
        entityId || null,
        ipAddress || '127.0.0.1',
        typeof details === 'object' ? JSON.stringify(details) : JSON.stringify({ message: details }),
      ]
    );
  } catch (error) {
    console.error('Audit log write error:', error.message);
  }
};

const auditMiddleware = (action, entityType = null) => {
  return async (req, res, next) => {
    const originalJson = res.json.bind(res);
    res.json = function (body) {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const userId = req.user ? req.user.id : null;
        const entityId = req.params?.id || body?.id || body?.data?.id || null;
        const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '127.0.0.1';
        logAudit(userId, action, entityType, entityId ? parseInt(entityId, 10) || null : null, ip, {
          route: req.originalUrl,
          method: req.method,
          params: req.params,
        });
      }
      return originalJson(body);
    };
    next();
  };
};

module.exports = {
  logAudit,
  auditMiddleware,
};
