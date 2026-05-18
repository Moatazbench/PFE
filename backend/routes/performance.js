const express = require('express');
const router = express.Router();
const Objective = require('../models/Objective');
const Team = require('../models/Team');
const auth = require('../middleware/auth');

function roundScore(value) {
  return Number(Number(value || 0).toFixed(2));
}

function calculateObjectiveScore(objective) {
  const achievement = Number.isFinite(Number(objective.achievementPercent)) ? Number(objective.achievementPercent) : 0;
  return roundScore((Number(objective.weight || 0) * achievement) / 100);
}

function getPerformanceLabel(score) {
  if (score >= 90) return 'Exceeded Expectations';
  if (score >= 75) return 'Achieved';
  if (score >= 50) return 'Partially Achieved';
  return 'Below Expectations';
}

async function computeSummary(employeeId, cycleId) {
  const objectives = await Objective.find({
    owner: employeeId,
    cycle: cycleId,
    status: { $nin: ['rejected', 'cancelled', 'archived'] },
  })
    .populate('owner', 'name email role')
    .populate('cycle', 'name year')
    .sort({ createdAt: 1 })
    .lean();

  return buildSummaryFromObjectives(employeeId, cycleId, objectives);
}

function buildSummaryFromObjectives(employeeId, cycleId, objectives) {
  if (objectives.length === 0) {
    return {
      employeeId,
      employee: null,
      cycleId,
      objectives: [],
      performanceScore: 0,
      averageRating: 0,
      performanceLabel: 'Below Expectations',
      totalObjectives: 0,
      totalWeight: 0,
      individualWeight: 0,
      teamWeight: 0,
    };
  }

  let individualWeightedScore = 0;
  let teamWeightedScore = 0;
  let individualWeight = 0;
  let teamWeight = 0;
  let ratingSum = 0;
  let ratingCount = 0;

  const objectiveDetails = objectives.map((objective) => {
    const score = calculateObjectiveScore(objective);
    const isTeam = objective.category === 'team';

    if (isTeam) {
      teamWeightedScore += score;
      teamWeight += Number(objective.weight || 0);
    } else {
      individualWeightedScore += score;
      individualWeight += Number(objective.weight || 0);
    }

    if (objective.evaluationNumericRating != null) {
      ratingSum += Number(objective.evaluationNumericRating);
      ratingCount += 1;
    }

    return {
      _id: objective._id,
      title: objective.title,
      weight: objective.weight,
      achievementPercent: objective.achievementPercent || 0,
      weightedScore: score,
      category: objective.category,
      status: objective.status,
      evaluationRating: objective.evaluationRating || '',
      evaluationNumericRating: objective.evaluationNumericRating,
    };
  });

  // Use the 70/30 composite score formula matching the validation panel:
  // Final Score = (Individual Score × 70%) + (Team Score × 30%)
  const individualScoreRaw = Math.min(individualWeightedScore, 100);
  const teamScoreRaw = Math.min(teamWeightedScore, 100);
  const hasTeamObjectives = teamWeight > 0;
  // If employee has only individual objectives, use 100% individual score
  const performanceScore = hasTeamObjectives
    ? roundScore((individualScoreRaw * 0.70) + (teamScoreRaw * 0.30))
    : roundScore(individualScoreRaw);
  const averageRating = ratingCount > 0 ? roundScore(ratingSum / ratingCount) : 0;

  return {
    employeeId,
    employee: objectives[0]?.owner || null,
    cycleId,
    objectives: objectiveDetails,
    performanceScore,
    averageRating,
    performanceLabel: getPerformanceLabel(performanceScore),
    totalObjectives: objectives.length,
    totalWeight: roundScore(individualWeight),
    individualWeight: roundScore(individualWeight),
    teamWeight: roundScore(teamWeight),
  };
}

router.get('/summary/:employeeId/:cycleId', auth, async (req, res) => {
  try {
    const { employeeId, cycleId } = req.params;
    const summary = await computeSummary(employeeId, cycleId);
    res.json({ success: true, ...summary });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/team-summary/:managerId/:cycleId', auth, async (req, res) => {
  try {
    const { managerId, cycleId } = req.params;
    if (req.user.id !== managerId && !['ADMIN', 'HR'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const team = await Team.findOne({ leader: managerId }).select('members').lean();
    const employeeIds = team ? team.members.map((member) => String(member)) : [];
    const objectives = employeeIds.length > 0
      ? await Objective.find({
          owner: { $in: employeeIds },
          cycle: cycleId,
          status: { $nin: ['rejected', 'cancelled', 'archived'] },
        })
          .populate('owner', 'name email role')
          .populate('cycle', 'name year')
          .sort({ createdAt: 1 })
          .lean()
      : [];

    const objectivesByEmployeeId = objectives.reduce((acc, objective) => {
      const ownerId = String(objective.owner?._id || objective.owner);
      if (!acc[ownerId]) acc[ownerId] = [];
      acc[ownerId].push(objective);
      return acc;
    }, {});

    const summaries = employeeIds
      .map((employeeId) => buildSummaryFromObjectives(employeeId, cycleId, objectivesByEmployeeId[employeeId] || []))
      .filter((summary) => summary.totalObjectives > 0);

    const teamPerformanceScore = summaries.length > 0
      ? roundScore(summaries.reduce((sum, summary) => sum + summary.performanceScore, 0) / summaries.length)
      : 0;
    const teamAverageRating = summaries.length > 0
      ? roundScore(summaries.reduce((sum, summary) => sum + summary.averageRating, 0) / summaries.length)
      : 0;

    res.json({
      success: true,
      managerId,
      cycleId,
      employeeCount: summaries.length,
      teamPerformanceScore,
      teamAverageRating,
      employees: summaries,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
