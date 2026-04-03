const Competency = require('../models/Competency');
const CareerPath = require('../models/CareerPath');

// === COMPETENCY CRUD ===

exports.createCompetency = async (req, res) => {
  try {
    const { name, description, category, level, skills, roles } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Name is required' });
    const competency = await Competency.create({ name, description, category, level, skills: skills || [], roles: roles || [], createdBy: req.user._id });
    res.status(201).json({ success: true, competency });
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ success: false, message: 'Competency name already exists' });
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getCompetencies = async (req, res) => {
  try {
    const { category } = req.query;
    const filter = { isActive: true };
    if (category) filter.category = category;
    const competencies = await Competency.find(filter).sort({ category: 1, name: 1 });
    res.json({ success: true, competencies });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateCompetency = async (req, res) => {
  try {
    const updated = await Competency.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!updated) return res.status(404).json({ success: false, message: 'Competency not found' });
    res.json({ success: true, competency: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteCompetency = async (req, res) => {
  try {
    await Competency.findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ success: true, message: 'Competency deactivated' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// === CAREER PATH CRUD ===

exports.createCareerPath = async (req, res) => {
  try {
    const { userId, currentRole, currentLevel, targetRole, targetLevel, targetDate, competencies, developmentPlan, mentorId, notes } = req.body;
    const targetUser = userId || req.user._id;
    const path = await CareerPath.create({
      user: targetUser, currentRole, currentLevel, targetRole, targetLevel,
      targetDate, competencies: competencies || [], developmentPlan: developmentPlan || [],
      mentorId, notes, createdBy: req.user._id, status: 'active',
    });
    const populated = await CareerPath.findById(path._id)
      .populate('user', 'name email role')
      .populate('competencies.competency', 'name category')
      .populate('mentorId', 'name email');
    res.status(201).json({ success: true, careerPath: populated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getMyCareerPath = async (req, res) => {
  try {
    const paths = await CareerPath.find({ user: req.user._id })
      .populate('competencies.competency', 'name category level description')
      .populate('mentorId', 'name email')
      .sort({ createdAt: -1 });
    res.json({ success: true, careerPaths: paths });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getCareerPathForUser = async (req, res) => {
  try {
    const paths = await CareerPath.find({ user: req.params.userId })
      .populate('competencies.competency', 'name category level description')
      .populate('mentorId', 'name email')
      .populate('user', 'name email role')
      .sort({ createdAt: -1 });
    res.json({ success: true, careerPaths: paths });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getAllCareerPaths = async (req, res) => {
  try {
    const paths = await CareerPath.find({ status: 'active' })
      .populate('user', 'name email role')
      .populate('competencies.competency', 'name category')
      .populate('mentorId', 'name email')
      .sort({ createdAt: -1 });
    res.json({ success: true, careerPaths: paths });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateCareerPath = async (req, res) => {
  try {
    const path = await CareerPath.findById(req.params.id);
    if (!path) return res.status(404).json({ success: false, message: 'Career path not found' });

    const isOwner = path.user.toString() === req.user._id.toString();
    const isAdmin = ['ADMIN', 'HR'].includes(req.user.role);
    if (!isOwner && !isAdmin) return res.status(403).json({ success: false, message: 'Not authorized' });

    Object.assign(path, req.body);
    await path.save();

    const populated = await CareerPath.findById(path._id)
      .populate('user', 'name email role')
      .populate('competencies.competency', 'name category')
      .populate('mentorId', 'name email');
    res.json({ success: true, careerPath: populated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteCareerPath = async (req, res) => {
  try {
    const path = await CareerPath.findById(req.params.id);
    if (!path) return res.status(404).json({ success: false, message: 'Career path not found' });
    const isOwner = path.user.toString() === req.user._id.toString();
    const isAdmin = ['ADMIN', 'HR'].includes(req.user.role);
    if (!isOwner && !isAdmin) return res.status(403).json({ success: false, message: 'Not authorized' });
    await CareerPath.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Career path deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Update development action status
exports.updateDevAction = async (req, res) => {
  try {
    const path = await CareerPath.findById(req.params.pathId);
    if (!path) return res.status(404).json({ success: false, message: 'Career path not found' });

    const action = path.developmentPlan.id(req.params.actionId);
    if (!action) return res.status(404).json({ success: false, message: 'Action not found' });

    if (req.body.status) action.status = req.body.status;
    if (req.body.notes) action.notes = req.body.notes;
    if (req.body.status === 'completed') action.completedAt = new Date();

    await path.save();
    res.json({ success: true, careerPath: path });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
