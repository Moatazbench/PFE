const Objective = require('../models/Objective');
const Task = require('../models/Task');
const CheckIn = require('../models/CheckIn');

const EXCLUDED_OBJECTIVE_STATUSES = ['draft', 'rejected', 'cancelled', 'archived'];

function clampPercentage(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(100, numeric));
}

function getConfirmedAchievement(objective) {
  if (objective?.managerAdjustedPercent != null) {
    return clampPercentage(objective.managerAdjustedPercent);
  }
  if (objective?.finalSelfPercent != null) {
    return clampPercentage(objective.finalSelfPercent);
  }
  return clampPercentage(objective?.achievementPercent);
}

function calculateWeightedScoreFromObjectives(objectives) {
  const eligibleObjectives = (Array.isArray(objectives) ? objectives : []).filter((objective) => {
    return objective && !EXCLUDED_OBJECTIVE_STATUSES.includes(objective.status);
  });

  const breakdown = eligibleObjectives.map((objective) => {
    const weight = clampPercentage(objective.weight);
    const achievement = getConfirmedAchievement(objective);
    const weightedPoints = Number(((weight * achievement) / 100).toFixed(2));

    return {
      objective_id: objective._id || null,
      title: objective.title || 'Untitled objective',
      category: objective.category || 'individual',
      weight,
      employee_achievement: objective.finalSelfPercent != null
        ? clampPercentage(objective.finalSelfPercent)
        : clampPercentage(objective.achievementPercent),
      manager_confirmed_achievement: objective.managerAdjustedPercent != null
        ? clampPercentage(objective.managerAdjustedPercent)
        : null,
      achievement_used: achievement,
      weighted_points: weightedPoints,
      status: objective.status || '',
    };
  });

  const totalWeight = breakdown.reduce((sum, item) => sum + item.weight, 0);
  const rawWeightedPoints = breakdown.reduce((sum, item) => sum + item.weighted_points, 0);
  // Current valid cycles total 100%. Legacy/incomplete cycles are normalized so missing
  // administrative weight does not unfairly reduce an employee's performance score.
  const score = totalWeight > 0
    ? totalWeight === 100
      ? rawWeightedPoints
      : (rawWeightedPoints / totalWeight) * 100
    : 0;

  return {
    score: Number(clampPercentage(score).toFixed(2)),
    totalWeight: Number(totalWeight.toFixed(2)),
    rawWeightedPoints: Number(rawWeightedPoints.toFixed(2)),
    normalized: totalWeight > 0 && totalWeight !== 100,
    breakdown,
  };
}

async function calculateWeightedObjectiveScore(employee_id, cycle_id) {
  const objectives = await Objective.find({
    owner: employee_id,
    cycle: cycle_id,
    status: { $nin: EXCLUDED_OBJECTIVE_STATUSES },
  }).lean();

  return calculateWeightedScoreFromObjectives(objectives);
}

async function getEvaluationEvidence(employee_id, cycle_id, objectiveIds) {
  const [tasks, checkins] = await Promise.all([
    Task.find({ assignee: employee_id, linkedGoal: { $in: objectiveIds } }).lean(),
    CheckIn.find({ employee_id, cycle_id }).lean(),
  ]);

  const completedTasks = tasks.filter((task) => ['done', 'completed'].includes(task.status)).length;
  const approvedCheckins = checkins.filter((checkin) => checkin.status === 'approved').length;

  return {
    tasks: {
      total: tasks.length,
      completed: completedTasks,
      completion_rate: tasks.length ? Number(((completedTasks / tasks.length) * 100).toFixed(1)) : null,
    },
    checkins: {
      total: checkins.length,
      approved: approvedCheckins,
      approval_rate: checkins.length ? Number(((approvedCheckins / checkins.length) * 100).toFixed(1)) : null,
      average_progress: checkins.length
        ? Number((checkins.reduce((sum, item) => sum + clampPercentage(item.progress_percent), 0) / checkins.length).toFixed(1))
        : null,
    },
  };
}

const calculateAutoScore = async (employee_id, cycle_id) => {
  const result = await calculateWeightedObjectiveScore(employee_id, cycle_id);
  return result.score;
};

const determineRatingLabel = (score) => {
  const normalizedScore = clampPercentage(score);
  if (normalizedScore >= 90) return 'exceptional';
  if (normalizedScore >= 75) return 'strong';
  if (normalizedScore >= 50) return 'meets_expectations';
  if (normalizedScore >= 30) return 'needs_improvement';
  return 'unsatisfactory';
};

module.exports = {
  calculateAutoScore,
  calculateWeightedObjectiveScore,
  calculateWeightedScoreFromObjectives,
  getEvaluationEvidence,
  determineRatingLabel,
  getConfirmedAchievement,
};
