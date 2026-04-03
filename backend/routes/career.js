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
router.put('/paths/:pathId/actions/:actionId', ctrl.updateDevAction);

module.exports = router;
