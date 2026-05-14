const express = require('express');
const router = express.Router();
const Team = require('../models/Team');
const User = require('../models/User');
const auth = require('../middleware/auth');
const role = require('../middleware/role');
const rateLimiter = require('../middleware/rateLimiter');
const { createNotification } = require('../utils/notificationHelper');

function populateTeamQuery(query) {
  return query
    .populate('leader', 'name email role')
    .populate('members', 'name email role')
    .populate('createdBy', 'name')
    .populate('parentTeam', 'name leader members');
}

function uniqueIds(values) {
  return [...new Set((values || []).filter(Boolean).map(function (value) {
    return String(value);
  }))];
}

function getParentPoolIds(team) {
  var pool = [];
  if (team && team.leader) {
    pool.push(team.leader._id ? team.leader._id : team.leader);
  }
  if (team && Array.isArray(team.members)) {
    team.members.forEach(function (member) {
      pool.push(member && member._id ? member._id : member);
    });
  }
  return uniqueIds(pool);
}

async function getDescendantTeamIds(parentIds) {
  var visited = new Set(uniqueIds(parentIds));
  var queue = Array.from(visited);

  while (queue.length > 0) {
    var children = await Team.find({ parentTeam: { $in: queue } }).select('_id');
    queue = [];
    children.forEach(function (child) {
      var childId = String(child._id);
      if (!visited.has(childId)) {
        visited.add(childId);
        queue.push(childId);
      }
    });
  }

  return Array.from(visited);
}

async function getManagedTeamIds(userId) {
  var ownedTeams = await Team.find({ leader: userId }).select('_id');
  if (ownedTeams.length === 0) return [];
  return getDescendantTeamIds(ownedTeams.map(function (team) { return team._id; }));
}

async function canManageTeam(user, team) {
  if (!user || !team) return false;
  if (user.role === 'ADMIN' || user.role === 'HR') return true;
  if (user.role !== 'TEAM_LEADER') return false;

  var managedIds = await getManagedTeamIds(user.id || user._id);
  return managedIds.includes(String(team._id));
}

async function getRootTeam(team) {
  var current = team;
  while (current && current.parentTeam) {
    current = await Team.findById(current.parentTeam).select('_id parentTeam leader members name');
  }
  return current;
}

async function validateMainTeamPayload(payload) {
  var name = payload.name;
  var leader = payload.leader;
  var members = uniqueIds(payload.members);

  if (!name || !name.trim()) {
    return { status: 400, message: 'Team name is required.' };
  }
  if (!leader) {
    return { status: 400, message: 'A team leader is required. Please select a team leader.' };
  }
  if (members.length === 0) {
    return { status: 400, message: 'At least one team member (collaborator) is required.' };
  }

  var leaderUser = await User.findById(leader).select('_id role');
  if (!leaderUser) {
    return { status: 400, message: 'Selected leader not found.' };
  }
  if (leaderUser.role !== 'TEAM_LEADER' && leaderUser.role !== 'ADMIN' && leaderUser.role !== 'HR') {
    return { status: 400, message: 'Selected leader must have TEAM_LEADER, ADMIN, or HR role.' };
  }

  var memberUsers = await User.find({ _id: { $in: members }, role: 'COLLABORATOR' }).select('_id');
  if (memberUsers.length !== members.length) {
    return { status: 400, message: 'All members must be valid users with the COLLABORATOR role.' };
  }

  return {
    name: name.trim(),
    description: payload.description || '',
    leader: String(leader),
    members: members
  };
}

async function validateSubTeamPayload(payload, parentTeam, creatorId) {
  var name = payload.name;
  var leader = String(creatorId);
  var members = uniqueIds([creatorId].concat(payload.members || []));
  var parentPoolIds = getParentPoolIds(parentTeam);

  if (!name || !name.trim()) {
    return { status: 400, message: 'Team name is required.' };
  }
  if (members.length === 0) {
    return { status: 400, message: 'At least one sub-team member is required.' };
  }
  if (!parentPoolIds.includes(String(leader))) {
    return { status: 400, message: 'Sub-team leader must belong to the parent team.' };
  }
  if (members.some(function (memberId) { return !parentPoolIds.includes(memberId); })) {
    return { status: 400, message: 'Sub-team members must belong to the parent team.' };
  }

  var assignedUsers = await User.find({ _id: { $in: uniqueIds([leader].concat(members)) } }).select('_id');
  if (assignedUsers.length !== uniqueIds([leader].concat(members)).length) {
    return { status: 400, message: 'One or more selected users were not found.' };
  }

  return {
    name: name.trim(),
    description: payload.description || '',
    leader: String(leader),
    members: members
  };
}

