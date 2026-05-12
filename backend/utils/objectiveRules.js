function normalizeWeight(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.round(numeric));
}

function isWeightBearingObjective(objective) {
  const status = objective?.status || 'draft';
  return !['rejected', 'cancelled', 'archived'].includes(status);
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
  const excludeId = options && options.excludeId ? String(options.excludeId) : null;

  return items.reduce(function (sum, objective) {
    if (!objective || !isWeightBearingObjective(objective)) {
      return sum;
    }

    const objectiveId = objective._id != null ? String(objective._id) : null;
    if (excludeId && objectiveId === excludeId) {
      return sum;
    }

    return sum + normalizeWeight(objective.weight);
  }, 0);
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

module.exports = {
  normalizeWeight,
  isWeightBearingObjective,
  sumObjectiveWeights,
  getObjectiveTeamId,
  getTeamObjectiveGroupKey,
  getUniqueTeamObjectives,
  sumTeamObjectiveWeights,
};
