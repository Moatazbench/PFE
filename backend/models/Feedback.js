const mongoose = require('mongoose');

const FeedbackSchema = new mongoose.Schema({
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: {
    type: String,
    enum: ['praise', 'suggestion', 'concern', '360', 'peer', 'manager', 'self'],
    default: 'praise'
  },
  message: { type: String, required: true, trim: true },
  anonymous: { type: Boolean, default: false },
  visibility: {
    type: String,
    enum: ['public', 'private', 'manager_only'],
    default: 'private'
  },
  relatedMeeting: { type: mongoose.Schema.Types.ObjectId, ref: 'Meeting', default: null },
  relatedReview: { type: mongoose.Schema.Types.ObjectId, ref: 'Review', default: null },
  relatedObjective: { type: mongoose.Schema.Types.ObjectId, ref: 'Objective', default: null },
  rating: { type: Number, min: 1, max: 5, default: null },
  tags: [{ type: String, trim: true }],
  status: {
    type: String,
    enum: ['active', 'archived', 'flagged'],
    default: 'active'
  },
  requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  isRequested: { type: Boolean, default: false },
}, { timestamps: true });

FeedbackSchema.index({ recipient: 1, createdAt: -1 });
FeedbackSchema.index({ sender: 1, createdAt: -1 });
FeedbackSchema.index({ type: 1 });
FeedbackSchema.index({ visibility: 1 });

module.exports = mongoose.model('Feedback', FeedbackSchema);
