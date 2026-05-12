const mongoose = require('mongoose');

const CareerRecommendationSchema = new mongoose.Schema({
  employee_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  cycle_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Cycle', required: true },
  suggested_path: { type: String, required: true },
  skills_to_develop: [{ type: String }],
  source: { type: String, enum: ['manager', 'auto'], default: 'manager' },
  basis: { type: String, default: '' }
}, { timestamps: true });

CareerRecommendationSchema.index({ employee_id: 1, cycle_id: 1 });

module.exports = mongoose.model('CareerRecommendation', CareerRecommendationSchema);
