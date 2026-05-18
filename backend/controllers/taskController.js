const Task = require('../models/Task');
const User = require('../models/User');

function clampProgress(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(100, Math.round(numeric)));
}

function resolveWorkflowStage(inputStage, inputStatus, existingTask) {
  if (inputStage) return inputStage;

  const status = inputStatus || existingTask?.status;
  if (status === 'done') return 'completed';
  if (status === 'in_progress') return existingTask?.workflowStage === 'review' ? 'review' : 'in_progress';
  if (status === 'cancelled') return 'todo';
  return existingTask?.workflowStage || 'todo';
}

function resolveStatus(inputStatus, inputStage, existingTask) {
  if (inputStatus) return inputStatus;

  const workflowStage = inputStage || existingTask?.workflowStage;
  if (workflowStage === 'completed') return 'done';
  if (workflowStage === 'in_progress' || workflowStage === 'review') return 'in_progress';
  return existingTask?.status || 'todo';
}

function sanitizeTimeTracking(input, existingTask) {
  const current = existingTask?.timeTracking || {};
  const next = input && typeof input === 'object' ? input : {};
  const existingSessions = Array.isArray(current.sessions) ? current.sessions : [];
  const candidateSessions = Array.isArray(next.sessions) ? next.sessions : existingSessions;

  const sessions = candidateSessions
    .map((session) => {
      if (!session?.startedAt || !session?.endedAt) return null;
      const durationSeconds = Math.max(0, Math.round(Number(session.durationSeconds) || 0));
      return {
        startedAt: session.startedAt,
        endedAt: session.endedAt,
        durationSeconds,
        focusMode: Boolean(session.focusMode),
        source: session.source || 'timer',
        notes: session.notes || '',
      };
    })
    .filter(Boolean)
    .sort((left, right) => new Date(right.endedAt) - new Date(left.endedAt))
    .slice(0, 120);

  const totalSeconds = Number.isFinite(Number(next.totalSeconds))
    ? Math.max(0, Math.round(Number(next.totalSeconds)))
    : sessions.reduce((sum, session) => sum + Number(session.durationSeconds || 0), 0);

  return {
    totalSeconds,
    lastTrackedAt: next.lastTrackedAt || current.lastTrackedAt || (sessions[0] ? sessions[0].endedAt : null),
    sessions,
  };
}

function sanitizeSingleSession(session) {
  if (!session || !session.startedAt || !session.endedAt) {
    return null;
  }

  return {
    startedAt: session.startedAt,
    endedAt: session.endedAt,
    durationSeconds: Math.max(0, Math.round(Number(session.durationSeconds) || 0)),
    focusMode: Boolean(session.focusMode),
    source: session.source || 'timer',
    notes: session.notes || '',
  };
}

function canManageTask(task, user) {
  const isAssignee = task.assignee.toString() === user._id.toString();
  const isAssigner = task.assignedBy.toString() === user._id.toString();
  const isAdmin = ['ADMIN', 'HR'].includes(user.role);
  return isAssignee || isAssigner || isAdmin;
}

