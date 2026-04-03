const mongoose = require('mongoose');

const RevisionHistorySchema = new mongoose.Schema({
  comment:        { type: String, default: '' },
  changedBy:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  changedAt:      { type: Date, default: Date.now },
  previousStatus: { type: String, default: '' },
  newStatus:      { type: String, default: '' },
}, { _id: true });

const GoalSchema = new mongoose.Schema({
  cycleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Cycle',
    required: true,
    index: true,
  },
  employeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  managerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
    index: true,
  },
  title: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    default: '',
  },
  category: {
    type: String,
    default: '',
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium',
  },
  weight: {
    type: Number,
    min: 0,
    max: 100,
    default: 0,
  },
  metric: {
    type: String,
    default: '',
  },
  targetValue: {
    type: mongoose.Schema.Types.Mixed, // String or Number
    default: '',
  },
  startDate: {
    type: Date,
    default: null,
  },
  dueDate: {
    type: Date,
    default: null,
  },
  currentProgress: {
    type: Number,
    min: 0,
    max: 100,
    default: 0,
  },
  finalCompletion: {
    type: Number,
    min: 0,
    max: 100,
    default: null,
  },
  status: {
    type: String,
    enum: [
      'draft',
      'submitted',
      'under_review',
      'needs_revision',
      'approved',
      'rejected',
      'midyear_assessed',
      'final_evaluated',
      'locked',
    ],
    default: 'draft',
    index: true,
  },
  employeeComments: {
    type: String,
    default: '',
  },
  managerComments: {
    type: String,
    default: '',
  },
  revisionHistory: [RevisionHistorySchema],
}, { timestamps: true });

// Compound indexes for common queries
GoalSchema.index({ cycleId: 1, employeeId: 1 });
GoalSchema.index({ cycleId: 1, managerId: 1 });
GoalSchema.index({ cycleId: 1, status: 1 });

module.exports = mongoose.model('Goal', GoalSchema);
