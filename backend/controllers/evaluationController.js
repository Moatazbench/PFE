const Evaluation = require('../models/Evaluation');
const Goal = require('../models/Goal');
const GoalReview = require('../models/GoalReview');
const Cycle = require('../models/Cycle');
const User = require('../models/User');
const Team = require('../models/Team');
const { createNotification } = require('../utils/notificationHelper');
const { createAuditLog } = require('../utils/auditHelper');

// ============================================================
//  SCORING ALGORITHM
// ============================================================

/**
 * Map achievement percentage (0-100) to rubric score (1-10)
 * Bands:
 *   0-30%  → 1.0 - 3.0  (Unsatisfactory)
 *   30-50% → 3.0 - 5.0  (Needs Improvement)
 *   50-75% → 5.0 - 6.0  (Meets Expectations)
 *   75-90% → 6.0 - 8.0  (Good/Exceeds)
 *   90-100%→ 8.0 - 10.0 (Exceptional)
 */
function mapPercentToScore(percent) {
  if (percent <= 0) return 1.0;
  if (percent >= 100) return 10.0;

  if (percent <= 30) {
    return 1.0 + (percent / 30) * 2.0;
  } else if (percent <= 50) {
    return 3.0 + ((percent - 30) / 20) * 2.0;
  } else if (percent <= 75) {
    return 5.0 + ((percent - 50) / 25) * 1.0;
  } else if (percent <= 90) {
    return 6.0 + ((percent - 75) / 15) * 2.0;
  } else {
    return 8.0 + ((percent - 90) / 10) * 2.0;
  }
}

/**
 * Calculate suggested score from goal assessments
 */
function calculateSuggestedScore(goalAssessments, goals, method) {
  if (!goalAssessments || goalAssessments.length === 0) return null;

  const reviewedAssessments = goalAssessments.filter(a => a.reviewed);
  if (reviewedAssessments.length === 0) return null;

  // Build a map of goal weights
  const goalMap = {};
  goals.forEach(g => {
    goalMap[String(g._id)] = g;
  });

  if (method === 'weighted_average') {
    let weightedSum = 0;
    let totalWeight = 0;

    reviewedAssessments.forEach(a => {
      const goal = goalMap[String(a.goalId)];
      const weight = goal ? (goal.weight || 0) : 0;
      weightedSum += a.achievementPercent * weight;
      totalWeight += weight;
    });

    if (totalWeight === 0) {
      // Fall back to simple average
      const sum = reviewedAssessments.reduce((s, a) => s + a.achievementPercent, 0);
      const avg = sum / reviewedAssessments.length;
      return Number(mapPercentToScore(avg).toFixed(1));
    }

    const weightedAvg = weightedSum / totalWeight;
    return Number(mapPercentToScore(weightedAvg).toFixed(1));
  }

  // Simple average
  const sum = reviewedAssessments.reduce((s, a) => s + a.achievementPercent, 0);
  const avg = sum / reviewedAssessments.length;
  return Number(mapPercentToScore(avg).toFixed(1));
}

/**
 * Get the rubric band label for a score
 */
function getRubricBand(score) {
  if (score == null) return null;
  if (score < 3) return { label: 'Unsatisfactory', range: '0-30%', color: '#ef4444' };
  if (score < 5) return { label: 'Needs Improvement', range: '30-50%', color: '#f97316' };
  if (score < 6) return { label: 'Meets Expectations', range: '50-75%', color: '#eab308' };
  if (score < 8) return { label: 'Good / Exceeds Expectations', range: '75-90%', color: '#22c55e' };
  return { label: 'Exceptional', range: '90-100%', color: '#8b5cf6' };
}

// ============================================================
//  RBAC HELPERS
// ============================================================

async function isManagerOf(managerId, employeeId) {
  // Check direct manager relationship
  const employee = await User.findById(employeeId);
  if (!employee) return false;
  if (employee.manager && String(employee.manager) === String(managerId)) return true;

  // Check team leadership
  const team = await Team.findOne({ leader: managerId, members: employeeId });
  if (team) return true;

  return false;
}

// ============================================================
//  EXPORTED HANDLERS
// ============================================================

/**
 * POST /api/evaluations — Create a new evaluation
 */
