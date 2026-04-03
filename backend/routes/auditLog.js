const express = require('express');
const router = express.Router();
const AuditLog = require('../models/AuditLog');
const auth = require('../middleware/auth');
const role = require('../middleware/role');

router.get('/', auth, role('ADMIN', 'HR'), async function (req, res) {
  try {
    var query = {};
    if (req.query.entityType) query.entityType = req.query.entityType;
    if (req.query.action) query.action = req.query.action;
    if (req.query.userId) query.user = req.query.userId;
    if (req.query.entityId) query.entityId = req.query.entityId;

    if (req.query.from || req.query.to) {
      query.createdAt = {};
      if (req.query.from) query.createdAt.$gte = new Date(req.query.from);
      if (req.query.to) query.createdAt.$lte = new Date(req.query.to);
    }

    var page = parseInt(req.query.page) || 1;
    var limit = parseInt(req.query.limit) || 50;
    var skip = (page - 1) * limit;

    var total = await AuditLog.countDocuments(query);
    var logs = await AuditLog.find(query)
      .populate('user', 'name email role')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.json({
      success: true,
      logs: logs,
      pagination: { page: page, limit: limit, total: total, pages: Math.ceil(total / limit) }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/entity/:entityType/:entityId', auth, role('ADMIN', 'HR', 'TEAM_LEADER'), async function (req, res) {
  try {
    var logs = await AuditLog.find({
      entityType: req.params.entityType,
      entityId: req.params.entityId
    })
      .populate('user', 'name email')
      .sort({ createdAt: -1 })
      .limit(100);
    res.json({ success: true, logs: logs });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;