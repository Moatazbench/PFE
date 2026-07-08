const router = require('express').Router();
const auth = require('../middleware/auth');
const role = require('../middleware/role');
const ctrl = require('../controllers/careerController');

router.use(auth);

// Competencies
router.post('/competencies', role('ADMIN', 'HR'), ctrl.createCompetency);
router.get('/competencies', ctrl.getCompetencies);
router.put('/competencies/:id', role('ADMIN', 'HR'), ctrl.updateCompetency);
router.delete('/competencies/:id', role('ADMIN', 'HR'), ctrl.deleteCompetency);

// Career Paths
router.post('/paths', ctrl.createCareerPath);
router.get('/paths/my', ctrl.getMyCareerPath);
router.get('/paths/all', role('ADMIN', 'HR', 'TEAM_LEADER'), ctrl.getAllCareerPaths);
router.get('/paths/user/:userId', role('ADMIN', 'HR', 'TEAM_LEADER'), ctrl.getCareerPathForUser);
router.put('/paths/:id', ctrl.updateCareerPath);
router.delete('/paths/:id', ctrl.deleteCareerPath);

// Development actions
router.post('/paths/:pathId/actions', ctrl.createDevelopmentAction);
router.put('/paths/:pathId/actions/:actionId', ctrl.updateDevAction);

// Career Recommendations
router.get('/recommendations/my', ctrl.getMyRecommendations);
router.get('/recommendations/all', role('ADMIN', 'HR', 'TEAM_LEADER'), ctrl.getAllRecommendations);
router.post('/recommendations/generate', role('ADMIN', 'HR', 'TEAM_LEADER'), ctrl.generateRecommendation);
router.post('/recommendations', role('ADMIN', 'HR', 'TEAM_LEADER'), ctrl.saveRecommendation);

module.exports = router;
