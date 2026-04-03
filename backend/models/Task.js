const mongoose = require('mongoose');

const TaskSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  assignee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: {
    type: String,
    enum: ['todo', 'in_progress', 'done', 'cancelled'],
    default: 'todo'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  labels: [{ type: String, trim: true }],
  dueDate: { type: Date, default: null },
  completedAt: { type: Date, default: null },
  recurring: {
    type: String,
    enum: ['none', 'daily', 'weekly', 'monthly'],
    default: 'none'
  },
  linkedGoal: { type: mongoose.Schema.Types.ObjectId, ref: 'Objective', default: null },
  linkedMeeting: { type: mongoose.Schema.Types.ObjectId, ref: 'Meeting', default: null },
  team: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', default: null },
  notes: { type: String, default: '' },
}, { timestamps: true });

TaskSchema.index({ assignee: 1, status: 1 });
TaskSchema.index({ assignedBy: 1, createdAt: -1 });
TaskSchema.index({ dueDate: 1, status: 1 });
TaskSchema.index({ linkedGoal: 1 });
TaskSchema.index({ linkedMeeting: 1 });
TaskSchema.index({ team: 1, status: 1 });

module.exports = mongoose.model('Task', TaskSchema);
