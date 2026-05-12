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
  exported_at: Date,
  hr_decision: {
    action: { type: String, enum: ['promotion','bonus','pip','transfer','no_action'] },
    notes: String,
    decided_by: { type: ObjectId, ref: 'User' },
    decided_at: Date
  }
}, { timestamps: true });

finalEvaluationSchema.index({ employee_id: 1, cycle_id: 1 }, { unique: true });

module.exports = mongoose.model('FinalEvaluation', finalEvaluationSchema);
