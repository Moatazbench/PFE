const Evaluation = require('../models/Evaluation');
const Objective = require('../models/Objective');
const Cycle = require('../models/Cycle');
const User = require('../models/User');
const Team = require('../models/Team');
const { createNotification } = require('../utils/notificationHelper');
const { createAuditLog } = require('../utils/auditHelper');

const ACTIVE_OBJECTIVE_STATUSES = ['approved', 'validated', 'evaluated', 'locked'];
const EDITABLE_EVALUATION_STATUSES = ['draft', 'in_progress', 'rejected'];

function roundScore(value) {
  return Number(Number(value || 0).toFixed(2));
}

function clampPercent(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(100, numeric));
}

function calculateObjectiveScore(objective) {
  return roundScore((Number(objective.weight || 0) * clampPercent(objective.achievementPercent)) / 100);
}

function calculateEvaluationScore(objectives) {
  return roundScore((objectives || []).reduce((sum, objective) => sum + calculateObjectiveScore(objective), 0));
}

function getObjectiveProgressState(objective) {
  const achievement = clampPercent(objective.achievementPercent);
  if (achievement >= 100) return 'completed';
  if (achievement > 0) return 'in_progress';
  return 'not_started';
}

function getRubricBand(score) {
  if (score == null) return null;
  if (score >= 90) return { label: 'Exceeded Expectations', range: '90-100', color: '#7c3aed' };
  if (score >= 75) return { label: 'Achieved', range: '75-89', color: '#16a34a' };
  if (score >= 50) return { label: 'Partially Achieved', range: '50-74', color: '#ca8a04' };
  return { label: 'Below Expectations', range: '0-49', color: '#dc2626' };
}

function getFullRubric() {
  return [
    { min: 0, max: 49, label: 'Below Expectations', range: '0-49', color: '#dc2626', description: 'Results remain below target and need corrective action.' },
    { min: 50, max: 74, label: 'Partially Achieved', range: '50-74', color: '#ca8a04', description: 'Core objectives progressed, but gaps remain.' },
    { min: 75, max: 89, label: 'Achieved', range: '75-89', color: '#16a34a', description: 'Objectives were delivered consistently and on target.' },
    { min: 90, max: 100, label: 'Exceeded Expectations', range: '90-100', color: '#7c3aed', description: 'Performance exceeded the expected objective outcomes.' },
  ];
}

async function isManagerOf(managerId, employeeId) {
  const employee = await User.findById(employeeId);
  if (!employee) return false;
  if (employee.manager && String(employee.manager) === String(managerId)) return true;

  const team = await Team.findOne({ leader: managerId, members: employeeId });
  return Boolean(team);
}

async function fetchObjectiveScope({ employeeId, cycleId, objectiveIds = null, useLiveCycleScope = false }) {
  const normalizedEmployeeId = employeeId && employeeId._id ? employeeId._id : employeeId;
  const normalizedCycleId = cycleId && cycleId._id ? cycleId._id : cycleId;
  const filter = {};

  if (useLiveCycleScope || !Array.isArray(objectiveIds) || objectiveIds.length === 0) {
    filter.owner = normalizedEmployeeId;
    filter.cycle = normalizedCycleId;
    filter.status = { $in: ACTIVE_OBJECTIVE_STATUSES };
  } else {
    filter._id = { $in: objectiveIds };
  }

  const objectives = await Objective.find(filter)
    .populate('owner', 'name email role')
    .populate('cycle', 'name year currentPhase status')
    .sort({ createdAt: 1 });

  return objectives;
}

function buildObjectiveAssessment(objective) {
  const achievementPercent = clampPercent(objective.achievementPercent);
  const weightedScore = calculateObjectiveScore(objective);

  return {
    objectiveId: objective._id,
    achievementPercent,
    weightedScore,
    objectiveStatus: getObjectiveProgressState(objective),
    workflowStatus: objective.status,
    reviewed: ['evaluated', 'locked'].includes(objective.status) || Boolean(objective.evaluationRating),
    comments: objective.evaluationComment || objective.managerComments || '',
    objective,
  };
}

