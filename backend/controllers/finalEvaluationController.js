const FinalEvaluation = require('../models/FinalEvaluation');
const ImprovementPlan = require('../models/ImprovementPlan');
const Objective = require('../models/Objective');
const CheckIn = require('../models/CheckIn');
const User = require('../models/User');
const Cycle = require('../models/Cycle');
const Team = require('../models/Team');
const BonusPenalty = require('../models/BonusPenalty');
const CareerRecommendation = require('../models/CareerRecommendation');
const {
  calculateWeightedObjectiveScore,
  getEvaluationEvidence,
  determineRatingLabel
} = require('../services/scoreCalculationService');
const aiService = require('../services/aiService');
const reviewContextService = require('../services/reviewContextService');
const auditLogger = require('../utils/auditLogger');
const { createNotification } = require('../utils/notificationHelper');
const {
  buildEvaluationReviewChecklist,
  getBlockingEvaluationReviewIssues
} = require('../utils/workflowRules');

const SIGNIFICANT_SCORE_ADJUSTMENT = 10;
const EXCLUDED_EVALUATION_OBJECTIVE_STATUSES = ['draft', 'rejected', 'cancelled', 'archived'];

function roundScore(value) {
  return Number(Number(value || 0).toFixed(2));
}

async function calculateEvaluationSnapshot(employeeId, cycleId) {
  const scoring = await calculateWeightedObjectiveScore(employeeId, cycleId);
  const objectiveIds = scoring.breakdown.map((item) => item.objective_id).filter(Boolean);
  const evidence = await getEvaluationEvidence(employeeId, cycleId, objectiveIds);
  return { scoring, evidence };
}

function applyEvaluationSnapshot(evaluation, snapshot) {
  evaluation.auto_score = snapshot.scoring.score;
  evaluation.objective_weight_total = snapshot.scoring.totalWeight;
  evaluation.objective_score_normalized = snapshot.scoring.normalized;
  evaluation.objective_breakdown = snapshot.scoring.breakdown;
  evaluation.evidence_summary = snapshot.evidence;

  const resolvedScore = evaluation.manager_score != null
    ? Number(evaluation.manager_score)
    : snapshot.scoring.score;
  evaluation.final_score = roundScore(resolvedScore);
  evaluation.score_difference = roundScore(evaluation.final_score - evaluation.auto_score);
  evaluation.rating_label = determineRatingLabel(evaluation.final_score);
}

async function buildConsistencyWarnings(evaluation) {
  const warnings = [];
  const expectedRating = determineRatingLabel(evaluation.final_score);
  const difference = Math.abs(Number(evaluation.final_score || 0) - Number(evaluation.auto_score || 0));
  const [improvementPlanExists, bonusDocumentationExists, careerRecommendationExists] = await Promise.all([
    ImprovementPlan.exists({ evaluation_id: evaluation._id }),
    BonusPenalty.exists({
      finalEvaluation: evaluation._id,
      reason: { $type: 'string', $ne: '' }
    }),
    CareerRecommendation.exists({
      employee_id: evaluation.employee_id,
      cycle_id: evaluation.cycle_id
    })
  ]);

  if (evaluation.objective_score_normalized) {
    warnings.push(`Objective weights total ${evaluation.objective_weight_total}%, so the suggested score was normalized to 100%.`);
  }
  if (evaluation.rating_label !== expectedRating) {
    warnings.push(`Rating should be ${humanizeRatingLabel(expectedRating)} for a score of ${roundScore(evaluation.final_score)}%.`);
  }
  if (difference >= SIGNIFICANT_SCORE_ADJUSTMENT && !String(evaluation.manager_adjustment_justification || '').trim()) {
    warnings.push(`Manager score differs from the suggested score by ${roundScore(difference)} points without justification.`);
  }
  if (!String(evaluation.manager_comments || '').trim()) {
    warnings.push('Manager final comments are missing.');
  }
  if (Number(evaluation.final_score || 0) < 50) {
    if (!improvementPlanExists) warnings.push('Low performance has no improvement plan yet.');
  }

  const reviewWarnings = buildEvaluationReviewChecklist(evaluation, {
    hasImprovementPlan: improvementPlanExists,
    hasBonusDocumentation: Boolean(bonusDocumentationExists),
    hasCareerRecommendation: Boolean(careerRecommendationExists),
  });

  return [...warnings, ...reviewWarnings.filter((item) => !warnings.includes(item))];
}

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

async function canManageEmployeeEvaluation(actor, employeeId) {
  if (['ADMIN', 'HR'].includes(actor.role)) {
    return true;
  }

  if (actor.role === 'TEAM_LEADER') {
    const managedEmployeeIds = await getManagedEmployeeIds(actor);
    return managedEmployeeIds.includes(String(employeeId));
  }

  return false;
}

