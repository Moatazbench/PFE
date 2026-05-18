const mongoose = require('mongoose');

const improvementPlanSchema = new mongoose.Schema({
  evaluation_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FinalEvaluation',
    required: true
  },
  employee_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  cycle_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Cycle',
    required: true
  },
  objective_goal: {
    type: String,
    required: true,
    trim: true
  },
  deadline: {
    type: Date,
    required: true
  },
  expected_outcome: {
    type: String,
    required: true,
    trim: true
  },
  notes: {
    type: String,
    default: '',
    trim: true
  },
  progress_status: {
    type: String,
    enum: ['not_started', 'in_progress', 'completed'],
    default: 'not_started'
  },
  created_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updated_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  }
}, { timestamps: true });

improvementPlanSchema.index({ evaluation_id: 1, deadline: 1 });
improvementPlanSchema.index({ employee_id: 1, progress_status: 1 });

module.exports = mongoose.model('ImprovementPlan', improvementPlanSchema);
