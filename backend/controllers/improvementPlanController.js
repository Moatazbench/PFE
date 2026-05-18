const ImprovementPlan = require('../models/ImprovementPlan');
const FinalEvaluation = require('../models/FinalEvaluation');
const User = require('../models/User');
const Team = require('../models/Team');

async function getManagedEmployeeIds(actor) {
  const actorId = actor.id || actor._id;
  const ids = new Set();

  const team = await Team.findOne({ leader: actorId }).select('members');
  if (team && Array.isArray(team.members)) {
    team.members.forEach((memberId) => ids.add(String(memberId)));
  }

  const directReports = await User.find({ manager: actorId, isDeleted: false }).select('_id');
  directReports.forEach((user) => ids.add(String(user._id)));

  return Array.from(ids);
}

async function canViewEvaluationPlans(user, evaluation) {
  if (!user || !evaluation) return false;

  if (['ADMIN', 'HR'].includes(user.role)) {
    return true;
  }

  const employeeId = String(evaluation.employee_id?._id || evaluation.employee_id);
  const currentUserId = String(user.id || user._id);

  if (user.role === 'COLLABORATOR') {
    return currentUserId === employeeId;
  }

  if (user.role === 'TEAM_LEADER') {
    const managedEmployeeIds = await getManagedEmployeeIds(user);
    return managedEmployeeIds.includes(employeeId) || currentUserId === employeeId;
  }

  return false;
}

async function loadEvaluationWithAccessCheck(req, res, evaluationId) {
  const evaluation = await FinalEvaluation.findById(evaluationId).populate('employee_id', 'name email');
  if (!evaluation) {
    res.status(404).json({ success: false, message: 'Evaluation not found' });
    return null;
  }

  const canView = await canViewEvaluationPlans(req.user, evaluation);
  if (!canView) {
    res.status(403).json({ success: false, message: 'Forbidden' });
    return null;
  }

  return evaluation;
}

function canManagePlans(user) {
  return ['ADMIN', 'HR'].includes(user?.role);
}

function isEligiblePerformanceStatus(status) {
  return ['needs_improvement', 'critical_attention'].includes(String(status || ''));
}

exports.getPlansForEvaluation = async (req, res) => {
  try {
    const evaluation = await loadEvaluationWithAccessCheck(req, res, req.params.evaluationId);
    if (!evaluation) return;

    const plans = await ImprovementPlan.find({ evaluation_id: evaluation._id })
      .populate('created_by', 'name')
      .populate('updated_by', 'name')
      .sort({ createdAt: -1 });

    res.json({ success: true, plans });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.createPlan = async (req, res) => {
  try {
    if (!canManagePlans(req.user)) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const evaluation = await FinalEvaluation.findById(req.params.evaluationId);
    if (!evaluation) {
      return res.status(404).json({ success: false, message: 'Evaluation not found' });
    }

    if (!isEligiblePerformanceStatus(evaluation.performance_status)) {
      return res.status(400).json({
        success: false,
        message: 'Improvement plans are only available for Needs Improvement or Critical Attention statuses.'
      });
    }

    const { objective_goal, deadline, expected_outcome, notes, progress_status } = req.body;

    if (!String(objective_goal || '').trim() || !deadline || !String(expected_outcome || '').trim()) {
      return res.status(400).json({
        success: false,
        message: 'Objective/goal, deadline, and expected outcome are required.'
      });
    }

    const plan = await ImprovementPlan.create({
      evaluation_id: evaluation._id,
      employee_id: evaluation.employee_id,
      cycle_id: evaluation.cycle_id,
      objective_goal: String(objective_goal).trim(),
      deadline,
      expected_outcome: String(expected_outcome).trim(),
      notes: String(notes || '').trim(),
      progress_status: progress_status || 'not_started',
      created_by: req.user.id || req.user._id,
      updated_by: req.user.id || req.user._id
    });

    const populated = await ImprovementPlan.findById(plan._id)
      .populate('created_by', 'name')
      .populate('updated_by', 'name');

    res.status(201).json({ success: true, plan: populated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updatePlan = async (req, res) => {
  try {
    if (!canManagePlans(req.user)) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const plan = await ImprovementPlan.findById(req.params.id);
    if (!plan) {
      return res.status(404).json({ success: false, message: 'Improvement plan not found' });
    }

    const evaluation = await FinalEvaluation.findById(plan.evaluation_id);
    if (!evaluation) {
      return res.status(404).json({ success: false, message: 'Evaluation not found' });
    }

    const {
      objective_goal,
      deadline,
      expected_outcome,
      notes,
      progress_status
    } = req.body;

    if (objective_goal !== undefined) plan.objective_goal = String(objective_goal).trim();
    if (deadline !== undefined) plan.deadline = deadline;
    if (expected_outcome !== undefined) plan.expected_outcome = String(expected_outcome).trim();
    if (notes !== undefined) plan.notes = String(notes || '').trim();
    if (progress_status !== undefined) plan.progress_status = progress_status;
    plan.updated_by = req.user.id || req.user._id;

    await plan.save();

    const populated = await ImprovementPlan.findById(plan._id)
      .populate('created_by', 'name')
      .populate('updated_by', 'name');

    res.json({ success: true, plan: populated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deletePlan = async (req, res) => {
  try {
    if (!canManagePlans(req.user)) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const plan = await ImprovementPlan.findById(req.params.id);
    if (!plan) {
      return res.status(404).json({ success: false, message: 'Improvement plan not found' });
    }

    await ImprovementPlan.findByIdAndDelete(plan._id);
    res.json({ success: true, message: 'Improvement plan deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
