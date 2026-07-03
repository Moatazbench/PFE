// middleware/audit.js - Audit logging middleware
const AuditLog = require('../models/AuditLog');

module.exports = function audit(action, resourceType) {
    return async function (req, res, next) {
        // Store original json method to capture response
        const originalJson = res.json.bind(res);

        res.json = function (data) {
            // Log audit after response is sent
            try {
                AuditLog.create({
                    user: req.user ? req.user.id : null,
                    action: action,
                    entityType: resourceType,
                    entityId: req.params.id || (data && data._id) || null,
                    metadata: {
                        method: req.method,
                        path: req.originalUrl,
                        statusCode: res.statusCode
                    }
                }).catch(function (err) {
                    console.error('Audit log error:', err.message);
                });
            } catch (err) {
                console.error('Audit log error:', err.message);
            }

            return originalJson(data);
        };

        next();
    };
};
