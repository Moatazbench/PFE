export var KANBAN_COLUMNS = [
  { key: 'backlog', label: 'Backlog' },
  { key: 'todo', label: 'Todo' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'review', label: 'Review' },
  { key: 'completed', label: 'Completed' },
];

export function getWorkflowStage(task) {
  if (task?.workflowStage) return task.workflowStage;
  if (task?.status === 'done') return 'completed';
  if (task?.status === 'in_progress') return 'in_progress';
  return 'todo';
}

export function getStatusForStage(stage) {
  if (stage === 'completed') return 'done';
  if (stage === 'in_progress' || stage === 'review') return 'in_progress';
  return 'todo';
}

export function getTrackedSeconds(task) {
  var total = Number(task?.timeTracking?.totalSeconds || 0);
  if (Number.isFinite(total) && total > 0) return Math.round(total);

  return (task?.timeTracking?.sessions || []).reduce(function (sum, session) {
    return sum + Math.max(0, Number(session?.durationSeconds || 0));
  }, 0);
}

export function formatDuration(totalSeconds) {
  var seconds = Math.max(0, Math.round(Number(totalSeconds) || 0));
  var hours = Math.floor(seconds / 3600);
  var minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0) return hours + 'h ' + String(minutes).padStart(2, '0') + 'm';
  return minutes + 'm';
}

export function formatDurationLong(totalSeconds) {
  var seconds = Math.max(0, Math.round(Number(totalSeconds) || 0));
  var hours = Math.floor(seconds / 3600);
  var minutes = Math.floor((seconds % 3600) / 60);
  var secs = seconds % 60;
  return String(hours).padStart(2, '0') + ':' + String(minutes).padStart(2, '0') + ':' + String(secs).padStart(2, '0');
}

export function buildTimesheetEntries(tasks) {
  return (tasks || [])
    .flatMap(function (task) {
      return (task?.timeTracking?.sessions || []).map(function (session, index) {
        return {
          id: String(task?._id || task?.id || 'task') + '-session-' + index + '-' + String(session?.endedAt || ''),
          taskId: task?._id || task?.id,
          taskTitle: task?.title || 'Task',
          linkedGoal: task?.linkedGoal?.title || '',
          focusMode: Boolean(session?.focusMode),
          startedAt: session?.startedAt,
          endedAt: session?.endedAt,
          durationSeconds: Math.max(0, Number(session?.durationSeconds || 0)),
          source: session?.source || 'timer',
        };
      });
    })
    .sort(function (left, right) {
      return new Date(right.endedAt || 0) - new Date(left.endedAt || 0);
    });
}

export function buildProductivitySummary(tasks) {
  var entries = buildTimesheetEntries(tasks);
  var todayKey = new Date().toISOString().slice(0, 10);
  var weekStart = new Date();
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());

  var todaySeconds = 0;
  var weekSeconds = 0;
  var focusSeconds = 0;
  var activeDays = new Set();

  entries.forEach(function (entry) {
    if (!entry?.endedAt) return;
    var endedAt = new Date(entry.endedAt);
    var entryKey = endedAt.toISOString().slice(0, 10);
    activeDays.add(entryKey);

    if (entryKey === todayKey) {
      todaySeconds += entry.durationSeconds;
    }
    if (endedAt >= weekStart) {
      weekSeconds += entry.durationSeconds;
    }
    if (entry.focusMode) {
      focusSeconds += entry.durationSeconds;
    }
  });

  return {
    totalSeconds: (tasks || []).reduce(function (sum, task) {
      return sum + getTrackedSeconds(task);
    }, 0),
    todaySeconds,
    weekSeconds,
    focusSeconds,
    activeDays: activeDays.size,
    entries: entries,
  };
}

