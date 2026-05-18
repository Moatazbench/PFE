const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const auth = require('../middleware/auth');
const role = require('../middleware/role');
const rateLimiter = require('../middleware/rateLimiter');
const multer = require('multer');
const { storeUploadedFile } = require('../utils/fileStorage');

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only images are allowed.'), false);
  }
});

// Profile and filtering
router.get('/filter/list', rateLimiter, auth, userController.getUsers);

// Legacy/Helper endpoints (case corrected in controller)
router.get('/managers', rateLimiter, auth, userController.getManagers);
router.get('/collaborators', rateLimiter, auth, userController.getCollaborators);

// Admin management
router.get('/', rateLimiter, auth, role('ADMIN'), userController.getAllUsers);
router.get('/:id', rateLimiter, auth, role('ADMIN'), userController.getUserById);
router.delete('/:id', rateLimiter, auth, role('ADMIN'), userController.deleteUser);
router.put('/:id', rateLimiter, auth, userController.updateUser);
router.put('/:id/avatar', rateLimiter, auth, upload.single('avatar'), async function (req, res, next) {
  try {
    if (req.file) {
      req.uploadedAsset = await storeUploadedFile(req.file, {
        folder: 'avatars',
        userId: req.user.id || req.user._id,
      });
    }
    next();
  } catch (err) {
    next(err);
  }
}, userController.updateAvatar);

module.exports = router;
