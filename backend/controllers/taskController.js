const Task = require('../models/Task');
const User = require('../models/User');
const Team = require('../models/Team');
const Objective = require('../models/Objective');
const Cycle = require('../models/Cycle');
const mongoose = require('mongoose');
const { createAuditLog } = require('../utils/auditHelper');
const accessControl = require('../utils/accessControl');

async function getManagedTeamIds(userId) {
  const roots = await Team.find({ leader: userId }).select('_id');
  const managed = new Set(roots.map((team) => String(team._id)));
  let queue = roots.map((team) => team._id);
  while (queue.length) {
    const children = await Team.find({ parentTeam: { $in: queue } }).select('_id');
    queue = children.map((team) => team._id);
    children.forEach((team) => managed.add(String(team._id)));
  }
  return Array.from(managed);
}

function clampProgress(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(100, Math.round(numeric)));
}

function resolveWorkflowStage(inputStage, inputStatus, existingTask) {
  if (inputStage) return inputStage;

  const status = inputStatus || existingTask?.status;
  if (status === 'done') return 'completed';
  if (status === 'cancelled' || status === 'canceled') return 'cancelled';
  if (status === 'in_progress') return existingTask?.workflowStage === 'review' ? 'review' : 'in_progress';
  return existingTask?.workflowStage || 'todo';
}

function resolveStatus(inputStatus, inputStage, existingTask) {
  if (inputStatus) return inputStatus;

  const workflowStage = inputStage || existingTask?.workflowStage;
  if (workflowStage === 'cancelled') return 'cancelled';
  if (workflowStage === 'completed') return 'done';
  if (workflowStage === 'in_progress' || workflowStage === 'review') return 'in_progress';
  return existingTask?.status || 'todo';
}

function normalizeTrackingSession(session) {
  if (!session) return null;

  const startedAt = session.startedAt || session.startTime;
  const endedAt = session.endedAt || session.endTime;
  if (!startedAt || !endedAt) return null;

  return {
    startedAt,
    endedAt,
    durationSeconds: Math.max(0, Math.round(Number(session.durationSeconds ?? session.duration ?? 0))),
    focusMode: Boolean(session.focusMode),
    source: session.source || 'timer',
    notes: session.notes || '',
  };
}

function sanitizeTimeTracking(input, existingTask) {
  const current = existingTask?.timeTracking || {};
  const next = input && typeof input === 'object' ? input : {};
  const existingAliasSessions = Array.isArray(existingTask?.timeSessions) ? existingTask.timeSessions : [];
  const existingSessions = Array.isArray(current.sessions) && current.sessions.length > 0
    ? current.sessions
    : existingAliasSessions;
  const candidateSessions = Array.isArray(next.sessions)
    ? next.sessions
    : Array.isArray(next.timeSessions)
      ? next.timeSessions
      : existingSessions;

  const sessions = candidateSessions
    .map(normalizeTrackingSession)
    .filter(Boolean)
    .sort((left, right) => new Date(right.endedAt) - new Date(left.endedAt))
    .slice(0, 120);

  const candidateTotal = next.totalSeconds ?? next.totalTimeSpent ?? next.totalTrackedTime;
  const totalSeconds = Number.isFinite(Number(candidateTotal))
    ? Math.max(0, Math.round(Number(candidateTotal)))
    : sessions.reduce((sum, session) => sum + Number(session.durationSeconds || 0), 0);

  return {
    totalSeconds,
    lastTrackedAt: next.lastTrackedAt
      || current.lastTrackedAt
      || existingTask?.timeSessions?.[0]?.endTime
      || (sessions[0] ? sessions[0].endedAt : null),
    sessions,
  };
}

function buildTimerAliases(timeTracking) {
  const normalized = sanitizeTimeTracking(timeTracking);

  return {
    totalTrackedTime: Math.max(0, Math.round(Number(normalized.totalSeconds || 0))),
    totalTimeSpent: Math.max(0, Math.round(Number(normalized.totalSeconds || 0))),
    timeSessions: (normalized.sessions || []).map(function (session) {
      return {
        startTime: session.startedAt,
        endTime: session.endedAt,
        duration: Math.max(0, Math.round(Number(session.durationSeconds || 0))),
        focusMode: Boolean(session.focusMode),
        source: session.source || 'timer',
        notes: session.notes || '',
      };
    }),
  };
}