// Create task
exports.createTask = async (req, res) => {
  try {
    const {
      title,
      description,
      assigneeId,
      status,
      workflowStage,
      priority,
      progress,
      labels,
      dueDate,
      recurring,
      linkedGoal,
      linkedMeeting,
      team,
      notes,
      timeTracking,
    } = req.body;
    const resolvedAssigneeId = assigneeId || req.user._id;

    if (!title) {
      return res.status(400).json({ success: false, message: 'Title is required' });
    }

    const assignee = await User.findById(resolvedAssigneeId);
    if (!assignee) {
      return res.status(404).json({ success: false, message: 'Assignee not found' });
    }

    const task = await Task.create({
      title,
      description: description || '',
      assignee: resolvedAssigneeId,
      assignedBy: req.user._id,
      status: resolveStatus(status, workflowStage),
      workflowStage: resolveWorkflowStage(workflowStage, status),
      priority: priority || 'medium',
      progress: clampProgress(progress),
      labels: labels || [],
      dueDate: dueDate || null,
      recurring: recurring || 'none',
      linkedGoal: linkedGoal || null,
      linkedMeeting: linkedMeeting || null,
      team: team || null,
      notes: notes || '',
      timeTracking: sanitizeTimeTracking(timeTracking),
    });

    const populated = await Task.findById(task._id)
      .populate('assignee', 'name email role')
      .populate('assignedBy', 'name email role')
      .populate('linkedGoal', 'title')
      .populate('linkedMeeting', 'title');

    res.status(201).json({ success: true, task: populated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Get my tasks (assigned to me)
exports.getMyTasks = async (req, res) => {
  try {
    const { status, priority, page = 1, limit = 50 } = req.query;
    const filter = { assignee: req.user._id };
    if (status) filter.status = status;
    if (priority) filter.priority = priority;

    const tasks = await Task.find(filter)
      .populate('assignee', 'name email role')
      .populate('assignedBy', 'name email role')
      .populate('linkedGoal', 'title goalStatus')
      .populate('linkedMeeting', 'title date')
      .sort({ dueDate: 1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .lean();

    const total = await Task.countDocuments(filter);
    res.json({ success: true, tasks, total, page: parseInt(page), pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Get tasks assigned by me
exports.getAssignedByMe = async (req, res) => {
  try {
    const tasks = await Task.find({ assignedBy: req.user._id })
      .populate('assignee', 'name email role')
      .populate('linkedGoal', 'title')
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    res.json({ success: true, tasks });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Get team tasks
exports.getTeamTasks = async (req, res) => {
  try {
    const { teamId } = req.params;
    const tasks = await Task.find({ team: teamId })
      .populate('assignee', 'name email role')
      .populate('assignedBy', 'name email role')
      .populate('linkedGoal', 'title')
      .sort({ dueDate: 1, createdAt: -1 })
      .lean();

    res.json({ success: true, tasks });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Get all tasks (admin)
exports.getAllTasks = async (req, res) => {
  try {
    const { status, priority, page = 1, limit = 50 } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (priority) filter.priority = priority;

    const tasks = await Task.find(filter)
      .populate('assignee', 'name email role')
      .populate('assignedBy', 'name email role')
      .populate('linkedGoal', 'title')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .lean();

    const total = await Task.countDocuments(filter);
    res.json({ success: true, tasks, total, page: parseInt(page), pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Update task
exports.updateTask = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    // Only assignee, assigner, or admin can update
    if (!canManageTask(task, req.user)) {
      return res.status(403).json({ success: false, message: 'Not authorized to update this task' });
    }

    const updates = req.body;
    if (updates.progress !== undefined) {
      updates.progress = clampProgress(updates.progress);
    }

    updates.workflowStage = resolveWorkflowStage(updates.workflowStage, updates.status, task);
    updates.status = resolveStatus(updates.status, updates.workflowStage, task);

    if (updates.timeTracking !== undefined) {
      updates.timeTracking = sanitizeTimeTracking(updates.timeTracking, task);
    }

    // Track completion
    if (updates.status === 'done' && task.status !== 'done') {
      updates.completedAt = new Date();
      updates.progress = 100;
    } else if (updates.status && updates.status !== 'done') {
      updates.completedAt = null;
    }

    const updated = await Task.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true })
      .populate('assignee', 'name email role')
      .populate('assignedBy', 'name email role')
      .populate('linkedGoal', 'title achievementPercent')
      .populate('linkedMeeting', 'title');

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

    res.json({ success: true, task: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.appendTimeEntry = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id)
      .populate('assignee', 'name email role')
      .populate('assignedBy', 'name email role')
      .populate('linkedGoal', 'title achievementPercent')
      .populate('linkedMeeting', 'title');

    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    if (!canManageTask(task, req.user)) {
      return res.status(403).json({ success: false, message: 'Not authorized to track time for this task' });
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

    const nextTimeTracking = sanitizeTimeTracking({
      totalSeconds: Number(task?.timeTracking?.totalSeconds || 0) + entry.durationSeconds,
      lastTrackedAt: entry.endedAt,
      sessions: [entry].concat(existingSessions),
    }, task);

    task.timeTracking = nextTimeTracking;
    task.markModified('timeTracking');
    await task.save({ validateBeforeSave: false });

    res.json({ success: true, task });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Delete task
exports.deleteTask = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    const isAssigner = task.assignedBy.toString() === req.user._id.toString();
    const isAdmin = ['ADMIN', 'HR'].includes(req.user.role);

    if (!isAssigner && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this task' });
    }

    await Task.findByIdAndDelete(req.params.id);
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
