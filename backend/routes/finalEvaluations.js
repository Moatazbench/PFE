const express = require('express');
const router = express.Router();
const finalEvaluationController = require('../controllers/finalEvaluationController');
const auth = require('../middleware/auth');
const role = require('../middleware/role');

router.use(auth);

// Manager gets team evaluations
router.get('/team/:cycle_id', role('ADMIN', 'HR', 'TEAM_LEADER'), finalEvaluationController.getTeamEvaluations);

// Export data for PDF
router.get('/export/:id', finalEvaluationController.exportEvaluation);

// HR get pending evaluations
router.get('/hr/pending', role('ADMIN', 'HR'), finalEvaluationController.getPendingEvaluations);

// Employee history
router.get('/user/:employee_id/history', finalEvaluationController.getUserHistory);

// Auto-generate
router.post('/generate/:cycle_id/:employee_id', role('ADMIN', 'HR', 'TEAM_LEADER'), finalEvaluationController.generateEvaluation);

// Update (manager override)
router.put('/:id', role('ADMIN', 'HR', 'TEAM_LEADER'), finalEvaluationController.updateEvaluation);

// HR validate
router.put('/:id/hr-validate', role('ADMIN', 'HR'), finalEvaluationController.validateEvaluation);

// Get a specific evaluation
router.get('/:cycle_id/:employee_id', finalEvaluationController.getEvaluation);

module.exports = router;
