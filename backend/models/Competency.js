const mongoose = require('mongoose');

const CompetencySchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  category: {
    type: String,
    enum: ['technical', 'leadership', 'communication', 'problem_solving', 'teamwork', 'domain', 'management', 'other'],
    default: 'other'
  },
  level: {
    type: String,
    enum: ['beginner', 'intermediate', 'advanced', 'expert'],
    default: 'beginner'
  },
  skills: [{ type: String, trim: true }],
  roles: [{ type: String, trim: true }],
  isActive: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

CompetencySchema.index({ category: 1, isActive: 1 });
CompetencySchema.index({ name: 1 }, { unique: true });

module.exports = mongoose.model('Competency', CompetencySchema);
