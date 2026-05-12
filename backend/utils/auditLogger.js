const AuditLog = require('../models/AuditLog');

const log = async (userId, action, entityType, entityId, metadata = {}) => {
  try {
    if (!userId) return; // Silent skip
    await AuditLog.create({ 
      user_id: userId, 
      action, 
      entity_type: entityType, 
      entity_id: entityId, 
      metadata 
    });
  } catch (e) { 
    console.error('Audit log failed:', e.message); 
  } // never crash main flow
};

module.exports = { log };
