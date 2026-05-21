const express = require('express');
const router = express.Router();
const Objective = require('../models/Objective');
const Task = require('../models/Task');
const Feedback = require('../models/Feedback');
const CheckIn = require('../models/CheckIn');
const AuditLog = require('../models/AuditLog');
const Team = require('../models/Team');
const User = require('../models/User');
const auth = require('../middleware/auth');

function toIdString(value) {
  if (!value) return '';
  return String(value._id || value.id || value);
}

function toIsoDate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function trimText(value, maxLength) {
  const text = String(value || '').trim();
  const limit = Number(maxLength || 0);
  if (!limit || text.length <= limit) return text;
  return text.slice(0, Math.max(0, limit - 3)).trimEnd() + '...';
}

function formatDuration(seconds) {
  const totalSeconds = Math.max(0, Math.round(Number(seconds) || 0));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  if (hours > 0) {
    return hours + 'h ' + String(minutes).padStart(2, '0') + 'm';
  }

  if (minutes > 0) {
    return minutes + 'm';
  }

  return totalSeconds + 's';
}

function humanizeAction(action) {
  return String(action || 'team activity')
    .replace(/[._]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildFeedUser(user, fallbackName) {
  return {
    _id: toIdString(user),
    name: user?.name || fallbackName || 'System',
    profileImage: user?.profileImage || '',
    role: user?.role || '',
  };
}

function pushActivity(activities, entry) {
  const timestamp = toIsoDate(entry?.timestamp);
  if (!timestamp) return;

  activities.push({
    id: String(entry.id || Math.random()),
    type: entry.type || 'activity',
    category: entry.category || 'activity',
    title: entry.title || entry.targetLabel || 'Activity',
    targetLabel: entry.targetLabel || entry.title || '',
    message: trimText(entry.message || 'Updated team activity', 220),
    timestamp,
    meta: entry.meta || '',
    user: buildFeedUser(entry.user, entry.fallbackUserName),
  });
}

async function resolveFeedScope(currentUser) {
  if (!currentUser) {
    return { unrestricted: false, userIds: [], teamIds: [] };
  }

  if (['ADMIN', 'HR'].includes(currentUser.role)) {
    return { unrestricted: true, userIds: [], teamIds: [] };
  }

  const userIds = new Set([toIdString(currentUser._id)]);
  const teamIds = new Set();

  if (currentUser.manager) {
    userIds.add(toIdString(currentUser.manager));
  }

  const teamFilters = [];
  if (currentUser.team) {
    teamFilters.push({ _id: currentUser.team });
  }
  teamFilters.push({ leader: currentUser._id }, { members: currentUser._id });

  const teams = await Team.find({ $or: teamFilters })
    .select('_id leader members')
    .lean();

  teams.forEach(function (team) {
    teamIds.add(toIdString(team._id));
    if (team.leader) userIds.add(toIdString(team.leader));
    (team.members || []).forEach(function (memberId) {
      userIds.add(toIdString(memberId));
    });
  });

  const [teamUsers, directReports] = await Promise.all([
    teamIds.size > 0
      ? User.find({ team: { $in: Array.from(teamIds) }, isActive: true, isDeleted: false }).select('_id').lean()
      : Promise.resolve([]),
    User.find({ manager: currentUser._id, isActive: true, isDeleted: false }).select('_id').lean(),
  ]);

  teamUsers.forEach(function (user) { userIds.add(toIdString(user._id)); });
  directReports.forEach(function (user) { userIds.add(toIdString(user._id)); });

  return {
    unrestricted: false,
    userIds: Array.from(userIds).filter(Boolean),
    teamIds: Array.from(teamIds).filter(Boolean),
  };
}

function buildObjectiveFilter(scope) {
  if (scope.unrestricted) return {};

  const clauses = [
    { owner: { $in: scope.userIds } },
    { 'comments.user': { $in: scope.userIds } },
    { 'progressUpdates.user': { $in: scope.userIds } },
    { 'activityLog.user': { $in: scope.userIds } },
  ];

  if (scope.teamIds.length > 0) {
    clauses.push({ team: { $in: scope.teamIds } });
  }

  return { $or: clauses };
}

function buildTaskFilter(scope) {
  if (scope.unrestricted) return {};

  const clauses = [
    { assignee: { $in: scope.userIds } },
    { assignedBy: { $in: scope.userIds } },
  ];

  if (scope.teamIds.length > 0) {
    clauses.push({ team: { $in: scope.teamIds } });
  }

  return { $or: clauses };
}

function buildFeedbackFilter(scope, currentUser) {
  if (scope.unrestricted) {
    return { status: 'active' };
  }

  const visibilityClauses = [
    { visibility: 'public' },
    { sender: currentUser._id },
    { recipient: currentUser._id },
  ];

  if (currentUser.role === 'TEAM_LEADER') {
    visibilityClauses.push({ visibility: 'manager_only' });
  }

  return {
    status: 'active',
    $and: [
      { $or: [{ sender: { $in: scope.userIds } }, { recipient: { $in: scope.userIds } }] },
      { $or: visibilityClauses },
    ],
  };
}

function buildCheckInFilter(scope) {
  if (scope.unrestricted) return {};
  return { employee_id: { $in: scope.userIds } };
}

function buildAuditFilter(scope) {
  const relevantActions = [{ action: /^cycle\./ }, { action: /^evaluation\./ }];
  if (scope.unrestricted) {
    return { $or: relevantActions };
  }

  return {
    user_id: { $in: scope.userIds },
    $or: relevantActions,
  };
}

router.get('/', auth, async function (req, res) {
  try {
    const currentUser = await User.findById(req.user._id)
      .select('_id name role team manager')
      .lean();

    const scope = await resolveFeedScope(currentUser);
    const sourceRequests = [
      {
        name: 'objectives',
        request: Objective.find(buildObjectiveFilter(scope))
          .select('title owner team updatedAt createdAt activityLog progressUpdates comments')
          .populate('owner', 'name profileImage role')
          .populate('progressUpdates.user', 'name profileImage role')
          .populate('comments.user', 'name profileImage role')
          .populate('activityLog.user', 'name profileImage role')
          .sort({ updatedAt: -1 })
          .limit(20)
          .lean(),
      },
      {
        name: 'tasks',
        request: Task.find(buildTaskFilter(scope))
          .select('title status timeTracking createdAt updatedAt completedAt assignee assignedBy linkedGoal team')
          .populate('assignee', 'name profileImage role')
          .populate('assignedBy', 'name profileImage role')
          .populate('linkedGoal', 'title')
          .sort({ updatedAt: -1 })
          .limit(20)
          .lean(),
      },
      {
        name: 'feedback',
        request: Feedback.find(buildFeedbackFilter(scope, currentUser))
          .select('sender recipient relatedObjective message type createdAt visibility status')
          .populate('sender', 'name profileImage role')
          .populate('recipient', 'name profileImage role')
          .populate('relatedObjective', 'title')
          .sort({ createdAt: -1 })
          .limit(20)
          .lean(),
      },
      {
        name: 'reports',
        request: CheckIn.find(buildCheckInFilter(scope))
          .select('employee_id objective_id progress_percent status submitted_at updatedAt createdAt')
          .populate('employee_id', 'name profileImage role')
          .populate('objective_id', 'title')
          .sort({ updatedAt: -1 })
          .limit(20)
          .lean(),
      },
      {
        name: 'system',
        request: AuditLog.find(buildAuditFilter(scope))
          .select('action entity_type metadata timestamp user_id')
          .populate('user_id', 'name profileImage role')
          .sort({ timestamp: -1 })
          .limit(20)
          .lean(),
      },
    ];

    const settledSources = await Promise.allSettled(sourceRequests.map(function (source) { return source.request; }));
    const dataBySource = {};
    const warnings = [];

    settledSources.forEach(function (result, index) {
      const name = sourceRequests[index].name;
      if (result.status === 'fulfilled') {
        dataBySource[name] = Array.isArray(result.value) ? result.value : [];
        return;
      }

      console.error('Feed source failed:', name, result.reason?.message || result.reason);
      dataBySource[name] = [];
      warnings.push(name + ' feed source is temporarily unavailable.');
    });

    const activities = [];

    (dataBySource.objectives || []).forEach(function (objective) {
      const objectiveTitle = objective?.title || 'Objective';

      (objective?.activityLog || []).forEach(function (entry) {
        const message = entry?.details
          || (entry?.toStatus ? 'Changed status to ' + String(entry.toStatus).replace(/_/g, ' ') : humanizeAction(entry?.action));

        pushActivity(activities, {
          id: 'objective-' + objective._id + '-activity-' + (entry?._id || entry?.createdAt || message),
          type: 'status_change',
          category: 'status',
          user: entry?.user || objective?.owner,
          title: objectiveTitle,
          targetLabel: objectiveTitle,
          message,
          timestamp: entry?.createdAt,
          meta: entry?.action || '',
        });
      });

      (objective?.progressUpdates || []).forEach(function (update) {
        pushActivity(activities, {
          id: 'objective-' + objective._id + '-progress-' + (update?._id || update?.createdAt || ''),
          type: 'progress_update',
          category: 'activity',
          user: update?.user || objective?.owner,
          title: objectiveTitle,
          targetLabel: objectiveTitle,
          message: update?.message || 'Posted a progress update',
          timestamp: update?.createdAt,
        });
      });

      (objective?.comments || []).forEach(function (comment) {
        pushActivity(activities, {
          id: 'objective-' + objective._id + '-comment-' + (comment?._id || comment?.createdAt || ''),
          type: 'comment',
          category: 'comments',
          user: comment?.user || objective?.owner,
          title: objectiveTitle,
          targetLabel: objectiveTitle,
          message: comment?.text || 'Added a comment',
          timestamp: comment?.createdAt,
        });
      });

      if (!(objective?.activityLog || []).length && !(objective?.progressUpdates || []).length && !(objective?.comments || []).length) {
        pushActivity(activities, {
          id: 'objective-' + objective._id + '-updated',
          type: 'goal_update',
          category: 'activity',
          user: objective?.owner,
          title: objectiveTitle,
          targetLabel: objectiveTitle,
          message: 'Updated objective details',
          timestamp: objective?.updatedAt || objective?.createdAt,
        });
      }
    });

    (dataBySource.tasks || []).forEach(function (task) {
      const taskTitle = task?.title || 'Task';
      const taskUser = task?.assignee || task?.assignedBy;
      const latestSession = Array.isArray(task?.timeTracking?.sessions) ? task.timeTracking.sessions[0] : null;

      pushActivity(activities, {
        id: 'task-' + task._id + '-created',
        type: 'task_update',
        category: 'tasks',
        user: task?.assignedBy || taskUser,
        title: taskTitle,
        targetLabel: task?.linkedGoal?.title || taskTitle,
        message: 'Created or assigned a task',
        timestamp: task?.createdAt,
      });

      if (task?.updatedAt && task?.createdAt && new Date(task.updatedAt).getTime() > new Date(task.createdAt).getTime() + 60000) {
        pushActivity(activities, {
          id: 'task-' + task._id + '-updated',
          type: 'task_update',
          category: 'tasks',
          user: taskUser,
          title: taskTitle,
          targetLabel: task?.linkedGoal?.title || taskTitle,
          message: 'Updated task details',
          timestamp: task?.updatedAt,
        });
      }

      if (task?.status === 'done' || task?.completedAt) {
        pushActivity(activities, {
          id: 'task-' + task._id + '-completed',
          type: 'task_status',
          category: 'status',
          user: taskUser,
          title: taskTitle,
          targetLabel: task?.linkedGoal?.title || taskTitle,
          message: 'Marked the task as completed',
          timestamp: task?.completedAt || task?.updatedAt,
        });
      }

      if (task?.timeTracking?.lastTrackedAt) {
        pushActivity(activities, {
          id: 'task-' + task._id + '-tracked',
          type: 'task_time',
          category: 'activity',
          user: taskUser,
          title: taskTitle,
          targetLabel: task?.linkedGoal?.title || taskTitle,
          message: 'Logged ' + formatDuration(latestSession?.durationSeconds || task?.timeTracking?.totalSeconds || 0) + ' on task',
          timestamp: task?.timeTracking?.lastTrackedAt,
        });
      }
    });

    (dataBySource.feedback || []).forEach(function (feedback) {
      pushActivity(activities, {
        id: 'feedback-' + feedback._id,
        type: 'feedback',
        category: 'activity',
        user: feedback?.sender,
        title: feedback?.relatedObjective?.title || (feedback?.recipient?.name ? 'Feedback for ' + feedback.recipient.name : 'Feedback'),
        targetLabel: feedback?.recipient?.name || 'Team member',
        message: feedback?.message || 'Shared feedback',
        timestamp: feedback?.createdAt,
        meta: feedback?.type || '',
      });
    });

    (dataBySource.reports || []).forEach(function (checkIn) {
      const progress = Number.isFinite(Number(checkIn?.progress_percent)) ? Math.round(Number(checkIn.progress_percent)) + '%' : 'no progress';
      pushActivity(activities, {
        id: 'report-' + checkIn._id,
        type: 'report',
        category: 'reports',
        user: checkIn?.employee_id,
        title: checkIn?.objective_id?.title || 'Check-in report',
        targetLabel: checkIn?.objective_id?.title || 'Check-in report',
        message: 'Submitted a ' + String(checkIn?.status || 'draft').replace(/_/g, ' ') + ' report at ' + progress,
        timestamp: checkIn?.submitted_at || checkIn?.updatedAt || checkIn?.createdAt,
      });
    });

    (dataBySource.system || []).forEach(function (log) {
      const action = String(log?.action || '');
      const category = action.indexOf('cycle.') === 0 ? 'system' : 'reports';
      const targetLabel = log?.entity_type || (category === 'system' ? 'System event' : 'Performance report');
      const metadataMessage = trimText(log?.metadata?.description || log?.metadata?.message || '', 180);

      pushActivity(activities, {
        id: 'audit-' + log._id,
        type: category === 'system' ? 'system_event' : 'report',
        category,
        user: log?.user_id,
        title: targetLabel,
        targetLabel,
        message: metadataMessage || humanizeAction(action),
        timestamp: log?.timestamp,
        meta: action,
      });
    });

    const uniqueActivities = [];
    const seenIds = new Set();

    activities
      .sort(function (left, right) {
        return new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime();
      })
      .forEach(function (activity) {
        if (seenIds.has(activity.id)) return;
        seenIds.add(activity.id);
        uniqueActivities.push(activity);
      });

    res.json({
      success: true,
      activities: uniqueActivities.slice(0, 60),
      warnings,
    });
  } catch (err) {
    console.error('Feed route error:', err);
    res.status(500).json({ success: false, message: err.message || 'Failed to load team feed' });
  }
});

module.exports = router;
