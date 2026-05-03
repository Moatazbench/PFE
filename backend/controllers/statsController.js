const User = require('../models/User');
const Team = require('../models/Team');
const Objective = require('../models/Objective');
const Cycle = require('../models/Cycle');
const HRDecision = require('../models/HRDecision');

exports.getDashboardStats = async (req, res) => {
  try {
    const scope = req.query.scope || 'me';
    const userId = req.user.id;

    // Security: Only ADMIN/HR can see ORG scope
    if (scope === 'org' && !['ADMIN', 'HR'].includes(req.user.role)) {
        return res.status(403).json({ success: false, message: 'Insufficient permissions for organizational scope.' });
    }

    if (scope === 'me') {
      const myObjectives = await Objective.countDocuments({ owner: userId });
      const myTeam = await Team.findOne({ $or: [{ leader: userId }, { members: userId }] });
      return res.json({
        users: 1,
        teams: myTeam ? 1 : 0,
        objectives: myObjectives,
        cycles: await Cycle.countDocuments({ status: { $in: ['active', 'in_progress'] } })
      });
    }

    if (scope === 'team') {
      const team = await Team.findOne({ $or: [{ leader: userId }, { members: userId }] });
      if (!team) return res.json({ users: 0, teams: 0, objectives: 0, cycles: 0 });
      const teamMembers = [team.leader, ...team.members].filter(Boolean);
      const teamObjectives = await Objective.countDocuments({ owner: { $in: teamMembers } });
      return res.json({
        users: teamMembers.length,
        teams: 1,
        objectives: teamObjectives,
        cycles: await Cycle.countDocuments({ status: { $in: ['active', 'in_progress'] } })
      });
    }

    // Org-wide (Validated for Admin/HR above)
    const [usersCount, teamsCount, objectivesCount, cyclesCount] = await Promise.all([
      User.countDocuments({ isDeleted: false }),
      Team.countDocuments(),
      Objective.countDocuments(),
      Cycle.countDocuments()
    ]);
    res.json({ users: usersCount, teams: teamsCount, objectives: objectivesCount, cycles: cyclesCount });
    
  } catch (err) { res.status(500).json({ message: 'Server error during stats retrieval' }); }
};

exports.getScoreDistribution = async (req, res) => {
  try {
    // Optimized: Using aggregation instead of fetching all docs to memory
    const stats = await HRDecision.aggregate([
      {
        $bucket: {
          groupBy: "$finalScore",
          boundaries: [0, 60, 70, 80, 90, 101],
          default: "Other",
          output: { "count": { $sum: 1 } }
        }
      }
    ]);

    const result = {
      '0-59 (Red Flag)': 0,
      '60-69': 0,
      '70-79': 0,
      '80-89': 0,
      '90-100': 0
    };

    const mapping = { 0: '0-59 (Red Flag)', 60: '60-69', 70: '70-79', 80: '80-89', 90: '90-100' };
    stats.forEach(s => { if (mapping[s._id] !== undefined) result[mapping[s._id]] = s.count; });

    res.json(result);
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
};

exports.getObjectivesByStatus = async (req, res) => {
    try {
        const stats = await Objective.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]);
        const result = { draft: 0, active: 0, submitted: 0, validated: 0, rejected: 0, completed: 0 };
        stats.forEach(s => { if (s._id) result[s._id] = s.count; });
        res.json(result);
    } catch (err) { res.status(500).json({ message: 'Server error' }); }
};

exports.getUsersByRole = async (req, res) => {
    try {
        const stats = await User.aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }]);
        const result = { ADMIN: 0, HR: 0, TEAM_LEADER: 0, COLLABORATOR: 0 };
        stats.forEach(s => { if (s._id) result[s._id] = s.count; });
        res.json(result);
    } catch (err) { res.status(500).json({ message: 'Server error' }); }
};
