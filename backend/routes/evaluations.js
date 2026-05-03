const express = require('express');
const router = express.Router();
const evaluationController = require('../controllers/evaluationController');
const auth = require('../middleware/auth');
const role = require('../middleware/role');

// Rubric (public for authenticated users)
router.get('/rubric', auth, evaluationController.getRubric);

// List all evaluations (with RBAC scoping)
router.get('/', auth, evaluationController.getAllEvaluations);

// Get evaluations for a specific employee
router.get('/employee/:employeeId', auth, evaluationController.getMyEvaluations);

// Get evaluations created by a specific evaluator
router.get('/evaluator/:evaluatorId', auth, evaluationController.getEvaluatorEvaluations);

// Get a single evaluation
router.get('/:id', auth, evaluationController.getEvaluation);

// Create a new evaluation
router.post('/', auth, evaluationController.createEvaluation);

// Update evaluation (comments, feedback, score)
router.put('/:id', auth, evaluationController.updateEvaluation);

// Workflow actions
router.post('/:id/submit', auth, evaluationController.submitEvaluation);
router.post('/:id/approve', auth, role('HR', 'ADMIN'), evaluationController.approveEvaluation);
router.post('/:id/reject', auth, role('HR', 'ADMIN'), evaluationController.rejectEvaluation);
router.post('/:id/complete', auth, evaluationController.completeEvaluation);
router.post('/:id/acknowledge', auth, evaluationController.acknowledgeEvaluation);

module.exports = router;
