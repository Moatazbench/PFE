const mongoose = require('mongoose');

const ActionItemSchema = new mongoose.Schema({
  description: { type: String, required: true },
  deadline:    { type: Date, default: null },
  completed:   { type: Boolean, default: false },
}, { _id: true });

const GoalReviewSchema = new mongoose.Schema({
  goalId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Goal',
    required: true,
    index: true,
  },
  cycleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Cycle',
    required: true,
    index: true,
  },
  phase: {
    type: String,
    enum: ['midyear', 'endyear'],
    required: true,
  },
  reviewerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  reviewType: {
    type: String,
    enum: ['self_assessment', 'manager_assessment'],
    required: true,
  },
  comment: {
    type: String,
    default: '',
  },
  rating: {
    type: Number,
    min: 1,
    max: 5,
    default: null,
  },
  progressPercentage: {
    type: Number,
    min: 0,
    max: 100,
    default: null,
  },
  status: {
    type: String,
    enum: ['not_started', 'in_progress', 'on_track', 'at_risk', 'delayed', 'completed_early'],
    default: 'not_started',
  },
  blockers: {
    type: String,
    default: '',
  },
  correctiveActions: {
    type: String,
    default: '',
  },
  supportRequired: {
    type: String,
    default: '',
  },
  confidenceLevel: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium',
  },
  meetingNotes: {
    type: String,
    default: '',
  },
  actionItems: [ActionItemSchema],
  decision: {
    type: String,
    default: '',
  },
}, { timestamps: true });

// Enforce one review per type per phase per goal
GoalReviewSchema.index(
  { goalId: 1, phase: 1, reviewType: 1 },
  { unique: true }
);
GoalReviewSchema.index({ cycleId: 1, reviewerId: 1 });

module.exports = mongoose.model('GoalReview', GoalReviewSchema);
