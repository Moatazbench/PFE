const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const aiController = require('../controllers/aiController');

router.post('/generate-goal', auth, aiController.generateGoal);
router.post('/suggest-kpis', auth, aiController.suggestKpis);
router.post('/summarize-performance', auth, aiController.summarizePerformance);
router.post('/detect-risks', auth, aiController.detectRisks);
router.post('/prioritize-notifications', auth, aiController.prioritizeNotifications);
router.post('/assist', auth, aiController.assist);
router.post('/draft-checkin', auth, aiController.draftCheckin);

module.exports = router;