function sanitizeSingleSession(session) {
  return normalizeTrackingSession(session);
}

function isDuplicateSession(left, right) {
  if (!left || !right) return false;

  return String(new Date(left.startedAt).toISOString()) === String(new Date(right.startedAt).toISOString())
    && String(new Date(left.endedAt).toISOString()) === String(new Date(right.endedAt).toISOString())
    && Math.round(Number(left.durationSeconds || 0)) === Math.round(Number(right.durationSeconds || 0))
    && Boolean(left.focusMode) === Boolean(right.focusMode)
    && String(left.source || 'timer') === String(right.source || 'timer');
}

function canManageTask(task, user) {
  const actorId = String(user?._id || user?.id || '');
  if (!actorId) return false;
  if (user?.role === 'ADMIN') return true;
  return String(task?.assignedBy?._id || task?.assignedBy || '') === actorId
    || String(task?.assignee?._id || task?.assignee || '') === actorId;
}

function canTrackTask(task, user) {
  const actorId = String(user?._id || user?.id || '');
  if (!actorId) return false;
  return String(task?.assignee?._id || task?.assignee || '') === actorId;
}

function isTerminalTask(task) {
  const status = String(task?.status || '').toLowerCase();
  const workflowStage = String(task?.workflowStage || '').toLowerCase();
  return ['done', 'completed', 'cancelled', 'canceled'].includes(status)
    || ['completed', 'cancelled', 'canceled'].includes(workflowStage);
}

function isActiveCycle(cycle) {
  return cycle
    && ['open', 'active', 'in_progress'].includes(String(cycle.status || ''))
    && String(cycle.currentPhase || '') !== 'closed';
}

async function getCurrentCycle() {
  return Cycle.findOne({
    status: { $in: ['open', 'active', 'in_progress'] },
    currentPhase: { $ne: 'closed' },
  }).sort({ year: -1, createdAt: -1 });
}

async function canAccessObjective(objective, user) {
  return accessControl.canAccessObjective(user, objective);
}

async function validateLinkableObjective(objectiveId, user) {
  if (objectiveId === undefined) return { ok: true, value: undefined };
  if (!objectiveId) return { ok: true, value: null };
  if (!mongoose.isValidObjectId(objectiveId)) {
    return { ok: false, status: 400, message: 'Linked objective ID is invalid.' };
  }

  const objective = await Objective.findById(objectiveId)
    .populate('cycle', 'name year status currentPhase')
    .select('_id owner team cycle title');
  if (!objective) {
    return { ok: false, status: 400, message: 'Linked objective was not found.' };
  }
  if (!isActiveCycle(objective.cycle)) {
    return { ok: false, status: 400, message: 'Tasks can only be linked to objectives in the current active cycle.' };
  }
  const currentCycle = await getCurrentCycle();
  if (currentCycle && String(objective.cycle?._id || objective.cycle) !== String(currentCycle._id)) {
    return { ok: false, status: 400, message: 'Tasks can only be linked to objectives in the current active cycle.' };
  }
  if (!(await canAccessObjective(objective, user))) {
    return { ok: false, status: 403, message: 'You are not allowed to link tasks to this objective.' };
  }
  return { ok: true, value: objective._id };
}

async function canUseTaskTeam(actor, assignee, teamId) {
  if (!teamId) return true;
  if (!mongoose.isValidObjectId(teamId)) return false;
  if (String(assignee?.team || '') === String(teamId)) return true;
  if (!(await accessControl.canAccessTeam(actor, teamId))) return false;

  const team = await Team.findById(teamId).select('leader members');
  if (!team) return false;
  const assigneeId = String(assignee?._id || assignee?.id || '');
  return String(team.leader || '') === assigneeId
    || (team.members || []).some((memberId) => String(memberId) === assigneeId);
}

