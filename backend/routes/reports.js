const express = require('express');
const router = express.Router();
const Objective = require('../models/Objective');
const Team = require('../models/Team');
const auth = require('../middleware/auth');
const role = require('../middleware/role');

function roundScore(value) {
  return Number(Number(value || 0).toFixed(2));
}

function getObjectiveScore(objective) {
  const achievement = Number.isFinite(Number(objective.achievementPercent)) ? Number(objective.achievementPercent) : 0;
  return roundScore((Number(objective.weight || 0) * achievement) / 100);
}

function summarizeObjectives(objectives) {
  const grouped = {};

  objectives.forEach((objective) => {
    const employeeId = String(objective.owner?._id || objective.owner);
    if (!grouped[employeeId]) {
      grouped[employeeId] = {
        employee: objective.owner,
        objectives: [],
      };
    }

    grouped[employeeId].objectives.push({
      _id: objective._id,
      title: objective.title,
      status: objective.status,
      weight: objective.weight,
      achievementPercent: objective.achievementPercent || 0,
      weightedScore: getObjectiveScore(objective),
      category: objective.category,
      evaluationRating: objective.evaluationRating || '',
    });
  });

  return Object.values(grouped).map((entry) => {
    const overallScore = roundScore(entry.objectives.reduce((sum, objective) => sum + objective.weightedScore, 0));
    return {
      ...entry,
      overallScore,
      totalObjectives: entry.objectives.length,
    };
  });
}

router.get('/cycle/:cycleId', auth, role('ADMIN', 'HR'), async (req, res) => {
  try {
    const { cycleId } = req.params;
    const objectives = await Objective.find({
      cycle: cycleId,
      status: { $nin: ['rejected', 'cancelled', 'archived'] },
    })
      .populate('owner', 'name email role department');

    const employees = summarizeObjectives(objectives);
    res.json({
      success: true,
      employees,
      totalEmployees: employees.length,
      totalObjectives: objectives.length,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/team/:managerId/:cycleId', auth, async (req, res) => {
  try {
    const { managerId, cycleId } = req.params;
    if (req.user.id !== managerId && req.user.role !== 'ADMIN' && req.user.role !== 'HR') {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const team = await Team.findOne({ leader: managerId });
    const memberIds = team ? team.members : [];

    const objectives = await Objective.find({
      owner: { $in: memberIds },
      cycle: cycleId,
      status: { $nin: ['rejected', 'cancelled', 'archived'] },
    })
      .populate('owner', 'name email role');

    const employees = summarizeObjectives(objectives);
    res.json({ success: true, employees, totalEmployees: employees.length });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
