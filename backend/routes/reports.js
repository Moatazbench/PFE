const express = require('express');
const router = express.Router();
const Goal = require('../models/Goal');
const GoalReview = require('../models/GoalReview');
const User = require('../models/User');
const Team = require('../models/Team');
const auth = require('../middleware/auth');
const role = require('../middleware/role');

// ========== CYCLE REPORT — all employees ==========
router.get('/cycle/:cycleId', auth, role('ADMIN', 'HR'), async (req, res) => {
  try {
    const { cycleId } = req.params;
    const goals = await Goal.find({ cycleId })
      .populate('employeeId', 'name email role department')
      .populate('managerId', 'name email');

    const reviews = await GoalReview.find({ cycleId });
    const midMap = {};
    const finalMap = {};
    reviews.forEach(r => {
      const gid = String(r.goalId);
      if (r.phase === 'midyear' && r.reviewType === 'manager_assessment') midMap[gid] = r;
      if (r.phase === 'endyear' && r.reviewType === 'manager_assessment') finalMap[gid] = r;
    });

    const employeeMap = {};
    goals.forEach(g => {
      const eid = String(g.employeeId?._id || g.employeeId);
      if (!employeeMap[eid]) {
        employeeMap[eid] = {
          employee: g.employeeId,
          manager: g.managerId,
          goals: [],
        };
      }
      employeeMap[eid].goals.push({
        _id: g._id,
        title: g.title,
        status: g.status,
        weight: g.weight,
        currentProgress: g.currentProgress,
        finalCompletion: g.finalCompletion,
        midyearData: midMap[String(g._id)] || null,
        finalData: finalMap[String(g._id)] || null,
      });
    });

    const employees = Object.values(employeeMap).map(e => {
      let wSum = 0, wTotal = 0;
      e.goals.forEach(g => {
        const c = g.finalCompletion != null ? g.finalCompletion : g.currentProgress || 0;
        wSum += (g.weight || 0) * c / 100;
        wTotal += g.weight || 0;
      });
      const score = wTotal > 0 ? Number(((wSum / wTotal) * 100).toFixed(2)) : 0;
      return { ...e, overallScore: score, totalGoals: e.goals.length };
    });

    res.json({ success: true, employees, totalEmployees: employees.length, totalGoals: goals.length });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ========== TEAM REPORT ==========
router.get('/team/:managerId/:cycleId', auth, async (req, res) => {
  try {
    const { managerId, cycleId } = req.params;
    if (req.user.id !== managerId && req.user.role !== 'ADMIN' && req.user.role !== 'HR') {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const goals = await Goal.find({ managerId, cycleId })
      .populate('employeeId', 'name email role');

    const reviews = await GoalReview.find({ cycleId, goalId: { $in: goals.map(g => g._id) } });
    const midMap = {};
    const finalMap = {};
    reviews.forEach(r => {
      const gid = String(r.goalId);
      if (r.phase === 'midyear' && r.reviewType === 'manager_assessment') midMap[gid] = r;
      if (r.phase === 'endyear' && r.reviewType === 'manager_assessment') finalMap[gid] = r;
    });

    const employeeMap = {};
    goals.forEach(g => {
      const eid = String(g.employeeId._id);
      if (!employeeMap[eid]) {
        employeeMap[eid] = { employee: g.employeeId, goals: [] };
      }
      employeeMap[eid].goals.push({
        _id: g._id, title: g.title, status: g.status, weight: g.weight,
        currentProgress: g.currentProgress, finalCompletion: g.finalCompletion,
        midyearData: midMap[String(g._id)] || null,
        finalData: finalMap[String(g._id)] || null,
      });
    });

    const employees = Object.values(employeeMap).map(e => {
      let wSum = 0, wTotal = 0;
      e.goals.forEach(g => {
        const c = g.finalCompletion != null ? g.finalCompletion : g.currentProgress || 0;
        wSum += (g.weight || 0) * c / 100;
        wTotal += g.weight || 0;
      });
      return { ...e, overallScore: wTotal > 0 ? Number(((wSum / wTotal) * 100).toFixed(2)) : 0, totalGoals: e.goals.length };
    });

    res.json({ success: true, employees, totalEmployees: employees.length });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
