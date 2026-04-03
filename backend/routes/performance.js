const express = require('express');
const router = express.Router();
const Goal = require('../models/Goal');
const GoalReview = require('../models/GoalReview');
const Team = require('../models/Team');
const auth = require('../middleware/auth');

/**
 * Compute performance summary for an employee in a cycle.
 */
async function computeSummary(employeeId, cycleId) {
  const goals = await Goal.find({ employeeId, cycleId })
    .populate('cycleId', 'name year');

  if (goals.length === 0) {
    return {
      employeeId,
      cycleId,
      goals: [],
      weightedAverage: 0,
      averageRating: 0,
      performanceLabel: 'Below Expectations',
      totalGoals: 0,
    };
  }

  // Get end-year manager ratings for each goal
  const goalIds = goals.map(g => g._id);
  const endyearReviews = await GoalReview.find({
    goalId: { $in: goalIds },
    phase: 'endyear',
    reviewType: 'manager_assessment',
  });

  const reviewMap = {};
  endyearReviews.forEach(r => {
    reviewMap[String(r.goalId)] = r;
  });

  let weightedSum = 0;
  let totalWeight = 0;
  let ratingSum = 0;
  let ratingCount = 0;

  const goalDetails = goals.map(g => {
    const review = reviewMap[String(g._id)];
    const completion = g.finalCompletion != null ? g.finalCompletion : g.currentProgress || 0;
    const weight = g.weight || 0;
    const rating = review ? review.rating : null;

    weightedSum += (weight * completion) / 100;
    totalWeight += weight;

    if (rating != null) {
      ratingSum += rating;
      ratingCount++;
    }

    return {
      _id: g._id,
      title: g.title,
      weight,
      currentProgress: g.currentProgress,
      finalCompletion: g.finalCompletion,
      effectiveCompletion: completion,
      rating,
      status: g.status,
    };
  });

  // Weighted average: normalized to 100 if total weight is 100
  const weightedAverage = totalWeight > 0
    ? Number(((weightedSum / totalWeight) * 100).toFixed(2))
    : 0;
  const averageRating = ratingCount > 0
    ? Number((ratingSum / ratingCount).toFixed(2))
    : 0;

  let performanceLabel;
  if (weightedAverage >= 100) performanceLabel = 'Exceeded Expectations';
  else if (weightedAverage >= 80) performanceLabel = 'Achieved';
  else if (weightedAverage >= 50) performanceLabel = 'Partially Achieved';
  else performanceLabel = 'Below Expectations';

  return {
    employeeId,
    cycleId,
    goals: goalDetails,
    weightedAverage,
    averageRating,
    performanceLabel,
    totalGoals: goals.length,
    totalWeight,
  };
}

// --- GET /api/performance/summary/:employeeId/:cycleId ---
router.get('/summary/:employeeId/:cycleId', auth, async (req, res) => {
  try {
    const { employeeId, cycleId } = req.params;
    const summary = await computeSummary(employeeId, cycleId);
    res.json({ success: true, ...summary });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// --- GET /api/performance/team-summary/:managerId/:cycleId ---
router.get('/team-summary/:managerId/:cycleId', auth, async (req, res) => {
  try {
    const { managerId, cycleId } = req.params;

    // Find all employees under this manager
    // 1. Via Goal model (goals assigned to this manager)
    const managedGoals = await Goal.find({ managerId, cycleId }).distinct('employeeId');

    // 2. Also via Team model
    const team = await Team.findOne({ leader: managerId });
    const teamMembers = team ? team.members.map(m => String(m)) : [];

    // Merge unique employee IDs
    const employeeSet = new Set([
      ...managedGoals.map(id => String(id)),
      ...teamMembers,
    ]);
    const employeeIds = Array.from(employeeSet);

    const summaries = [];
    for (const empId of employeeIds) {
      const summary = await computeSummary(empId, cycleId);
      // Only include employees who actually have goals
      if (summary.totalGoals > 0) {
        summaries.push(summary);
      }
    }

    // Team-level aggregates
    const teamWeightedAvg = summaries.length > 0
      ? Number((summaries.reduce((s, e) => s + e.weightedAverage, 0) / summaries.length).toFixed(2))
      : 0;
    const teamAvgRating = summaries.length > 0
      ? Number((summaries.reduce((s, e) => s + e.averageRating, 0) / summaries.length).toFixed(2))
      : 0;

    res.json({
      success: true,
      managerId,
      cycleId,
      employeeCount: summaries.length,
      teamWeightedAverage: teamWeightedAvg,
      teamAverageRating: teamAvgRating,
      employees: summaries,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
