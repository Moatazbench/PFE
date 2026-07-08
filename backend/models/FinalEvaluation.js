const mongoose = require('mongoose');
const { ObjectId } = mongoose.Schema.Types;

const finalEvaluationSchema = new mongoose.Schema({
  employee_id: { type: ObjectId, ref: 'User', required: true },
  cycle_id: { type: ObjectId, ref: 'Cycle', required: true },
  // Scores
  auto_score: { type: Number }, // calculated by engine
  manager_score: { type: Number }, // manager override
  final_score: { type: Number }, // resolved final
  rating_label: { type: String, enum: ['exceptional','strong','meets_expectations','needs_improvement','unsatisfactory'] },
  score_difference: { type: Number, default: 0 },
  manager_adjustment_justification: { type: String, default: '' },
  objective_weight_total: { type: Number, default: 0 },
  objective_score_normalized: { type: Boolean, default: false },
  objective_breakdown: [{
    objective_id: { type: ObjectId, ref: 'Objective' },
    title: String,
    category: String,
    weight: Number,
    employee_achievement: Number,
    manager_confirmed_achievement: Number,
    achievement_used: Number,
    weighted_points: Number,
    status: String
  }],
  evidence_summary: {
    tasks: {
      total: { type: Number, default: 0 },
      completed: { type: Number, default: 0 },
      completion_rate: { type: Number, default: null }
    },
    checkins: {
      total: { type: Number, default: 0 },
      approved: { type: Number, default: 0 },
      approval_rate: { type: Number, default: null },
      average_progress: { type: Number, default: null }
    }
  },
  consistency_warnings: [String],
  ai_assisted: { type: Boolean, default: false },
  ai_draft_generated_at: { type: Date, default: null },
  ai_reviewed_by_manager: { type: Boolean, default: false },
  // Content
  strengths: [String],
  weaknesses: [String],
  improvement_suggestions: [String],
  manager_comments: String,
  recommendation: { type: String, enum: ['promotion','bonus_eligible','performance_improvement_plan','no_action','department_transfer'] },
  evaluator_id: { type: ObjectId, ref: 'User', default: null },
  evaluator_role: { type: String, enum: ['ADMIN', 'HR', 'TEAM_LEADER', 'COLLABORATOR'], default: null },
  evaluated_at: Date,
  // Workflow
  status: { type: String, enum: ['draft','pending_hr','validated','closed'], default: 'draft' },
  hr_validated_by: { type: ObjectId, ref: 'User' },
  hr_validated_at: Date,
  hr_review_notes: { type: String, default: '' },
  hr_return_reason: { type: String, default: '' },
  workflow_history: [{
    action: { type: String, enum: ['submitted', 'validated', 'sent_back'] },
    reason: { type: String, default: '' },
    performed_by: { type: ObjectId, ref: 'User' },
    performed_at: { type: Date, default: Date.now }
  }],
  performance_status: {
    type: String,
    enum: ['excellent_performance', 'satisfactory', 'needs_improvement', 'critical_attention', null],
    default: null
  },
  exported_at: Date,
  hr_decision: {
    action: { type: String, enum: ['promotion','bonus','pip','transfer','no_action'] },
    notes: String,
    decided_by: { type: ObjectId, ref: 'User' },
    decided_at: Date
  },
  employee_feedback: {
    acknowledged: { type: Boolean, default: false },
    comment: { type: String, default: '' },
    acknowledged_at: { type: Date, default: null },
    updated_at: { type: Date, default: null }
  }
}, { timestamps: true });

finalEvaluationSchema.index({ employee_id: 1, cycle_id: 1 }, { unique: true });

module.exports = mongoose.model('FinalEvaluation', finalEvaluationSchema);
