const router = require('express').Router();
const auth = require('../middleware/auth');
const role = require('../middleware/role');
const ctrl = require('../controllers/feedbackController');

// All routes require authentication
router.use(auth);

// Create feedback
router.post('/', ctrl.createFeedback);

// Request 360-degree feedback
router.post('/request', ctrl.requestFeedback);

// Get feedback received by me
router.get('/received', ctrl.getReceived);

// Get feedback sent by me
router.get('/sent', ctrl.getSent);

// Get all feedback (admin/HR only)
router.get('/all', role('ADMIN', 'HR'), ctrl.getAll);

// Get feedback stats for current user or specific user
router.get('/stats', ctrl.getStats);
router.get('/stats/:userId', role('ADMIN', 'HR', 'TEAM_LEADER'), ctrl.getStats);

// Get feedback for a specific user (manager view)
router.get('/user/:userId', role('ADMIN', 'HR', 'TEAM_LEADER'), ctrl.getForUser);

// Delete feedback
router.delete('/:id', ctrl.deleteFeedback);

module.exports = router;