async function notifyTeamAssignments(reqUser, leader, members, teamName) {
  var creatorName = reqUser.name || 'An administrator';
  var notifyIds = [];
  if (leader) notifyIds.push(String(leader));
  (members || []).forEach(function (memberId) {
    if (String(memberId) !== String(reqUser.id)) notifyIds.push(String(memberId));
  });

  for (const memberId of [...new Set(notifyIds)]) {
    if (memberId !== String(reqUser.id)) {
      await createNotification({
        recipientId: memberId,
        senderId: reqUser.id,
        type: 'GOAL_UPDATE',
        title: 'You have been added to a team',
        message: `${creatorName} has added you to the team "${teamName}".`,
        link: '/teams'
      });
    }
  }
}

async function validateChildTeamsAgainstParent(parentTeamId, parentPoolIds) {
  var childTeams = await Team.find({ parentTeam: parentTeamId }).select('name leader members');
  for (const childTeam of childTeams) {
    var childAssignments = uniqueIds([childTeam.leader].concat(childTeam.members || []));
    var invalidAssignment = childAssignments.some(function (userId) {
      return !parentPoolIds.includes(userId);
    });
    if (invalidAssignment) {
      return `Cannot remove users from the parent team while sub-team "${childTeam.name}" still uses them.`;
    }
  }
  return null;
}

