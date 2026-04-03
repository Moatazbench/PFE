// controllers/teamController.js
// Team controller: CRUD operations for teams

const Team = require('../models/Team');
const User = require('../models/User');

// Create a new team (ADMIN/HR only)
exports.createTeam = async (req, res) => {
  try {
    const { name, description, leader, members } = req.body;

    // Basic validation
    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Team name is required.'
      });
    }

    if (!leader) {
      return res.status(400).json({
        success: false,
        message: 'Team leader is required.'
      });
    }

    // Validate leader exists and has correct role
    const leaderUser = await User.findById(leader);
    if (!leaderUser) {
      return res.status(400).json({
        success: false,
        message: 'Leader not found.'
      });
    }
    if (leaderUser.role !== 'TEAM_LEADER' && leaderUser.role !== 'ADMIN' && leaderUser.role !== 'HR') {
      return res.status(400).json({
        success: false,
        message: 'Selected user must have TEAM_LEADER, ADMIN, or HR role.'
      });
    }

    // Check if leader already leads another team
    const existingTeam = await Team.findOne({ leader });
    if (existingTeam) {
      return res.status(409).json({
        success: false,
        message: 'This leader already manages another team.'
      });
    }

    // Validate members if provided
    if (members && members.length > 0) {
      const users = await User.find({
        _id: { $in: members },
        role: 'COLLABORATOR'
      });
      if (users.length !== members.length) {
        return res.status(400).json({
          success: false,
          message: 'All members must be valid users with the COLLABORATOR role.'
        });
      }
    }

    // Check for duplicate team name
    const duplicateName = await Team.findOne({
      name: { $regex: new RegExp(`^${name.trim()}$`, 'i') }
    });
    if (duplicateName) {
      return res.status(409).json({
        success: false,
        message: 'A team with this name already exists.'
      });
    }

    // Create the team
    const team = await Team.create({
      name: name.trim(),
      description: description || '',
      leader,
      members: members || [],
      createdBy: req.user.id
    });

    // Populate and return
    const populatedTeam = await Team.findById(team._id)
      .populate('leader', 'name email role')
      .populate('members', 'name email role')
      .populate('createdBy', 'name');

    res.status(201).json({ success: true, team: populatedTeam });

  } catch (err) {
    console.error('Create team error:', err);

    // Handle duplicate key error
    if (err.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'A team with this name already exists.'
      });
    }

    res.status(500).json({ success: false, message: err.message });
  }
};

// Get all teams (ADMIN, HR, TEAM_LEADER)
exports.getTeams = async (req, res) => {
  try {
    let filter = {};

    // Team Leaders can only see their own team
    if (req.user.role === 'TEAM_LEADER') {
      filter.leader = req.user.id || req.user._id;
    }

    const teams = await Team.find(filter)
      .populate('leader', 'name email role')
      .populate('members', 'name email role')
      .populate('createdBy', 'name')
      .sort({ name: 1 });

    res.json({ success: true, teams });
  } catch (err) {
    console.error('Get teams error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// Get my team (for any authenticated user — employee, leader, etc.)
exports.getMyTeam = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;

    // First check: is the user a team leader?
    let team = await Team.findOne({ leader: userId })
      .populate('leader', 'name email role')
      .populate('members', 'name email role');

    // Second check: is the user a team member?
    if (!team) {
      team = await Team.findOne({ members: userId })
        .populate('leader', 'name email role')
        .populate('members', 'name email role');
    }

    if (!team) {
      return res.status(404).json({
        success: false,
        message: 'You are not assigned to any team.'
      });
    }

    res.json({ success: true, team });
  } catch (err) {
    console.error('Get my team error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// Get single team by ID
exports.getTeamById = async (req, res) => {
  try {
    const team = await Team.findById(req.params.id)
      .populate('leader', 'name email role')
      .populate('members', 'name email role')
      .populate('createdBy', 'name');

    if (!team) {
      return res.status(404).json({
        success: false,
        message: 'Team not found.'
      });
    }

    // Authorization check
    const userId = req.user.id || req.user._id;
    const isHR = req.user.role === 'HR' || req.user.role === 'ADMIN';
    const isLeader = team.leader && team.leader._id.toString() === userId.toString();
    const isMember = team.members.some(
      (m) => m._id.toString() === userId.toString()
    );

    if (!isHR && !isLeader && !isMember) {
      return res.status(403).json({
        success: false,
        message: 'Access denied.'
      });
    }

    res.json({ success: true, team });
  } catch (err) {
    console.error('Get team by ID error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// Update team (ADMIN/HR only)
exports.updateTeam = async (req, res) => {
  try {
    const { name, description, leader, members } = req.body;

    const team = await Team.findById(req.params.id);
    if (!team) {
      return res.status(404).json({
        success: false,
        message: 'Team not found.'
      });
    }

    // Validate name if provided
    if (name !== undefined) {
      if (!name.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Team name cannot be empty.'
        });
      }

      // Check for duplicate name (excluding current team)
      const duplicateName = await Team.findOne({
        name: { $regex: new RegExp(`^${name.trim()}$`, 'i') },
        _id: { $ne: team._id }
      });
      if (duplicateName) {
        return res.status(409).json({
          success: false,
          message: 'A team with this name already exists.'
        });
      }

      team.name = name.trim();
    }

    // Validate and update leader if provided
    if (leader && leader !== (team.leader ? team.leader.toString() : null)) {
      const leaderUser = await User.findById(leader);
      if (!leaderUser) {
        return res.status(400).json({
          success: false,
          message: 'Leader not found.'
        });
      }
      if (leaderUser.role !== 'TEAM_LEADER' && leaderUser.role !== 'ADMIN' && leaderUser.role !== 'HR') {
        return res.status(400).json({
          success: false,
          message: 'Selected user must have TEAM_LEADER, ADMIN, or HR role.'
        });
      }

      // Check if new leader already leads another team
      const existingTeam = await Team.findOne({
        leader,
        _id: { $ne: team._id }
      });
      if (existingTeam) {
        return res.status(409).json({
          success: false,
          message: 'This leader already manages another team.'
        });
      }

      team.leader = leader;
    }

    // Update description
    if (description !== undefined) team.description = description;

    // Validate and update members if provided
    if (members !== undefined) {
      if (members.length > 0) {
        const users = await User.find({
          _id: { $in: members },
          role: 'COLLABORATOR'
        });
        if (users.length !== members.length) {
          return res.status(400).json({
            success: false,
            message: 'All members must be valid users with the COLLABORATOR role.'
          });
        }
      }
      team.members = members;
    }

    await team.save();

    // Populate and return
    const populatedTeam = await Team.findById(team._id)
      .populate('leader', 'name email role')
      .populate('members', 'name email role')
      .populate('createdBy', 'name');

    res.json({ success: true, team: populatedTeam });

  } catch (err) {
    console.error('Update team error:', err);

    if (err.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'A team with this name already exists.'
      });
    }

    res.status(500).json({ success: false, message: err.message });
  }
};

// Delete team (ADMIN/HR only)
exports.deleteTeam = async (req, res) => {
  try {
    const team = await Team.findById(req.params.id);

    if (!team) {
      return res.status(404).json({
        success: false,
        message: 'Team not found.'
      });
    }

    await Team.findByIdAndDelete(req.params.id);

    res.json({ success: true, message: 'Team deleted successfully.' });

  } catch (err) {
    console.error('Delete team error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};