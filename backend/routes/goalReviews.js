const express = require('express');
const router = express.Router();
const GoalReview = require('../models/GoalReview');
const Goal = require('../models/Goal');
const Cycle = require('../models/Cycle');
const Team = require('../models/Team');
const auth = require('../middleware/auth');

// --- PATCH /api/goal-reviews/:id — update a review ---
router.patch('/:id', auth, async (req, res) => {
  try {
    const review = await GoalReview.findById(req.params.id);
    if (!review) return res.status(404).json({ success: false, message: 'Review not found' });

    // Only original reviewer can edit
    if (String(review.reviewerId) !== String(req.user.id) && req.user.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Only the original reviewer can update this review' });
    }

    // Phase enforcement — midyear reviews editable in phase2, endyear in phase3
    const cycle = await Cycle.findById(review.cycleId);
    if (!cycle) return res.status(404).json({ success: false, message: 'Cycle not found' });

    const requiredPhase = review.phase === 'midyear' ? 'phase2' : 'phase3';
    if (cycle.currentPhase !== requiredPhase && req.user.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        message: `Reviews for ${review.phase} can only be edited during ${requiredPhase}. Current phase: ${cycle.currentPhase}`,
      });
    }

    const allowedFields = [
      'comment', 'rating', 'progressPercentage', 'status',
      'blockers', 'correctiveActions', 'supportRequired',
      'confidenceLevel', 'meetingNotes', 'actionItems', 'decision',
    ];
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) review[field] = req.body[field];
    });

    await review.save();

    // If manager updates progress, sync it back to the goal
    if (review.reviewType === 'manager_assessment' && req.body.progressPercentage != null) {
      const goal = await Goal.findById(review.goalId);
      if (goal) {
        if (review.phase === 'midyear') {
          goal.currentProgress = req.body.progressPercentage;
        } else if (review.phase === 'endyear') {
          goal.finalCompletion = req.body.progressPercentage;
        }
        await goal.save();
      }
    }

    const populated = await GoalReview.findById(review._id)
      .populate('reviewerId', 'name email role')
      .populate('goalId', 'title status');

    res.json({ success: true, review: populated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// --- GET /api/goal-reviews/completion/:managerId/:cycleId — mid-year completion status ---
router.get('/completion/:managerId/:cycleId', auth, async (req, res) => {
  try {
    const { managerId, cycleId } = req.params;

    // All approved+ goals under this manager for this cycle
    const goals = await Goal.find({
      managerId,
      cycleId,
      status: { $in: ['approved', 'midyear_assessed', 'final_evaluated', 'locked'] },
    }).populate('employeeId', 'name email');

    const totalGoals = goals.length;

    // Find which goals have a completed manager mid-year assessment
    const assessedGoalIds = await GoalReview.distinct('goalId', {
      cycleId,
      phase: 'midyear',
      reviewType: 'manager_assessment',
      goalId: { $in: goals.map(g => g._id) },
    });

    const assessedSet = new Set(assessedGoalIds.map(id => String(id)));
    const completedCount = assessedSet.size;
    const pendingGoals = goals.filter(g => !assessedSet.has(String(g._id)));

    res.json({
      success: true,
      totalGoals,
      completedAssessments: completedCount,
      completionPercentage: totalGoals > 0 ? Number(((completedCount / totalGoals) * 100).toFixed(1)) : 0,
      pendingGoals: pendingGoals.map(g => ({
        _id: g._id,
        title: g.title,
        employee: g.employeeId,
        status: g.status,
      })),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
