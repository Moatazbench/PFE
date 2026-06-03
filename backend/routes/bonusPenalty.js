const express = require('express');
const router = express.Router();
const BonusPenalty = require('../models/BonusPenalty');
const Team = require('../models/Team');
const auth = require('../middleware/auth');
const role = require('../middleware/role');

// POST /api/bonus-penalty — Create a new bonus/penalty (HR and Admin only)
router.post('/', auth, role('HR', 'ADMIN'), async function (req, res) {
  try {
    const { employee, type, value, reason } = req.body;

    if (!employee) {
      return res.status(400).json({ success: false, message: 'Employee is required.' });
    }
    if (!type || !['bonus', 'penalty'].includes(type)) {
      return res.status(400).json({ success: false, message: 'Type must be "bonus" or "penalty".' });
    }
    if (value == null || !Number.isFinite(Number(value))) {
      return res.status(400).json({ success: false, message: 'A valid numeric value is required.' });
    }
    if (!reason || !reason.trim()) {
      return res.status(400).json({ success: false, message: 'Reason is required.' });
    }

    const record = await BonusPenalty.create({
      employee: employee,
      assignedBy: req.user.id || req.user._id,
      type: type,
      value: Number(value),
      reason: reason.trim()
    });

    const populated = await BonusPenalty.findById(record._id)
      .populate('employee', 'name email role')
      .populate('assignedBy', 'name email role');

    res.status(201).json({ success: true, record: populated });
  } catch (err) {
    console.error('Create bonus/penalty error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/bonus-penalty/employee/:employeeId — Get all records for an employee
// Allowed: HR, Admin, and the employee's direct manager (team leader)
router.get('/employee/:employeeId', auth, async function (req, res) {
  try {
    const { employeeId } = req.params;
    const currentUserId = String(req.user.id || req.user._id);

    // HR and Admin can always access
    if (req.user.role !== 'HR' && req.user.role !== 'ADMIN') {
      // Check if the current user is the employee's direct manager (team leader)
      const team = await Team.findOne({ leader: currentUserId, members: employeeId });
      if (!team) {
        return res.status(403).json({ success: false, message: 'Forbidden: You are not authorized to view this data.' });
      }
    }

    const records = await BonusPenalty.find({ employee: employeeId })
      .populate('employee', 'name email role')
      .populate('assignedBy', 'name email role')
      .sort({ createdAt: -1 });

    res.json({ success: true, records: records });
  } catch (err) {
    console.error('Get bonus/penalty error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