async function enforcePhase3Evaluation(cycleId) {
  const cycle = await Cycle.findById(cycleId).select('currentPhase status');
  if (!cycle) {
    return { error: true, status: 404, message: 'Cycle not found.' };
  }

  if (cycle.status === 'draft' || cycle.currentPhase !== 'phase3') {
    return { error: true, status: 403, message: 'End-Year Review is only available during Phase 3.' };
  }

  return { error: false, cycle };
}

async function enforceEvaluationView(cycleId) {
  const cycle = await Cycle.findById(cycleId).select('currentPhase status');
  if (!cycle) {
    return { error: true, status: 404, message: 'Cycle not found.' };
  }

  if (cycle.status === 'draft' || !['phase3', 'closed'].includes(cycle.currentPhase)) {
    return { error: true, status: 403, message: 'End-Year Review data is only available during Phase 3 or after the cycle is closed.' };
  }

  return { error: false, cycle };
}

function normalizeDraftList(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item || '').trim())
      .filter(Boolean);
  }

  const normalized = String(value || '').trim();
  if (!normalized) return [];

  return normalized
    .split(/\r?\n|(?:\s*[•\u2022]\s*)|(?:\s*;\s*)/)
    .map((item) => item.replace(/^[-*]\s*/, '').trim())
    .filter(Boolean);
}

