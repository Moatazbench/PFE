const express = require('express');
const router = express.Router();
const goalController = require('../controllers/goalController');
const auth = require('../middleware/auth');
const role = require('../middleware/role');

// Get validation status
router.get('/validation-status/:employeeId/:cycleId', auth, goalController.getValidationStatus);

// List goals
router.get('/', auth, goalController.getGoals);

// Create goal
router.post('/', auth, goalController.createGoal);

// Get single goal
router.get('/:id', auth, goalController.getGoals);

// Update goal
router.patch('/:id', auth, goalController.updateGoal);

// Delete goal
router.delete('/:id', auth, goalController.deleteGoal);

// Submission & Approval Workflow
router.post('/:id/submit', auth, goalController.submitGoal);
router.post('/:id/approve', auth, goalController.approveGoal);
router.post('/:id/revise', auth, goalController.requestRevision);

// Assessments
router.post('/:id/midyear-assessment', auth, goalController.midYearAssessment);
router.post('/:id/final-evaluation', auth, goalController.finalEvaluation);

module.exports = router;
