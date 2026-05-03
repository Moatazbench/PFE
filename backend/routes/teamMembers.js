const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Team = require('../models/Team');
const User = require('../models/User');
const Task = require('../models/Task');
const Objective = require('../models/Objective');
const Evaluation = require('../models/Evaluation');
const rateLimiter = require('../middleware/rateLimiter');

// GET /api/team-members
router.get('/', rateLimiter, auth, async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;

    // 1. Find the user's team
    let team = await Team.findOne({ leader: userId })
      .populate('leader', 'name email role profileImage isActive')
      .populate('members', 'name email role profileImage isActive');

    if (!team) {
      team = await Team.findOne({ members: userId })
        .populate('leader', 'name email role profileImage isActive')
        .populate('members', 'name email role profileImage isActive');
    }

    let usersToProcess = [];
    let teamName = "General Division";

    if (team) {
      teamName = team.name;
      if (team.leader && team.leader._id) {
        usersToProcess.push(team.leader);
      }
      if (team.members && Array.isArray(team.members)) {
        team.members.forEach(m => {
          if (m && m._id && !usersToProcess.find(u => String(u._id) === String(m._id))) {
            usersToProcess.push(m);
          }
        });
      }
    } else if (['ADMIN', 'HR'].includes(req.user.role)) {
      // Fallback: If no team but has admin/hr perms, show all active users
      const allUsers = await User.find({ isDeleted: false })
        .select('name email role profileImage isActive');
      usersToProcess = allUsers;
      teamName = "Company Wide";
    }

    if (usersToProcess.length === 0) {
      return res.status(200).json([]);
    }

    // 2. Fetch stats for each user asynchronously
    const aggregatedData = await Promise.all(usersToProcess.map(async (user) => {
      try {
        const uId = user._id;

        const tasksCompletedCount = await Task.countDocuments({ assignee: uId, status: 'done' });
        const tasksActiveCount = await Task.countDocuments({ assignee: uId, status: { $nin: ['done', 'cancelled'] } });

        const activeObjectivesCount = await Objective.countDocuments({
          owner: uId,
          status: { $nin: ['draft', 'rejected', 'cancelled', 'archived', 'locked'] }
        });

        const pendingReviewsCount = await Evaluation.countDocuments({
          evaluatorId: uId,
          status: { $in: ['draft', 'in_progress', 'rejected'] }
        });

        const objectives = await Objective.find({
          owner: uId,
          status: { $nin: ['draft', 'rejected', 'cancelled', 'archived', 'locked'] }
        });
        
        let progress = 0;
        if (objectives.length > 0) {
          const totalProgress = objectives.reduce((sum, objective) => sum + (objective.achievementPercent || 0), 0);
          progress = Math.round(totalProgress / objectives.length);
        } else if (tasksActiveCount > 0 || tasksCompletedCount > 0) {
          progress = Math.round((tasksCompletedCount / (tasksActiveCount + tasksCompletedCount)) * 100);
        }

        let calculatedStatus = 'available';
        if (user.isActive === false) {
          calculatedStatus = 'offline';
        } else if (pendingReviewsCount > 0 || tasksActiveCount >= 6) {
          calculatedStatus = 'do_not_disturb';
        } else if (tasksActiveCount >= 3 || activeObjectivesCount >= 3) {
          calculatedStatus = 'busy';
        }

        return {
          id: uId,
          name: user.name || 'Unknown',
          avatar: user.profileImage || '',
          role: user.role || 'COLLABORATOR',
          department: teamName,
          status: calculatedStatus,
          progress: progress,
          tasksCompleted: tasksCompletedCount,
          activeTasks: tasksActiveCount,
          activeGoals: activeObjectivesCount,
          pendingReviews: pendingReviewsCount
        };
      } catch (innerError) {
        console.error(`Error processing user ${user?._id}:`, innerError);
        // Fallback for this single user so we don't crash the whole array
        return {
          id: user?._id || Math.random().toString(),
          name: user?.name || 'Unknown',
          avatar: user?.profileImage || '',
          role: user?.role || 'COLLABORATOR',
          department: teamName,
          status: 'offline',
          progress: 0,
          tasksCompleted: 0,
          activeTasks: 0,
          activeGoals: 0,
          pendingReviews: 0
        };
      }
    }));

    return res.status(200).json(aggregatedData);

  } catch (error) {
    console.error('Error in /api/team-members:', error);
    return res.status(500).json({ message: 'Failed to load team dashboard data' });
  }
});

module.exports = router;
