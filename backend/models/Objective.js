
const mongoose = require('mongoose');

const KpiSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  metricType: { type: String, enum: ['percent', 'number', 'currency', 'boolean', 'milestone'], default: 'percent' },
  initialValue: { type: Number, default: 0 },
  targetValue: { type: Number, default: 100 },
  currentValue: { type: Number, default: 0 },
  unit: { type: String, default: '' },
  status: { type: String, enum: ['not_started', 'in_progress', 'completed'], default: 'not_started' },
}, { _id: true, timestamps: true });

const ProgressUpdateSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  message: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

const CommentSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  text: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

const AttachmentSchema = new mongoose.Schema({
  filename: { type: String, required: true },
  originalName: { type: String, required: true },
  size: { type: Number, default: 0 },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  uploadedAt: { type: Date, default: Date.now },
});

// Change Request Schema for active goals
const ChangeRequestSchema = new mongoose.Schema({
  requestType: {
    type: String,
    enum: ['due_date_extension', 'scope_change', 'pause', 'cancellation'],
    required: true,
  },
  requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  reason: { type: String, required: true },
  // For due date extension
  newDeadline: { type: Date, default: null },
  // For scope change
  newDescription: { type: String, default: '' },
  newTitle: { type: String, default: '' },
  // Resolution
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'modified'],
    default: 'pending',
  },
  resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  resolvedAt: { type: Date, default: null },
  resolutionNote: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
}, { _id: true, timestamps: true });

// Activity log for tracking all events on the goal
const ActivityLogSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  action: { type: String, required: true }, // e.g. 'created', 'submitted', 'approved', 'rejected', etc.
  details: { type: String, default: '' },
  fromStatus: { type: String, default: '' },
  toStatus: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
});

const ObjectiveSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  successIndicator: { type: String, required: true, trim: true },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  cycle: { type: mongoose.Schema.Types.ObjectId, ref: 'Cycle', required: true, index: true },
  category: { type: String, enum: ['individual', 'team'], default: 'individual' },
  assignedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  weight: { type: Number, required: true, min: 1, max: 100 },
  achievementPercent: { type: Number, min: 0, max: 100, default: null },
  selfAssessment: { type: String, default: '' },
  finalSelfAssessment: { type: String, default: '' },
  finalSelfRating: { type: Number, min: 1, max: 5, default: null },
  finalSelfPercent: { type: Number, min: 0, max: 100, default: null },
  finalSelfSubmittedAt: { type: Date, default: null },
  managerAdjustedPercent: { type: Number, min: 0, max: 100, default: null },
  managerComments: { type: String, default: '' },
  weightedScore: { type: Number, default: null },

  // === WORKFLOW STATUS (approval lifecycle) ===
  status: {
    type: String,
    enum: [
      'draft',              // employee is drafting
      'pending',            // employee submitted to team leader, awaiting review
      'submitted',          // employee submitted for approval (legacy, maps to pending_approval)
      'pending_approval',   // awaiting manager approval
      'revision_requested', // manager requested revision
      'rejected',           // manager rejected
      'assigned',           // manager assigned to employee, pending acknowledgment
      'acknowledged',       // employee acknowledged manager-assigned goal
      'approved',           // manager approved - goal is active
      'validated',          // legacy: manager validated (kept for backward compat)
      'locked',             // locked - no edits
      'cancelled',          // cancelled
      'evaluated',          // completion evaluated by manager
      'archived',           // archived
    ],
    default: 'draft',
    index: true,
  },

  // === GOAL SOURCE ===
  source: {
    type: String,
    enum: ['employee_created', 'manager_assigned'],
    default: 'employee_created',
  },
  assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

  // === SUBMISSION TRACKING ===
  submittedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

  // === REJECTION / REVISION DETAILS ===
  rejectionReason: { type: String, default: '' },
  revisionReason: { type: String, default: '' },

  // === EVALUATION ===
  evaluationRating: {
    type: String,
    enum: ['exceeded', 'met', 'partially_met', 'not_met', ''],
    default: '',
  },
  evaluationComment: { type: String, default: '' },
  evaluationNumericRating: { type: Number, min: 1, max: 5, default: null },
  evaluationEvidence: { type: String, default: '' },
  evaluatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  evaluatedAt: { type: Date, default: null },

  validatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  validatedAt: { type: Date, default: null },

  labels: [{ type: String, trim: true }],
  visibility: {
    type: String,
    enum: ['private', 'team', 'department', 'public'],
    default: 'public',
  },
  parentObjective: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Objective',
    default: null,
    index: true,
  },
  kpis: [KpiSchema],
  progressUpdates: [ProgressUpdateSchema],
  comments: [CommentSchema],
  attachments: [AttachmentSchema],
  changeRequests: [ChangeRequestSchema],
  activityLog: [ActivityLogSchema],
}, { timestamps: true });

ObjectiveSchema.index({ owner: 1, cycle: 1, title: 1 }, { unique: true });
ObjectiveSchema.index({ owner: 1, status: 1 });

ObjectiveSchema.index({ owner: 1, cycle: 1 });
ObjectiveSchema.index({ status: 1 });
ObjectiveSchema.index({ category: 1 });
ObjectiveSchema.index({ source: 1 });

ObjectiveSchema.pre('save', function syncWeightedScore(next) {
  if (this.achievementPercent == null || !Number.isFinite(this.weight)) {
    this.weightedScore = null;
    return next();
  }

  const normalizedAchievement = Math.max(0, Math.min(100, Number(this.achievementPercent)));
  this.achievementPercent = normalizedAchievement;
  this.weightedScore = Number(((Number(this.weight) * normalizedAchievement) / 100).toFixed(2));
  next();
});

module.exports = mongoose.model('Objective', ObjectiveSchema);
