const express = require('express');
const router = express.Router();
const Team = require('../models/Team');
const User = require('../models/User');
const auth = require('../middleware/auth');
const role = require('../middleware/role');
const rateLimiter = require('../middleware/rateLimiter');
const { createNotification } = require('../utils/notificationHelper');

// Get all teams (ADMIN, HR, TEAM_LEADER)
router.get('/', rateLimiter, auth, role('ADMIN', 'HR', 'TEAM_LEADER'), async function (req, res) {
  try {
    var teams = await Team.find({})
      .populate('leader', 'name email role')
      .populate('members', 'name email role')
      .populate('createdBy', 'name')
      .sort({ createdAt: -1 });
    res.json(teams);
  } catch (err) {
    console.error('Get teams error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get my team (ALL authenticated users — employees can see their own team)
router.get('/my-team', rateLimiter, auth, async function (req, res) {
  try {
    var userId = req.user.id || req.user._id;

    // Check if user is a team leader
    var team = await Team.findOne({ leader: userId })
      .populate('leader', 'name email role')
      .populate('members', 'name email role');

    // Check if user is a team member
    if (!team) {
      team = await Team.findOne({ members: userId })
        .populate('leader', 'name email role')
        .populate('members', 'name email role');
    }

    if (!team) {
      return res.status(404).json({ success: false, message: 'You are not assigned to any team.' });
    }

    res.json({ success: true, team: team });
  } catch (err) {
    console.error('Get my team error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get single team (ADMIN, HR, TEAM_LEADER)
router.get('/:id', rateLimiter, auth, role('ADMIN', 'HR', 'TEAM_LEADER'), async function (req, res) {
  try {
    var team = await Team.findById(req.params.id)
      .populate('leader', 'name email role')
      .populate('members', 'name email role')
      .populate('createdBy', 'name');
    if (!team) {
      return res.status(404).json({ message: 'Team not found' });
    }
    res.json(team);
  } catch (err) {
    console.error('Get team error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create team (ADMIN, HR, TEAM_LEADER)
router.post('/', rateLimiter, auth, role('ADMIN', 'HR', 'TEAM_LEADER'), async function (req, res) {
  try {
    var { name, description, leader, members } = req.body;
    var team = new Team({
      name: name,
      description: description || '',
      leader: leader || null,
      members: members || [],
      createdBy: req.user.id
    });
    await team.save();

    if (leader) {
      await User.findByIdAndUpdate(leader, { team: team._id });
    }

    // Update all members' team reference
    if (members && members.length > 0) {
      await User.updateMany(
        { _id: { $in: members } },
        { team: team._id }
      );
    }

    var populated = await Team.findById(team._id)
      .populate('leader', 'name email role')
      .populate('members', 'name email role')
      .populate('createdBy', 'name');

    // === FEATURE: Notify every assigned member about the team assignment ===
    const creatorName = req.user.name || 'An administrator';
    const notifyIds = [];
    if (leader) notifyIds.push(leader.toString());
    if (members) members.forEach(m => { if (m.toString() !== req.user.id.toString()) notifyIds.push(m.toString()); });

    // Deduplicate
    const uniqueNotifyIds = [...new Set(notifyIds)];
    for (const memberId of uniqueNotifyIds) {
      await createNotification({
        recipientId: memberId,
        senderId: req.user.id,
        type: 'GOAL_UPDATE',
        title: 'You have been added to a team',
        message: `${creatorName} has added you to the team "${name}".`,
        link: '/teams'
      });
    }

    res.status(201).json(populated);
  } catch (err) {
    console.error('Create team error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update team (ADMIN, HR, TEAM_LEADER)
router.put('/:id', rateLimiter, auth, role('ADMIN', 'HR', 'TEAM_LEADER'), async function (req, res) {
  try {
    var { name, description, leader, members } = req.body;
    var team = await Team.findById(req.params.id);
    if (!team) {
      return res.status(404).json({ message: 'Team not found' });
    }

    // Track previously assigned members to detect new ones
    const prevMembers = team.members.map(m => m.toString());
    const prevLeader = team.leader ? team.leader.toString() : null;

    // Clear old team references
    await User.updateMany(
      { team: team._id },
      { $unset: { team: 1 } }
    );

    if (name) team.name = name;
    if (description !== undefined) team.description = description;
    if (leader !== undefined) team.leader = leader || null;
    if (members !== undefined) team.members = members || [];
    await team.save();

    if (team.leader) {
      await User.findByIdAndUpdate(team.leader, { team: team._id });
    }
    if (team.members && team.members.length > 0) {
      await User.updateMany(
        { _id: { $in: team.members } },
        { team: team._id }
      );
    }

    var populated = await Team.findById(team._id)
      .populate('leader', 'name email role')
      .populate('members', 'name email role')
      .populate('createdBy', 'name');

    // === FEATURE: Notify newly added members about the team assignment ===
    const creatorName = req.user.name || 'An administrator';
    const teamName = team.name;
    const newMembers = (members || []).map(m => m.toString()).filter(m => !prevMembers.includes(m));
    const newLeader = leader && leader.toString() !== prevLeader ? leader.toString() : null;
    const toNotify = [...new Set([...newMembers, ...(newLeader ? [newLeader] : [])])];

    for (const memberId of toNotify) {
      if (memberId !== req.user.id.toString()) {
        await createNotification({
          recipientId: memberId,
          senderId: req.user.id,
          type: 'GOAL_UPDATE',
          title: 'You have been added to a team',
          message: `${creatorName} has added you to the team "${teamName}".`,
          link: '/teams'
        });
      }
    }

    res.json(populated);
  } catch (err) {
    console.error('Update team error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete team (ADMIN, HR only — not TEAM_LEADER)
router.delete('/:id', rateLimiter, auth, role('ADMIN', 'HR'), async function (req, res) {
  try {
    var team = await Team.findById(req.params.id);
    if (!team) {
      return res.status(404).json({ message: 'Team not found' });
    }
    await User.updateMany(
      { team: team._id },
      { $unset: { team: 1 } }
    );
    await Team.findByIdAndDelete(req.params.id);
    res.json({ message: 'Team deleted' });
  } catch (err) {
    console.error('Delete team error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;