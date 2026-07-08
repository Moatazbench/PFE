const express = require('express');
const router = express.Router();
const HRDecision = require('../models/HRDecision');
const User = require('../models/User');
const auth = require('../middleware/auth');
const role = require('../middleware/role');
const Team = require('../models/Team');
const FinalEvaluation = require('../models/FinalEvaluation');

async function getManagedEmployeeIds(managerId) {
  const managedIds = new Set();
  const rootTeams = await Team.find({ leader: managerId }).select('_id members');
  let queue = rootTeams.map((team) => team._id);
  rootTeams.forEach((team) => (team.members || []).forEach((member) => managedIds.add(String(member))));
  while (queue.length) {
    const children = await Team.find({ parentTeam: { $in: queue } }).select('_id members');
    queue = children.map((team) => team._id);
    children.forEach((team) => (team.members || []).forEach((member) => managedIds.add(String(member))));
  }
  const directReports = await User.find({ manager: managerId, isDeleted: false }).select('_id');
  directReports.forEach((user) => managedIds.add(String(user._id)));
  return Array.from(managedIds);
}

// Get all HR decisions
router.get('/', auth, async function (req, res) {
  try {
    var query = {};

    // Collaborator can only see their own
    if (req.user.role === 'COLLABORATOR') {
      query.user = req.user.id;
    }

    // Manager can see their team's decisions
    if (req.user.role === 'TEAM_LEADER') {
      const managedIds = await getManagedEmployeeIds(req.user.id);
      query.user = { $in: managedIds };
    }

    // Admin and HR can see all

    var decisions = await HRDecision.find(query)
      .populate('user', 'name email role')
      .populate('cycle', 'name year currentPhase')
      .populate('finalEvaluation', 'final_score rating_label status objective_breakdown')
      .populate('decidedBy', 'name')
      .sort({ createdAt: -1 });

    res.json(decisions);
  } catch (err) {
    console.error('Get HR decisions error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get single HR decision
router.get('/:id', auth, async function (req, res) {
  try {
    var decision = await HRDecision.findById(req.params.id)
      .populate('user', 'name email role')
      .populate('cycle', 'name year currentPhase')
      .populate('finalEvaluation', 'final_score rating_label status objective_breakdown')
      .populate('decidedBy', 'name');

    if (!decision) {
      return res.status(404).json({ message: 'HR Decision not found' });
    }

    // Check access
    if (req.user.role === 'COLLABORATOR' && decision.user._id.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Access denied' });
    }
    if (req.user.role === 'TEAM_LEADER') {
      const managedIds = await getManagedEmployeeIds(req.user.id);
      if (!managedIds.includes(String(decision.user._id))) {
        return res.status(403).json({ message: 'Access denied: employee is outside your managed teams.' });
      }
    }

    res.json(decision);
  } catch (err) {
    console.error('Get HR decision error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create HR decision - Admin and HR only
router.post('/', auth, role('ADMIN', 'HR'), async function (req, res) {
  try {
    var { user, cycle, finalEvaluation, finalScore, action, actionLabel, notes } = req.body;
    if (!finalEvaluation) {
      return res.status(400).json({ message: 'A validated final evaluation is required.' });
    }
    const linkedEvaluation = await FinalEvaluation.findOne({
      _id: finalEvaluation,
      employee_id: user,
      cycle_id: cycle,
      status: { $in: ['validated', 'closed'] }
    });
    if (!linkedEvaluation) {
      return res.status(400).json({ message: 'The final evaluation must be validated and match the selected employee and cycle.' });
    }

    var decision = new HRDecision({
      user: user,
      cycle: cycle,
      finalEvaluation: finalEvaluation,
      finalScore: linkedEvaluation.final_score ?? finalScore,
      action: action,
      actionLabel: actionLabel,
      notes: notes || '',
      decidedBy: req.user.id,
      decidedAt: new Date()
    });

    await decision.save();

    var populated = await HRDecision.findById(decision._id)
      .populate('user', 'name email role')
      .populate('cycle', 'name year currentPhase')
      .populate('finalEvaluation', 'final_score rating_label status objective_breakdown')
      .populate('decidedBy', 'name');

    res.status(201).json(populated);
  } catch (err) {
    console.error('Create HR decision error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update HR decision - Admin and HR only
router.put('/:id', auth, role('ADMIN', 'HR'), async function (req, res) {
  try {
    var { action, actionLabel, notes } = req.body;

    var decision = await HRDecision.findById(req.params.id);
    if (!decision) {
      return res.status(404).json({ message: 'HR Decision not found' });
    }

    if (action) decision.action = action;
    if (actionLabel) decision.actionLabel = actionLabel;
    if (notes !== undefined) decision.notes = notes;
    decision.decidedBy = req.user.id;
    decision.decidedAt = new Date();

    await decision.save();

    var populated = await HRDecision.findById(decision._id)
      .populate('user', 'name email role')
      .populate('cycle', 'name year currentPhase')
      .populate('finalEvaluation', 'final_score rating_label status objective_breakdown')
      .populate('decidedBy', 'name');

    res.json(populated);
  } catch (err) {
    console.error('Update HR decision error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete HR decision - Admin only
router.delete('/:id', auth, role('ADMIN'), async function (req, res) {
  try {
    var decision = await HRDecision.findById(req.params.id);
    if (!decision) {
      return res.status(404).json({ message: 'HR Decision not found' });
    }

    await HRDecision.findByIdAndDelete(req.params.id);
    res.json({ message: 'HR Decision deleted' });
  } catch (err) {
    console.error('Delete HR decision error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
