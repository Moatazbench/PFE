const mongoose = require('mongoose');

const AuditLogSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  action: { type: String, required: true }, // e.g. 'checkin.submitted', 'evaluation.approved'
  entity_type: { type: String }, // 'CheckIn', 'FinalEvaluation', 'Cycle', 'HRDecision'
  entity_id: { type: mongoose.Schema.Types.ObjectId },
  metadata: { type: mongoose.Schema.Types.Mixed },
  timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('AuditLog', AuditLogSchema);