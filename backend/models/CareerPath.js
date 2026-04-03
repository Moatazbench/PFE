const mongoose = require('mongoose');

const DevelopmentActionSchema = new mongoose.Schema({
  title: { type: String, required: true },
  type: { type: String, enum: ['training', 'mentoring', 'project', 'certification', 'reading', 'other'], default: 'other' },
  status: { type: String, enum: ['planned', 'in_progress', 'completed'], default: 'planned' },
  dueDate: { type: Date, default: null },
  completedAt: { type: Date, default: null },
  notes: { type: String, default: '' },
});

const CareerPathSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  currentRole: { type: String, required: true, trim: true },
  currentLevel: { type: String, default: '' },
  targetRole: { type: String, default: '', trim: true },
  targetLevel: { type: String, default: '' },
  targetDate: { type: Date, default: null },
  competencies: [{
    competency: { type: mongoose.Schema.Types.ObjectId, ref: 'Competency' },
    currentLevel: { type: String, enum: ['beginner', 'intermediate', 'advanced', 'expert'], default: 'beginner' },
    targetLevel: { type: String, enum: ['beginner', 'intermediate', 'advanced', 'expert'], default: 'advanced' },
    gap: { type: Number, default: 0 },
  }],
  developmentPlan: [DevelopmentActionSchema],
  mentorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  status: {
    type: String,
    enum: ['active', 'completed', 'paused'],
    default: 'active'
  },
  notes: { type: String, default: '' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

CareerPathSchema.index({ user: 1, status: 1 });

module.exports = mongoose.model('CareerPath', CareerPathSchema);
