const router = require('express').Router();
const auth = require('../middleware/auth');
const role = require('../middleware/role');
const ctrl = require('../controllers/taskController');

// All routes require authentication
router.use(auth);

// Create task
router.post('/', ctrl.createTask);

// Get my tasks
router.get('/my', ctrl.getMyTasks);

// Get tasks assigned by me
router.get('/assigned', ctrl.getAssignedByMe);

// Get task stats
router.get('/stats', ctrl.getStats);

// Get all tasks (admin)
router.get('/all', role('ADMIN', 'HR'), ctrl.getAllTasks);

// Get team tasks
router.get('/team/:teamId', ctrl.getTeamTasks);

// Update task
router.put('/:id', ctrl.updateTask);

// Delete task
router.delete('/:id', ctrl.deleteTask);

module.exports = router;
