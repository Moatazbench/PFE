const express = require('express');
const router = express.Router();
const Goal = require('../models/Goal');
const GoalReview = require('../models/GoalReview');
const Cycle = require('../models/Cycle');
const User = require('../models/User');
const Team = require('../models/Team');
const auth = require('../middleware/auth');
const role = require('../middleware/role');

// ========== ADMIN DASHBOARD ==========
router.get('/admin/:cycleId', auth, role('ADMIN', 'HR'), async (req, res) => {
  try {
    const { cycleId } = req.params;
    const cycle = await Cycle.findById(cycleId);
    if (!cycle) return res.status(404).json({ success: false, message: 'Cycle not found' });

    const totalEmployees = await User.countDocuments({ isActive: { $ne: false } });
    const goals = await Goal.find({ cycleId });

    // Phase 1 stats
    const statusCounts = {};
    goals.forEach(g => { statusCounts[g.status] = (statusCounts[g.status] || 0) + 1; });

    const employeeGoals = {};
    goals.forEach(g => {
      const eid = String(g.employeeId);
      if (!employeeGoals[eid]) employeeGoals[eid] = { total: 0, approved: 0 };
      employeeGoals[eid].total++;
      if (['approved', 'midyear_assessed', 'final_evaluated', 'locked'].includes(g.status)) employeeGoals[eid].approved++;
    });
    const employeesComplete = Object.values(employeeGoals).filter(e => e.total > 0 && e.approved === e.total).length;
    const employeesIncomplete = Object.values(employeeGoals).filter(e => e.total > 0 && e.approved < e.total).length;
    const totalEmployeesWithGoals = Object.keys(employeeGoals).length;

    // Phase 2 stats
    const eligibleForMidyear = goals.filter(g => ['approved', 'midyear_assessed', 'final_evaluated', 'locked'].includes(g.status));
    const midyearReviews = await GoalReview.find({ cycleId, phase: 'midyear', reviewType: 'manager_assessment' });
    const midyearAssessedIds = new Set(midyearReviews.map(r => String(r.goalId)));

    // Phase 3 stats
    const eligibleForFinal = goals.filter(g => ['approved', 'midyear_assessed', 'final_evaluated', 'locked'].includes(g.status));
    const finalReviews = await GoalReview.find({ cycleId, phase: 'endyear', reviewType: 'manager_assessment' });
    const finalEvaluatedIds = new Set(finalReviews.map(r => String(r.goalId)));

    // Average performance score
    let totalScore = 0;
    let scoredCount = 0;
    const employeeIds = [...new Set(goals.map(g => String(g.employeeId)))];
    for (const eid of employeeIds) {
      const eGoals = goals.filter(g => String(g.employeeId) === eid);
      let wSum = 0, wTotal = 0;
      eGoals.forEach(g => {
        const c = g.finalCompletion != null ? g.finalCompletion : g.currentProgress || 0;
        wSum += (g.weight || 0) * c / 100;
        wTotal += g.weight || 0;
      });
      if (wTotal > 0) { totalScore += (wSum / wTotal) * 100; scoredCount++; }
    }

    res.json({
      success: true,
      cycle: { _id: cycle._id, name: cycle.name, year: cycle.year, currentPhase: cycle.currentPhase, status: cycle.status },
      totalEmployees,
      phase1: {
        totalGoals: goals.length,
        statusCounts,
        employeesComplete,
        employeesIncomplete,
        validationCompletion: totalEmployeesWithGoals > 0 ? Number(((employeesComplete / totalEmployeesWithGoals) * 100).toFixed(1)) : 0,
      },
      phase2: {
        totalEligible: eligibleForMidyear.length,
        assessed: midyearAssessedIds.size,
        notAssessed: eligibleForMidyear.length - midyearAssessedIds.size,
        completionPercentage: eligibleForMidyear.length > 0 ? Number(((midyearAssessedIds.size / eligibleForMidyear.length) * 100).toFixed(1)) : 0,
      },
      phase3: {
        totalEligible: eligibleForFinal.length,
        evaluated: finalEvaluatedIds.size,
        notEvaluated: eligibleForFinal.length - finalEvaluatedIds.size,
        completionPercentage: eligibleForFinal.length > 0 ? Number(((finalEvaluatedIds.size / eligibleForFinal.length) * 100).toFixed(1)) : 0,
        averagePerformanceScore: scoredCount > 0 ? Number((totalScore / scoredCount).toFixed(2)) : 0,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ========== MANAGER DASHBOARD ==========
router.get('/manager/:managerId/:cycleId', auth, async (req, res) => {
  try {
    const { managerId, cycleId } = req.params;
    if (req.user.id !== managerId && req.user.role !== 'ADMIN' && req.user.role !== 'HR') {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const goals = await Goal.find({ managerId, cycleId })
      .populate('employeeId', 'name email role');

    const employeeMap = {};
    goals.forEach(g => {
      const eid = String(g.employeeId._id);
      if (!employeeMap[eid]) {
        employeeMap[eid] = {
          employee: { _id: g.employeeId._id, name: g.employeeId.name, email: g.employeeId.email },
          totalGoals: 0, statusCounts: {}, approvedCount: 0,
        };
      }
      employeeMap[eid].totalGoals++;
      employeeMap[eid].statusCounts[g.status] = (employeeMap[eid].statusCounts[g.status] || 0) + 1;
      if (['approved', 'midyear_assessed', 'final_evaluated', 'locked'].includes(g.status)) employeeMap[eid].approvedCount++;
    });

    // Enrich with midyear/endyear completion
    const midyearReviews = await GoalReview.find({ cycleId, reviewType: 'manager_assessment', phase: 'midyear' });
    const finalReviews = await GoalReview.find({ cycleId, reviewType: 'manager_assessment', phase: 'endyear' });
    const midSet = new Set(midyearReviews.map(r => String(r.goalId)));
    const finalSet = new Set(finalReviews.map(r => String(r.goalId)));

    const teamMembers = Object.values(employeeMap).map(e => {
      const empGoals = goals.filter(g => String(g.employeeId._id) === String(e.employee._id));
      const midComplete = empGoals.filter(g => midSet.has(String(g._id))).length;
      const finalComplete = empGoals.filter(g => finalSet.has(String(g._id))).length;
      let score = null;
      let wSum = 0, wTotal = 0;
      empGoals.forEach(g => {
        const c = g.finalCompletion != null ? g.finalCompletion : g.currentProgress || 0;
        wSum += (g.weight || 0) * c / 100;
        wTotal += g.weight || 0;
      });
      if (wTotal > 0) score = Number(((wSum / wTotal) * 100).toFixed(2));

      return {
        ...e,
        validationPercentage: e.totalGoals > 0 ? Number(((e.approvedCount / e.totalGoals) * 100).toFixed(1)) : 0,
        midyearComplete: midComplete === e.approvedCount && e.approvedCount > 0,
        midyearCount: midComplete,
        endyearComplete: finalComplete === e.approvedCount && e.approvedCount > 0,
        endyearCount: finalComplete,
        overallScore: score,
      };
    });

    res.json({ success: true, teamMembers });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ========== EMPLOYEE DASHBOARD ==========
router.get('/employee/:employeeId/:cycleId', auth, async (req, res) => {
  try {
    const { employeeId, cycleId } = req.params;
    if (req.user.id !== employeeId && req.user.role !== 'ADMIN' && req.user.role !== 'HR') {
      const goals = await Goal.find({ employeeId, cycleId });
      const isManager = goals.some(g => String(g.managerId) === String(req.user.id));
      if (!isManager) return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const goals = await Goal.find({ employeeId, cycleId })
      .populate('cycleId', 'name year currentPhase status');

    const reviews = await GoalReview.find({ cycleId, goalId: { $in: goals.map(g => g._id) } });

    // Score
    let wSum = 0, wTotal = 0;
    goals.forEach(g => {
      const c = g.finalCompletion != null ? g.finalCompletion : g.currentProgress || 0;
      wSum += (g.weight || 0) * c / 100;
      wTotal += g.weight || 0;
    });
    const weightedAvg = wTotal > 0 ? Number(((wSum / wTotal) * 100).toFixed(2)) : 0;

    let label = 'Below Expectations';
    if (weightedAvg >= 100) label = 'Exceeded Expectations';
    else if (weightedAvg >= 80) label = 'Achieved';
    else if (weightedAvg >= 50) label = 'Partially Achieved';

    const total = goals.length;
    const approved = goals.filter(g => ['approved', 'midyear_assessed', 'final_evaluated', 'locked'].includes(g.status)).length;

    res.json({
      success: true,
      goals: goals.map(g => ({
        _id: g._id, title: g.title, status: g.status, weight: g.weight,
        currentProgress: g.currentProgress, finalCompletion: g.finalCompletion,
        category: g.category, priority: g.priority, dueDate: g.dueDate,
      })),
      reviews,
      totalGoals: total,
      approvedCount: approved,
      validationPercentage: total > 0 ? Number(((approved / total) * 100).toFixed(1)) : 0,
      performanceScore: weightedAvg,
      performanceLabel: label,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ========== MANUAL DEADLINE CHECK (Admin) ==========
router.post('/admin/check-deadlines', auth, role('ADMIN'), async (req, res) => {
  try {
    const { checkGoalDeadlines } = require('../cron/goalDeadlineCron');
    const result = await checkGoalDeadlines();
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