function pickTaskUpdates(body) {
  const allowed = [
    'title',
    'description',
    'status',
    'workflowStage',
    'priority',
    'progress',
    'dueDate',
    'recurring',
    'linkedGoal',
    'objective_id',
    'linkedMeeting',
    'notes',
    'timeTracking',
    'totalTimeSpent',
    'totalTrackedTime',
    'timeSessions',
  ];
  return allowed.reduce((updates, key) => {
    if (Object.prototype.hasOwnProperty.call(body, key)) {
      updates[key] = body[key];
    }
    return updates;
  }, {});
}

function addTaskSearch(filter, search) {
  const term = String(search || '').trim();
  if (!term) return filter;
  filter.$or = [
    { title: { $regex: term, $options: 'i' } },
    { description: { $regex: term, $options: 'i' } },
    { notes: { $regex: term, $options: 'i' } },
    { status: { $regex: term, $options: 'i' } },
    { priority: { $regex: term, $options: 'i' } },
  ];
  return filter;
}

function syncTaskTimerFields(task) {
  if (!task) return task;

  const nextTimeTracking = sanitizeTimeTracking({
    totalSeconds: task?.timeTracking?.totalSeconds,
    lastTrackedAt: task?.timeTracking?.lastTrackedAt,
    sessions: Array.isArray(task?.timeTracking?.sessions) && task.timeTracking.sessions.length > 0
      ? task.timeTracking.sessions
      : task?.timeSessions,
    totalTrackedTime: task?.totalTrackedTime,
    timeSessions: task?.timeSessions,
  }, task);
  const aliases = buildTimerAliases(nextTimeTracking);

  task.timeTracking = nextTimeTracking;
  task.totalTrackedTime = aliases.totalTrackedTime;
  task.totalTimeSpent = aliases.totalTimeSpent;
  task.timeSessions = aliases.timeSessions;
  return task;
}

