const express = require('express');
const router = express.Router();
const checkInController = require('../controllers/checkInController');
const auth = require('../middleware/auth');
const role = require('../middleware/role');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { storeUploadedFile, UPLOAD_ROOT } = require('../utils/fileStorage');
const CheckIn = require('../models/CheckIn');
const { canAccessEmployee } = require('../utils/accessControl');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    // Allow common document and image types
    const allowed = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.png', '.jpg', '.jpeg', '.gif', '.txt', '.csv', '.zip'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('File type not allowed. Supported: ' + allowed.join(', ')), false);
  }
});

router.use(auth);

// File upload for check-in attachments (MUST be before generic POST /)
router.post('/upload', upload.single('file'), async function (req, res) {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded.' });
    const stored = await storeUploadedFile(req.file, {
      folder: 'checkins',
      userId: req.user.id || req.user._id,
    });
    res.json({
      success: true,
      attachment: stored
    });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/attachments/:filename', async function (req, res) {
  try {
    const filename = path.basename(req.params.filename || '');
    if (!filename || filename !== req.params.filename) {
      return res.status(400).json({ success: false, message: 'Invalid file path.' });
    }

    const possibleUrls = [
      '/api/checkins/attachments/' + filename,
      '/uploads/checkins/' + filename
    ];
    const checkIn = await CheckIn.findOne({ 'attachments.url': { $in: possibleUrls } }).select('employee_id');
    if (!checkIn) return res.status(404).json({ success: false, message: 'Attachment not found.' });
    if (!(await canAccessEmployee(req.user, checkIn.employee_id, { allowSelf: true, allowHr: true }))) {
      return res.status(403).json({ success: false, message: 'You are not authorized to download this attachment.' });
    }

    const filePath = path.join(UPLOAD_ROOT, 'checkins', filename);
    if (!filePath.startsWith(path.join(UPLOAD_ROOT, 'checkins')) || !fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: 'Attachment file not found.' });
    }
    res.download(filePath);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Employee routes
router.get('/', checkInController.getCheckIns);
router.post('/', checkInController.submitCheckIn);
router.get('/objective/:objective_id/tasks', checkInController.getTasksForObjective);

// Manager routes
router.get('/by-objective', role('ADMIN', 'HR', 'TEAM_LEADER'), checkInController.getCheckInsByObjective);
router.get('/team', role('ADMIN', 'HR', 'TEAM_LEADER'), checkInController.getTeamCheckIns);
router.put('/:id/review', role('ADMIN', 'HR', 'TEAM_LEADER'), checkInController.reviewCheckIn);

module.exports = router;
