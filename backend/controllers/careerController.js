const Competency = require('../models/Competency');
const CareerPath = require('../models/CareerPath');
const Team = require('../models/Team');
const { createNotification } = require('../utils/notificationHelper');

async function canManageCareerUser(actor, targetUserId) {
  if (['ADMIN', 'HR'].includes(actor.role)) return true;
  if (String(actor.id || actor._id) === String(targetUserId)) return true;
  if (actor.role !== 'TEAM_LEADER') return false;
  return Boolean(await Team.exists({ leader: actor.id || actor._id, members: targetUserId }));
}

async function canManageCareerPath(actor, targetUserId) {
  if (['ADMIN', 'HR'].includes(actor.role)) return true;
  if (String(actor.id || actor._id) === String(targetUserId)) return true;
  if (actor.role !== 'TEAM_LEADER') return false;
  return Boolean(await Team.exists({ leader: actor.id || actor._id, members: targetUserId }));
}

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

exports.createCareerPath = async (req, res) => {
  try {
    const { userId, currentRole, currentLevel, targetRole, targetLevel, targetDate, competencies, developmentPlan, mentorId, notes } = req.body;
    const targetUser = userId || req.user._id;
    if (!await canManageCareerUser(req.user, targetUser)) {
      return res.status(403).json({ success: false, message: 'You cannot create a career path for this user.' });
    }
    const path = await CareerPath.create({
      user: targetUser, currentRole, currentLevel, targetRole, targetLevel,
      targetDate, competencies: competencies || [], developmentPlan: developmentPlan || [],
      mentorId, notes, createdBy: req.user._id, status: 'active', finalEvaluation: req.body.finalEvaluation || null,
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
    const targetUserId = req.params.userId;
    if (!await canManageCareerPath(req.user, targetUserId)) {
      return res.status(403).json({ success: false, message: 'You cannot view this career path.' });
    }

    const paths = await CareerPath.find({ user: targetUserId })
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

    const isOwner = String(path.user) === String(req.user._id || req.user.id);
    const canManage = await canManageCareerPath(req.user, path.user);
    if (!isOwner && !canManage) return res.status(403).json({ success: false, message: 'Not authorized' });

    const allowedUpdates = ['currentRole', 'currentLevel', 'targetRole', 'targetLevel', 'targetDate', 'competencies', 'developmentPlan', 'mentorId', 'notes', 'status', 'finalEvaluation'];
    allowedUpdates.forEach((field) => {
      if (req.body[field] !== undefined) path[field] = req.body[field];
    });
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
    const isOwner = String(path.user) === String(req.user._id || req.user.id);
    const canManage = await canManageCareerPath(req.user, path.user);
    if (!isOwner && !canManage) return res.status(403).json({ success: false, message: 'Not authorized' });
    await CareerPath.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Career path deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.createDevelopmentAction = async (req, res) => {
  try {
    const path = await CareerPath.findById(req.params.pathId);
    if (!path) return res.status(404).json({ success: false, message: 'Career path not found' });

    if (!await canManageCareerPath(req.user, path.user)) {
      return res.status(403).json({ success: false, message: 'You cannot create a development action for this career path.' });
    }

    const { title, type, dueDate, notes, status } = req.body;
    if (!title || !String(title).trim()) {
      return res.status(400).json({ success: false, message: 'A title is required.' });
    }

    const action = {
      title: String(title).trim(),
      type: type || 'other',
      status: ['planned', 'in_progress', 'completed', 'overdue', 'cancelled'].includes(status) ? status : 'planned',
      dueDate: dueDate || null,
      notes: notes || '',
      createdFromEvaluation: req.body.finalEvaluation || null,
    };

    path.developmentPlan.push(action);
    await path.save();
    if (String(path.user) !== String(req.user.id || req.user._id)) {
      await createNotification({
        recipientId: path.user,
        senderId: req.user.id || req.user._id,
        type: 'GOAL_UPDATE',
        title: 'Development action created',
        message: `A new ${action.type} action was added to your development plan: ${action.title}.`,
        link: '/career'
      });
    }

    const populated = await CareerPath.findById(path._id)
      .populate('user', 'name email role')
      .populate('competencies.competency', 'name category')
      .populate('mentorId', 'name email');
    res.status(201).json({ success: true, careerPath: populated, action });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateDevAction = async (req, res) => {
  try {
    const path = await CareerPath.findById(req.params.pathId);
    if (!path) return res.status(404).json({ success: false, message: 'Career path not found' });

    const action = path.developmentPlan.id(req.params.actionId);
    if (!action) return res.status(404).json({ success: false, message: 'Action not found' });
    if (!await canManageCareerUser(req.user, path.user)) {
      return res.status(403).json({ success: false, message: 'You cannot update this development action.' });
    }

    if (req.body.status) action.status = req.body.status;
    if (req.body.notes) action.notes = req.body.notes;
    if (req.body.status === 'completed') action.completedAt = new Date();

    await path.save();
    res.json({ success: true, careerPath: path });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const CareerRecommendation = require('../models/CareerRecommendation');
const FinalEvaluation = require('../models/FinalEvaluation');

exports.getMyRecommendations = async (req, res) => {
  try {
    const recommendations = await CareerRecommendation.find({ employee_id: req.user.id || req.user._id })
      .populate('cycle_id', 'name year')
      .sort({ createdAt: -1 });
    res.json({ success: true, recommendations });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getAllRecommendations = async (req, res) => {
  try {
    const filter = {};
    if (req.user.role === 'TEAM_LEADER') {
      const teams = await Team.find({ leader: req.user.id || req.user._id }).select('members');
      filter.employee_id = { $in: teams.flatMap((team) => team.members || []) };
    }
    const recommendations = await CareerRecommendation.find(filter)
      .populate('employee_id', 'name email role')
      .populate('cycle_id', 'name year')
      .sort({ createdAt: -1 });
    res.json({ success: true, recommendations });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.generateRecommendation = async (req, res) => {
  try {
    const { employee_id, cycle_id } = req.body;
    
    const evaluation = await FinalEvaluation.findOne({ employee_id, cycle_id });
    
    let suggested_path = 'Standard Progression';
    let skills_to_develop = [];
    let basis = '';

    if (evaluation) {
      if (evaluation.weaknesses && evaluation.weaknesses.length > 0) {
        skills_to_develop = evaluation.weaknesses.map(w => w.split(' ')[0] + ' improvement');
        basis = 'Based on identified areas for improvement in recent evaluation.';
      }
      if (evaluation.recommendation === 'promotion') {
        suggested_path = 'Accelerated Leadership Track';
        basis = 'Strong performance and promotion recommendation.';
      } else if (evaluation.recommendation === 'performance_improvement_plan') {
        suggested_path = 'Core Competency Reinforcement';
        basis = 'Recent performance requires focused improvement.';
      }
    }

    res.json({
      success: true,
      recommendation: {
        suggested_path,
        skills_to_develop,
        basis,
        source: 'auto'
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.saveRecommendation = async (req, res) => {
  try {
    const { employee_id, cycle_id, suggested_path, skills_to_develop, source, basis } = req.body;

    let rec = await CareerRecommendation.findOne({ employee_id, cycle_id });
    if (rec) {
      rec.suggested_path = suggested_path;
      rec.skills_to_develop = skills_to_develop;
      rec.source = source || 'manager';
      rec.basis = basis;
      await rec.save();
    } else {
      rec = await CareerRecommendation.create({
        employee_id,
        cycle_id,
        suggested_path,
        skills_to_develop,
        source: source || 'manager',
        basis
      });
    }

    res.json({ success: true, recommendation: rec });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