exports.createEvaluation = async (req, res) => {
  try {
    const { employeeId, cycleId, period, scoringMethod } = req.body;
    const evaluatorId = req.user.id;

    // RBAC: must be manager of the employee, or ADMIN/HR
    if (!['ADMIN', 'HR'].includes(req.user.role)) {
      const isManager = await isManagerOf(evaluatorId, employeeId);
      if (!isManager) {
        return res.status(403).json({ success: false, message: 'You can only evaluate your direct reports' });
      }
    }

    // Check if evaluation already exists for this employee+cycle
    const existing = await Evaluation.findOne({ employeeId, cycleId });
    if (existing) {
      return res.status(400).json({ success: false, message: 'An evaluation already exists for this employee in this cycle' });
    }

    // Verify cycle exists
    const cycle = await Cycle.findById(cycleId);
    if (!cycle) {
      return res.status(404).json({ success: false, message: 'Cycle not found' });
    }

    // Get employee goals for this cycle
    const goals = await Goal.find({
      employeeId,
      cycleId,
      status: { $in: ['approved', 'midyear_assessed', 'final_evaluated', 'locked'] },
    });

    // Build goal assessments - pre-populate with existing data
    const goalAssessments = [];
    for (const goal of goals) {
      // Try to get existing end-year review data
      const endyearReview = await GoalReview.findOne({
        goalId: goal._id,
        phase: 'endyear',
        reviewType: 'manager_assessment',
      });

      goalAssessments.push({
        goalId: goal._id,
        achievementPercent: goal.finalCompletion || goal.currentProgress || 0,
        goalStatus: goal.finalCompletion >= 100 ? 'exceeded' :
                    goal.finalCompletion >= 75 ? 'completed' :
                    goal.finalCompletion > 0 ? 'in_progress' : 'not_started',
        comments: endyearReview ? endyearReview.comment : '',
        reviewed: false,
      });
    }

    const evaluation = new Evaluation({
      employeeId,
      evaluatorId,
      cycleId,
      period: period || `${cycle.name} ${cycle.year}`,
      status: 'draft',
      scoringMethod: scoringMethod || 'weighted_average',
      goalAssessments,
    });

    // Calculate initial suggested score
    evaluation.suggestedScore = calculateSuggestedScore(goalAssessments, goals, evaluation.scoringMethod);

    await evaluation.save();

    // Send notification to employee
    createNotification({
      recipientId: employeeId,
      senderId: evaluatorId,
      type: 'EVALUATION_CREATED',
      title: 'Evaluation Started',
      message: `Your manager has started your performance evaluation for ${evaluation.period}.`,
      link: '/evaluation-list',
    });

    createAuditLog({
      entityType: 'evaluation',
      entityId: evaluation._id,
      action: 'create',
      performedBy: evaluatorId,
      description: `Evaluation created for employee`,
    });

    const populated = await Evaluation.findById(evaluation._id)
      .populate('employeeId', 'name email role')
      .populate('evaluatorId', 'name email role')
      .populate('cycleId', 'name year currentPhase')
      .populate('goalAssessments.goalId', 'title description category weight metric targetValue currentProgress finalCompletion status');

    res.status(201).json({ success: true, evaluation: populated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * GET /api/evaluations/:id — Get a single evaluation
 */
exports.getEvaluation = async (req, res) => {
  try {
    const evaluation = await Evaluation.findById(req.params.id)
      .populate('employeeId', 'name email role team')
      .populate('evaluatorId', 'name email role')
      .populate('cycleId', 'name year currentPhase status')
      .populate('goalAssessments.goalId', 'title description category weight metric targetValue currentProgress finalCompletion status dueDate priority')
      .populate('approvals.approverId', 'name email role')
      .populate('scoreHistory.changedBy', 'name email');

    if (!evaluation) {
      return res.status(404).json({ success: false, message: 'Evaluation not found' });
    }

    // RBAC: employee can see their own, evaluator can see theirs, HR/ADMIN can see all
    const userId = String(req.user.id);
    const isEmployee = String(evaluation.employeeId._id) === userId;
    const isEvaluator = String(evaluation.evaluatorId._id) === userId;
    const isPrivileged = ['ADMIN', 'HR'].includes(req.user.role);

    if (!isEmployee && !isEvaluator && !isPrivileged) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    // Include rubric band info
    const rubricBand = getRubricBand(evaluation.finalScore || evaluation.suggestedScore);

    res.json({
      success: true,
      evaluation,
      rubricBand,
      rubric: getFullRubric(),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * GET /api/evaluations/employee/:employeeId — Get evaluations for an employee
 */
exports.getMyEvaluations = async (req, res) => {
  try {
    const { employeeId } = req.params;

    // RBAC: can only view own evaluations unless ADMIN/HR
    if (String(req.user.id) !== employeeId && !['ADMIN', 'HR'].includes(req.user.role)) {
      // Check if they're the manager
      const isManager = await isManagerOf(req.user.id, employeeId);
      if (!isManager) {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }
    }

    const evaluations = await Evaluation.find({ employeeId })
      .populate('employeeId', 'name email role')
      .populate('evaluatorId', 'name email role')
      .populate('cycleId', 'name year currentPhase')
      .sort({ createdAt: -1 });

    res.json({ success: true, evaluations });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * GET /api/evaluations/evaluator/:evaluatorId — Get evaluations created by a manager
 */
exports.getEvaluatorEvaluations = async (req, res) => {
  try {
    const { evaluatorId } = req.params;

    if (String(req.user.id) !== evaluatorId && !['ADMIN', 'HR'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const filter = { evaluatorId };
    if (req.query.cycleId) filter.cycleId = req.query.cycleId;
    if (req.query.status) filter.status = req.query.status;

    const evaluations = await Evaluation.find(filter)
      .populate('employeeId', 'name email role')
      .populate('evaluatorId', 'name email role')
      .populate('cycleId', 'name year currentPhase')
      .sort({ createdAt: -1 });

    res.json({ success: true, evaluations });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * GET /api/evaluations — Get all evaluations (with filters)
 */
exports.getAllEvaluations = async (req, res) => {
  try {
    const filter = {};
    if (req.query.cycleId) filter.cycleId = req.query.cycleId;
    if (req.query.status) filter.status = req.query.status;
    if (req.query.employeeId) filter.employeeId = req.query.employeeId;
    if (req.query.evaluatorId) filter.evaluatorId = req.query.evaluatorId;

    // RBAC scoping
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
    // ADMIN and HR see all

    const evaluations = await Evaluation.find(filter)
      .populate('employeeId', 'name email role')
      .populate('evaluatorId', 'name email role')
      .populate('cycleId', 'name year currentPhase')
      .sort({ createdAt: -1 });

    res.json({ success: true, evaluations });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * PUT /api/evaluations/:id — Update evaluation (comments, feedback, score)
 */
exports.updateEvaluation = async (req, res) => {
  try {
    const evaluation = await Evaluation.findById(req.params.id);
    if (!evaluation) return res.status(404).json({ success: false, message: 'Evaluation not found' });

    // Only evaluator or ADMIN can update
    if (String(evaluation.evaluatorId) !== String(req.user.id) && req.user.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Only the evaluator can update this evaluation' });
    }

    // Only updatable in draft or in_progress or rejected status
    if (!['draft', 'in_progress', 'rejected'].includes(evaluation.status)) {
      return res.status(400).json({ success: false, message: 'Evaluation cannot be modified in its current status' });
    }

    const allowedFields = [
      'overallComments', 'strengths', 'areasForImprovement',
      'developmentRecommendations', 'nextSteps', 'scoringMethod', 'period',
    ];

    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) evaluation[field] = req.body[field];
    });

    // Handle final score update with history tracking
    if (req.body.finalScore !== undefined) {
      const newScore = parseFloat(req.body.finalScore);
      if (isNaN(newScore) || newScore < 1 || newScore > 10) {
        return res.status(400).json({ success: false, message: 'Final score must be between 1 and 10' });
      }

      evaluation.scoreHistory.push({
        previousScore: evaluation.finalScore,
        newScore: newScore,
        changedBy: req.user.id,
        reason: req.body.scoreChangeReason || 'Manual update',
      });

      evaluation.finalScore = newScore;
    }

    // Recalculate if scoring method changed
    if (req.body.scoringMethod) {
      const goals = await Goal.find({
        _id: { $in: evaluation.goalAssessments.map(a => a.goalId) },
      });
      evaluation.suggestedScore = calculateSuggestedScore(evaluation.goalAssessments, goals, evaluation.scoringMethod);
    }

    // Move to in_progress if was draft
    if (evaluation.status === 'draft') {
      evaluation.status = 'in_progress';
    }

    await evaluation.save();

    const populated = await Evaluation.findById(evaluation._id)
      .populate('employeeId', 'name email role')
      .populate('evaluatorId', 'name email role')
      .populate('cycleId', 'name year currentPhase')
      .populate('goalAssessments.goalId', 'title description category weight metric targetValue currentProgress finalCompletion status');

    res.json({ success: true, evaluation: populated, rubricBand: getRubricBand(evaluation.finalScore || evaluation.suggestedScore) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * PATCH /api/evaluations/:id/goal/:goalId — Update a single goal assessment
 */
exports.updateGoalAssessment = async (req, res) => {
  try {
    const evaluation = await Evaluation.findById(req.params.id);
    if (!evaluation) return res.status(404).json({ success: false, message: 'Evaluation not found' });

    if (String(evaluation.evaluatorId) !== String(req.user.id) && req.user.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    if (!['draft', 'in_progress', 'rejected'].includes(evaluation.status)) {
      return res.status(400).json({ success: false, message: 'Evaluation cannot be modified in its current status' });
    }

    const assessment = evaluation.goalAssessments.find(
      a => String(a.goalId) === req.params.goalId
    );

    if (!assessment) {
      return res.status(404).json({ success: false, message: 'Goal assessment not found in this evaluation' });
    }

    // Update fields
    if (req.body.achievementPercent !== undefined) {
      const pct = parseFloat(req.body.achievementPercent);
      if (isNaN(pct) || pct < 0 || pct > 100) {
        return res.status(400).json({ success: false, message: 'Achievement must be between 0 and 100' });
      }
      assessment.achievementPercent = pct;
    }
    if (req.body.goalStatus !== undefined) assessment.goalStatus = req.body.goalStatus;
    if (req.body.comments !== undefined) assessment.comments = req.body.comments;

    assessment.reviewed = true;

    // Move to in_progress if draft
    if (evaluation.status === 'draft') {
      evaluation.status = 'in_progress';
    }

    // Recalculate suggested score
    const goals = await Goal.find({
      _id: { $in: evaluation.goalAssessments.map(a => a.goalId) },
    });
    evaluation.suggestedScore = calculateSuggestedScore(evaluation.goalAssessments, goals, evaluation.scoringMethod);

    await evaluation.save();

    const populated = await Evaluation.findById(evaluation._id)
      .populate('employeeId', 'name email role')
      .populate('evaluatorId', 'name email role')
      .populate('cycleId', 'name year currentPhase')
      .populate('goalAssessments.goalId', 'title description category weight metric targetValue currentProgress finalCompletion status');

    res.json({
      success: true,
      evaluation: populated,
      suggestedScore: evaluation.suggestedScore,
      rubricBand: getRubricBand(evaluation.finalScore || evaluation.suggestedScore),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * POST /api/evaluations/:id/submit — Submit the evaluation
 */
exports.submitEvaluation = async (req, res) => {
  try {
    const evaluation = await Evaluation.findById(req.params.id);
    if (!evaluation) return res.status(404).json({ success: false, message: 'Evaluation not found' });

    if (String(evaluation.evaluatorId) !== String(req.user.id) && req.user.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Only the evaluator can submit' });
    }

    if (!['draft', 'in_progress', 'rejected'].includes(evaluation.status)) {
      return res.status(400).json({ success: false, message: 'Evaluation cannot be submitted in its current status' });
    }

    // Validate: all goals must be reviewed
    const unreviewedCount = evaluation.goalAssessments.filter(a => !a.reviewed).length;
    if (unreviewedCount > 0) {
      return res.status(400).json({
        success: false,
        message: `${unreviewedCount} goal(s) have not been reviewed yet`,
      });
    }

    // Validate: final score must be set
    if (!evaluation.finalScore && !evaluation.suggestedScore) {
      return res.status(400).json({ success: false, message: 'A final score must be assigned before submitting' });
    }

    // If no manual score set, use suggested
    if (!evaluation.finalScore) {
      evaluation.finalScore = evaluation.suggestedScore;
    }

    evaluation.status = 'submitted';
    evaluation.submittedAt = new Date();
    await evaluation.save();

    // Notify employee
    createNotification({
      recipientId: evaluation.employeeId,
      senderId: req.user.id,
      type: 'EVALUATION_SUBMITTED',
      title: 'Evaluation Submitted',
      message: `Your performance evaluation for ${evaluation.period} has been submitted.`,
      link: '/evaluation-list',
    });

    createAuditLog({
      entityType: 'evaluation',
      entityId: evaluation._id,
      action: 'submit',
      performedBy: req.user.id,
      description: `Evaluation submitted with score ${evaluation.finalScore}`,
    });

    res.json({ success: true, evaluation });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * POST /api/evaluations/:id/approve — Approve (HR/Admin)
 */
exports.approveEvaluation = async (req, res) => {
  try {
    const evaluation = await Evaluation.findById(req.params.id);
    if (!evaluation) return res.status(404).json({ success: false, message: 'Evaluation not found' });

    if (evaluation.status !== 'submitted') {
      return res.status(400).json({ success: false, message: 'Only submitted evaluations can be approved' });
    }

    evaluation.status = 'approved';
    evaluation.approvals.push({
      approverId: req.user.id,
      status: 'approved',
      comments: req.body.comments || '',
      date: new Date(),
    });

    await evaluation.save();

    // Notify evaluator and employee
    createNotification({
      recipientId: evaluation.evaluatorId,
      senderId: req.user.id,
      type: 'EVALUATION_APPROVED',
      title: 'Evaluation Approved',
      message: `The evaluation you submitted has been approved.`,
      link: '/evaluation-list',
    });
    createNotification({
      recipientId: evaluation.employeeId,
      senderId: req.user.id,
      type: 'EVALUATION_APPROVED',
      title: 'Evaluation Approved',
      message: `Your performance evaluation for ${evaluation.period} has been approved.`,
      link: '/evaluation-list',
    });

    createAuditLog({
      entityType: 'evaluation',
      entityId: evaluation._id,
      action: 'approve',
      performedBy: req.user.id,
      description: 'Evaluation approved',
    });

    res.json({ success: true, evaluation });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * POST /api/evaluations/:id/reject — Reject (HR/Admin)
 */
exports.rejectEvaluation = async (req, res) => {
  try {
    const evaluation = await Evaluation.findById(req.params.id);
    if (!evaluation) return res.status(404).json({ success: false, message: 'Evaluation not found' });

    if (evaluation.status !== 'submitted') {
      return res.status(400).json({ success: false, message: 'Only submitted evaluations can be rejected' });
    }

    evaluation.status = 'rejected';
    evaluation.approvals.push({
      approverId: req.user.id,
      status: 'rejected',
      comments: req.body.comments || 'Needs revision',
      date: new Date(),
    });

    await evaluation.save();

    createNotification({
      recipientId: evaluation.evaluatorId,
      senderId: req.user.id,
      type: 'EVALUATION_REJECTED',
      title: 'Evaluation Rejected',
      message: `The evaluation you submitted was rejected: ${req.body.comments || 'Needs revision'}`,
      link: '/evaluation-list',
    });

    createAuditLog({
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

/**
 * POST /api/evaluations/:id/complete — Complete after approval
 */
exports.completeEvaluation = async (req, res) => {
  try {
    const evaluation = await Evaluation.findById(req.params.id);
    if (!evaluation) return res.status(404).json({ success: false, message: 'Evaluation not found' });

    if (evaluation.status !== 'approved') {
      return res.status(400).json({ success: false, message: 'Only approved evaluations can be completed' });
    }

    evaluation.status = 'completed';
    evaluation.completedAt = new Date();
    await evaluation.save();

    createNotification({
      recipientId: evaluation.employeeId,
      senderId: req.user.id,
      type: 'EVALUATION_COMPLETED',
      title: 'Evaluation Completed',
      message: `Your performance evaluation for ${evaluation.period} is now complete. Your score: ${evaluation.finalScore}/10.`,
      link: '/evaluation-list',
    });

    createAuditLog({
      entityType: 'evaluation',
      entityId: evaluation._id,
      action: 'complete',
      performedBy: req.user.id,
      description: `Evaluation completed with final score ${evaluation.finalScore}`,
    });

    res.json({ success: true, evaluation });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * POST /api/evaluations/:id/acknowledge — Employee acknowledges evaluation
 */
exports.acknowledgeEvaluation = async (req, res) => {
  try {
    const evaluation = await Evaluation.findById(req.params.id);
    if (!evaluation) return res.status(404).json({ success: false, message: 'Evaluation not found' });

    if (String(evaluation.employeeId) !== String(req.user.id)) {
      return res.status(403).json({ success: false, message: 'Only the evaluated employee can acknowledge' });
    }

    if (!['submitted', 'approved', 'completed'].includes(evaluation.status)) {
      return res.status(400).json({ success: false, message: 'Evaluation has not been submitted yet' });
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

/**
 * GET /api/evaluations/rubric — Return the scoring rubric
 */
exports.getRubric = async (req, res) => {
  res.json({ success: true, rubric: getFullRubric() });
};

function getFullRubric() {
  return [
    { min: 1, max: 3, label: 'Unsatisfactory', range: '0-30%', color: '#ef4444', description: 'Performance is significantly below expectations. Goals were largely unmet.' },
    { min: 3, max: 5, label: 'Needs Improvement', range: '30-50%', color: '#f97316', description: 'Performance is below expectations. Some goals met but significant gaps remain.' },
    { min: 5, max: 6, label: 'Meets Expectations', range: '50-75%', color: '#eab308', description: 'Performance meets the basic requirements. Core goals are achieved.' },
    { min: 6, max: 8, label: 'Good / Exceeds Expectations', range: '75-90%', color: '#22c55e', description: 'Performance exceeds expectations. Most goals achieved with high quality.' },
    { min: 8, max: 10, label: 'Exceptional', range: '90-100%', color: '#8b5cf6', description: 'Outstanding performance. All goals exceeded. Contributes beyond role.' },
  ];
}
