
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const ROLES = ['ADMIN', 'HR', 'TEAM_LEADER', 'COLLABORATOR'];

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    validate: {
      validator: v => /^([\w.-]+)@biat\.com$/.test(v),
      message: 'Email must end with @biat.com'
    }
  },
  password: { type: String, required: true, select: false },
  role: {
    type: String,
    enum: ROLES,
    required: true,
    default: 'COLLABORATOR',
    index: true
  },
  team: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', default: null },
  manager: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  isActive: { type: Boolean, default: true },
  tenantId: { type: String, default: 'default', index: true },
  refreshToken: { type: String, select: false },
  isDeleted: { type: Boolean, default: false, index: true },
  profileImage: { type: String, default: '' },
}, { timestamps: true });

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

userSchema.methods.comparePassword = async function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

module.exports = mongoose.model('User', userSchema);