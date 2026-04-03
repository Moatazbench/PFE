const express = require('express');
const router = express.Router();
const statsController = require('../controllers/statsController');
const auth = require('../middleware/auth');

// Dashboard stats
router.get('/dashboard', auth, statsController.getDashboardStats);

// Pie charts
router.get('/objectives-by-status', auth, statsController.getObjectivesByStatus);
router.get('/users-by-role', auth, statsController.getUsersByRole);

// Distributions
router.get('/score-distribution', auth, statsController.getScoreDistribution);

module.exports = router;