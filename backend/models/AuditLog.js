const mongoose = require('mongoose');

const AuditLogSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  userName: {
    type: String,
    default: ''
  },
  userRole: {
    type: String,
    default: ''
  },
  action: {
    type: String,
    enum: ['create', 'update', 'delete', 'submit', 'validate', 'reject', 'checkin', 'login', 'export', 'submitted', 'approved', 'rejected', 'revision_requested', 'midyear_assessed', 'final_evaluated', 'locked', 'unlocked', 'phase_changed', 'review_created', 'review_updated'],
    required: true
  },
  entityType: {
    type: String,
    enum: ['objective', 'key_result', 'checkin', 'cycle', 'team', 'user', 'hr_decision', 'notification', 'evaluation', 'goal', 'review', 'goal_review'],
    required: true
  },
  entityId: {
    type: mongoose.Schema.Types.ObjectId,
    default: null
  },
  description: {
    type: String,
    required: true
  },
  changes: {
    before: { type: mongoose.Schema.Types.Mixed, default: null },
    after: { type: mongoose.Schema.Types.Mixed, default: null }
  },
  ipAddress: {
    type: String,
    default: ''
  },
  userAgent: {
    type: String,
    default: ''
  },
  tenantId: {
    type: String,
    default: 'default',
    index: true
  }
}, {
  timestamps: true
});

AuditLogSchema.index({ createdAt: -1 });
AuditLogSchema.index({ user: 1, createdAt: -1 });
AuditLogSchema.index({ entityType: 1, entityId: 1 });
AuditLogSchema.index({ action: 1, createdAt: -1 });
AuditLogSchema.index({ tenantId: 1, createdAt: -1 });
AuditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 365 * 24 * 60 * 60 });

module.exports = mongoose.model('AuditLog', AuditLogSchema);