export function buildDailyProductivity(tasks, days) {
  var totalDays = days || 7;
  var entries = buildTimesheetEntries(tasks);
  var now = new Date();
  now.setHours(0, 0, 0, 0);

  var buckets = Array.from({ length: totalDays }).map(function (_, index) {
    var date = new Date(now);
    date.setDate(now.getDate() - (totalDays - index - 1));
    return {
      key: date.toISOString().slice(0, 10),
      label: date.toLocaleDateString('en-US', { weekday: totalDays > 7 ? 'short' : 'narrow' }),
      trackedSeconds: 0,
      sessions: 0,
    };
  });

  var bucketMap = buckets.reduce(function (map, bucket) {
    map[bucket.key] = bucket;
    return map;
  }, {});

  entries.forEach(function (entry) {
    var key = new Date(entry.endedAt || entry.startedAt || 0).toISOString().slice(0, 10);
    if (!bucketMap[key]) return;
    bucketMap[key].trackedSeconds += entry.durationSeconds;
    bucketMap[key].sessions += 1;
  });

  return buckets;
}

export function buildCalendarItems(payload) {
  var tasks = payload?.tasks || [];
  var objectives = payload?.objectives || [];
  var meetings = payload?.meetings || [];
  var checkIns = payload?.checkIns || [];
  var providerEvents = payload?.providerEvents || [];

  return []
    .concat(tasks.map(function (task) {
      if (!task?.dueDate) return null;
      return {
        id: 'task-' + task._id,
        sourceId: task._id,
        type: 'task',
        title: task.title,
        start: task.dueDate,
        end: task.dueDate,
        allDay: true,
        status: task.status,
        description: task.description || '',
        meta: task?.assignee?.name || '',
      };
    }).filter(Boolean))
    .concat(objectives.map(function (objective) {
      var deadline = objective?.deadline || objective?.dueDate;
      if (!deadline) return null;
      return {
        id: 'objective-' + objective._id,
        sourceId: objective._id,
        type: 'objective',
        title: objective.title,
        start: deadline,
        end: deadline,
        allDay: true,
        status: objective.status,
        description: objective.description || '',
        meta: objective?.owner?.name || '',
      };
    }).filter(Boolean))
    .concat(meetings.map(function (meeting) {
      var meetingStart = meeting?.date;
      if (!meetingStart) return null;
      var baseDate = new Date(meetingStart);
      var endDate = new Date(baseDate);
      if (meeting?.endTime) {
        var endParts = String(meeting.endTime).split(':');
        endDate.setHours(Number(endParts[0] || 0), Number(endParts[1] || 0), 0, 0);
      } else {
        endDate.setHours(endDate.getHours() + 1);
      }
      return {
        id: 'meeting-' + meeting._id,
        sourceId: meeting._id,
        type: 'meeting',
        title: meeting.title,
        start: meetingStart,
        end: endDate.toISOString(),
        allDay: false,
        status: meeting.status,
        description: meeting.description || '',
        meta: meeting.type || '',
      };
    }).filter(Boolean))
    .concat(checkIns.map(function (checkIn) {
      var date = checkIn?.submitted_at || checkIn?.updatedAt || checkIn?.createdAt;
      if (!date) return null;
      return {
        id: 'checkin-' + checkIn._id,
        sourceId: checkIn._id,
        type: 'checkin',
        title: checkIn?.objective_id?.title || 'Check-in',
        start: date,
        end: date,
        allDay: false,
        status: checkIn.status,
        description: checkIn.summary || '',
        meta: 'Check-in',
      };
    }).filter(Boolean))
    .concat((providerEvents || []).map(function (event) {
      return {
        id: 'provider-' + event.provider + '-' + event.id,
        sourceId: event.id,
        type: event.provider,
        title: event.title,
        start: event.start,
        end: event.end || event.start,
        allDay: false,
        status: event.status,
        description: event.description || '',
        meta: event.provider === 'google' ? 'Google Calendar' : event.provider === 'outlook' ? 'Outlook' : event.provider,
        url: event.url || '',
      };
    }))
    .sort(function (left, right) {
      return new Date(left.start || 0) - new Date(right.start || 0);
    });
}

export function getEventTone(type) {
  return {
    task: '#2563eb',
    objective: '#7c3aed',
    meeting: '#0f766e',
    checkin: '#d97706',
    google: '#ea4335',
    outlook: '#2563eb',
  }[type] || '#64748b';
}
