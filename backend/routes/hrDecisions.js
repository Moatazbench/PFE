const express = require('express');
const router = express.Router();
const HRDecision = require('../models/HRDecision');
const User = require('../models/User');
const auth = require('../middleware/auth');
const role = require('../middleware/role');

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
      const Team = require('../models/Team');
      var team = await Team.findOne({ leader: req.user.id }).select('members');
      if (team && team.members && team.members.length > 0) {
        query.user = { $in: team.members };
      }
    }

    // Admin and HR can see all

    var decisions = await HRDecision.find(query)
      .populate('user', 'name email role')
      .populate('cycle', 'name year currentPhase')
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
      .populate('decidedBy', 'name');

    if (!decision) {
      return res.status(404).json({ message: 'HR Decision not found' });
    }

    // Check access
    if (req.user.role === 'COLLABORATOR' && decision.user._id.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Access denied' });
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
    var { user, cycle, finalScore, action, actionLabel, notes } = req.body;

    var decision = new HRDecision({
      user: user,
      cycle: cycle,
      finalScore: finalScore,
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