function humanizeRatingLabel(label) {
  return String(label || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function humanizePerformanceStatus(status) {
  return String(status || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function buildManagerComments(summary, rationale, warning) {
  return [summary, rationale ? `Rating rationale: ${rationale}` : '', warning ? `Note: ${warning}` : '']
    .filter(Boolean)
    .join('\n\n');
}

function buildManagerReviewFallback(context, autoScore, ratingLabel) {
  const employeeName = context?.employee?.name || 'This employee';
  const objectives = Array.isArray(context?.objectives) ? context.objectives : [];
  const feedbacks = Array.isArray(context?.feedbacks) ? context.feedbacks : [];
  const meetings = Array.isArray(context?.meetings) ? context.meetings : [];
  const completedObjectives = objectives.filter((objective) => Number(objective.achievementPercent || 0) >= 80);
  const atRiskObjectives = objectives.filter((objective) => Number(objective.achievementPercent || 0) < 60);
  const averageAchievement = objectives.length
    ? Math.round(objectives.reduce((sum, objective) => sum + Number(objective.achievementPercent || 0), 0) / objectives.length)
    : 0;

  return {
    performance_summary: `${employeeName} finished the cycle with an auto-calculated score of ${Number(autoScore || 0).toFixed(1)}% and an average objective achievement of ${averageAchievement}%. ${completedObjectives.length > 0 ? `Top delivery came from ${completedObjectives.slice(0, 2).map((objective) => objective.title).join(' and ')}.` : 'Objective completion data shows mixed delivery across the cycle.'}`,
    strengths: completedObjectives.length > 0
      ? completedObjectives.slice(0, 3).map((objective) => `${objective.title} showed strong execution (${Number(objective.achievementPercent || 0)}% achievement).`)
      : ['Maintained participation across assigned objectives during the cycle.'],
    areas_for_improvement: atRiskObjectives.length > 0
      ? atRiskObjectives.slice(0, 3).map((objective) => `${objective.title} needs stronger follow-through (${Number(objective.achievementPercent || 0)}% achievement).`)
      : ['Continue improving consistency and documenting impact across key objectives.'],
    recommended_rating_rationale: `The current draft rating is ${humanizeRatingLabel(ratingLabel)} based on the auto-score, objective completion pattern, ${feedbacks.length} recent feedback item(s), and ${meetings.length} recent review/check-in meeting(s).`,
    development_actions: atRiskObjectives.length > 0
      ? atRiskObjectives.slice(0, 3).map((objective) => `Create a focused action plan for ${objective.title} with clear milestones and manager checkpoints next cycle.`)
      : ['Set 2-3 measurable growth goals for the next cycle and review progress monthly.'],
    warning: aiService.isConfigured() ? '' : 'AI provider unavailable. This report was generated from existing performance data using the built-in fallback summary.',
  };
}

async function generateManagerDraft(employeeId, cycleId, autoScore, ratingLabel, snapshot) {
  const context = await reviewContextService.buildReviewContext({ employeeId, cycleId });
  context.evaluationDecision = {
    suggestedScore: autoScore,
    ratingLabel,
    objectiveWeightTotal: snapshot?.scoring?.totalWeight ?? null,
    objectiveScoreNormalized: Boolean(snapshot?.scoring?.normalized),
    objectiveBreakdown: snapshot?.scoring?.breakdown || [],
    evidenceSummary: snapshot?.evidence || null,
  };
  const fallbackReview = buildManagerReviewFallback(context, autoScore, ratingLabel);

  if (aiService.isConfigured()) {
    const aiDraft = await aiService.generateManagerReview(context);

    if (aiDraft?.warning) {
      return {
        review: {
          ...fallbackReview,
          warning: 'AI provider unavailable. This report was generated from existing performance data using the built-in fallback summary.',
        },
        usedFallback: true,
      };
    }

    return {
      review: aiDraft,
      usedFallback: false,
    };
  }

  return {
    review: fallbackReview,
    usedFallback: true,
  };
}

exports.getEvaluation = async (req, res) => {
  try {
    const { cycle_id, employee_id } = req.params;
    const viewCheck = await enforceEvaluationView(cycle_id);
    if (viewCheck.error) return res.status(viewCheck.status).json({ success: false, message: viewCheck.message });
    
    // Check permissions
    if (req.user.role === 'COLLABORATOR' && String(req.user.id) !== String(employee_id)) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    if (req.user.role === 'TEAM_LEADER') {
      const canManage = await canManageEmployeeEvaluation(req.user, employee_id);
      const isSelf = String(req.user.id || req.user._id) === String(employee_id);
      if (!canManage && !isSelf) {
        return res.status(403).json({ success: false, message: 'Forbidden' });
      }
    }

    const evaluation = await FinalEvaluation.findOne({ cycle_id, employee_id })
      .populate('employee_id', 'name email profileImage')
      .populate('evaluator_id', 'name role')
      .populate('hr_validated_by', 'name')
      .populate('workflow_history.performed_by', 'name role');

    const improvementPlans = evaluation
      ? await ImprovementPlan.find({ evaluation_id: evaluation._id })
        .populate('created_by', 'name')
        .populate('updated_by', 'name')
        .sort({ createdAt: -1 })
      : [];

    res.json({ success: true, evaluation, improvementPlans });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getUserHistory = async (req, res) => {
  try {
    const { employee_id } = req.params;

    if (req.user.role === 'COLLABORATOR' && String(req.user.id) !== String(employee_id)) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const evaluations = await FinalEvaluation.find({
      employee_id,
      status: { $in: ['validated', 'closed'] }
    })
      .populate('cycle_id', 'name year currentPhase status')
      .populate('evaluator_id', 'name role')
      .sort({ createdAt: 1 });

    res.json({ success: true, evaluations });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getTeamEvaluations = async (req, res) => {
  try {
    const { cycle_id } = req.params;
    const phaseCheck = await enforceEvaluationView(cycle_id);
    if (phaseCheck.error) return res.status(phaseCheck.status).json({ success: false, message: phaseCheck.message });
    
    let teamMembers = [];

    if (req.user.role === 'TEAM_LEADER') {
      const managedEmployeeIds = await getManagedEmployeeIds(req.user);
      teamMembers = await User.find({ _id: { $in: managedEmployeeIds }, isDeleted: false }).select('_id name email profileImage');
    } else {
      const objectiveOwners = await Objective.distinct('owner', { cycle: cycle_id });
      teamMembers = await User.find({
        _id: { $in: objectiveOwners },
        role: { $ne: 'ADMIN' },
        isDeleted: false
      }).select('_id name email profileImage');
    }

    const memberIds = teamMembers.map(m => m._id);

    const evaluations = await FinalEvaluation.find({ cycle_id, employee_id: { $in: memberIds } })
      .populate('employee_id', 'name email profileImage')
      .populate('evaluator_id', 'name role');
      
    res.json({ success: true, evaluations, teamMembers });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.generateEvaluation = async (req, res) => {
  try {
    const { employee_id, cycle_id } = req.params;
    const phaseCheck = await enforcePhase3Evaluation(cycle_id);
    if (phaseCheck.error) return res.status(phaseCheck.status).json({ success: false, message: phaseCheck.message });

    const canManage = await canManageEmployeeEvaluation(req.user, employee_id);
    if (!canManage) {
      return res.status(403).json({ success: false, message: 'You can only evaluate your own team members.' });
    }
    
    let evaluation = await FinalEvaluation.findOne({ employee_id, cycle_id });
    if (evaluation && evaluation.status !== 'draft') {
      return res.status(400).json({ success: false, message: 'Evaluation already exists and is not in draft' });
    }

    const snapshot = await calculateEvaluationSnapshot(employee_id, cycle_id);
    const auto_score = snapshot.scoring.score;
    const rating_label = determineRatingLabel(auto_score);
    const { review, usedFallback } = await generateManagerDraft(employee_id, cycle_id, auto_score, rating_label, snapshot);

    if (evaluation) {
      evaluation.manager_score = null;
      evaluation.manager_adjustment_justification = '';
      applyEvaluationSnapshot(evaluation, snapshot);
      evaluation.evaluator_id = req.user.id || req.user._id;
      evaluation.evaluator_role = req.user.role;
      evaluation.evaluated_at = new Date();
      evaluation.strengths = normalizeDraftList(review?.strengths);
      evaluation.weaknesses = normalizeDraftList(review?.areas_for_improvement);
      evaluation.improvement_suggestions = normalizeDraftList(review?.development_actions);
      evaluation.manager_comments = buildManagerComments(
        review?.performance_summary,
        review?.recommended_rating_rationale,
        review?.warning
      );
      evaluation.ai_assisted = !usedFallback;
      evaluation.ai_draft_generated_at = new Date();
      evaluation.consistency_warnings = await buildConsistencyWarnings(evaluation);
      await evaluation.save();
    } else {
      evaluation = new FinalEvaluation({
        employee_id,
        cycle_id,
        auto_score,
        final_score: auto_score,
        rating_label,
        objective_weight_total: snapshot.scoring.totalWeight,
        objective_score_normalized: snapshot.scoring.normalized,
        objective_breakdown: snapshot.scoring.breakdown,
        evidence_summary: snapshot.evidence,
        evaluator_id: req.user.id || req.user._id,
        evaluator_role: req.user.role,
        evaluated_at: new Date(),
        strengths: normalizeDraftList(review?.strengths),
        weaknesses: normalizeDraftList(review?.areas_for_improvement),
        improvement_suggestions: normalizeDraftList(review?.development_actions),
        manager_comments: buildManagerComments(
          review?.performance_summary,
          review?.recommended_rating_rationale,
          review?.warning
        ),
        ai_assisted: !usedFallback,
        ai_draft_generated_at: new Date(),
        status: 'draft'
      });
      evaluation.consistency_warnings = await buildConsistencyWarnings(evaluation);
      await evaluation.save();
    }

    await auditLogger.log(req.user.id, 'evaluation.generated', 'FinalEvaluation', evaluation._id, {
      employee_id,
      cycle_id,
      auto_score,
      aiDraftGenerated: !usedFallback,
      usedFallback
    });

    const populated = await FinalEvaluation.findById(evaluation._id).populate('employee_id', 'name');
    res.json({
      success: true,
      evaluation: populated,
      aiGenerated: !usedFallback,
      usedFallback,
      message: usedFallback
        ? 'Evaluation draft generated using the built-in fallback summary.'
        : 'AI-assisted evaluation draft generated successfully.'
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateEvaluation = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      manager_score,
      manager_adjustment_justification,
      recommendation,
      strengths,
      weaknesses,
      improvement_suggestions,
      manager_comments,
      status,
    } = req.body;

    const mongoose = require('mongoose');
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({ success: false, message: 'Evaluation not found' });
    }

    const evaluation = await FinalEvaluation.findById(id);
    if (!evaluation) return res.status(404).json({ success: false, message: 'Evaluation not found' });
    const phaseCheck = await enforcePhase3Evaluation(evaluation.cycle_id);
    if (phaseCheck.error) return res.status(phaseCheck.status).json({ success: false, message: phaseCheck.message });

    const canManage = await canManageEmployeeEvaluation(req.user, evaluation.employee_id);
    if (!canManage) {
      return res.status(403).json({ success: false, message: 'You can only evaluate your own team members.' });
    }

    if (evaluation.status === 'closed' || evaluation.status === 'validated') {
      return res.status(400).json({ success: false, message: 'Cannot edit validated or closed evaluation' });
    }
    if (evaluation.status === 'pending_hr' && status === 'pending_hr') {
      return res.status(409).json({
        success: false,
        message: 'This evaluation has already been submitted to HR review.'
      });
    }
    if (evaluation.status === 'pending_hr' && status !== undefined) {
      return res.status(400).json({
        success: false,
        message: 'This evaluation is locked while it awaits HR review.'
      });
    }

    if (manager_score !== undefined) {
      const parsedManagerScore = Number(manager_score);
      if (!Number.isFinite(parsedManagerScore) || parsedManagerScore < 0 || parsedManagerScore > 100) {
        return res.status(400).json({ success: false, message: 'Manager score must be between 0 and 100.' });
      }
      evaluation.manager_score = roundScore(parsedManagerScore);
      evaluation.final_score = evaluation.manager_score;
    }
    if (manager_adjustment_justification !== undefined) {
      evaluation.manager_adjustment_justification = String(manager_adjustment_justification || '').trim();
    }
    if (strengths !== undefined) evaluation.strengths = normalizeDraftList(strengths);
    if (weaknesses !== undefined) evaluation.weaknesses = normalizeDraftList(weaknesses);
    if (improvement_suggestions !== undefined) evaluation.improvement_suggestions = normalizeDraftList(improvement_suggestions);
    if (manager_comments !== undefined) evaluation.manager_comments = String(manager_comments || '').trim();
    if (recommendation) evaluation.recommendation = recommendation;
    if (status && !['draft', 'pending_hr'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid manager evaluation status.' });
    }

    const resolvedScore = evaluation.manager_score != null ? evaluation.manager_score : evaluation.auto_score;
    evaluation.final_score = roundScore(resolvedScore);
    evaluation.score_difference = roundScore(evaluation.final_score - evaluation.auto_score);
    evaluation.rating_label = determineRatingLabel(evaluation.final_score);

    const significantAdjustment = Math.abs(evaluation.score_difference) >= SIGNIFICANT_SCORE_ADJUSTMENT;
    if (significantAdjustment && !String(evaluation.manager_adjustment_justification || '').trim()) {
      return res.status(400).json({
        success: false,
        message: `A justification is required when the manager score differs by ${SIGNIFICANT_SCORE_ADJUSTMENT} points or more.`,
        errors: [{ field: 'manager_adjustment_justification', message: 'Explain the significant score adjustment.' }]
      });
    }
    if (status === 'pending_hr') {
      const submissionErrors = [];
      if (!String(evaluation.manager_comments || '').trim()) {
        submissionErrors.push({ field: 'manager_comments', message: 'Add final manager comments.' });
      }
      if (!Array.isArray(evaluation.strengths) || evaluation.strengths.length === 0) {
        submissionErrors.push({ field: 'strengths', message: 'Add at least one strength.' });
      }
      if (!Array.isArray(evaluation.weaknesses) || evaluation.weaknesses.length === 0) {
        submissionErrors.push({ field: 'weaknesses', message: 'Add at least one area for improvement.' });
      }
      if (!Array.isArray(evaluation.objective_breakdown) || evaluation.objective_breakdown.length === 0) {
        submissionErrors.push({ field: 'objectives', message: 'Objective contribution breakdown is missing. Recalculate or regenerate the final evaluation before submitting.' });
      }

      const objectives = await Objective.find({
        owner: evaluation.employee_id,
        cycle: evaluation.cycle_id,
        status: { $nin: EXCLUDED_EVALUATION_OBJECTIVE_STATUSES }
      }).select('title finalSelfSubmittedAt managerAdjustedPercent');
      const missingSelfAssessmentObjectives = objectives.filter((objective) => !objective.finalSelfSubmittedAt);
      const unconfirmedObjectives = objectives.filter((objective) => objective.managerAdjustedPercent == null);

      if (missingSelfAssessmentObjectives.length > 0) {
        submissionErrors.push(...missingSelfAssessmentObjectives.map((objective) => ({
          field: 'objectives',
          objectiveId: objective._id,
          message: `${objective.title}: employee self-assessment is missing.`
        })));
      }
      if (unconfirmedObjectives.length > 0) {
        submissionErrors.push(...unconfirmedObjectives.map((objective) => ({
          field: 'objectives',
          objectiveId: objective._id,
          message: `${objective.title}: manager achievement confirmation is missing.`
        })));
      }
      if (submissionErrors.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Complete the required final-review fields before submitting to HR.',
          errors: submissionErrors
        });
      }
    }
    if (status) {
      evaluation.status = status;
      if (status === 'pending_hr') {
        evaluation.hr_return_reason = '';
        evaluation.workflow_history.push({
          action: 'submitted',
          performed_by: req.user.id || req.user._id,
          performed_at: new Date()
        });
      }
    }
    if (evaluation.ai_assisted) {
      evaluation.ai_reviewed_by_manager = true;
    }
    evaluation.evaluator_id = req.user.id || req.user._id;
    evaluation.evaluator_role = req.user.role;
    evaluation.evaluated_at = new Date();
    
    evaluation.consistency_warnings = await buildConsistencyWarnings(evaluation);
    await evaluation.save();

    await auditLogger.log(req.user.id || req.user._id, 'evaluation.updated', 'FinalEvaluation', evaluation._id, {
      status: evaluation.status,
      manager_score,
      score_difference: evaluation.score_difference,
      adjustmentJustified: Boolean(evaluation.manager_adjustment_justification),
      aiReviewedByManager: evaluation.ai_reviewed_by_manager
    });

    const populated = await FinalEvaluation.findById(evaluation._id)
      .populate('employee_id', 'name email profileImage')
      .populate('cycle_id', 'name year')
      .populate('evaluator_id', 'name role')
      .populate('hr_validated_by', 'name');

    res.json({ success: true, evaluation: populated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.recalculateEvaluation = async (req, res) => {
  try {
    const evaluation = await FinalEvaluation.findById(req.params.id);
    if (!evaluation) return res.status(404).json({ success: false, message: 'Evaluation not found' });

    const phaseCheck = await enforcePhase3Evaluation(evaluation.cycle_id);
    if (phaseCheck.error) return res.status(phaseCheck.status).json({ success: false, message: phaseCheck.message });
    if (!await canManageEmployeeEvaluation(req.user, evaluation.employee_id)) {
      return res.status(403).json({ success: false, message: 'You can only evaluate your own team members.' });
    }
    if (evaluation.status !== 'draft') {
      return res.status(400).json({ success: false, message: 'Only draft evaluations can be recalculated.' });
    }

    const snapshot = await calculateEvaluationSnapshot(evaluation.employee_id, evaluation.cycle_id);
    applyEvaluationSnapshot(evaluation, snapshot);
    evaluation.consistency_warnings = await buildConsistencyWarnings(evaluation);
    await evaluation.save();

    await auditLogger.log(req.user.id || req.user._id, 'evaluation.recalculated', 'FinalEvaluation', evaluation._id, {
      auto_score: evaluation.auto_score,
      final_score: evaluation.final_score,
      objective_weight_total: evaluation.objective_weight_total
    });

    const populated = await FinalEvaluation.findById(evaluation._id)
      .populate('employee_id', 'name email profileImage')
      .populate('evaluator_id', 'name role');
    res.json({ success: true, evaluation: populated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.validateEvaluation = async (req, res) => {
  try {
    const { id } = req.params;
    const { action, performance_status, return_reason, hr_review_notes } = req.body;
    if (!['validate', 'send_back'].includes(action)) {
      return res.status(400).json({ success: false, message: 'Action must be validate or send_back.' });
    }

    const evaluation = await FinalEvaluation.findById(id);
    if (!evaluation) return res.status(404).json({ success: false, message: 'Evaluation not found' });
    const phaseCheck = await enforcePhase3Evaluation(evaluation.cycle_id);
    if (phaseCheck.error) return res.status(phaseCheck.status).json({ success: false, message: phaseCheck.message });

    let didCompleteReview = false;
    if (action === 'validate') {
      if (evaluation.status === 'pending_hr') {
        const blockingIssues = getBlockingEvaluationReviewIssues(evaluation);
        if (blockingIssues.length > 0) {
          return res.status(400).json({
            success: false,
            message: 'This evaluation is incomplete and must be corrected by the manager before HR can mark it as reviewed.',
            errors: blockingIssues
          });
        }
      } else if (!['validated', 'closed'].includes(evaluation.status)) {
        return res.status(400).json({
          success: false,
          message: 'Only manager-submitted or previously reviewed evaluations can be updated by HR.'
        });
      }

      const isFirstReview = evaluation.status === 'pending_hr';
      evaluation.consistency_warnings = await buildConsistencyWarnings(evaluation);
      if (isFirstReview) {
        didCompleteReview = true;
        evaluation.status = 'validated';
        evaluation.hr_validated_by = req.user.id;
        evaluation.hr_validated_at = new Date();
        evaluation.workflow_history.push({
          action: 'validated',
          reason: String(hr_review_notes || '').trim(),
          performed_by: req.user.id,
          performed_at: new Date()
        });
      }
      if (performance_status !== undefined) {
        evaluation.performance_status = performance_status || null;
      }
      if (hr_review_notes !== undefined) {
        evaluation.hr_review_notes = String(hr_review_notes || '').trim();
      }
      evaluation.hr_return_reason = '';
    } else if (action === 'send_back') {
      if (evaluation.status !== 'pending_hr') {
        return res.status(400).json({ success: false, message: 'Only an evaluation pending HR validation can be sent back.' });
      }
      if (!String(return_reason || '').trim()) {
        return res.status(400).json({ success: false, message: 'A return reason is required before sending the evaluation back.' });
      }
      evaluation.status = 'draft';
      evaluation.hr_return_reason = String(return_reason).trim();
      evaluation.workflow_history.push({
        action: 'sent_back',
        reason: evaluation.hr_return_reason,
        performed_by: req.user.id,
        performed_at: new Date()
      });
    }

    await evaluation.save();
    if (action === 'send_back' && evaluation.evaluator_id) {
      await createNotification({
        recipientId: evaluation.evaluator_id,
        senderId: req.user.id,
        type: 'EVALUATION_REJECTED',
        title: 'Final evaluation returned by HR',
        message: `HR returned the final evaluation for revision: ${evaluation.hr_return_reason}`,
        link: '/final-evaluations'
      });
    }
    if (didCompleteReview && evaluation.employee_id) {
      await createNotification({
        recipientId: evaluation.employee_id,
        senderId: req.user.id,
        type: 'EVALUATION_COMPLETED',
        title: 'Final evaluation report ready',
        message: 'HR completed the process review. Your final evaluation report is ready to view.',
        link: '/final-evaluations'
      });
    }

    await auditLogger.log(req.user.id, `evaluation.${action}`, 'FinalEvaluation', evaluation._id, {
      action,
      status: evaluation.status,
      performance_status: evaluation.performance_status || null
    });

    const populated = await FinalEvaluation.findById(evaluation._id)
      .populate('employee_id', 'name email profileImage')
      .populate('cycle_id', 'name year')
      .populate('evaluator_id', 'name role')
      .populate('hr_validated_by', 'name')
      .populate('workflow_history.performed_by', 'name role');

    res.json({ success: true, evaluation: populated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.exportEvaluation = async (req, res) => {
  try {
    const { id } = req.params;
    const evaluation = await FinalEvaluation.findById(id)
      .populate('employee_id', 'name email department position')
      .populate('cycle_id', 'name year type');
      
    if (!evaluation) return res.status(404).json({ success: false, message: 'Evaluation not found' });

    const objectives = await Objective.find({ 
      owner: evaluation.employee_id._id, 
      cycle: evaluation.cycle_id._id 
    });
    const improvementPlans = await ImprovementPlan.find({ evaluation_id: evaluation._id }).sort({ deadline: 1 });

    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument({ margin: 50 });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=evaluation-${evaluation.employee_id.name.replace(/\s+/g, '-')}.pdf`);

    doc.pipe(res);

    // Header
    doc.fontSize(24).text('Performance Evaluation Report', { align: 'center' });
    doc.moveDown(2);

    // Employee Info
    doc.fontSize(16).text('Employee Information');
    doc.fontSize(12).moveDown(0.5);
    doc.text(`Name: ${evaluation.employee_id.name}`);
    doc.text(`Email: ${evaluation.employee_id.email}`);
    if (evaluation.employee_id.department) doc.text(`Department: ${evaluation.employee_id.department}`);
    if (evaluation.employee_id.position) doc.text(`Position: ${evaluation.employee_id.position}`);
    
    doc.moveDown(1);
    doc.text(`Cycle: ${evaluation.cycle_id.name} (${evaluation.cycle_id.year})`);
    doc.text(`Date of Evaluation: ${new Date(evaluation.updatedAt).toLocaleDateString()}`);
    doc.moveDown(2);

    // Scores & Rating
    doc.fontSize(16).text('Evaluation Summary');
    doc.fontSize(12).moveDown(0.5);
    doc.text(`Weighted Suggested Score: ${evaluation.auto_score ?? 'N/A'}`);
    doc.text(`Manager Score: ${evaluation.manager_score ?? 'Not adjusted'}`);
    doc.text(`Final Score: ${evaluation.final_score ?? 'N/A'}`);
    doc.text(`Rating Label: ${evaluation.rating_label || 'N/A'}`);
    doc.text(`Score Difference: ${evaluation.score_difference || 0} point(s)`);
    if (evaluation.manager_adjustment_justification) {
      doc.text(`Manager Adjustment Justification: ${evaluation.manager_adjustment_justification}`);
    }
    doc.text(`Manager Recommendation: ${evaluation.recommendation || 'None'}`);
    if (evaluation.performance_status) {
      doc.text(`HR Performance Status: ${humanizePerformanceStatus(evaluation.performance_status)}`);
    }
    doc.moveDown(2);

    // Manager Comments
    if (evaluation.manager_comments) {
      doc.fontSize(16).text('Manager Comments');
      doc.fontSize(12).moveDown(0.5);
      doc.text(evaluation.manager_comments, { width: 500, align: 'justify' });
      doc.moveDown(2);
    }

    // Strengths & Weaknesses
    if (evaluation.strengths && evaluation.strengths.length > 0) {
      doc.fontSize(16).text('Strengths');
      doc.fontSize(12).moveDown(0.5);
      evaluation.strengths.forEach(s => doc.text(`• ${s}`));
      doc.moveDown(2);
    }

    if (evaluation.weaknesses && evaluation.weaknesses.length > 0) {
      doc.fontSize(16).text('Areas for Improvement');
      doc.fontSize(12).moveDown(0.5);
      evaluation.weaknesses.forEach(w => doc.text(`• ${w}`));
      doc.moveDown(2);
    }

    if (improvementPlans.length > 0) {
      doc.fontSize(16).text('Improvement Plans');
      doc.fontSize(12).moveDown(0.5);
      improvementPlans.forEach((plan, index) => {
        doc.text(`${index + 1}. Goal: ${plan.objective_goal}`);
        doc.text(`Deadline: ${new Date(plan.deadline).toLocaleDateString()}`);
        doc.text(`Expected Outcome: ${plan.expected_outcome}`);
        doc.text(`Progress Status: ${humanizePerformanceStatus(plan.progress_status)}`);
        if (plan.notes) {
          doc.text(`Notes: ${plan.notes}`);
        }
        doc.moveDown(0.75);
      });
      doc.moveDown(1);
    }

    if (evaluation.employee_feedback?.acknowledged || evaluation.employee_feedback?.comment) {
      doc.fontSize(16).text('Employee Feedback');
      doc.fontSize(12).moveDown(0.5);
      doc.text(`Acknowledged: ${evaluation.employee_feedback?.acknowledged ? 'Yes' : 'No'}`);
      if (evaluation.employee_feedback?.acknowledged_at) {
        doc.text(`Acknowledged At: ${new Date(evaluation.employee_feedback.acknowledged_at).toLocaleDateString()}`);
      }
      if (evaluation.employee_feedback?.comment) {
        doc.text(`Comment: ${evaluation.employee_feedback.comment}`);
      }
      doc.moveDown(2);
    }

    // Objectives Summary
    doc.fontSize(16).text('Weighted Objectives Summary');
    doc.moveDown(0.5);
    if (evaluation.objective_breakdown?.length > 0) {
      evaluation.objective_breakdown.forEach((objective, idx) => {
        doc.fontSize(14).text(`${idx + 1}. ${objective.title}`);
        doc.fontSize(12).text(`Category: ${objective.category || 'individual'}`);
        doc.text(`Weight: ${objective.weight || 0}%`);
        doc.text(`Employee Achievement: ${objective.employee_achievement || 0}%`);
        doc.text(`Manager Confirmed: ${objective.manager_confirmed_achievement ?? objective.achievement_used ?? 0}%`);
        doc.text(`Weighted Contribution: ${objective.weighted_points || 0} points`);
        doc.moveDown(1);
      });
    } else if (objectives.length === 0) {
      doc.fontSize(12).text('No objectives found for this cycle.');
    } else {
      objectives.forEach((obj, idx) => {
        doc.fontSize(14).text(`${idx + 1}. ${obj.title}`);
        doc.fontSize(12).text(`Status: ${obj.status}`);
        doc.text(`Achievement: ${obj.achievementPercent || 0}%`);
        doc.moveDown(1);
      });
    }

    // Signatures
    doc.moveDown(4);
    doc.text('_____________________________', 50, doc.y);
    doc.text('Manager Signature', 50, doc.y + 10);
    
    doc.text('_____________________________', 350, doc.y - 10);
    doc.text('Employee Signature', 350, doc.y + 10);

    doc.end();

  } catch (err) {
    console.error('PDF Generation Error:', err);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: 'Failed to generate PDF' });
    }
  }
};

exports.getPendingEvaluations = async (req, res) => {
  try {
    const evaluationDocuments = await FinalEvaluation.find({ status: 'pending_hr' });
    await Promise.all(evaluationDocuments.map(async (evaluation) => {
      const warnings = await buildConsistencyWarnings(evaluation);
      const warningsChanged = JSON.stringify(evaluation.consistency_warnings || []) !== JSON.stringify(warnings);
      if (warningsChanged) {
        evaluation.consistency_warnings = warnings;
        await evaluation.save();
      }
    }));

    const evaluations = await FinalEvaluation.find({ status: 'pending_hr' })
      .populate('employee_id', 'name email profileImage')
      .populate('cycle_id', 'name')
      .populate('evaluator_id', 'name role')
      .populate('workflow_history.performed_by', 'name role');
    res.json({ success: true, evaluations });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getReviewedEvaluations = async (req, res) => {
  try {
    const evaluations = await FinalEvaluation.find({ status: { $in: ['validated', 'closed'] } })
      .populate('employee_id', 'name email profileImage')
      .populate('cycle_id', 'name year')
      .populate('evaluator_id', 'name role')
      .populate('hr_validated_by', 'name')
      .populate('workflow_history.performed_by', 'name role')
      .sort({ hr_validated_at: -1, updatedAt: -1 });

    res.json({ success: true, evaluations });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.submitEmployeeFeedback = async (req, res) => {
  try {
    const { id } = req.params;
    const { acknowledged, comment } = req.body;

    const evaluation = await FinalEvaluation.findById(id)
      .populate('employee_id', 'name email profileImage')
      .populate('evaluator_id', 'name role')
      .populate('hr_validated_by', 'name');

    if (!evaluation) {
      return res.status(404).json({ success: false, message: 'Evaluation not found' });
    }

    if (String(evaluation.employee_id?._id || evaluation.employee_id) !== String(req.user.id || req.user._id)) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    evaluation.employee_feedback = {
      acknowledged: Boolean(acknowledged),
      comment: String(comment || '').trim(),
      acknowledged_at: acknowledged ? new Date() : null,
      updated_at: new Date()
    };

    await evaluation.save();

    await auditLogger.log(req.user.id, 'evaluation.employee_feedback', 'FinalEvaluation', evaluation._id, {
      acknowledged: evaluation.employee_feedback.acknowledged,
      hasComment: Boolean(evaluation.employee_feedback.comment)
    });

    res.json({ success: true, evaluation });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
