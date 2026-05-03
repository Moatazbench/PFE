const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const role = require('../middleware/role');
const rateLimiter = require('../middleware/rateLimiter');
const validate = require('../middleware/validate');
const schemas = require('../validators/schemas');
const objectiveController = require('../controllers/objectiveController');

// All users can get objectives
router.get('/', rateLimiter, auth, objectiveController.getObjectives);
router.get('/my', rateLimiter, auth, objectiveController.getMyObjectives);
router.get('/user/:userId/cycle/:cycleId', rateLimiter, auth, async (req, res) => {
    req.query.cycle = req.params.cycleId;
    req.query.targetUserId = req.params.userId;
    return objectiveController.getObjectives(req, res);
});

router.get('/pending-validation', rateLimiter, auth, role('TEAM_LEADER'), objectiveController.getPendingValidation);
router.get('/stale', rateLimiter, auth, role('TEAM_LEADER', 'ADMIN'), objectiveController.getStaleObjectives);
router.get('/pending-change-requests', rateLimiter, auth, role('TEAM_LEADER', 'ADMIN'), objectiveController.getPendingChangeRequests);
router.get('/completed-awaiting-evaluation', rateLimiter, auth, role('TEAM_LEADER', 'ADMIN'), objectiveController.getCompletedAwaitingEvaluation);
router.get('/:id', rateLimiter, auth, objectiveController.getObjectiveById);

// Creation and modification
router.post('/', rateLimiter, auth, role('ADMIN', 'TEAM_LEADER', 'COLLABORATOR'), validate(schemas.objective.create), objectiveController.createObjective);
router.put('/:id', rateLimiter, auth, role('ADMIN', 'TEAM_LEADER', 'COLLABORATOR'), validate(schemas.objective.update), objectiveController.updateObjective);
router.delete('/:id', rateLimiter, auth, role('ADMIN', 'TEAM_LEADER', 'COLLABORATOR'), objectiveController.deleteObjective);

// Workflow actions
router.post('/submit-all', rateLimiter, auth, role('COLLABORATOR'), validate(schemas.objective.submitAll), objectiveController.submitObjectives);
router.post('/submit', rateLimiter, auth, validate(schemas.objective.submitAll), objectiveController.submitObjectives);
router.post('/submit/:id', rateLimiter, auth, objectiveController.submitObjective);
router.post('/:id/submit', rateLimiter, auth, role('ADMIN', 'TEAM_LEADER', 'COLLABORATOR'), validate(schemas.objective.submitProgress), objectiveController.submitProgress);
router.post('/:id/submit-for-approval', rateLimiter, auth, objectiveController.submitObjective);
router.post('/:id/validate', rateLimiter, auth, role('ADMIN', 'TEAM_LEADER'), objectiveController.validateObjective);
router.post('/:id/acknowledge', rateLimiter, auth, objectiveController.acknowledgeObjective);
router.post('/:id/mark-completed', rateLimiter, auth, objectiveController.markCompleted);
router.post('/:id/midyear-review', rateLimiter, auth, role('ADMIN', 'TEAM_LEADER'), objectiveController.midYearReviewObjective);
router.post('/:id/final-self-assessment', rateLimiter, auth, objectiveController.finalSelfAssessmentObjective);
router.post('/:id/evaluate', rateLimiter, auth, role('ADMIN', 'TEAM_LEADER'), objectiveController.evaluateObjective);
router.post('/:id/lock', rateLimiter, auth, role('ADMIN', 'TEAM_LEADER'), objectiveController.lockObjective);

// Change requests
router.post('/:id/change-requests', rateLimiter, auth, objectiveController.createChangeRequest);
router.put('/:id/change-requests/:crId', rateLimiter, auth, role('ADMIN', 'TEAM_LEADER'), objectiveController.resolveChangeRequest);
router.patch('/:id/correction', rateLimiter, auth, role('COLLABORATOR', 'TEAM_LEADER', 'ADMIN'), validate(schemas.objective.correctionRequest), objectiveController.createCorrectionRequest);
router.patch('/:id/correction/:crId', rateLimiter, auth, role('ADMIN', 'TEAM_LEADER'), validate(schemas.objective.reviewCorrectionRequest), objectiveController.reviewCorrectionRequest);

// Goal status
// Route removed as updateGoalStatus is undefined


// KPI management
router.post('/:id/kpis', rateLimiter, auth, objectiveController.addKpi);
router.put('/:id/kpis/:kpiId', rateLimiter, auth, objectiveController.updateKpi);
router.delete('/:id/kpis/:kpiId', rateLimiter, auth, objectiveController.deleteKpi);

// Progress updates
router.post('/:id/progress', rateLimiter, auth, objectiveController.addProgressUpdate);

// Comments
router.post('/:id/comments', rateLimiter, auth, objectiveController.addComment);
router.delete('/:id/comments/:commentId', rateLimiter, auth, objectiveController.deleteComment);

// Sub-objectives
router.get('/:id/children', rateLimiter, auth, objectiveController.getSubObjectives);

// Duplicate
router.post('/:id/duplicate', rateLimiter, auth, objectiveController.duplicateObjective);

module.exports = router;
