const mongoose = require('mongoose');

const CorrectionRequestSchema = new mongoose.Schema({
  objectiveId: { type: mongoose.Schema.Types.ObjectId, ref: 'Objective', required: true, index: true },
  field: { type: String, enum: ['description', 'successIndicator'], required: true },
  oldValue: { type: String, default: '' },
  newValue: { type: String, required: true },
  correctionReason: { type: String, required: true },
  requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED'], default: 'PENDING', index: true },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  reviewedAt: { type: Date, default: null },
  resolutionNote: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

CorrectionRequestSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('CorrectionRequest', CorrectionRequestSchema);
