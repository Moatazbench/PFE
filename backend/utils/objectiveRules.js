function normalizeWeight(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.round(numeric));
}

function isWeightBearingObjective(objective) {
  const status = objective?.status || 'draft';
  return !['cancelled', 'archived', 'deleted'].includes(status);
}

function isAllocationWeightBearingObjective(objective) {
  const status = String(objective?.status || 'draft').toLowerCase();
  return !['cancelled', 'archived', 'deleted'].includes(status);
}

function getObjectiveTeamId(objective) {
  if (!objective) return '';
  const rawTeamId = objective.team?._id || objective.team || '';
  return rawTeamId ? String(rawTeamId) : '';
}

function getTeamObjectiveGroupKey(objective) {
  if (!objective) return '';

  const teamId = getObjectiveTeamId(objective);
  const cycleId = objective.cycle?._id || objective.cycle || '';
  const title = String(objective.title || '').trim().toLowerCase();

  if (!teamId || !cycleId || !title) {
    return '';
  }

  return [teamId, String(cycleId), title].join('::');
}

function sumObjectiveWeights(objectives, options) {
  const items = Array.isArray(objectives) ? objectives : [];
  const excludeId = options && (options.excludeId || options.excludeObjectiveId) ? String(options.excludeId || options.excludeObjectiveId) : null;

  let totalWeight = items.reduce(function (sum, objective) {
    if (!objective || !isWeightBearingObjective(objective)) {
      return sum;
    }
    return sum + normalizeWeight(objective.weight);
  }, 0);

  if (excludeId) {
    const excludedObjective = items.find(o => String(o._id || '') === excludeId);
    if (excludedObjective) {
      totalWeight -= normalizeWeight(excludedObjective.weight);
    }
  }

  return totalWeight;
}

function getUniqueTeamObjectives(objectives, options) {
  const items = Array.isArray(objectives) ? objectives : [];
  const excludeId = options && options.excludeId ? String(options.excludeId) : null;
  const seen = new Set();
  let excludedGroupKey = null;

  if (excludeId) {
    const excludedObjective = items.find((objective) => String(objective?._id || '') === excludeId);
    excludedGroupKey = getTeamObjectiveGroupKey(excludedObjective);
  }

  return items.filter((objective) => {
    if (!objective || !isWeightBearingObjective(objective)) {
      return false;
    }

    const objectiveId = objective._id != null ? String(objective._id) : null;
    if (excludeId && objectiveId === excludeId && !excludedGroupKey) {
      return false;
    }

    const groupKey = getTeamObjectiveGroupKey(objective);
    if (!groupKey) {
      return !excludeId || objectiveId !== excludeId;
    }

    if (excludedGroupKey && groupKey === excludedGroupKey) {
      return false;
    }

    if (seen.has(groupKey)) {
      return false;
    }

    seen.add(groupKey);
    return true;
  });
}

function sumTeamObjectiveWeights(objectives, options) {
  return getUniqueTeamObjectives(objectives, options).reduce(function (sum, objective) {
    return sum + normalizeWeight(objective.weight);
  }, 0);
}

function getTeamMemberWeightUsage(objectives, memberIds, options) {
  const usage = {};
  (memberIds || []).map(String).filter(Boolean).forEach(function (memberId) {
    usage[memberId] = 0;
  });

  getUniqueTeamObjectives(objectives, options).forEach(function (objective) {
    const assignedIds = Array.isArray(objective.assignedUsers) && objective.assignedUsers.length > 0
      ? objective.assignedUsers.map(String)
      : [objective.owner?._id || objective.owner].filter(Boolean).map(String);

    assignedIds.forEach(function (memberId) {
      if (Object.prototype.hasOwnProperty.call(usage, memberId)) {
        usage[memberId] += normalizeWeight(objective.weight);
      }
    });
  });

  return usage;
}

function calculateMemberWeightBreakdowns(objectives, memberIds, options = {}) {
  const members = (memberIds || []).map(String).filter(Boolean);
  const selectedTeamId = options.teamId ? String(options.teamId) : '';
  const cycleId = options.cycleId ? String(options.cycleId) : '';
  const breakdowns = {};

  members.forEach(function (memberId) {
    breakdowns[memberId] = {
      memberId,
      individualWeight: 0,
      teamWeight: 0,
      subteamWeight: 0,
      usedWeight: 0,
      remainingWeight: 100,
      individualRemainingWeight: 100,
      teamRemainingWeight: 100,
      subteamRemainingWeight: 100,
      isOverAllocated: false,
      isNearLimit: false,
    };
  });

  const scopedObjectives = (Array.isArray(objectives) ? objectives : []).filter(function (objective) {
    if (!objective || !isAllocationWeightBearingObjective(objective)) return false;
    if (!cycleId) return true;
    const objectiveCycleId = objective.cycle?._id || objective.cycle || '';
    return String(objectiveCycleId) === cycleId;
  });

  scopedObjectives.forEach(function (objective) {
    if (objective.category === 'team') return;
    const ownerId = String(objective.owner?._id || objective.owner || '');
    if (Object.prototype.hasOwnProperty.call(breakdowns, ownerId)) {
      breakdowns[ownerId].individualWeight += normalizeWeight(objective.weight);
    }
  });

  getUniqueTeamObjectives(scopedObjectives.filter(function (objective) {
    return objective.category === 'team';
  }), options).forEach(function (objective) {
    const assignedIds = Array.isArray(objective.assignedUsers) && objective.assignedUsers.length > 0
      ? objective.assignedUsers.map(String)
      : [objective.owner?._id || objective.owner].filter(Boolean).map(String);
    const objectiveTeamId = getObjectiveTeamId(objective);
    const bucket = selectedTeamId && objectiveTeamId && objectiveTeamId !== selectedTeamId ? 'subteamWeight' : 'teamWeight';

    assignedIds.forEach(function (memberId) {
      if (Object.prototype.hasOwnProperty.call(breakdowns, memberId)) {
        breakdowns[memberId][bucket] += normalizeWeight(objective.weight);
      }
    });
  });

  Object.keys(breakdowns).forEach(function (memberId) {
    const breakdown = breakdowns[memberId];
    breakdown.individualRemainingWeight = Math.max(0, 100 - breakdown.individualWeight);
    breakdown.teamRemainingWeight = Math.max(0, 100 - breakdown.teamWeight);
    breakdown.subteamRemainingWeight = Math.max(0, 100 - breakdown.subteamWeight);
    breakdown.usedWeight = Math.max(breakdown.individualWeight, breakdown.teamWeight, breakdown.subteamWeight);
    breakdown.remainingWeight = Math.max(0, 100 - breakdown.usedWeight);
    breakdown.isOverAllocated = breakdown.individualWeight > 100 || breakdown.teamWeight > 100 || breakdown.subteamWeight > 100;
    breakdown.isNearLimit = !breakdown.isOverAllocated && breakdown.usedWeight >= 80 && breakdown.usedWeight <= 100;
  });

  return breakdowns;
}

module.exports = {
  normalizeWeight,
  isWeightBearingObjective,
  isAllocationWeightBearingObjective,
  sumObjectiveWeights,
  getObjectiveTeamId,
  getTeamObjectiveGroupKey,
  getUniqueTeamObjectives,
  sumTeamObjectiveWeights,
  getTeamMemberWeightUsage,
  calculateMemberWeightBreakdowns,
};
