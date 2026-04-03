const AuditLog = require('../models/AuditLog');

/**
 * Create an audit log entry.
 * Non-blocking — errors are logged but never thrown.
 */
async function createAuditLog({ entityType, entityId, action, performedBy, oldValue, newValue, description, ipAddress, userName, userRole }) {
  try {
    await AuditLog.create({
      entityType,
      entityId: entityId || null,
      action,
      user: performedBy,
      userName: userName || '',
      userRole: userRole || '',
      description: description || '',
      changes: {
        before: oldValue || null,
        after: newValue || null,
      },
      ipAddress: ipAddress || '',
    });
  } catch (err) {
    console.error('Audit log creation failed (non-fatal):', err.message);
  }
}

module.exports = { createAuditLog };