// Create task
exports.createTask = async (req, res) => {
  try {
    const {
      title,
      description,
      assigneeId,
      assignee: assigneeBody,
      status,
      workflowStage,
      priority,
      progress,
      dueDate,
      recurring,
      linkedGoal,
      linkedMeeting,
      team,
      notes,
      timeTracking,
      totalTimeSpent,
      totalTrackedTime,
      timeSessions,
    } = req.body;
    const resolvedAssigneeId = assigneeId || assigneeBody || req.user._id;

    if (!title) {
      return res.status(400).json({ success: false, message: 'Title is required' });
    }

    const assignee = await User.findById(resolvedAssigneeId);
    if (!assignee) {
      return res.status(404).json({ success: false, message: 'Assignee not found' });
    }
    if (!(await accessControl.canAssignTaskTo(req.user, resolvedAssigneeId))) {
      return res.status(403).json({ success: false, message: 'You are not allowed to assign tasks to this user.' });
    }

    const objectiveValidation = await validateLinkableObjective(linkedGoal || req.body.objective_id || null, req.user);
    if (!objectiveValidation.ok) {
      return res.status(objectiveValidation.status).json({ success: false, message: objectiveValidation.message });
    }
    if (objectiveValidation.value) {
      const objective = await Objective.findById(objectiveValidation.value).select('owner team');
      if (objective && String(objective.owner) !== String(resolvedAssigneeId)) {
        return res.status(403).json({ success: false, message: 'Linked objective tasks must be assigned to the objective owner.' });
      }
    }
    if (!(await canUseTaskTeam(req.user, assignee, team))) {
      return res.status(403).json({ success: false, message: 'You are not allowed to assign tasks in this team.' });
    }

    const nextTimeTracking = sanitizeTimeTracking({
      ...(timeTracking && typeof timeTracking === 'object' ? timeTracking : {}),
      totalTimeSpent,
      totalTrackedTime,
      timeSessions,
    });
    const timerAliases = buildTimerAliases(nextTimeTracking);

    const task = await Task.create({
      title,
      description: description || '',
      assignee: resolvedAssigneeId,
      assignedBy: req.user._id,
      status: resolveStatus(status, workflowStage),
      workflowStage: resolveWorkflowStage(workflowStage, status),
      priority: priority || 'medium',
      progress: clampProgress(progress),
      dueDate: dueDate || null,
      recurring: recurring || 'none',
      linkedGoal: objectiveValidation.value || null,
      objective_id: objectiveValidation.value || null,
      linkedMeeting: linkedMeeting || null,
      team: team || assignee.team || null,
      notes: notes || '',
      timeTracking: nextTimeTracking,
      totalTimeSpent: timerAliases.totalTimeSpent,
      totalTrackedTime: timerAliases.totalTrackedTime,
      timeSessions: timerAliases.timeSessions,
    });

    const populated = syncTaskTimerFields(await Task.findById(task._id)
      .populate('assignee', 'name email role')
      .populate('assignedBy', 'name email role')
      .populate('linkedGoal', 'title cycle')
      .populate('linkedMeeting', 'title'));

    await createAuditLog({
      entityType: 'task', entityId: task._id, entityName: task.title,
      action: 'created', performedBy: req.user.id,
      description: 'Task "' + task.title + '" created.', ipAddress: req.ip,
    });
    res.status(201).json({ success: true, task: populated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Task data is private to its creator, regardless of assignee or role.
exports.getMyTasks = async (req, res) => {
  try {
    const { status, priority, search, page = 1, limit = 50 } = req.query;
    const filter = addTaskSearch({ assignee: req.user._id }, search);

    if (status) filter.status = status;
    if (priority) filter.priority = priority;

    const tasks = (await Task.find(filter)
      .populate('assignee', 'name email role')
      .populate('assignedBy', 'name email role')
      .populate('linkedGoal', 'title goalStatus cycle')
      .populate('linkedMeeting', 'title date')
      .sort({ dueDate: 1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .lean()).map(syncTaskTimerFields);

    const total = await Task.countDocuments(filter);
    res.json({ success: true, tasks, total, page: parseInt(page), pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Get tasks assigned by me
exports.getAssignedByMe = async (req, res) => {
  try {
    const tasks = (await Task.find({ assignedBy: req.user._id })
      .populate('assignee', 'name email role')
      .populate('linkedGoal', 'title cycle')
      .sort({ createdAt: -1 })
      .limit(100)
      .lean()).map(syncTaskTimerFields);

    res.json({ success: true, tasks });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Get team tasks
exports.getTeamTasks = async (req, res) => {
  try {
    const { teamId } = req.params;
    const team = await Team.findById(teamId).select('leader members');
    if (!team) return res.status(404).json({ success: false, message: 'Team not found.' });
    const actorId = String(req.user.id || req.user._id);
    const managedTeamIds = req.user.role === 'TEAM_LEADER' ? await getManagedTeamIds(actorId) : [];
    const canView = ['ADMIN', 'HR'].includes(req.user.role)
      || managedTeamIds.includes(String(team._id))
      || String(team.leader) === actorId
      || (team.members || []).some((member) => String(member) === actorId);
    if (!canView) return res.status(403).json({ success: false, message: 'Not authorized to view this team.' });
    const tasks = (await Task.find({ team: teamId })
      .populate('assignee', 'name email role')
      .populate('assignedBy', 'name email role')
      .populate('linkedGoal', 'title cycle')
      .sort({ dueDate: 1, createdAt: -1 })
      .lean()).map(syncTaskTimerFields);

    res.json({ success: true, tasks });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Get tasks for multiple teams
exports.getTasksByTeams = async (req, res) => {
  try {
    const teamIds = String(req.query.teamIds || '')
      .split(',')
      .map(function (value) { return value.trim(); })
      .filter(Boolean);

    if (teamIds.length === 0) {
      return res.json({ success: true, tasks: [] });
    }

    const actorId = String(req.user.id || req.user._id);
    let allowedTeamIds = teamIds;
    if (!['ADMIN', 'HR'].includes(req.user.role)) {
      const managedTeamIds = req.user.role === 'TEAM_LEADER' ? await getManagedTeamIds(actorId) : [];
      const visibleTeams = await Team.find({
        _id: { $in: teamIds },
        $or: [{ leader: actorId }, { members: actorId }]
      }).select('_id');
      allowedTeamIds = Array.from(new Set([
        ...visibleTeams.map((team) => String(team._id)),
        ...teamIds.filter((teamId) => managedTeamIds.includes(String(teamId)))
      ]));
    }
    if (!allowedTeamIds.length) return res.json({ success: true, tasks: [] });

    const limit = Number.parseInt(req.query.limit, 10);
    let query = Task.find({ team: { $in: allowedTeamIds } })
      .populate('assignee', 'name email role')
      .populate('assignedBy', 'name email role')
      .populate('linkedGoal', 'title cycle')
      .sort({ dueDate: 1, createdAt: -1 });

    if (Number.isFinite(limit) && limit > 0) {
      query = query.limit(limit);
    }

    const tasks = (await query.lean()).map(syncTaskTimerFields);

    res.json({ success: true, tasks });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Kept for API compatibility; privacy rules still restrict results to the creator.
exports.getAllTasks = async (req, res) => {
  try {
    const { status, priority, search, page = 1, limit = 50 } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    addTaskSearch(filter, search);

    const tasks = (await Task.find(filter)
      .populate('assignee', 'name email role')
      .populate('assignedBy', 'name email role')
      .populate('linkedGoal', 'title cycle')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .lean()).map(syncTaskTimerFields);

    const total = await Task.countDocuments(filter);
    res.json({ success: true, tasks, total, page: parseInt(page), pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Update task
exports.updateTask = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Task ID is invalid' });
    }
    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    if (!canManageTask(task, req.user)) {
      return res.status(403).json({ success: false, message: 'Not authorized to update this task' });
    }

    const updates = pickTaskUpdates(req.body || {});
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, message: 'No supported task fields were provided.' });
    }
    const requestedObjectiveId = updates.linkedGoal !== undefined ? updates.linkedGoal : updates.objective_id;
    const objectiveValidation = await validateLinkableObjective(requestedObjectiveId, req.user);
    if (!objectiveValidation.ok) {
      return res.status(objectiveValidation.status).json({ success: false, message: objectiveValidation.message });
    }
    if (objectiveValidation.value !== undefined) {
      updates.linkedGoal = objectiveValidation.value;
      updates.objective_id = objectiveValidation.value;
    }

    if (updates.progress !== undefined) {
      updates.progress = clampProgress(updates.progress);
    }

    updates.workflowStage = resolveWorkflowStage(updates.workflowStage, updates.status, task);
    updates.status = resolveStatus(updates.status, updates.workflowStage, task);

    if (updates.timeTracking !== undefined || updates.totalTimeSpent !== undefined || updates.totalTrackedTime !== undefined || updates.timeSessions !== undefined) {
      const nextTimeTracking = sanitizeTimeTracking({
        ...(updates.timeTracking && typeof updates.timeTracking === 'object' ? updates.timeTracking : {}),
        totalTimeSpent: updates.totalTimeSpent,
        totalTrackedTime: updates.totalTrackedTime,
        timeSessions: updates.timeSessions,
      }, task);
      const timerAliases = buildTimerAliases(nextTimeTracking);
      updates.timeTracking = nextTimeTracking;
      updates.totalTimeSpent = timerAliases.totalTimeSpent;
      updates.totalTrackedTime = timerAliases.totalTrackedTime;
      updates.timeSessions = timerAliases.timeSessions;
    }

    // Track completion
    if (updates.status === 'done' && task.status !== 'done') {
      updates.completedAt = new Date();
      updates.progress = 100;
    } else if (updates.status && updates.status !== 'done') {
      updates.completedAt = null;
    }

    const updated = syncTaskTimerFields(await Task.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true })
      .populate('assignee', 'name email role')
      .populate('assignedBy', 'name email role')
      .populate('linkedGoal', 'title achievementPercent cycle')
      .populate('linkedMeeting', 'title'));

    // Auto-update objective progress
    const objId = updated.objective_id || updated.linkedGoal?._id || updated.linkedGoal;
    if (objId) {
      const allTasks = await Task.find({
        $or: [ { objective_id: objId }, { linkedGoal: objId } ]
      });
      if (allTasks.length > 0) {
        const completedTasks = allTasks.filter(t => t.status === 'done').length;
        const newPercent = Math.round((completedTasks / allTasks.length) * 100);
        const Objective = require('../models/Objective');
        await Objective.findByIdAndUpdate(objId, { achievementPercent: newPercent });
      }
    }

    await createAuditLog({
      entityType: 'task', entityId: updated._id, entityName: updated.title,
      action: 'updated', performedBy: req.user.id, newValue: updates,
      description: 'Task "' + updated.title + '" updated.', ipAddress: req.ip,
    });
    res.json({ success: true, task: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.appendTimeEntry = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Task ID is invalid' });
    }
    const task = await Task.findById(req.params.id)
      .populate('assignee', 'name email role')
      .populate('assignedBy', 'name email role')
      .populate('linkedGoal', 'title achievementPercent cycle')
      .populate('linkedMeeting', 'title');

    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    if (!canTrackTask(task, req.user)) {
      return res.status(403).json({ success: false, message: 'Not authorized to track time for this task' });
    }
    if (isTerminalTask(task)) {
      return res.status(400).json({ success: false, message: 'Completed or cancelled tasks cannot be tracked.' });
    }

    const entry = sanitizeSingleSession(req.body);
    if (!entry || entry.durationSeconds <= 0) {
      return res.status(400).json({ success: false, message: 'A valid tracked session is required' });
    }

    const existingSessions = Array.isArray(task?.timeTracking?.sessions)
      ? task.timeTracking.sessions.map(function (session) {
          return {
            startedAt: session.startedAt,
            endedAt: session.endedAt,
            durationSeconds: session.durationSeconds,
            focusMode: session.focusMode,
            source: session.source,
            notes: session.notes,
          };
        })
      : [];

    if (existingSessions.some(function (session) { return isDuplicateSession(session, entry); })) {
      return res.json({ success: true, task: syncTaskTimerFields(task) });
    }

    const nextTimeTracking = sanitizeTimeTracking({
      totalSeconds: Number(task?.timeTracking?.totalSeconds || 0) + entry.durationSeconds,
      lastTrackedAt: entry.endedAt,
      sessions: [entry].concat(existingSessions),
    }, task);

    const timerAliases = buildTimerAliases(nextTimeTracking);

    task.timeTracking = nextTimeTracking;
    task.totalTimeSpent = timerAliases.totalTimeSpent;
    task.totalTrackedTime = timerAliases.totalTrackedTime;
    task.timeSessions = timerAliases.timeSessions;
    task.markModified('timeTracking');
    task.markModified('timeSessions');
    await task.save({ validateBeforeSave: false });

    res.json({ success: true, task: syncTaskTimerFields(task) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Delete task
exports.deleteTask = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Task ID is invalid' });
    }
    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }
    if (!canManageTask(task, req.user)) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this task' });
    }

    await Task.findByIdAndDelete(req.params.id);
    await createAuditLog({
      entityType: 'task', entityId: task._id, entityName: task.title,
      action: 'deleted', performedBy: req.user.id,
      description: 'Task "' + task.title + '" deleted.', ipAddress: req.ip,
    });
    res.json({ success: true, message: 'Task deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Get task stats
exports.getStats = async (req, res) => {
  try {
    const userId = req.user._id;
    const [byStatus, overdue, total] = await Promise.all([
      Task.aggregate([
        { $match: { assignee: userId } },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]),
      Task.countDocuments({ assignee: userId, status: { $in: ['todo', 'in_progress'] }, dueDate: { $lt: new Date() } }),
      Task.countDocuments({ assignee: userId })
    ]);

    const statusMap = {};
    byStatus.forEach(s => { statusMap[s._id] = s.count; });

    res.json({
      success: true,
      stats: {
        total,
        todo: statusMap.todo || 0,
        inProgress: statusMap.in_progress || 0,
        done: statusMap.done || 0,
        cancelled: statusMap.cancelled || 0,
        overdue,
        completionRate: total > 0 ? Math.round(((statusMap.done || 0) / total) * 100) : 0
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports._private = {
  canManageTask,
  canTrackTask,
  addTaskSearch,
  isTerminalTask,
  validateLinkableObjective,
  pickTaskUpdates,
};
