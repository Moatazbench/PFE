const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const auth = require('../middleware/auth');
const role = require('../middleware/role');
const rateLimiter = require('../middleware/rateLimiter');
const multer = require('multer');
const path = require('path');

// Storage config for avatars
const storage = multer.diskStorage({
  destination: function (req, file, cb) { cb(null, 'uploads/avatars/'); },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, req.user.id + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only images are allowed.'), false);
  }
});

// Admin management
router.get('/', rateLimiter, auth, role('ADMIN'), userController.getAllUsers);
router.get('/:id', rateLimiter, auth, role('ADMIN'), userController.getUserById);
router.delete('/:id', rateLimiter, auth, role('ADMIN'), userController.deleteUser);
router.put('/:id', rateLimiter, auth, userController.updateUser);

// Profile and filtering
router.get('/filter/list', rateLimiter, auth, userController.getUsers);
router.put('/:id/avatar', rateLimiter, auth, upload.single('avatar'), userController.updateAvatar);

// Legacy/Helper endpoints (case corrected in controller)
router.get('/managers', rateLimiter, auth, userController.getManagers);
router.get('/collaborators', rateLimiter, auth, userController.getCollaborators);

module.exports = router;