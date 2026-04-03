const Goal = require('../models/Goal');
const GoalReview = require('../models/GoalReview');
const Cycle = require('../models/Cycle');
const User = require('../models/User');
const Team = require('../models/Team');
const { createNotification } = require('../utils/notificationHelper');
const { createAuditLog } = require('../utils/auditHelper');

// ============================================================
//  UTILITY HELPERS (Internal to Controller)
// ============================================================

async function enforcePhase(cycleId, requiredPhase) {
  const cycle = await Cycle.findById(cycleId);
  if (!cycle) return { error: true, status: 404, message: 'Cycle not found' };
  const allowed = Array.isArray(requiredPhase) ? requiredPhase : [requiredPhase];
  if (!allowed.includes(cycle.currentPhase)) {
    return {
      error: true,
      status: 403,
      message: `Action allowed during ${allowed.join(' or ')}. Current: ${cycle.currentPhase}`,
    };
  }
  return { error: false, cycle };
}

function addRevision(goal, changedBy, comment, previousStatus, newStatus) {
  goal.revisionHistory = goal.revisionHistory || [];
  goal.revisionHistory.push({
    changedBy,
    comment: comment || '',
    previousStatus: previousStatus || '',
    newStatus: newStatus || '',
    changedAt: new Date(),
  });
}

async function resolveManager(employeeId) {
  const employee = await User.findById(employeeId);
  if (!employee) return null;
  if (employee.manager) return employee.manager;
  const team = await Team.findOne({ members: employeeId });
  if (team && team.leader) return team.leader;
  return null;
}

// ============================================================
//  EXPORTED HANDLERS
// ============================================================

