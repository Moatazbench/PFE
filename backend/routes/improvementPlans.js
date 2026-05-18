const router = require('express').Router();
const auth = require('../middleware/auth');
const ctrl = require('../controllers/improvementPlanController');

router.use(auth);

router.get('/evaluation/:evaluationId', ctrl.getPlansForEvaluation);
router.post('/evaluation/:evaluationId', ctrl.createPlan);
router.put('/:id', ctrl.updatePlan);
router.delete('/:id', ctrl.deletePlan);

module.exports = router;
