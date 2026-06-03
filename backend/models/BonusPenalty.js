const mongoose = require('mongoose');

const BonusPenaltySchema = new mongoose.Schema({
  employee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['bonus', 'penalty'], required: true },
  value: { type: Number, required: true },
  reason: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

BonusPenaltySchema.index({ employee: 1, createdAt: -1 });

module.exports = mongoose.model('BonusPenalty', BonusPenaltySchema);
