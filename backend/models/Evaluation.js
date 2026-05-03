const mongoose = require('mongoose');

// Score change history for audit trail
const ScoreHistorySchema = new mongoose.Schema({
  previousScore: { type: Number, default: null },
  newScore:      { type: Number, default: null },
  changedBy:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  changedAt:     { type: Date, default: Date.now },
  reason:        { type: String, default: '' },
}, { _id: true });

// Objective references kept inside the evaluation.
const ObjectiveAssessmentSchema = new mongoose.Schema({
  objectiveId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Objective',
    required: true,
  },
}, { _id: true });

// Approval entry
const ApprovalSchema = new mongoose.Schema({
  approverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
  },
  comments: {
    type: String,
    default: '',
  },
  date: {
    type: Date,
    default: null,
  },
}, { _id: true });

const EvaluationSchema = new mongoose.Schema({
  // Core relationships
  employeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  evaluatorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  cycleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Cycle',
    required: true,
    index: true,
  },

  // Descriptors
  period: {
    type: String,
    default: '', // e.g., "Q4 2024", "End-Year 2025"
  },

  // Status workflow: draft → in_progress → submitted → approved/rejected → completed
  status: {
    type: String,
    enum: ['draft', 'in_progress', 'submitted', 'approved', 'rejected', 'completed'],
    default: 'draft',
    index: true,
  },

  // Objective scope for this evaluation
  objectiveAssessments: [ObjectiveAssessmentSchema],

  // Scoring
  scoringMethod: {
    type: String,
    enum: ['objective_weighted_sum', 'simple_average', 'weighted_average'],
    default: 'objective_weighted_sum',
  },
  suggestedScore: {
    type: Number,
    min: 0,
    max: 100,
    default: null,
  },
  finalScore: {
    type: Number,
    min: 0,
    max: 100,
    default: null,
  },
  scoreHistory: [ScoreHistorySchema],

  // Feedback sections
  overallComments: {
    type: String,
    default: '',
  },
  strengths: {
    type: String,
    default: '',
  },
  areasForImprovement: {
    type: String,
    default: '',
  },
  developmentRecommendations: {
    type: String,
    default: '',
  },
  nextSteps: {
    type: String,
    default: '',
  },

  // Approval workflow
  approvals: [ApprovalSchema],

  // Employee acknowledgment
  employeeAcknowledgment: {
    acknowledged: { type: Boolean, default: false },
    date: { type: Date, default: null },
  },

  // Timestamps
  submittedAt: { type: Date, default: null },
  completedAt: { type: Date, default: null },
}, { timestamps: true });

// Compound indexes
EvaluationSchema.index({ employeeId: 1, cycleId: 1 });
EvaluationSchema.index({ evaluatorId: 1, cycleId: 1 });
EvaluationSchema.index({ cycleId: 1, status: 1 });
EvaluationSchema.index({ 'objectiveAssessments.objectiveId': 1 });

module.exports = mongoose.model('Evaluation', EvaluationSchema);
