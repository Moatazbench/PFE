const mongoose = require('mongoose');

const calendarConnectionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  provider: { type: String, enum: ['google', 'outlook'], required: true },
  email: { type: String, default: '' },
  accessToken: { type: String, default: '', select: false },
  refreshToken: { type: String, default: '', select: false },
  expiresAt: { type: Date, default: null },
  scope: { type: String, default: '' },
  metadata: { type: Object, default: {} },
  lastSyncAt: { type: Date, default: null },
}, { timestamps: true });

calendarConnectionSchema.index({ user: 1, provider: 1 }, { unique: true });

module.exports = mongoose.model('CalendarConnection', calendarConnectionSchema);
