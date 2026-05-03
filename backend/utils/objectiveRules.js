function normalizeWeight(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.round(numeric));
}

function isWeightBearingObjective(objective) {
  const status = objective?.status || 'draft';
  return !['rejected', 'cancelled', 'archived'].includes(status);
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

module.exports = {
  normalizeWeight,
  isWeightBearingObjective,
  sumObjectiveWeights,
};
