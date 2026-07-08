const mongoose = require('mongoose');

const BonusPenaltySchema = new mongoose.Schema({
  employee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['bonus', 'penalty'], required: true },
  value: { type: Number, required: true, min: 0.01 },
  reason: { type: String, required: true },
  finalEvaluation: { type: mongoose.Schema.Types.ObjectId, ref: 'FinalEvaluation', required: true },
  hrDecision: { type: mongoose.Schema.Types.ObjectId, ref: 'HRDecision', default: null },
  objective: { type: mongoose.Schema.Types.ObjectId, ref: 'Objective', default: null },
  approvalStatus: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'approved' },
  reviewNotes: { type: String, default: '' },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  reviewedAt: { type: Date, default: null },
  paymentDate: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now }
});

BonusPenaltySchema.index({ employee: 1, createdAt: -1 });
BonusPenaltySchema.index({ finalEvaluation: 1 });

module.exports = mongoose.model('BonusPenalty', BonusPenaltySchema);
