const mongoose = require('mongoose');

const HRDecisionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  cycle: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Cycle',
    required: true
  },
  individualScore: {
    type: Number,
    default: 0
  },
  teamScore: {
    type: Number,
    default: 0
  },
  finalScore: {
    type: Number,
    required: true
  },
  action: {
    type: String,
    enum: ['reward', 'promotion', 'bonus', 'satisfactory', 'coaching', 'training', 'position_change', 'termination_review'],
    required: true
  },
  actionLabel: {
    type: String,
    default: ''
  },
  decidedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  decidedAt: {
    type: Date,
    default: Date.now
  },
  notes: {
    type: String,
    default: ''
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

HRDecisionSchema.index({ user: 1, cycle: 1 }, { unique: true });

module.exports = mongoose.model('HRDecision', HRDecisionSchema);