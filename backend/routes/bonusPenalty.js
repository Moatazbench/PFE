const express = require('express');
const router = express.Router();
const BonusPenalty = require('../models/BonusPenalty');
const auth = require('../middleware/auth');
const role = require('../middleware/role');
const FinalEvaluation = require('../models/FinalEvaluation');
const HRDecision = require('../models/HRDecision');
const { createNotification } = require('../utils/notificationHelper');
const { canAccessEmployee, canManageEmployee } = require('../utils/accessControl');

// POST /api/bonus-penalty — Create a new bonus/penalty (HR and Admin only)
router.post('/', auth, role('ADMIN', 'HR', 'TEAM_LEADER'), async function (req, res) {
  try {
    const { employee, type, value, reason, finalEvaluation, hrDecision, objective, approvalStatus, paymentDate } = req.body;

    if (!employee) {
      return res.status(400).json({ success: false, message: 'Employee is required.' });
    }
    if (!finalEvaluation) {
      return res.status(400).json({ success: false, message: 'A validated final evaluation is required.' });
    }
    if (!type || !['bonus', 'penalty'].includes(type)) {
      return res.status(400).json({ success: false, message: 'Type must be "bonus" or "penalty".' });
    }
    if (value == null || !Number.isFinite(Number(value)) || Number(value) <= 0) {
      return res.status(400).json({ success: false, message: 'Value must be a positive number greater than zero.' });
    }
    if (!reason || !reason.trim()) {
      return res.status(400).json({ success: false, message: 'Reason is required.' });
    }
    if (!(await canManageEmployee(req.user, employee))) {
      return res.status(403).json({ success: false, message: 'You can only recommend records for employees you manage.' });
    }

    const linkedEvaluation = await FinalEvaluation.findOne({ _id: finalEvaluation, employee_id: employee, status: { $in: ['validated', 'closed'] } });
    if (!linkedEvaluation) {
      return res.status(400).json({ success: false, message: 'A validated final evaluation is required.' });
    }
    const duplicate = await BonusPenalty.exists({ finalEvaluation: linkedEvaluation._id, type });
    if (duplicate) {
      return res.status(409).json({ success: false, message: `A ${type} record already exists for this final evaluation.` });
    }
    const linkedDecision = hrDecision
      ? await HRDecision.findOne({ _id: hrDecision, user: employee, finalEvaluation: linkedEvaluation._id })
      : await HRDecision.findOne({ user: employee, finalEvaluation: linkedEvaluation._id });

    const record = await BonusPenalty.create({
      employee: employee,
      assignedBy: req.user.id || req.user._id,
      type: type,
      value: Number(value),
      reason: reason.trim(),
      finalEvaluation: linkedEvaluation._id,
      hrDecision: linkedDecision?._id || null,
      objective: objective || null,
      approvalStatus: req.user.role === 'TEAM_LEADER'
        ? 'pending'
        : (['pending', 'approved', 'rejected'].includes(approvalStatus) ? approvalStatus : 'approved'),
      paymentDate: paymentDate || null
    });

    const populated = await BonusPenalty.findById(record._id)
      .populate('employee', 'name email role')
      .populate('assignedBy', 'name email role');
    await populated.populate('finalEvaluation', 'final_score rating_label status');
    await populated.populate('hrDecision', 'action actionLabel');
    await populated.populate('objective', 'title weight');

    res.status(201).json({ success: true, record: populated });
  } catch (err) {
    console.error('Create bonus/penalty error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/:id/approval', auth, role('HR', 'ADMIN'), async function (req, res) {
  try {
    if (!['approved', 'rejected'].includes(req.body.approvalStatus)) {
      return res.status(400).json({ success: false, message: 'Approval status must be approved or rejected.' });
    }
    const reviewNotes = String(req.body.reviewNotes || '').trim();
    if (req.body.approvalStatus === 'rejected' && !reviewNotes) {
      return res.status(400).json({
        success: false,
        message: 'A documentation correction reason is required before sending the recommendation back.'
      });
    }
    const record = await BonusPenalty.findById(req.params.id);
    if (!record) return res.status(404).json({ success: false, message: 'Record not found.' });
    record.approvalStatus = req.body.approvalStatus;
    record.reviewNotes = reviewNotes;
    record.reviewedBy = req.user.id || req.user._id;
    record.reviewedAt = new Date();
    if (req.body.paymentDate !== undefined) record.paymentDate = req.body.paymentDate || null;
    await record.save();
    if (record.approvalStatus === 'rejected' && record.assignedBy) {
      await createNotification({
        recipientId: record.assignedBy,
        senderId: req.user.id || req.user._id,
        type: 'EVALUATION_REJECTED',
        title: 'Compensation documentation needs correction',
        message: `HR sent the ${record.type} recommendation back for documentation: ${reviewNotes}`,
        link: '/bonus-penalty'
      });
    }
    const populated = await BonusPenalty.findById(record._id)
      .populate('employee', 'name email role')
      .populate('assignedBy', 'name email role')
      .populate('reviewedBy', 'name role');
    res.json({ success: true, record: populated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/eligible-evaluations', auth, role('ADMIN', 'HR', 'TEAM_LEADER'), async function (req, res) {
  try {
    const evaluations = await FinalEvaluation.find({ status: { $in: ['validated', 'closed'] } })
      .populate('employee_id', 'name email role team')
      .populate('cycle_id', 'name year')
      .sort({ updatedAt: -1 })
      .limit(250);
    const used = await BonusPenalty.find({ finalEvaluation: { $in: evaluations.map((item) => item._id) } }).select('finalEvaluation type');
    const usedByEvaluation = used.reduce((map, item) => {
      const key = String(item.finalEvaluation);
      map[key] = map[key] || [];
      map[key].push(item.type);
      return map;
    }, {});

    const eligible = [];
    for (const evaluation of evaluations) {
      const employeeId = evaluation.employee_id?._id || evaluation.employee_id;
      if (await canAccessEmployee(req.user, employeeId, { allowSelf: false, allowHr: true })) {
        eligible.push({
          _id: evaluation._id,
          employee: evaluation.employee_id,
          cycle: evaluation.cycle_id,
          status: evaluation.status,
          final_score: evaluation.final_score,
          rating_label: evaluation.rating_label,
          existingTypes: usedByEvaluation[String(evaluation._id)] || []
        });
      }
    }

    res.json({ success: true, evaluations: eligible });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/', auth, role('HR', 'ADMIN'), async function (req, res) {
  try {
    const records = await BonusPenalty.find({})
      .populate('employee', 'name email role')
      .populate('assignedBy', 'name email role')
      .populate('reviewedBy', 'name role')
      .populate('finalEvaluation', 'final_score rating_label status')
      .populate('hrDecision', 'action actionLabel')
      .populate('objective', 'title weight')
      .sort({ createdAt: -1 });
    res.json({ success: true, records });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/bonus-penalty/employee/:employeeId — Get all records for an employee
// Allowed: HR, Admin, and the employee's direct manager (team leader)
router.get('/employee/:employeeId', auth, async function (req, res) {
  try {
    const { employeeId } = req.params;

    // HR and Admin can always access
    if (req.user.role !== 'HR' && req.user.role !== 'ADMIN' && currentUserId !== String(employeeId)) {
      if (!(await canAccessEmployee(req.user, employeeId, { allowSelf: true, allowHr: true }))) {
        return res.status(403).json({ success: false, message: 'Forbidden: You are not authorized to view this data.' });
      }
    }

    const records = await BonusPenalty.find({ employee: employeeId })
      .populate('employee', 'name email role')
      .populate('assignedBy', 'name email role')
      .populate('reviewedBy', 'name role')
      .populate('finalEvaluation', 'final_score rating_label status')
      .populate('hrDecision', 'action actionLabel')
      .populate('objective', 'title weight')
      .sort({ createdAt: -1 });

    res.json({ success: true, records: records });
  } catch (err) {
    console.error('Get bonus/penalty error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
