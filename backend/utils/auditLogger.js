const AuditLog = require('../models/AuditLog');

const log = async (userId, action, entityType, entityId, metadata = {}) => {
  try {
    if (!userId) return; // Silent skip
    await AuditLog.create({
      user: userId,
      action,
      entityType,
      entityId,
      entityName: metadata.entityName || metadata.name || '',
      description: metadata.description || '',
      metadata,
    });
  } catch (e) { 
    console.error('Audit log failed:', e.message); 
  } // never crash main flow
};

module.exports = { log };
