const Objective = require('../models/Objective');
const User = require('../models/User');
const Team = require('../models/Team');
const Cycle = require('../models/Cycle');
const { createNotification } = require('./notificationController');

// ========== HELPERS ==========
function calculateKpiProgress(kpis) {
  if (!kpis || kpis.length === 0) return 0;
  let totalProgress = 0;
  kpis.forEach(kpi => {
    if (kpi.metricType === 'boolean') {
      totalProgress += kpi.currentValue >= 1 ? 100 : 0;
    } else {
      const range = Math.abs(kpi.targetValue - kpi.initialValue);
      if (range === 0) {
        totalProgress += kpi.currentValue >= kpi.targetValue ? 100 : 0;
      } else {
        let progress;
        if (kpi.targetValue > kpi.initialValue) {
          // Increase target: (current - initial) / (target - initial)
          progress = ((kpi.currentValue - kpi.initialValue) / range) * 100;
        } else {
          // Decrease target: (initial - current) / (initial - target)
          progress = ((kpi.initialValue - kpi.currentValue) / range) * 100;
        }
        totalProgress += Math.min(100, Math.max(0, progress));
      }
    }
  });
  return Math.round(totalProgress / kpis.length);
}

function addActivity(objective, userId, action, details, fromStatus, toStatus) {
  objective.activityLog = objective.activityLog || [];
  objective.activityLog.push({ user: userId, action, details, fromStatus: fromStatus || '', toStatus: toStatus || '' });
}

// Valid status transitions
const VALID_TRANSITIONS = {
  'draft': ['pending', 'pending_approval', 'submitted'],
  'pending': ['pending_approval', 'approved', 'validated', 'rejected', 'revision_requested'],
  'submitted': ['approved', 'validated', 'rejected', 'revision_requested', 'pending_approval'],
  'pending_approval': ['approved', 'validated', 'rejected', 'revision_requested'],
  'revision_requested': ['pending', 'pending_approval', 'submitted', 'draft'],
  'rejected': ['draft', 'pending', 'pending_approval', 'submitted', 'archived'],
  'assigned': ['acknowledged', 'approved', 'cancelled'],
  'acknowledged': ['approved'],
  'approved': ['evaluated', 'cancelled', 'archived', 'locked'],
  'validated': ['evaluated', 'cancelled', 'archived', 'locked'],
  'evaluated': ['archived'],
  'locked': ['archived'],
  'cancelled': ['archived'],
  'archived': [],
};

function isValidTransition(from, to) {
  if (from === to) return true;
  const allowed = VALID_TRANSITIONS[from];
  return allowed && allowed.includes(to);
}

async function getTeamForUser(userId) {
  return Team.findOne({ members: userId });
}

async function getTeamForLeader(leaderId) {
  return Team.findOne({ leader: leaderId });
}

function isTeamMember(team, userId) {
  return team && team.members.some(m => String(m) === String(userId));
}

