const Task = require('../models/Task');
const User = require('../models/User');

// Create task
exports.createTask = async (req, res) => {
  try {
    const { title, description, assigneeId, status, priority, labels, dueDate, recurring, linkedGoal, linkedMeeting, team, notes } = req.body;

    if (!title || !assigneeId) {
      return res.status(400).json({ success: false, message: 'Title and assignee are required' });
    }

    const assignee = await User.findById(assigneeId);
    if (!assignee) {
      return res.status(404).json({ success: false, message: 'Assignee not found' });
    }

    const task = await Task.create({
      title,
      description: description || '',
      assignee: assigneeId,
      assignedBy: req.user._id,
      status: status || 'todo',
      priority: priority || 'medium',
      labels: labels || [],
      dueDate: dueDate || null,
      recurring: recurring || 'none',
      linkedGoal: linkedGoal || null,
      linkedMeeting: linkedMeeting || null,
      team: team || null,
      notes: notes || '',
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
      .limit(parseInt(limit));

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
      .limit(100);

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
      .sort({ dueDate: 1, createdAt: -1 });

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
      .limit(parseInt(limit));

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
    const isAssignee = task.assignee.toString() === req.user._id.toString();
    const isAssigner = task.assignedBy.toString() === req.user._id.toString();
    const isAdmin = ['ADMIN', 'HR'].includes(req.user.role);

    if (!isAssignee && !isAssigner && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Not authorized to update this task' });
    }

    const updates = req.body;

    // Track completion
    if (updates.status === 'done' && task.status !== 'done') {
      updates.completedAt = new Date();
    } else if (updates.status && updates.status !== 'done') {
      updates.completedAt = null;
    }

    const updated = await Task.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true })
      .populate('assignee', 'name email role')
      .populate('assignedBy', 'name email role')
      .populate('linkedGoal', 'title')
      .populate('linkedMeeting', 'title');

    res.json({ success: true, task: updated });
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