exports.getValidationStatus = async (req, res) => {
  try {
    const { employeeId, cycleId } = req.params;
    const goals = await Goal.find({ employeeId, cycleId });
    const total = goals.length;
    const approved = goals.filter(g => ['approved', 'midyear_assessed', 'final_evaluated', 'locked'].includes(g.status)).length;
    const pending = goals.filter(g => ['draft', 'submitted', 'under_review', 'needs_revision'].includes(g.status)).length;
    const rejected = goals.filter(g => g.status === 'rejected').length;
    const totalWeight = goals.reduce((sum, g) => sum + (g.weight || 0), 0);

    res.json({
      success: true,
      totalGoals: total,
      approvedCount: approved,
      pendingCount: pending,
      rejectedCount: rejected,
      totalWeight,
      weightWarning: totalWeight !== 100 ? `Total weight is ${totalWeight}%` : null,
    });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.getGoals = async (req, res) => {
  try {
    const filter = {};
    if (req.query.cycleId) filter.cycleId = req.query.cycleId;
    if (req.query.employeeId) filter.employeeId = req.query.employeeId;
    if (req.query.status) filter.status = req.query.status;

    if (req.user.role === 'COLLABORATOR') filter.employeeId = req.user.id;
    else if (req.user.role === 'TEAM_LEADER' && !req.query.employeeId) {
      const team = await Team.findOne({ leader: req.user.id });
      if (team) filter.employeeId = { $in: [...team.members, req.user.id] };
    }

    const goals = await Goal.find(filter)
      .populate('employeeId', 'name email role')
      .populate('managerId', 'name email role')
      .populate('cycleId', 'name year currentPhase status')
      .sort({ createdAt: -1 });

    res.json({ success: true, goals });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.createGoal = async (req, res) => {
  try {
    const { cycleId, title } = req.body;
    const phaseCheck = await enforcePhase(cycleId, 'phase1');
    if (phaseCheck.error) return res.status(phaseCheck.status).json({ success: false, message: phaseCheck.message });

    const managerId = await resolveManager(req.user.id);
    const goal = new Goal({
      ...req.body,
      employeeId: req.user.id,
      managerId,
      status: 'draft'
    });
    addRevision(goal, req.user.id, 'Goal created', '', 'draft');
    await goal.save();
    
    createAuditLog({ entityType: 'goal', entityId: goal._id, action: 'create', performedBy: req.user.id, description: `Goal "${title}" created` });
    res.status(201).json({ success: true, goal });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.updateGoal = async (req, res) => {
  try {
    const goal = await Goal.findById(req.params.id);
    if (!goal) return res.status(404).json({ success: false, message: 'Not found' });
    if (String(goal.employeeId) !== String(req.user.id) && req.user.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    const allowed = ['title', 'description', 'category', 'priority', 'weight', 'metric', 'targetValue', 'startDate', 'dueDate', 'employeeComments'];
    allowed.forEach(f => { if (req.body[f] !== undefined) goal[f] = req.body[f]; });
    addRevision(goal, req.user.id, 'Updated', goal.status, goal.status);
    await goal.save();
    res.json({ success: true, goal });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.deleteGoal = async (req, res) => {
  try {
    const goal = await Goal.findById(req.params.id);
    if (!goal || (String(goal.employeeId) !== String(req.user.id) && req.user.role !== 'ADMIN')) return res.status(403).json({ success: false, message: 'Forbidden' });
    if (goal.status !== 'draft') return res.status(400).json({ success: false, message: 'Only drafts can be deleted' });
    await Goal.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Deleted' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.submitGoal = async (req, res) => {
  try {
    const goal = await Goal.findById(req.params.id);
    if (!goal || (String(goal.employeeId) !== String(req.user.id) && req.user.role !== 'ADMIN')) return res.status(403).json({ success: false, message: 'Forbidden' });
    const oldStatus = goal.status;
    goal.status = 'submitted';
    addRevision(goal, req.user.id, 'Goal submitted', oldStatus, 'submitted');
    await goal.save();
    if (goal.managerId) createNotification({ recipientId: goal.managerId, senderId: req.user.id, type: 'GOAL_SUBMITTED', title: 'Goal Submitted' });
    res.json({ success: true, goal });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.approveGoal = async (req, res) => {
  try {
    const goal = await Goal.findById(req.params.id);
    if (!goal || (String(goal.managerId) !== String(req.user.id) && req.user.role !== 'ADMIN')) return res.status(403).json({ success: false, message: 'Forbidden' });
    const oldStatus = goal.status;
    goal.status = 'approved';
    addRevision(goal, req.user.id, 'Goal approved', oldStatus, 'approved');
    await goal.save();
    createNotification({ recipientId: goal.employeeId, senderId: req.user.id, type: 'GOAL_APPROVED', title: 'Goal Approved' });
    res.json({ success: true, goal });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.requestRevision = async (req, res) => {
  try {
    const goal = await Goal.findById(req.params.id);
    if (!goal || (String(goal.managerId) !== String(req.user.id) && req.user.role !== 'ADMIN')) return res.status(403).json({ success: false, message: 'Forbidden' });
    const oldStatus = goal.status;
    goal.status = 'needs_revision';
    goal.managerComments = req.body.comment;
    addRevision(goal, req.user.id, req.body.comment, oldStatus, 'needs_revision');
    await goal.save();
    createNotification({ recipientId: goal.employeeId, senderId: req.user.id, type: 'GOAL_REVISION_REQUESTED', title: 'Revision Requested' });
    res.json({ success: true, goal });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.midYearAssessment = async (req, res) => {
    try {
        const goal = await Goal.findById(req.params.id);
        if (!goal) return res.status(404).json({ success: false, message: 'Goal not found' });
        const phaseCheck = await enforcePhase(goal.cycleId, 'phase2');
        if (phaseCheck.error) return res.status(phaseCheck.status).json({ success: false, message: phaseCheck.message });

        const isOwner = String(goal.employeeId) === String(req.user.id);
        const isManager = goal.managerId && String(goal.managerId) === String(req.user.id);
        const reviewType = isOwner ? 'self_assessment' : 'manager_assessment';

        const review = await GoalReview.create({
            ...req.body,
            goalId: goal._id,
            cycleId: goal.cycleId,
            phase: 'midyear',
            reviewerId: req.user.id,
            reviewType
        });

        if (reviewType === 'manager_assessment') {
            goal.status = 'midyear_assessed';
            if (req.body.progressPercentage) goal.currentProgress = req.body.progressPercentage;
            await goal.save();
        }
        res.status(201).json({ success: true, review });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.finalEvaluation = async (req, res) => {
    try {
        const goal = await Goal.findById(req.params.id);
        if (!goal) return res.status(404).json({ success: false, message: 'Goal not found' });
        const phaseCheck = await enforcePhase(goal.cycleId, 'phase3');
        if (phaseCheck.error) return res.status(phaseCheck.status).json({ success: false, message: phaseCheck.message });

        const isManager = goal.managerId && String(goal.managerId) === String(req.user.id);
        if (!isManager && req.user.role !== 'ADMIN') return res.status(403).json({ success: false, message: 'Forbidden' });

        const review = await GoalReview.create({
            ...req.body,
            goalId: goal._id,
            cycleId: goal.cycleId,
            phase: 'endyear',
            reviewerId: req.user.id,
            reviewType: 'manager_assessment'
        });

        goal.status = 'final_evaluated';
        if (req.body.finalCompletion) goal.finalCompletion = req.body.finalCompletion;
        await goal.save();
        res.status(201).json({ success: true, review });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};