// ========== CREATE ==========
exports.createObjective = async (req, res) => {
  try {
    const { title, description, successIndicator, weight, deadline, cycle, category, labels, visibility, startDate, parentObjective, targetUser, targetTeam } = req.body;
    if (!cycle) return res.status(400).json({ success: false, message: 'Cycle is required.' });
    const targetedCycle = await Cycle.findById(cycle);
    if (!targetedCycle) return res.status(404).json({ success: false, message: 'Cycle not found.' });
    if (targetedCycle.status === 'closed') return res.status(400).json({ success: false, message: 'Cannot add objectives to a closed cycle.' });
    if (!title || !weight) return res.status(400).json({ success: false, message: 'Title and weight are required.' });
    if (weight < 1 || weight > 100) return res.status(400).json({ success: false, message: 'Weight must be between 1 and 100.' });

    let ownerId = req.user.id;
    let source = 'employee_created';
    let assignedBy = null;
    let initialStatus = 'draft';

    // Manager assigning goal to employee
    if (category === 'individual' && targetUser && (req.user.role === 'TEAM_LEADER' || req.user.role === 'ADMIN' || req.user.role === 'HR')) {
      ownerId = targetUser;
      if (targetUser !== req.user.id) {
        source = 'manager_assigned';
        assignedBy = req.user.id;
        initialStatus = 'assigned';
      }
    }

    const exists = await Objective.findOne({ owner: ownerId, cycle, title });
    if (exists) return res.status(409).json({ success: false, message: 'Duplicate objective title within this cycle.' });
    const count = await Objective.countDocuments({ owner: ownerId, cycle });
    if (count >= 10) return res.status(400).json({ success: false, message: 'Maximum objectives reached for this cycle.' });

    const existingObjs = await Objective.find({ owner: ownerId, cycle, category: category || 'individual', status: { $nin: ['approved', 'validated'] } });
    const usedWeight = existingObjs.reduce((sum, o) => sum + (o.weight || 0), 0);
    if (usedWeight + weight > 100) return res.status(400).json({ success: false, message: 'Total weight would exceed 100%. Currently used: ' + usedWeight + '%, trying to add: ' + weight + '%.' });

    if (category === 'team') {
      if (req.user.role !== 'TEAM_LEADER' && req.user.role !== 'ADMIN') return res.status(403).json({ success: false, message: 'Only Team Leaders or Admins can create Team Objectives' });
      let team;
      if (targetTeam) { team = await Team.findById(targetTeam).populate('members', '_id name'); }
      else { team = await Team.findOne({ leader: req.user.id }).populate('members', '_id name'); if (!team) team = await Team.findOne({ leader: req.user._id }).populate('members', '_id name'); }
      if (!team) return res.status(400).json({ success: false, message: 'Team not found.' });
      if (!team.members || team.members.length === 0) return res.status(400).json({ success: false, message: 'Your team has no members.' });

      const memberObjectives = team.members.map(member => ({
        owner: member._id, cycle, category: 'team', title, description, successIndicator: successIndicator || title, weight, deadline, status: 'assigned', source: 'manager_assigned', assignedBy: req.user.id,
        labels: labels || [], visibility: visibility || 'public', startDate: startDate || null, parentObjective: parentObjective || null,
        activityLog: [{ user: req.user.id, action: 'assigned', details: 'Team goal assigned by manager' }],
      }));
      await Objective.insertMany(memberObjectives);

      for (const member of team.members) {
        await createNotification(member._id, 'Goal Assigned', `Your manager assigned you a new goal: "${title}".`, '/goals', 'GOAL_ASSIGNED');
      }
      res.status(201).json({ success: true, message: `Team Objective distributed to ${team.members.length} member(s)` });
    } else {
      const objective = await Objective.create({
        owner: ownerId, cycle, category: 'individual', title, description, successIndicator, weight, deadline,
        status: initialStatus, source, assignedBy, labels: labels || [], visibility: visibility || 'public',
        startDate: startDate || null, parentObjective: parentObjective || null,
        activityLog: [{ user: req.user.id, action: source === 'manager_assigned' ? 'assigned' : 'created', details: source === 'manager_assigned' ? 'Goal assigned by manager' : 'Goal created as draft' }],
      });

      if (source === 'manager_assigned') {
        await createNotification(ownerId, 'Goal Assigned', `Your manager assigned you a new goal: "${title}".`, '/goals', 'GOAL_ASSIGNED');
      }
      res.status(201).json({ success: true, objective });
    }
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// ========== GET MY OBJECTIVES ==========
exports.getMyObjectives = async (req, res) => {
  try {
    const objectives = await Objective.find({ owner: req.user.id })
      .populate('owner', 'name email role')
      .populate('cycle', 'name year status')
      .populate('assignedBy', 'name email');
    res.json({ success: true, objectives });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// ========== GET ALL (role-based) ==========
exports.getObjectives = async (req, res) => {
  try {
    let filter = {};
    if (req.query.cycle) filter.cycle = req.query.cycle;
    if (req.query.label) filter.labels = req.query.label;
    if (req.query.status && req.query.status !== 'all') filter.status = req.query.status;

    const targetUserId = req.query.targetUserId;
    if (targetUserId) {
      filter.owner = targetUserId;
    } else {
      if (req.user.role === 'TEAM_LEADER') {
        if (req.query.scope === 'my') { filter.owner = req.user.id; }
        else {
          const team = await getTeamForLeader(req.user.id);
          if (!team) return res.json({ success: true, objectives: [] });
          filter.owner = { $in: [req.user.id, ...team.members] };
        }
      } else if (req.user.role === 'COLLABORATOR') {
        filter.owner = req.user.id;
      }
    }

    const objectives = await Objective.find(filter)
      .populate('owner', 'name email role')
      .populate('cycle', 'name year status')
      .populate('parentObjective', 'title')
      .populate('assignedBy', 'name email')
      .sort({ createdAt: -1 });

    if (targetUserId && req.query.cycle) {
      const individualObjectives = objectives.filter(o => o.category === 'individual');
      const teamObjectives = objectives.filter(o => o.category === 'team');
      let indScoreSum = 0, teamScoreSum = 0;
      individualObjectives.forEach(o => { 
        if (['approved', 'validated'].includes(o.status)) { indScoreSum += (o.weightedScore || 0); } 
      });
      teamObjectives.forEach(o => { 
        if (['approved', 'validated'].includes(o.status)) { teamScoreSum += (o.weightedScore || 0); } 
      });
      const indScoreRaw = Math.min(indScoreSum, 100);
      const teamScoreRaw = Math.min(teamScoreSum, 100);
      const individualScore = Number((indScoreRaw * 0.70).toFixed(2));
      const teamScore = Number((teamScoreRaw * 0.30).toFixed(2));
      const compositeScore = Number((individualScore + teamScore).toFixed(2));
      const indWeight = individualObjectives.reduce((s, o) => s + o.weight, 0);
      const tmWeight = teamObjectives.reduce((s, o) => s + o.weight, 0);
      const validation = {
        individualCount: individualObjectives.length, minIndividualObjectives: 3,
        isValidIndividualCount: individualObjectives.length >= 3, individualWeight: indWeight,
        isValidIndividualWeight: indWeight === 100,
        individualValidatedCount: individualObjectives.filter(o => ['validated', 'approved'].includes(o.status)).length,
        individualRejectedCount: individualObjectives.filter(o => o.status === 'rejected').length,
        individualScore: indScoreRaw, individualRemainingWeight: Math.max(0, 100 - indWeight),
        canAddMoreIndividual: individualObjectives.length < 7 && indWeight < 100,
        teamCount: teamObjectives.length, teamWeight: tmWeight, isValidTeamWeight: tmWeight === 100,
        teamValidatedCount: teamObjectives.filter(o => ['validated', 'approved'].includes(o.status)).length,
        teamScore: teamScoreRaw, teamRemainingWeight: Math.max(0, 100 - tmWeight),
        canAddMoreTeam: teamObjectives.length < 7 && tmWeight < 100,
        requiredCategoryTotal: 100, compositeScore,
        totalRejected: individualObjectives.filter(o => o.status === 'rejected').length + teamObjectives.filter(o => o.status === 'rejected').length,
        allValidated: objectives.length > 0 && objectives.every(o => ['validated', 'approved', 'evaluated'].includes(o.status)),
      };
      return res.json({ success: true, individualObjectives, teamObjectives, validation });
    }
    res.json({ success: true, objectives });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// ========== GET BY ID ==========
exports.getObjectiveById = async (req, res) => {
  try {
    const objective = await Objective.findById(req.params.id)
      .populate('owner', 'name email role').populate('cycle', 'name year status')
      .populate('parentObjective', 'title').populate('comments.user', 'name email')
      .populate('progressUpdates.user', 'name email').populate('assignedBy', 'name email')
      .populate('changeRequests.requestedBy', 'name email').populate('changeRequests.resolvedBy', 'name email')
      .populate('activityLog.user', 'name email').populate('evaluatedBy', 'name email');
    if (!objective) return res.status(404).json({ success: false, message: 'Objective not found.' });
    if (req.user.role === 'ADMIN' || req.user.role === 'HR') return res.json({ success: true, objective });
    if (req.user.role === 'COLLABORATOR' && String(objective.owner._id) === String(req.user.id)) return res.json({ success: true, objective });
    if (req.user.role === 'TEAM_LEADER') {
      const team = await getTeamForLeader(req.user.id);
      if (team && (String(req.user.id) === String(objective.owner._id) || isTeamMember(team, objective.owner._id))) return res.json({ success: true, objective });
    }
    return res.status(403).json({ success: false, message: 'Forbidden' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// ========== GET PENDING VALIDATION ==========
exports.getPendingValidation = async (req, res) => {
  try {
    if (req.user.role !== 'TEAM_LEADER' && req.user.role !== 'ADMIN') return res.status(403).json({ success: false, message: 'Only Team Leaders or Admins can fetch pending validations.' });
    const team = await getTeamForLeader(req.user.id);
    if (!team || !team.members || team.members.length === 0) return res.json([]);
    const pending = await Objective.find({
      owner: { $in: team.members },
      status: { $in: ['pending', 'submitted', 'pending_approval'] },
    }).populate('owner', 'name email').populate('cycle', 'name year status');
    res.json(pending);
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// ========== GET PENDING CHANGE REQUESTS (Manager) ==========
exports.getPendingChangeRequests = async (req, res) => {
  try {
    if (req.user.role !== 'TEAM_LEADER' && req.user.role !== 'ADMIN') return res.status(403).json({ success: false, message: 'Forbidden' });
    const team = await getTeamForLeader(req.user.id);
    if (!team) return res.json({ success: true, objectives: [] });
    const objectives = await Objective.find({
      owner: { $in: team.members },
      'changeRequests.status': 'pending',
    }).populate('owner', 'name email').populate('cycle', 'name year status');
    res.json({ success: true, objectives });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// ========== GET COMPLETED AWAITING EVALUATION (Manager) ==========
exports.getCompletedAwaitingEvaluation = async (req, res) => {
  try {
    if (req.user.role !== 'TEAM_LEADER' && req.user.role !== 'ADMIN') return res.status(403).json({ success: false, message: 'Forbidden' });
    const team = await getTeamForLeader(req.user.id);
    if (!team) return res.json({ success: true, objectives: [] });
    const objectives = await Objective.find({
      owner: { $in: team.members },
      status: { $in: ['approved', 'validated'] },
      evaluationRating: '',
    }).populate('owner', 'name email').populate('cycle', 'name year status');
    res.json({ success: true, objectives });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// ========== UPDATE OBJECTIVE ==========
exports.updateObjective = async (req, res) => {
  try {
    const objective = await Objective.findById(req.params.id).populate('cycle');
    if (!objective) return res.status(404).json({ success: false, message: 'Objective not found.' });
    const isOwner = String(objective.owner) === String(req.user.id);
    const isAdmin = req.user.role === 'ADMIN';
    const isLeader = req.user.role === 'TEAM_LEADER';
    if (!isOwner && !isAdmin && !isLeader) return res.status(403).json({ success: false, message: 'Not authorized to update.' });
    if (objective.cycle && objective.cycle.status === 'closed') return res.status(400).json({ success: false, message: 'Cannot edit objects in a closed cycle.' });
    if (req.user.role === 'COLLABORATOR' && !['draft', 'revision_requested', 'rejected'].includes(objective.status)) {
      return res.status(400).json({ success: false, message: 'Only draft/revision-requested objectives can be updated.' });
    }

    const { title, description, weight, deadline, labels, visibility, startDate, parentObjective } = req.body;
    if (title !== undefined) objective.title = title;
    if (description !== undefined) objective.description = description;
    if (weight !== undefined) objective.weight = weight;
    if (deadline !== undefined) objective.deadline = deadline;
    if (labels !== undefined) objective.labels = labels;
    if (visibility !== undefined) objective.visibility = visibility;
    if (startDate !== undefined) objective.startDate = startDate;
    if (parentObjective !== undefined) objective.parentObjective = parentObjective;

    if (weight !== undefined) {
      const siblings = await Objective.find({ owner: objective.owner, cycle: objective.cycle, category: objective.category || 'individual', _id: { $ne: objective._id } });
      const totalWeight = siblings.reduce((sum, o) => sum + (o.weight || 0), 0) + parseInt(weight);
      if (totalWeight > 100) return res.status(400).json({ success: false, message: 'Total weight would exceed 100%.' });
    }

    addActivity(objective, req.user.id, 'updated', 'Goal details updated');
    await objective.save();
    res.json({ success: true, objective });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// ========== SUBMIT FOR APPROVAL (Employee) ==========
exports.submitObjective = async (req, res) => {
  try {
    const objective = await Objective.findById(req.params.id);
    if (!objective) return res.status(404).json({ success: false, message: 'Objective not found.' });
    if (String(objective.owner) !== String(req.user.id) && req.user.role !== 'ADMIN') return res.status(403).json({ success: false, message: 'Only the owner can submit.' });
    if (!['draft', 'revision_requested', 'rejected'].includes(objective.status)) return res.status(400).json({ success: false, message: 'Only draft/revision-requested goals can be submitted.' });

    // Find the employee's team and resolve the team leader
    const team = await getTeamForUser(req.user.id);
    if (!team || !team.leader) return res.status(400).json({ success: false, message: 'You are not assigned to a team with a leader. Cannot submit.' });

    const oldStatus = objective.status;
    objective.status = 'pending';
    objective.submittedBy = req.user.id;
    objective.submittedTo = team.leader;
    addActivity(objective, req.user.id, 'submitted', 'Goal submitted to team leader for approval', oldStatus, 'pending');
    await objective.save();

    const user = await User.findById(req.user.id);
    await createNotification(team.leader, 'Goal Submitted', `${user ? user.name : 'A team member'} submitted "${objective.title}" for approval.`, '/goals', 'GOAL_SUBMITTED');

    res.json({ success: true, objective });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// ========== SUBMIT ALL (batch - legacy) ==========
exports.submitObjectives = async (req, res) => {
  try {
    const { cycle } = req.body;
    if (!cycle) return res.status(400).json({ success: false, message: 'Cycle is required.' });
    const targetedCycle = await Cycle.findById(cycle);
    if (!targetedCycle || targetedCycle.status === 'closed') return res.status(400).json({ success: false, message: 'Cycle is invalid or closed.' });
    const objectives = await Objective.find({ owner: req.user.id, cycle, category: 'individual', status: { $nin: ['approved', 'validated'] } });
    if (objectives.length < 3 || objectives.length > 10) return res.status(400).json({ success: false, message: 'You must have between 3 and 10 individual objectives.' });
    const totalWeight = objectives.reduce((sum, obj) => sum + (obj.weight || 0), 0);
    if (totalWeight !== 100) return res.status(400).json({ success: false, message: `Total weight must equal 100. Current: ${totalWeight}` });

    const user = await User.findById(req.user.id);
    const team = await getTeamForUser(req.user.id);
    
    if (!team || !team.leader) {
      return res.status(400).json({ success: false, message: 'You are not assigned to a team with a leader. Cannot submit goals.' });
    }

    await Objective.updateMany(
      { owner: req.user.id, cycle, status: { $in: ['draft', 'revision_requested', 'rejected'] } }, 
      { status: 'pending_approval', submittedTo: team.leader, submittedBy: req.user.id }
    );

    if (team && team.leader) {
      await createNotification(team.leader, 'Objectives Submitted', `${user ? user.name : 'A team member'} submitted their objectives for validation.`, '/goals', 'GOAL_SUBMITTED');
    }
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// ========== VALIDATE / APPROVE / REJECT / REVISION (Manager) ==========
exports.validateObjective = async (req, res) => {
  try {
    const objective = await Objective.findById(req.params.id).populate('cycle');
    if (!objective) return res.status(404).json({ success: false, message: 'Objective not found.' });
    // Authorization: Only ADMIN or the specific team leader it was submitted to can validate
    if (req.user.role !== 'ADMIN') {
      if (!objective.submittedTo || String(objective.submittedTo) !== String(req.user.id)) {
        return res.status(403).json({ success: false, message: 'Only the team leader who received this goal can approve or reject it.' });
      }
    }

    if (!['pending', 'submitted', 'pending_approval'].includes(objective.status)) return res.status(400).json({ success: false, message: 'Only pending/submitted objectives can be validated.' });

    const { status, managerAdjustedPercent, managerComments, rejectionReason, revisionReason } = req.body;
    const oldStatus = objective.status;
    let notifType = 'GOAL_APPROVED';
    let notifTitle = 'Goal Approved';
    let notifMsg = `Your goal "${objective.title}" was approved.`;

    if (status === 'rejected') {
      objective.status = 'rejected';
      objective.rejectionReason = rejectionReason || managerComments || '';
      notifType = 'GOAL_REJECTED';
      notifTitle = 'Goal Rejected';
      notifMsg = `Your goal "${objective.title}" was rejected. Reason: ${objective.rejectionReason || 'No reason provided.'}`;
    } else if (status === 'revision_requested') {
      objective.status = 'revision_requested';
      objective.revisionReason = revisionReason || managerComments || '';
      notifType = 'GOAL_REVISION_REQUESTED';
      notifTitle = 'Revision Requested';
      notifMsg = `Your manager requested changes to "${objective.title}": ${objective.revisionReason || 'Please review and update.'}`;
    } else {
      // approved / validated
      objective.status = status === 'validated' ? 'validated' : 'approved';
    }

    if (managerAdjustedPercent !== undefined && managerAdjustedPercent !== null) {
      objective.managerAdjustedPercent = managerAdjustedPercent;
      objective.weightedScore = (objective.weight * managerAdjustedPercent) / 100;
    } else if (objective.achievementPercent !== null) {
      objective.weightedScore = (objective.weight * objective.achievementPercent) / 100;
    }
    if (managerComments !== undefined) objective.managerComments = managerComments;
    objective.validatedBy = req.user.id;
    objective.validatedAt = new Date();

    addActivity(objective, req.user.id, status === 'rejected' ? 'rejected' : status === 'revision_requested' ? 'revision_requested' : 'approved', managerComments || '', oldStatus, objective.status);
    await objective.save();

    await createNotification(objective.owner, notifTitle, notifMsg, '/goals', notifType);
    res.json({ success: true, objective });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// ========== ACKNOWLEDGE (Employee - for manager-assigned goals) ==========
exports.acknowledgeObjective = async (req, res) => {
  try {
    const objective = await Objective.findById(req.params.id);
    if (!objective) return res.status(404).json({ success: false, message: 'Objective not found.' });
    if (String(objective.owner) !== String(req.user.id) && req.user.role !== 'ADMIN') return res.status(403).json({ success: false, message: 'Only the assignee or admin can acknowledge.' });
    if (objective.status !== 'assigned') return res.status(400).json({ success: false, message: 'Only assigned goals can be acknowledged.' });

    const { accepted, clarificationMessage } = req.body;
    const oldStatus = objective.status;

    if (accepted) {
      objective.status = 'approved';
      addActivity(objective, req.user.id, 'acknowledged', 'Goal accepted by employee', oldStatus, 'approved');
      await objective.save();

      if (objective.assignedBy) {
        const user = await User.findById(req.user.id);
        await createNotification(objective.assignedBy, 'Goal Acknowledged', `${user ? user.name : 'Employee'} accepted the goal "${objective.title}".`, '/goals', 'GOAL_ACKNOWLEDGED');
      }
    } else {
      // Request clarification - add comment and keep as assigned
      if (clarificationMessage) {
        objective.comments.push({ user: req.user.id, text: `Clarification requested: ${clarificationMessage}` });
        addActivity(objective, req.user.id, 'clarification_requested', clarificationMessage, oldStatus, oldStatus);
      }
      await objective.save();

      if (objective.assignedBy) {
        const user = await User.findById(req.user.id);
        await createNotification(objective.assignedBy, 'Clarification Requested', `${user ? user.name : 'Employee'} requested clarification on "${objective.title}".`, '/goals', 'GOAL_UPDATE');
      }
    }
    res.json({ success: true, objective });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// ========== MARK COMPLETED (Employee) ==========
exports.markCompleted = async (req, res) => {
  try {
    const objective = await Objective.findById(req.params.id);
    if (!objective) return res.status(404).json({ success: false, message: 'Objective not found.' });
    if (String(objective.owner) !== String(req.user.id) && req.user.role !== 'ADMIN') return res.status(403).json({ success: false, message: 'Only the owner can mark completed.' });
    if (!['approved', 'validated'].includes(objective.status)) return res.status(400).json({ success: false, message: 'Only active goals can be marked completed.' });

    if (req.body.selfAssessment) objective.selfAssessment = req.body.selfAssessment;
    addActivity(objective, req.user.id, 'completed', 'Goal marked as completed', oldStatus, 'achieved');
    await objective.save();

    const team = await getTeamForUser(objective.owner);
    if (team && team.leader) {
      const user = await User.findById(objective.owner);
      await createNotification(team.leader, 'Goal Completed', `${user ? user.name : 'A team member'} completed "${objective.title}" and it's ready for evaluation.`, '/goals', 'GOAL_COMPLETED');
    }
    res.json({ success: true, objective });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// ========== EVALUATE (Manager) ==========
exports.evaluateObjective = async (req, res) => {
  try {
    const objective = await Objective.findById(req.params.id);
    if (!objective) return res.status(404).json({ success: false, message: 'Objective not found.' });
    if (req.user.role !== 'TEAM_LEADER' && req.user.role !== 'ADMIN') return res.status(403).json({ success: false, message: 'Only managers can evaluate.' });

    if (req.user.role === 'TEAM_LEADER') {
      const team = await getTeamForLeader(req.user.id);
      if (!team || !isTeamMember(team, objective.owner)) return res.status(403).json({ success: false, message: 'Not your team member.' });
    }

    const { evaluationRating, evaluationComment, managerAdjustedPercent } = req.body;
    if (!evaluationRating || !['exceeded', 'met', 'partially_met', 'not_met'].includes(evaluationRating)) {
      return res.status(400).json({ success: false, message: 'Valid evaluation rating is required.' });
    }

    const oldStatus = objective.status;
    objective.evaluationRating = evaluationRating;
    objective.evaluationComment = evaluationComment || '';
    objective.evaluatedBy = req.user.id;
    objective.evaluatedAt = new Date();
    objective.status = 'evaluated';
    if (managerAdjustedPercent !== undefined) { objective.managerAdjustedPercent = managerAdjustedPercent; objective.weightedScore = (objective.weight * managerAdjustedPercent) / 100; }
    addActivity(objective, req.user.id, 'evaluated', `Evaluation: ${evaluationRating}. ${evaluationComment || ''}`, oldStatus, 'evaluated');
    await objective.save();

    const ratingLabels = { exceeded: 'Exceeded Expectations', met: 'Met Expectations', partially_met: 'Partially Met', not_met: 'Did Not Meet' };
    await createNotification(objective.owner, 'Goal Evaluated', `Your goal "${objective.title}" was evaluated: ${ratingLabels[evaluationRating]}.`, '/goals', 'GOAL_EVALUATED');
    res.json({ success: true, objective });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// ========== CHANGE REQUEST ==========
exports.createChangeRequest = async (req, res) => {
  try {
    const objective = await Objective.findById(req.params.id);
    if (!objective) return res.status(404).json({ success: false, message: 'Objective not found.' });
    if (String(objective.owner) !== String(req.user.id) && req.user.role !== 'ADMIN') return res.status(403).json({ success: false, message: 'Only the owner can request changes.' });
    if (!['approved', 'validated'].includes(objective.status)) return res.status(400).json({ success: false, message: 'Change requests only for active goals.' });

    const { requestType, reason, newDeadline, newDescription, newTitle } = req.body;
    if (!requestType || !reason) return res.status(400).json({ success: false, message: 'requestType and reason required.' });

    objective.changeRequests.push({ requestType, requestedBy: req.user.id, reason, newDeadline, newDescription, newTitle });
    addActivity(objective, req.user.id, 'change_requested', `${requestType}: ${reason}`);
    await objective.save();

    const team = await getTeamForUser(objective.owner);
    if (team && team.leader) {
      const user = await User.findById(req.user.id);
      await createNotification(team.leader, 'Change Request', `${user ? user.name : 'Employee'} requested a change on "${objective.title}": ${requestType}.`, '/goals', 'CHANGE_REQUEST');
    }
    res.json({ success: true, objective });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.resolveChangeRequest = async (req, res) => {
  try {
    const objective = await Objective.findById(req.params.id);
    if (!objective) return res.status(404).json({ success: false, message: 'Objective not found.' });
    if (req.user.role !== 'TEAM_LEADER' && req.user.role !== 'ADMIN') return res.status(403).json({ success: false, message: 'Only managers can resolve.' });

    const cr = objective.changeRequests.id(req.params.crId);
    if (!cr) return res.status(404).json({ success: false, message: 'Change request not found.' });

    const { status, resolutionNote } = req.body;
    cr.status = status; // approved, rejected, modified
    cr.resolvedBy = req.user.id;
    cr.resolvedAt = new Date();
    cr.resolutionNote = resolutionNote || '';

    if (status === 'approved') {
      if (cr.requestType === 'due_date_extension' && cr.newDeadline) objective.deadline = cr.newDeadline;
      if (cr.requestType === 'scope_change') { if (cr.newDescription) objective.description = cr.newDescription; if (cr.newTitle) objective.title = cr.newTitle; }
      if (cr.requestType === 'cancellation') { objective.status = 'cancelled'; }
    }

    addActivity(objective, req.user.id, 'change_resolved', `${cr.requestType} ${status}: ${resolutionNote || ''}`);
    await objective.save();

    await createNotification(objective.owner, 'Change Request ' + (status === 'approved' ? 'Approved' : 'Rejected'), `Your change request on "${objective.title}" was ${status}.`, '/goals', 'CHANGE_REQUEST_RESOLVED');
    res.json({ success: true, objective });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// ========== DELETE ==========
exports.deleteObjective = async (req, res) => {
  try {
    const objective = await Objective.findById(req.params.id).populate('cycle');
    if (!objective) return res.status(404).json({ success: false, message: 'Objective not found.' });
    const isOwner = String(objective.owner) === String(req.user.id);
    const isAdmin = req.user.role === 'ADMIN';
    if (!isOwner && !isAdmin) return res.status(403).json({ success: false, message: 'Only the owner or admin can delete.' });
    if (objective.cycle && objective.cycle.status === 'closed') return res.status(400).json({ success: false, message: 'Cannot delete from a closed cycle.' });
    if (req.user.role === 'COLLABORATOR' && !['draft', 'rejected'].includes(objective.status)) return res.status(400).json({ success: false, message: 'Only draft/rejected objectives can be deleted.' });
    await Objective.deleteOne({ _id: objective._id });
    res.json({ success: true, message: 'Objective deleted.' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// ========== SUBMIT PROGRESS ==========
exports.submitProgress = async (req, res) => {
  try {
    const { achievementPercent, selfAssessment } = req.body;
    const objective = await Objective.findById(req.params.id).populate('cycle');
    if (!objective) return res.status(404).json({ success: false, message: 'Objective not found.' });
    if (String(objective.owner) !== String(req.user.id) && req.user.role !== 'ADMIN') return res.status(403).json({ success: false, message: 'Only the owner can submit progress.' });
    if (objective.cycle && objective.cycle.status === 'closed') return res.status(400).json({ success: false, message: 'Cycle is closed.' });
    objective.achievementPercent = achievementPercent;
    objective.selfAssessment = selfAssessment;
    objective.weightedScore = (objective.weight * achievementPercent) / 100;
    await objective.save();

    if (achievementPercent >= 100) {
      const team = await getTeamForUser(objective.owner);
      if (team && team.leader) {
        const user = await User.findById(objective.owner);
        await createNotification(team.leader, 'Objective Completed', `${user ? user.name : 'A team member'} reached 100% on "${objective.title}".`, '/goals', 'GOAL_COMPLETED');
      }
    }
    res.json({ success: true, objective });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// ========== KPIs ==========
exports.addKpi = async (req, res) => {
  try {
    const objective = await Objective.findById(req.params.id);
    if (!objective) return res.status(404).json({ success: false, message: 'Objective not found.' });
    const { title, metricType, initialValue, targetValue, currentValue, unit } = req.body;
    if (!title) return res.status(400).json({ success: false, message: 'KPI title is required.' });
    objective.kpis.push({ title, metricType: metricType || 'percent', initialValue: initialValue || 0, targetValue: targetValue || 100, currentValue: currentValue || 0, unit: unit || '' });
    objective.achievementPercent = calculateKpiProgress(objective.kpis);
    objective.weightedScore = (objective.weight * objective.achievementPercent) / 100;
    await objective.save();
    res.json({ success: true, objective });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.updateKpi = async (req, res) => {
  try {
    const objective = await Objective.findById(req.params.id);
    if (!objective) return res.status(404).json({ success: false, message: 'Objective not found.' });
    const kpi = objective.kpis.id(req.params.kpiId);
    if (!kpi) return res.status(404).json({ success: false, message: 'KPI not found.' });
    const { title, metricType, initialValue, targetValue, currentValue, unit, status } = req.body;
    if (title !== undefined) kpi.title = title;
    if (metricType !== undefined) kpi.metricType = metricType;
    if (initialValue !== undefined) kpi.initialValue = initialValue;
    if (targetValue !== undefined) kpi.targetValue = targetValue;
    if (currentValue !== undefined) kpi.currentValue = currentValue;
    if (unit !== undefined) kpi.unit = unit;
    if (status !== undefined) kpi.status = status;
    objective.achievementPercent = calculateKpiProgress(objective.kpis);
    objective.weightedScore = (objective.weight * objective.achievementPercent) / 100;
    await objective.save();
    const team = await getTeamForUser(objective.owner);
    if (team && team.leader && String(req.user.id) === String(objective.owner)) {
      const user = await User.findById(req.user.id);
      await createNotification(team.leader, 'KPI Updated', `${user ? user.name : 'A team member'} updated a KPI for "${objective.title}".`, '/goals', 'GOAL_UPDATE');
    }
    res.json({ success: true, objective });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.deleteKpi = async (req, res) => {
  try {
    const objective = await Objective.findById(req.params.id);
    if (!objective) return res.status(404).json({ success: false, message: 'Objective not found.' });
    objective.kpis = objective.kpis.filter(k => String(k._id) !== req.params.kpiId);
    objective.achievementPercent = objective.kpis.length > 0 ? calculateKpiProgress(objective.kpis) : null;
    if (objective.achievementPercent !== null) objective.weightedScore = (objective.weight * objective.achievementPercent) / 100;
    await objective.save();
    res.json({ success: true, objective });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// ========== PROGRESS UPDATES ==========
exports.addProgressUpdate = async (req, res) => {
  try {
    const objective = await Objective.findById(req.params.id);
    if (!objective) return res.status(404).json({ success: false, message: 'Objective not found.' });
    const { message, kpiUpdates } = req.body;
    if (!message) return res.status(400).json({ success: false, message: 'Message is required.' });
    if (kpiUpdates && Array.isArray(kpiUpdates)) {
      kpiUpdates.forEach(update => { const kpi = objective.kpis.id(update._id); if (kpi && update.currentValue !== undefined) { kpi.currentValue = update.currentValue; if (update.status) kpi.status = update.status; } });
      objective.achievementPercent = calculateKpiProgress(objective.kpis);
      if (objective.achievementPercent !== null) objective.weightedScore = (objective.weight * objective.achievementPercent) / 100;
    }
    objective.progressUpdates.push({ user: req.user.id, message });
    addActivity(objective, req.user.id, 'check_in', message);
    await objective.save();
    const team = await getTeamForUser(objective.owner);
    if (team && team.leader && String(req.user.id) === String(objective.owner)) {
      const user = await User.findById(req.user.id);
      await createNotification(team.leader, 'Check-in', `${user ? user.name : 'Member'} checked in on "${objective.title}".`, '/goals', 'GOAL_UPDATE');
    } else if (String(req.user.id) !== String(objective.owner)) {
      const updater = await User.findById(req.user.id);
      await createNotification(objective.owner, 'New Update', `${updater ? updater.name : 'Someone'} checked in on "${objective.title}".`, '/goals', 'GOAL_UPDATE');
    }
    const updated = await Objective.findById(req.params.id).populate('progressUpdates.user', 'name email');
    res.json({ success: true, objective: updated });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// ========== COMMENTS ==========
exports.addComment = async (req, res) => {
  try {
    const objective = await Objective.findById(req.params.id);
    if (!objective) return res.status(404).json({ success: false, message: 'Objective not found.' });
    const { text } = req.body;
    if (!text) return res.status(400).json({ success: false, message: 'Comment text is required.' });
    objective.comments.push({ user: req.user.id, text });
    await objective.save();
    const mentionRegex = /@(\w+)/g;
    const mentions = text.match(mentionRegex);
    if (mentions) {
      for (const mention of mentions) {
        const username = mention.substring(1);
        const mentionedUser = await User.findOne({ name: new RegExp('^' + username + '$', 'i') });
        if (mentionedUser && String(mentionedUser._id) !== String(req.user.id)) {
          await createNotification(mentionedUser._id, 'You were mentioned', `${req.user.name} mentioned you in a comment on "${objective.title}".`, '/goals', 'MENTION');
        }
      }
    }
    if (String(req.user.id) !== String(objective.owner)) {
      const commenter = await User.findById(req.user.id);
      await createNotification(objective.owner, 'New Comment', `${commenter ? commenter.name : 'Someone'} commented on "${objective.title}".`, '/goals', 'COMMENT');
    } else {
      const team = await getTeamForUser(objective.owner);
      if (team && team.leader) await createNotification(team.leader, 'New Comment', `${req.user.name} commented on "${objective.title}".`, '/goals', 'COMMENT');
    }
    const updated = await Objective.findById(req.params.id).populate('comments.user', 'name email');
    res.json({ success: true, objective: updated });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.deleteComment = async (req, res) => {
  try {
    const objective = await Objective.findById(req.params.id);
    if (!objective) return res.status(404).json({ success: false, message: 'Objective not found.' });
    objective.comments = objective.comments.filter(c => String(c._id) !== req.params.commentId);
    await objective.save();
    res.json({ success: true, objective });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// ========== SUB-OBJECTIVES ==========
exports.getSubObjectives = async (req, res) => {
  try {
    const children = await Objective.find({ parentObjective: req.params.id }).populate('owner', 'name email role').sort({ createdAt: -1 });
    res.json({ success: true, objectives: children });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// ========== DUPLICATE ==========
exports.duplicateObjective = async (req, res) => {
  try {
    const source = await Objective.findById(req.params.id);
    if (!source) return res.status(404).json({ success: false, message: 'Objective not found.' });
    const duplicate = await Objective.create({
      title: source.title + ' (Copy)', description: source.description, successIndicator: source.successIndicator,
      owner: req.user.id, cycle: source.cycle, category: source.category, weight: source.weight, deadline: source.deadline,
      status: 'draft', source: 'employee_created', labels: source.labels, visibility: source.visibility,
      startDate: source.startDate,
      kpis: source.kpis.map(k => ({ title: k.title, metricType: k.metricType, initialValue: k.initialValue, targetValue: k.targetValue, currentValue: k.initialValue, unit: k.unit })),
      activityLog: [{ user: req.user.id, action: 'created', details: 'Duplicated from: ' + source.title }],
    });
    res.status(201).json({ success: true, objective: duplicate });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};