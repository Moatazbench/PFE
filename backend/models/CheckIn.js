const mongoose = require('mongoose');
const { ObjectId } = mongoose.Schema.Types;

const checkInSchema = new mongoose.Schema({
  objective_id: { type: ObjectId, ref: 'Objective', required: true },
  employee_id: { type: ObjectId, ref: 'User', required: true },
  cycle_id: { type: ObjectId, ref: 'Cycle', required: true },
  // Workflow
  status: { type: String, enum: ['draft','pending_review','revision_requested','approved'], default: 'draft' },
  manager_feedback: { type: String },
  manager_id: { type: ObjectId, ref: 'User' },
  reviewedBy: { type: ObjectId, ref: 'User' },
  reviewedAt: { type: Date },
  // Content
  progress_percent: { type: Number, min: 0, max: 100 },
  notes: { type: String },
  priority: { type: String, enum: ['low','medium','high'], default: 'medium' },
  attachments: [{
    name: { type: String },
    url: { type: String },
    type: { type: String, default: 'file' },
    size: { type: Number },
    mimetype: { type: String }
  }],
  // History
  history: [{ 
    submitted_at: Date, 
    content: String, 
    status: String,
    manager_feedback: String 
  }],
  submitted_at: Date,
  last_edited_at: Date
}, { timestamps: true });

// Optional: index for faster lookups
checkInSchema.index({ objective_id: 1 });
checkInSchema.index({ employee_id: 1, cycle_id: 1 });

module.exports = mongoose.model('CheckIn', checkInSchema);
