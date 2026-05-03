const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const aiController = require('../controllers/aiController');

router.post('/goal-suggestions', auth, aiController.generateGoalSuggestions);
router.post('/generate-objective', auth, aiController.generateGoalSuggestions); // backward compat
router.post('/suggest-kpis', auth, aiController.suggestKpis);
router.post('/summarize-performance', auth, aiController.summarizePerformance);
router.post('/detect-risks', auth, aiController.detectRisks);
router.post('/prioritize-notifications', auth, aiController.prioritizeNotifications);
router.post('/assist', auth, aiController.assist);
router.post('/draft-checkin', auth, aiController.draftCheckin);
router.post('/analyze-objective-quality', auth, aiController.analyzeObjectiveQuality);
router.post('/refine-objective', auth, aiController.refineObjective);

router.post('/review/midyear', auth, aiController.generateMidyearReview);
router.post('/review/final-self', auth, aiController.generateFinalSelfReview);
router.post('/review/manager', auth, aiController.generateManagerReview);
router.post('/development-plan', auth, aiController.generateDevelopmentPlan);

module.exports = router;