// Get all teams
router.get('/', rateLimiter, auth, role('ADMIN', 'HR', 'TEAM_LEADER'), async function (req, res) {
  try {
    var filter = {};
    if (req.user.role === 'TEAM_LEADER') {
      var managedIds = await getManagedTeamIds(req.user.id || req.user._id);
      filter = { _id: { $in: managedIds } };
    }

    var teams = await populateTeamQuery(Team.find(filter))
      .sort({ createdAt: -1 });

    res.json(teams);
  } catch (err) {
    console.error('Get teams error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get my team hierarchy
router.get('/my-team', rateLimiter, auth, async function (req, res) {
  try {
    var userId = req.user.id || req.user._id;

    var team = await populateTeamQuery(Team.findOne({ leader: userId }));
    if (!team) {
      team = await populateTeamQuery(Team.findOne({ members: userId }).sort({ parentTeam: 1, createdAt: 1 }));
    }

    if (!team) {
      return res.status(404).json({ success: false, message: 'You are not assigned to any team.' });
    }

    var rootTeam = await getRootTeam(team);
    var rootTeamId = rootTeam ? rootTeam._id : team._id;
    var subTeams = await populateTeamQuery(Team.find({ parentTeam: rootTeamId }).sort({ createdAt: 1 }));

    res.json({ success: true, team: await populateTeamQuery(Team.findById(rootTeamId)), subTeams: subTeams });
  } catch (err) {
    console.error('Get my team error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get sub-teams by parent team
router.get('/:id/subteams', rateLimiter, auth, async function (req, res) {
  try {
    var parentTeam = await Team.findById(req.params.id);
    if (!parentTeam) {
      return res.status(404).json({ message: 'Team not found' });
    }

    var isAllowed = await canManageTeam(req.user, parentTeam);
    var isMember = req.user.role === 'COLLABORATOR' && (parentTeam.members || []).some(function (memberId) {
      return String(memberId) === String(req.user.id);
    });
    if (!isAllowed && !isMember) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    var subTeams = await populateTeamQuery(Team.find({ parentTeam: req.params.id }).sort({ createdAt: 1 }));
    res.json(subTeams);
  } catch (err) {
    console.error('Get sub-teams error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get single team
router.get('/:id', rateLimiter, auth, role('ADMIN', 'HR', 'TEAM_LEADER'), async function (req, res) {
  try {
    var team = await populateTeamQuery(Team.findById(req.params.id));
    if (!team) {
      return res.status(404).json({ message: 'Team not found' });
    }

    if (!(await canManageTeam(req.user, team))) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    var subTeams = await populateTeamQuery(Team.find({ parentTeam: team._id }).sort({ createdAt: 1 }));
    res.json({ ...team.toObject(), subTeams: subTeams });
  } catch (err) {
    console.error('Get team error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create main team
router.post('/', rateLimiter, auth, role('ADMIN', 'HR'), async function (req, res) {
  try {
    var validated = await validateMainTeamPayload(req.body);
    if (validated.status) {
      return res.status(validated.status).json({ message: validated.message });
    }

    var team = new Team({
      name: validated.name,
      description: validated.description,
      leader: validated.leader,
      members: validated.members,
      parentTeam: null,
      createdBy: req.user.id
    });
    await team.save();

    await User.findByIdAndUpdate(validated.leader, { team: team._id });
    await User.updateMany(
      { _id: { $in: validated.members } },
      { team: team._id }
    );

    var populated = await populateTeamQuery(Team.findById(team._id));
    await notifyTeamAssignments(req.user, validated.leader, validated.members, validated.name);

    res.status(201).json(populated);
  } catch (err) {
    console.error('Create team error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create sub-team
router.post('/:id/subteams', rateLimiter, auth, role('ADMIN', 'HR', 'TEAM_LEADER'), async function (req, res) {
  try {
    var parentTeam = await populateTeamQuery(Team.findById(req.params.id));
    if (!parentTeam) {
      return res.status(404).json({ message: 'Parent team not found' });
    }

    if (!(await canManageTeam(req.user, parentTeam))) {
      return res.status(403).json({ message: 'You can only create sub-teams inside your own team structure.' });
    }

    var validated = await validateSubTeamPayload(req.body, parentTeam, req.user.id || req.user._id);
    if (validated.status) {
      return res.status(validated.status).json({ message: validated.message });
    }

    var team = new Team({
      name: validated.name,
      description: validated.description,
      leader: validated.leader,
      members: validated.members,
      parentTeam: parentTeam._id,
      createdBy: req.user.id
    });
    await team.save();

    var populated = await populateTeamQuery(Team.findById(team._id));
    await notifyTeamAssignments(req.user, validated.leader, validated.members, validated.name);

    res.status(201).json(populated);
  } catch (err) {
    console.error('Create sub-team error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update team or sub-team
router.put('/:id', rateLimiter, auth, role('ADMIN', 'HR', 'TEAM_LEADER'), async function (req, res) {
  try {
    var team = await populateTeamQuery(Team.findById(req.params.id));
    if (!team) {
      return res.status(404).json({ message: 'Team not found' });
    }

    var isSubTeam = !!team.parentTeam;
    if (!(await canManageTeam(req.user, team))) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    if (req.user.role === 'TEAM_LEADER' && !isSubTeam) {
      return res.status(403).json({ message: 'Team leaders cannot edit main teams.' });
    }

    if (req.body.parentTeam !== undefined && String(req.body.parentTeam || '') !== String(team.parentTeam?._id || team.parentTeam || '')) {
      return res.status(400).json({ message: 'Changing the parent team is not allowed.' });
    }

    var prevMembers = team.members.map(function (member) { return String(member._id || member); });
    var prevLeader = team.leader ? String(team.leader._id || team.leader) : null;
    var validated;

    if (isSubTeam) {
      var parentTeam = await populateTeamQuery(Team.findById(team.parentTeam._id || team.parentTeam));
      if (!parentTeam) {
        return res.status(400).json({ message: 'Parent team not found.' });
      }
      validated = await validateSubTeamPayload({
        name: req.body.name !== undefined ? req.body.name : team.name,
        description: req.body.description !== undefined ? req.body.description : team.description,
        members: req.body.members !== undefined ? req.body.members : prevMembers
      }, parentTeam, team.leader ? String(team.leader._id || team.leader) : (req.user.id || req.user._id));
    } else {
      validated = await validateMainTeamPayload({
        name: req.body.name !== undefined ? req.body.name : team.name,
        description: req.body.description !== undefined ? req.body.description : team.description,
        leader: req.body.leader !== undefined ? req.body.leader : prevLeader,
        members: req.body.members !== undefined ? req.body.members : prevMembers
      });
    }

    if (validated.status) {
      return res.status(validated.status).json({ message: validated.message });
    }

    if (!isSubTeam) {
      var updatedParentPoolIds = uniqueIds([validated.leader].concat(validated.members));
      var childTeamValidationMessage = await validateChildTeamsAgainstParent(team._id, updatedParentPoolIds);
      if (childTeamValidationMessage) {
        return res.status(400).json({ message: childTeamValidationMessage });
      }
    }

    if (!isSubTeam) {
      await User.updateMany(
        { team: team._id },
        { $unset: { team: 1 } }
      );
    }

    team.name = validated.name;
    team.description = validated.description;
    team.leader = validated.leader;
    team.members = validated.members;
    await team.save();

    if (!isSubTeam) {
      await User.findByIdAndUpdate(validated.leader, { team: team._id });
      await User.updateMany(
        { _id: { $in: validated.members } },
        { team: team._id }
      );
    }

    var populated = await populateTeamQuery(Team.findById(team._id));

    var newMembers = validated.members.filter(function (memberId) {
      return !prevMembers.includes(memberId);
    });
    var newLeader = validated.leader !== prevLeader ? validated.leader : null;
    await notifyTeamAssignments(req.user, newLeader, newMembers, validated.name);

    res.json(populated);
  } catch (err) {
    console.error('Update team error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete team or sub-team
router.delete('/:id', rateLimiter, auth, role('ADMIN', 'HR', 'TEAM_LEADER'), async function (req, res) {
  try {
    var team = await Team.findById(req.params.id);
    if (!team) {
      return res.status(404).json({ message: 'Team not found' });
    }

    if (!(await canManageTeam(req.user, team))) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    if (req.user.role === 'TEAM_LEADER' && !team.parentTeam) {
      return res.status(403).json({ message: 'Team leaders cannot delete main teams.' });
    }

    var descendantIds = await getDescendantTeamIds([team._id]);
    if (!team.parentTeam) {
      await User.updateMany(
        { team: { $in: descendantIds } },
        { $unset: { team: 1 } }
      );
    }

    await Team.deleteMany({ _id: { $in: descendantIds } });
    res.json({ message: 'Team deleted' });
  } catch (err) {
    console.error('Delete team error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
