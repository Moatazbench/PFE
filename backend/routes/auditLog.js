const express = require('express');
const router = express.Router();
const AuditLog = require('../models/AuditLog');
const auth = require('../middleware/auth');
const role = require('../middleware/role');

router.get('/', auth, role('ADMIN', 'HR'), async function (req, res) {
  try {
    var query = {};
    if (req.query.entityType) {
      query.$or = [{ entityType: req.query.entityType }, { entity_type: req.query.entityType }];
    }
    if (req.query.action) query.action = req.query.action;
    if (req.query.userId) query.user = req.query.userId;
    if (req.query.entityId) query.entityId = req.query.entityId;

    var from = req.query.from || req.query.startDate;
    var to = req.query.to || req.query.endDate;
    if (from || to) {
      query.timestamp = {};
      if (from) query.timestamp.$gte = new Date(from);
      if (to) {
        var endDate = new Date(to);
        endDate.setHours(23, 59, 59, 999);
        query.timestamp.$lte = endDate;
      }
    }

    var page = parseInt(req.query.page) || 1;
    var limit = parseInt(req.query.limit) || 50;
    var skip = (page - 1) * limit;

    var total = await AuditLog.countDocuments(query);
    var logs = await AuditLog.find(query)
      .populate('user', 'name email role')
      .populate('user_id', 'name email role')
      .sort({ timestamp: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit);

    var normalizedLogs = logs.map(function (log) {
      var item = log.toObject();
      item.entityType = item.entityType || item.entity_type || 'record';
      item.entityId = item.entityId || item.entity_id || null;
      item.userName = item.userName || item.user?.name || item.user_id?.name || 'System';
      item.userRole = item.userRole || item.user?.role || item.user_id?.role || '';
      item.timestamp = item.timestamp || item.createdAt;
      item.description = item.description || item.metadata?.description || '';
      item.entityName = item.entityName || item.metadata?.entityName || item.metadata?.name || '';
      return item;
    });

    res.json({
      success: true,
      logs: normalizedLogs,
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
      .sort({ timestamp: -1, createdAt: -1 })
      .limit(100);
    res.json({ success: true, logs: logs });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
