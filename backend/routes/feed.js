const express = require('express');
const router = express.Router();
const Objective = require('../models/Objective');
const auth = require('../middleware/auth');

/**
 * Get unified activity feed for the user's team
 * This pulls:
 * 1. Progress updates
 * 2. New comments
 * 3. Goal state changes
 */
router.get('/', auth, async (req, res) => {
    try {
        // Find goals visible to the user (Public or Team-specific)
        // For simplicity, we'll fetch recently updated objectives
        const objectives = await Objective.find()
            .populate('owner', 'name profileImage')
            .populate('progressUpdates.user', 'name profileImage')
            .populate('comments.user', 'name profileImage')
            .sort({ updatedAt: -1 })
            .limit(30);

        // Transform objectives into a flat list of status updates, progress, and comments
        const activities = [];

        objectives.forEach(obj => {
            // Add goal creation/update activity
            activities.push({
                id: obj._id + '_update',
                type: 'GOAL_UPDATE',
                user: obj.owner,
                goalTitle: obj.title,
                goalId: obj._id,
                message: 'updated the goal',
                timestamp: obj.updatedAt
            });

            // Add progress updates
            obj.progressUpdates.forEach(update => {
                activities.push({
                    id: update._id,
                    type: 'PROGRESS_UPDATE',
                    user: update.user,
                    goalTitle: obj.title,
                    goalId: obj._id,
                    message: update.message,
                    timestamp: update.createdAt
                });
            });

            // Add comments
            obj.comments.forEach(comment => {
                activities.push({
                    id: comment._id,
                    type: 'COMMENT',
                    user: comment.user,
                    goalTitle: obj.title,
                    goalId: obj._id,
                    message: comment.text,
                    timestamp: comment.createdAt
                });
            });
        });

        // Sort all aggregated activities by timestamp
        const sortedActivities = activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 50);

        res.json(sortedActivities);
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
