function clampPercent(value) {
  var numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(100, Math.round(numeric)));
}

export function getUserId(user) {
  return String(user?.id || user?._id || '');
}

export function dedupeById(items) {
  var seen = new Set();
  return (items || []).filter(function (item) {
    var key = String(item?._id || item?.id || '');
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function normalizeArrayPayload(payload, keys) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [];

  var candidates = Array.isArray(keys) ? keys : [];
  for (var index = 0; index < candidates.length; index += 1) {
    var key = candidates[index];
    if (Array.isArray(payload[key])) return payload[key];
  }

  return [];
}

export function normalizeObjectivesPayload(payload) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [];

  if (Array.isArray(payload.objectives)) return payload.objectives;

  if (Array.isArray(payload.individualObjectives) || Array.isArray(payload.teamObjectives)) {
    return []
      .concat(payload.individualObjectives || [])
      .concat(payload.teamObjectives || []);
  }

  return [];
}

export function normalizeCyclesPayload(payload) {
  return normalizeArrayPayload(payload, ['cycles', 'items']);
}

export function normalizeTeamsPayload(payload) {
  return normalizeArrayPayload(payload, ['teams', 'items']);
}

export function normalizeTasksPayload(payload) {
  return normalizeArrayPayload(payload, ['tasks', 'items']);
}

export function normalizeMeetingsPayload(payload) {
  return normalizeArrayPayload(payload, ['meetings', 'items']);
}

export function normalizeFeedbackPayload(payload) {
  return normalizeArrayPayload(payload, ['feedbacks', 'feedback', 'items']);
}

export function normalizeCheckInsPayload(payload) {
  return normalizeArrayPayload(payload, ['checkIns', 'checkins', 'items']);
}

export function findActiveCycle(cycles) {
  return (cycles || []).find(function (cycle) {
    return ['open', 'active', 'in_progress'].includes(cycle?.status);
  }) || (cycles || [])[0] || null;
}

export function filterObjectivesForCycle(objectives, activeCycle) {
  var cycleId = activeCycle?._id || activeCycle?.id;
  if (!cycleId) return objectives || [];

  return (objectives || []).filter(function (objective) {
    var objectiveCycleId = objective?.cycle?._id || objective?.cycle?.id || objective?.cycle;
    return !objectiveCycleId || String(objectiveCycleId) === String(cycleId);
  });
}

export function resolveScopeTeams(teams, user, activeTab) {
  if (activeTab === 'org') return teams || [];
  if (activeTab !== 'team') return [];

  var userId = getUserId(user);
  return (teams || []).filter(function (team) {
    var leaderId = team?.leader?._id || team?.leader;
    var isLeader = String(leaderId || '') === userId;
    var isMember = (team?.members || []).some(function (member) {
      return String(member?._id || member || '') === userId;
    });
    return isLeader || isMember;
  });
}

export function objectiveStatusLabel(status, progress) {
  if (clampPercent(progress) >= 100) return 'Completed';
  if (['approved', 'validated', 'acknowledged', 'assigned'].includes(status)) return 'Active';
  if (['pending', 'submitted', 'pending_approval', 'revision_requested'].includes(status)) return 'In Review';
  if (['evaluated', 'locked', 'archived'].includes(status)) return 'Closed';
  return 'Draft';
}

export function statusTone(status, progress) {
  var label = objectiveStatusLabel(status, progress);

  if (label === 'Completed') return { label: label, color: '#0f766e', background: 'rgba(20, 184, 166, 0.12)' };
  if (label === 'Active') return { label: label, color: '#4338ca', background: 'rgba(79, 70, 229, 0.12)' };
  if (label === 'In Review') return { label: label, color: '#b45309', background: 'rgba(245, 158, 11, 0.14)' };
  if (label === 'Closed') return { label: label, color: '#475569', background: 'rgba(148, 163, 184, 0.16)' };
  return { label: label, color: '#64748b', background: 'rgba(148, 163, 184, 0.14)' };
}

export function getObjectiveProgress(objective) {
  return clampPercent(objective?.achievementPercent);
}

export function getObjectiveSummary(objectives) {
  var summary = {
    total: 0,
    completed: 0,
    active: 0,
    review: 0,
    draft: 0,
    averageProgress: 0,
    completionRate: 0,
  };

  var totalProgress = 0;

  (objectives || []).forEach(function (objective) {
    var progress = getObjectiveProgress(objective);
    var label = objectiveStatusLabel(objective?.status, progress);

    summary.total += 1;
    totalProgress += progress;

    if (label === 'Completed') summary.completed += 1;
    else if (label === 'Active') summary.active += 1;
    else if (label === 'In Review') summary.review += 1;
    else summary.draft += 1;
  });

  if (summary.total > 0) {
    summary.averageProgress = Math.round(totalProgress / summary.total);
    summary.completionRate = Math.round((summary.completed / summary.total) * 100);
  }

  return summary;
}

export function getTaskSummary(tasks) {
  var now = new Date();
  var summary = {
    total: 0,
    todo: 0,
    inProgress: 0,
    done: 0,
    cancelled: 0,
    overdue: 0,
    completionRate: 0,
  };

  (tasks || []).forEach(function (task) {
    summary.total += 1;

    if (task?.status === 'done') summary.done += 1;
    else if (task?.status === 'in_progress') summary.inProgress += 1;
    else if (task?.status === 'cancelled') summary.cancelled += 1;
    else summary.todo += 1;

    if (
      task?.dueDate &&
      !['done', 'cancelled'].includes(task?.status) &&
      new Date(task.dueDate) < now
    ) {
      summary.overdue += 1;
    }
  });

  summary.completionRate = summary.total > 0 ? Math.round((summary.done / summary.total) * 100) : 0;
  return summary;
}

export function getCheckInSummary(checkIns) {
  var summary = {
    total: 0,
    pending: 0,
    approved: 0,
    revisions: 0,
    averageProgress: 0,
  };

  var totalProgress = 0;

  (checkIns || []).forEach(function (checkIn) {
    summary.total += 1;
    totalProgress += clampPercent(checkIn?.progress_percent);

    if (checkIn?.status === 'approved') summary.approved += 1;
    else if (checkIn?.status === 'revision_requested') summary.revisions += 1;
    else summary.pending += 1;
  });

  summary.averageProgress = summary.total > 0 ? Math.round(totalProgress / summary.total) : 0;
  return summary;
}

export function collectKpis(objectives) {
  return dedupeById(
    (objectives || []).flatMap(function (objective) {
      return (objective?.kpis || []).map(function (kpi, index) {
        var currentValue = Number(kpi?.currentValue);
        var targetValue = Number(kpi?.targetValue);
        var safeTarget = Number.isFinite(targetValue) && targetValue !== 0 ? targetValue : 100;
        var safeCurrent = Number.isFinite(currentValue) ? currentValue : 0;

        return {
          _id: kpi?._id || objective?._id + '-kpi-' + index,
          objectiveId: objective?._id,
          objectiveTitle: objective?.title || 'Objective',
          title: kpi?.title || kpi?.name || 'Untitled KPI',
          metricType: kpi?.metricType || kpi?.type || 'percent',
          currentValue: safeCurrent,
          targetValue: safeTarget,
          unit: kpi?.unit || '',
          progress: clampPercent((safeCurrent / safeTarget) * 100),
        };
      });
    })
  );
}

function formatBucketLabel(date) {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function buildWeeklyActivity(objectives, tasks, checkIns) {
  var weeks = [];
  var today = new Date();
  today.setHours(0, 0, 0, 0);

  for (var index = 5; index >= 0; index -= 1) {
    var bucketDate = new Date(today);
    bucketDate.setDate(today.getDate() - index * 7);
    weeks.push({
      key: bucketDate.toISOString().slice(0, 10),
      label: formatBucketLabel(bucketDate),
      progress: 0,
      objectiveUpdates: 0,
      completedTasks: 0,
      checkIns: 0,
    });
  }

  var bucketMap = {};
  weeks.forEach(function (week) {
    bucketMap[week.key] = week;
  });

  function resolveBucketKey(value) {
    if (!value) return null;
    var date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;

    var dayIndex = Math.floor((today - date) / (1000 * 60 * 60 * 24));
    if (dayIndex < 0 || dayIndex > 41) return null;

    var weekOffset = Math.floor(dayIndex / 7);
    var bucket = weeks[weeks.length - 1 - weekOffset];
    return bucket?.key || null;
  }

  (objectives || []).forEach(function (objective) {
    var bucketKey = resolveBucketKey(objective?.updatedAt || objective?.createdAt);
    if (!bucketKey || !bucketMap[bucketKey]) return;
    bucketMap[bucketKey].progress += getObjectiveProgress(objective);
    bucketMap[bucketKey].objectiveUpdates += 1;
  });

  (tasks || []).forEach(function (task) {
    if (task?.status !== 'done') return;
    var bucketKey = resolveBucketKey(task?.completedAt || task?.updatedAt || task?.createdAt);
    if (!bucketKey || !bucketMap[bucketKey]) return;
    bucketMap[bucketKey].completedTasks += 1;
  });

  (checkIns || []).forEach(function (checkIn) {
    var bucketKey = resolveBucketKey(checkIn?.submitted_at || checkIn?.updatedAt || checkIn?.createdAt);
    if (!bucketKey || !bucketMap[bucketKey]) return;
    bucketMap[bucketKey].checkIns += 1;
  });

  return weeks.map(function (week) {
    return {
      label: week.label,
      progress: week.objectiveUpdates > 0 ? Math.round(week.progress / week.objectiveUpdates) : 0,
      completedTasks: week.completedTasks,
      checkIns: week.checkIns,
      activity: week.objectiveUpdates + week.completedTasks + week.checkIns,
    };
  });
}

export function buildObjectiveStatusChart(objectives) {
  var counts = {
    Draft: 0,
    'In Review': 0,
    Active: 0,
    Completed: 0,
  };

  (objectives || []).forEach(function (objective) {
    counts[objectiveStatusLabel(objective?.status, objective?.achievementPercent)] += 1;
  });

  return [
    { name: 'Draft', value: counts.Draft, color: '#94a3b8' },
    { name: 'In Review', value: counts['In Review'], color: '#f59e0b' },
    { name: 'Active', value: counts.Active, color: '#6366f1' },
    { name: 'Completed', value: counts.Completed, color: '#14b8a6' },
  ];
}

export function buildTaskStatusChart(tasks) {
  var summary = getTaskSummary(tasks);
  return [
    { name: 'Todo', value: summary.todo, color: '#94a3b8' },
    { name: 'In Progress', value: summary.inProgress, color: '#3b82f6' },
    { name: 'Done', value: summary.done, color: '#10b981' },
    { name: 'Cancelled', value: summary.cancelled, color: '#f97316' },
  ];
}

export function buildComparisonChart(activeTab, objectives, teams, user) {
  if (activeTab === 'me') {
    return (objectives || []).slice(0, 6).map(function (objective) {
      var title = objective?.title || 'Untitled';
      return {
        label: title.length > 18 ? title.slice(0, 18) + '...' : title,
        value: getObjectiveProgress(objective),
      };
    });
  }

  return (teams || []).slice(0, 6).map(function (team) {
    var teamIds = []
      .concat(team?.leader?._id || team?.leader || [])
      .concat((team?.members || []).map(function (member) { return member?._id || member; }))
      .filter(Boolean)
      .map(String);

    var teamObjectives = (objectives || []).filter(function (objective) {
      var ownerId = objective?.owner?._id || objective?.owner;
      return teamIds.includes(String(ownerId || ''));
    });

    var average = teamObjectives.length > 0
      ? Math.round(teamObjectives.reduce(function (sum, objective) {
          return sum + getObjectiveProgress(objective);
        }, 0) / teamObjectives.length)
      : 0;

    return {
      label: team?.name || 'Team',
      value: average,
    };
  });
}

export function buildLeaderboard(objectives, activeTab, user) {
  var byOwner = {};

  (objectives || []).forEach(function (objective) {
    var ownerId = String(objective?.owner?._id || objective?.owner || 'self');
    if (!byOwner[ownerId]) {
      byOwner[ownerId] = {
        label: objective?.owner?.name || (activeTab === 'me' ? (user?.name || 'You') : 'Unknown'),
        total: 0,
        count: 0,
      };
    }
    byOwner[ownerId].total += getObjectiveProgress(objective);
    byOwner[ownerId].count += 1;
  });

  return Object.values(byOwner)
    .map(function (entry) {
      return {
        label: entry.label,
        value: entry.count > 0 ? Math.round(entry.total / entry.count) : 0,
      };
    })
    .sort(function (left, right) { return right.value - left.value; })
    .slice(0, 5);
}

export function buildRecentTimeline(items) {
  return dedupeById(items)
    .sort(function (left, right) {
      return new Date(right?.date || 0) - new Date(left?.date || 0);
    })
    .slice(0, 8);
}

export function getScopeLabel(activeTab) {
  if (activeTab === 'team') return 'Team';
  if (activeTab === 'org') return 'Organization';
  return 'Personal';
}
