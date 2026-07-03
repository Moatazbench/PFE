const mongoose = require('mongoose');

const AuditLogSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  action: { type: String, required: true }, // e.g. 'checkin.submitted', 'evaluation.approved'
  entityType: { type: String, default: '', index: true },
  entity_type: { type: String, default: '' },
  entityId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
  entity_id: { type: mongoose.Schema.Types.ObjectId, default: null },
  entityName: { type: String, default: '' },
  userName: { type: String, default: '' },
  userRole: { type: String, default: '' },
  description: { type: String, default: '' },
  changes: {
    before: { type: mongoose.Schema.Types.Mixed, default: null },
    after: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  metadata: { type: mongoose.Schema.Types.Mixed, default: null },
  ipAddress: { type: String, default: '' },
  timestamp: { type: Date, default: Date.now, index: true },
}, { timestamps: true });

AuditLogSchema.index({ timestamp: -1 });

module.exports = mongoose.model('AuditLog', AuditLogSchema);