function setEvaluationScope(evaluation, objectives) {
  evaluation.objectiveAssessments = (objectives || []).map((objective) => ({
    objectiveId: objective._id,
  }));
  evaluation.scoringMethod = 'objective_weighted_sum';
  evaluation.suggestedScore = calculateEvaluationScore(objectives);
}

async function hydrateEvaluation(evaluation) {
  const isEditable = EDITABLE_EVALUATION_STATUSES.includes(evaluation.status);
  const storedObjectiveIds = (evaluation.objectiveAssessments || []).map((item) => item.objectiveId);
  const objectives = await fetchObjectiveScope({
    employeeId: evaluation.employeeId,
    cycleId: evaluation.cycleId,
    objectiveIds: storedObjectiveIds,
    useLiveCycleScope: isEditable,
  });

  const evaluationObject = evaluation.toObject();
  evaluationObject.objectiveAssessments = objectives.map(buildObjectiveAssessment);
  evaluationObject.suggestedScore = calculateEvaluationScore(objectives);
  evaluationObject.totalWeight = roundScore(objectives.reduce((sum, objective) => sum + Number(objective.weight || 0), 0));

  return evaluationObject;
}

exports.createEvaluation = async (req, res) => {
  try {
    const { employeeId, cycleId, period } = req.body;
    const evaluatorId = req.user.id;

    if (!['ADMIN', 'HR'].includes(req.user.role)) {
      const managerAccess = await isManagerOf(evaluatorId, employeeId);
      if (!managerAccess) {
        return res.status(403).json({ success: false, message: 'You can only evaluate your direct reports.' });
      }
    }

    const existing = await Evaluation.findOne({ employeeId, cycleId });
    if (existing) {
      return res.status(400).json({ success: false, message: 'An evaluation already exists for this employee in this cycle.' });
    }

    const cycle = await Cycle.findById(cycleId);
    if (!cycle) {
      return res.status(404).json({ success: false, message: 'Cycle not found.' });
    }

    if (cycle.currentPhase !== 'phase3' && req.user.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Evaluations can only be created during Phase 3.' });
    }

    const objectives = await fetchObjectiveScope({ employeeId, cycleId, useLiveCycleScope: true });
    if (objectives.length === 0) {
      return res.status(400).json({ success: false, message: 'No approved objectives were found for this employee in the selected cycle.' });
    }

    const totalWeight = objectives.reduce((sum, objective) => sum + Number(objective.weight || 0), 0);
    if (totalWeight > 100) {
      return res.status(400).json({ success: false, message: `Objective weights are invalid for this employee. Total detected: ${totalWeight}%.` });
    }

    const evaluation = new Evaluation({
      employeeId,
      evaluatorId,
      cycleId,
      period: period || `${cycle.name} ${cycle.year}`,
      status: 'draft',
    });

    setEvaluationScope(evaluation, objectives);
    await evaluation.save();

    await createNotification({
      recipientId: employeeId,
      senderId: evaluatorId,
      type: 'EVALUATION_CREATED',
      title: 'Evaluation Started',
      message: `Your manager started your performance evaluation for ${evaluation.period}.`,
      link: '/evaluation-list',
    });

    await createAuditLog({
      entityType: 'evaluation',
      entityId: evaluation._id,
      action: 'create',
      performedBy: evaluatorId,
      description: 'Evaluation created from approved objectives.',
    });

    const populated = await Evaluation.findById(evaluation._id)
      .populate('employeeId', 'name email role')
      .populate('evaluatorId', 'name email role')
      .populate('cycleId', 'name year currentPhase');

    const hydratedEvaluation = await hydrateEvaluation(populated);
    res.status(201).json({ success: true, evaluation: hydratedEvaluation, rubricBand: getRubricBand(hydratedEvaluation.suggestedScore) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getEvaluation = async (req, res) => {
  try {
    const evaluation = await Evaluation.findById(req.params.id)
      .populate('employeeId', 'name email role team')
      .populate('evaluatorId', 'name email role')
      .populate('cycleId', 'name year currentPhase status')
      .populate('approvals.approverId', 'name email role')
      .populate('scoreHistory.changedBy', 'name email');

    if (!evaluation) {
      return res.status(404).json({ success: false, message: 'Evaluation not found.' });
    }

    const userId = String(req.user.id);
    const isEmployee = String(evaluation.employeeId._id) === userId;
    const isEvaluator = String(evaluation.evaluatorId._id) === userId;
    const isPrivileged = ['ADMIN', 'HR'].includes(req.user.role);

    if (!isEmployee && !isEvaluator && !isPrivileged) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const hydratedEvaluation = await hydrateEvaluation(evaluation);
    res.json({
      success: true,
      evaluation: hydratedEvaluation,
      rubricBand: getRubricBand(hydratedEvaluation.finalScore ?? hydratedEvaluation.suggestedScore),
      rubric: getFullRubric(),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getMyEvaluations = async (req, res) => {
  try {
    const { employeeId } = req.params;

    if (String(req.user.id) !== employeeId && !['ADMIN', 'HR'].includes(req.user.role)) {
      const managerAccess = await isManagerOf(req.user.id, employeeId);
      if (!managerAccess) {
        return res.status(403).json({ success: false, message: 'Access denied.' });
      }
    }

    const evaluations = await Evaluation.find({ employeeId })
      .populate('employeeId', 'name email role')
      .populate('evaluatorId', 'name email role')
      .populate('cycleId', 'name year currentPhase')
      .sort({ createdAt: -1 });

    const hydrated = await Promise.all(evaluations.map(hydrateEvaluation));
    res.json({ success: true, evaluations: hydrated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getEvaluatorEvaluations = async (req, res) => {
  try {
    const { evaluatorId } = req.params;

    if (String(req.user.id) !== evaluatorId && !['ADMIN', 'HR'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const filter = { evaluatorId };
    if (req.query.cycleId) filter.cycleId = req.query.cycleId;
    if (req.query.status) filter.status = req.query.status;

    const evaluations = await Evaluation.find(filter)
      .populate('employeeId', 'name email role')
      .populate('evaluatorId', 'name email role')
      .populate('cycleId', 'name year currentPhase')
      .sort({ createdAt: -1 });

    const hydrated = await Promise.all(evaluations.map(hydrateEvaluation));
    res.json({ success: true, evaluations: hydrated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getAllEvaluations = async (req, res) => {
  try {
    const filter = {};
    if (req.query.cycleId) filter.cycleId = req.query.cycleId;
    if (req.query.status) filter.status = req.query.status;
    if (req.query.employeeId) filter.employeeId = req.query.employeeId;
    if (req.query.evaluatorId) filter.evaluatorId = req.query.evaluatorId;

    if (req.user.role === 'COLLABORATOR') {
      filter.employeeId = req.user.id;
    } else if (req.user.role === 'TEAM_LEADER') {
      const team = await Team.findOne({ leader: req.user.id });
      if (team) {
        filter.$or = [
          { evaluatorId: req.user.id },
          { employeeId: { $in: [...team.members, req.user.id] } },
        ];
      }
    }

    const evaluations = await Evaluation.find(filter)
      .populate('employeeId', 'name email role')
      .populate('evaluatorId', 'name email role')
      .populate('cycleId', 'name year currentPhase')
      .sort({ createdAt: -1 });

    const hydrated = await Promise.all(evaluations.map(hydrateEvaluation));
    res.json({ success: true, evaluations: hydrated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateEvaluation = async (req, res) => {
  try {
    const evaluation = await Evaluation.findById(req.params.id);
    if (!evaluation) {
      return res.status(404).json({ success: false, message: 'Evaluation not found.' });
    }

    if (String(evaluation.evaluatorId) !== String(req.user.id) && req.user.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Only the evaluator can update this evaluation.' });
    }

    if (!EDITABLE_EVALUATION_STATUSES.includes(evaluation.status)) {
      return res.status(400).json({ success: false, message: 'Evaluation cannot be modified in its current status.' });
    }

    const objectives = await fetchObjectiveScope({
      employeeId: evaluation.employeeId,
      cycleId: evaluation.cycleId,
      useLiveCycleScope: true,
    });

    if (objectives.length === 0) {
      return res.status(400).json({ success: false, message: 'This evaluation no longer has any approved objectives to score.' });
    }

    const allowedFields = [
      'overallComments',
      'strengths',
      'areasForImprovement',
      'developmentRecommendations',
      'nextSteps',
      'period',
    ];

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        evaluation[field] = req.body[field];
      }
    });

    setEvaluationScope(evaluation, objectives);

    if (req.body.finalScore !== undefined) {
      const newScore = clampPercent(req.body.finalScore);
      evaluation.scoreHistory.push({
        previousScore: evaluation.finalScore,
        newScore,
        changedBy: req.user.id,
        reason: req.body.scoreChangeReason || 'Manual override',
      });
      evaluation.finalScore = newScore;
    }

    if (evaluation.status === 'draft') {
      evaluation.status = 'in_progress';
    }

    await evaluation.save();

    const populated = await Evaluation.findById(evaluation._id)
      .populate('employeeId', 'name email role')
      .populate('evaluatorId', 'name email role')
      .populate('cycleId', 'name year currentPhase')
      .populate('scoreHistory.changedBy', 'name email');

    const hydratedEvaluation = await hydrateEvaluation(populated);
    res.json({
      success: true,
      evaluation: hydratedEvaluation,
      rubricBand: getRubricBand(hydratedEvaluation.finalScore ?? hydratedEvaluation.suggestedScore),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.submitEvaluation = async (req, res) => {
  try {
    const evaluation = await Evaluation.findById(req.params.id);
    if (!evaluation) {
      return res.status(404).json({ success: false, message: 'Evaluation not found.' });
    }

    if (String(evaluation.evaluatorId) !== String(req.user.id) && req.user.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Only the evaluator can submit this evaluation.' });
    }

    if (!EDITABLE_EVALUATION_STATUSES.includes(evaluation.status)) {
      return res.status(400).json({ success: false, message: 'Evaluation cannot be submitted in its current status.' });
    }

    const objectives = await fetchObjectiveScope({
      employeeId: evaluation.employeeId,
      cycleId: evaluation.cycleId,
      useLiveCycleScope: true,
    });

    if (objectives.length === 0) {
      return res.status(400).json({ success: false, message: 'No approved objectives are available for submission.' });
    }

    const totalWeight = objectives.reduce((sum, objective) => sum + Number(objective.weight || 0), 0);
    if (totalWeight > 100) {
      return res.status(400).json({ success: false, message: `Objective weights exceed 100% (${totalWeight}%).` });
    }

    setEvaluationScope(evaluation, objectives);

    if (evaluation.suggestedScore == null) {
      return res.status(400).json({ success: false, message: 'A score could not be calculated from the current objectives.' });
    }

    if (evaluation.finalScore == null) {
      evaluation.finalScore = evaluation.suggestedScore;
    }

    evaluation.status = 'submitted';
    evaluation.submittedAt = new Date();
    await evaluation.save();

    await Objective.updateMany(
      { _id: { $in: objectives.map((objective) => objective._id) }, status: { $ne: 'locked' } },
      { $set: { status: 'locked' } }
    );

    await createNotification({
      recipientId: evaluation.employeeId,
      senderId: req.user.id,
      type: 'EVALUATION_SUBMITTED',
      title: 'Evaluation Submitted',
      message: `Your performance evaluation for ${evaluation.period} has been submitted.`,
      link: '/evaluation-list',
    });

    await createAuditLog({
      entityType: 'evaluation',
      entityId: evaluation._id,
      action: 'submit',
      performedBy: req.user.id,
      description: `Evaluation submitted with final score ${evaluation.finalScore}.`,
    });

    res.json({ success: true, evaluation });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.approveEvaluation = async (req, res) => {
  try {
    const evaluation = await Evaluation.findById(req.params.id);
    if (!evaluation) {
      return res.status(404).json({ success: false, message: 'Evaluation not found.' });
    }

    if (evaluation.status !== 'submitted') {
      return res.status(400).json({ success: false, message: 'Only submitted evaluations can be approved.' });
    }

    evaluation.status = 'approved';
    evaluation.approvals.push({
      approverId: req.user.id,
      status: 'approved',
      comments: req.body.comments || '',
      date: new Date(),
    });
    await evaluation.save();

    await createNotification({
      recipientId: evaluation.evaluatorId,
      senderId: req.user.id,
      type: 'EVALUATION_APPROVED',
      title: 'Evaluation Approved',
      message: 'The evaluation you submitted has been approved.',
      link: '/evaluation-list',
    });
    await createNotification({
      recipientId: evaluation.employeeId,
      senderId: req.user.id,
      type: 'EVALUATION_APPROVED',
      title: 'Evaluation Approved',
      message: `Your performance evaluation for ${evaluation.period} has been approved.`,
      link: '/evaluation-list',
    });

    await createAuditLog({
      entityType: 'evaluation',
      entityId: evaluation._id,
      action: 'approve',
      performedBy: req.user.id,
      description: 'Evaluation approved.',
    });

    res.json({ success: true, evaluation });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.rejectEvaluation = async (req, res) => {
  try {
    const evaluation = await Evaluation.findById(req.params.id);
    if (!evaluation) {
      return res.status(404).json({ success: false, message: 'Evaluation not found.' });
    }

    if (evaluation.status !== 'submitted') {
      return res.status(400).json({ success: false, message: 'Only submitted evaluations can be rejected.' });
    }

    evaluation.status = 'rejected';
    evaluation.approvals.push({
      approverId: req.user.id,
      status: 'rejected',
      comments: req.body.comments || 'Needs revision',
      date: new Date(),
    });
    await evaluation.save();

    await createNotification({
      recipientId: evaluation.evaluatorId,
      senderId: req.user.id,
      type: 'EVALUATION_REJECTED',
      title: 'Evaluation Rejected',
      message: `The evaluation you submitted was rejected: ${req.body.comments || 'Needs revision'}`,
      link: '/evaluation-list',
    });

    await createAuditLog({
      entityType: 'evaluation',
      entityId: evaluation._id,
      action: 'reject',
      performedBy: req.user.id,
      description: `Evaluation rejected: ${req.body.comments || ''}`,
    });

    res.json({ success: true, evaluation });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.completeEvaluation = async (req, res) => {
  try {
    const evaluation = await Evaluation.findById(req.params.id);
    if (!evaluation) {
      return res.status(404).json({ success: false, message: 'Evaluation not found.' });
    }

    if (evaluation.status !== 'approved') {
      return res.status(400).json({ success: false, message: 'Only approved evaluations can be completed.' });
    }

    evaluation.status = 'completed';
    evaluation.completedAt = new Date();
    await evaluation.save();

    await createNotification({
      recipientId: evaluation.employeeId,
      senderId: req.user.id,
      type: 'EVALUATION_COMPLETED',
      title: 'Evaluation Completed',
      message: `Your performance evaluation for ${evaluation.period} is complete. Final score: ${evaluation.finalScore}/100.`,
      link: '/evaluation-list',
    });

    await createAuditLog({
      entityType: 'evaluation',
      entityId: evaluation._id,
      action: 'complete',
      performedBy: req.user.id,
      description: `Evaluation completed with final score ${evaluation.finalScore}.`,
    });

    res.json({ success: true, evaluation });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.acknowledgeEvaluation = async (req, res) => {
  try {
    const evaluation = await Evaluation.findById(req.params.id);
    if (!evaluation) {
      return res.status(404).json({ success: false, message: 'Evaluation not found.' });
    }

    if (String(evaluation.employeeId) !== String(req.user.id)) {
      return res.status(403).json({ success: false, message: 'Only the evaluated employee can acknowledge this evaluation.' });
    }

    if (!['submitted', 'approved', 'completed'].includes(evaluation.status)) {
      return res.status(400).json({ success: false, message: 'Evaluation has not been submitted yet.' });
    }

    evaluation.employeeAcknowledgment = {
      acknowledged: true,
      date: new Date(),
    };
    await evaluation.save();

    res.json({ success: true, evaluation });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getRubric = async (req, res) => {
  res.json({ success: true, rubric: getFullRubric() });
};
