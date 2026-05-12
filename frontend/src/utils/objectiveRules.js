export function normalizeWeight(value) {
    var numeric = Number(value);
    if (!Number.isFinite(numeric)) return 0;
    return Math.max(0, Math.round(numeric));
}

export function isWeightBearingObjective(objective) {
    var status = objective && objective.status ? objective.status : 'draft';
    return ['rejected', 'cancelled', 'archived'].indexOf(status) === -1;
}

export function getTeamObjectiveGroupKey(objective) {
    if (!objective) return '';
    var teamId = objective.team?._id || objective.team || '';
    var cycleId = objective.cycle?._id || objective.cycle || '';
    var title = String(objective.title || '').trim().toLowerCase();
    if (!teamId || !cycleId || !title) return '';
    return [String(teamId), String(cycleId), title].join('::');
}

export function getUniqueTeamObjectives(objectives, options) {
    var items = Array.isArray(objectives) ? objectives : [];
    var excludeId = options && options.excludeId ? String(options.excludeId) : null;
    var excludedGroupKey = '';
    var seen = new Set();

    if (excludeId) {
        var excludedObjective = items.find(function (objective) {
            return String(objective?._id || '') === excludeId;
        });
        excludedGroupKey = getTeamObjectiveGroupKey(excludedObjective);
    }

    return items.filter(function (objective) {
        if (!objective || !isWeightBearingObjective(objective)) return false;

        var objectiveId = objective._id != null ? String(objective._id) : null;
        if (excludeId && objectiveId === excludeId && !excludedGroupKey) return false;

        var groupKey = getTeamObjectiveGroupKey(objective);
        if (!groupKey) return !excludeId || objectiveId !== excludeId;
        if (excludedGroupKey && groupKey === excludedGroupKey) return false;
        if (seen.has(groupKey)) return false;

        seen.add(groupKey);
        return true;
    });
}

export function sumObjectiveWeights(objectives, options) {
    var excludeId = options && options.excludeId ? String(options.excludeId) : null;

    return (Array.isArray(objectives) ? objectives : []).reduce(function (sum, objective) {
        if (!objective || !isWeightBearingObjective(objective)) {
            return sum;
        }

        var objectiveId = objective._id != null ? String(objective._id) : null;
        if (excludeId && objectiveId === excludeId) {
            return sum;
        }

        return sum + normalizeWeight(objective.weight);
    }, 0);
}

export function sumTeamObjectiveWeights(objectives, options) {
    return getUniqueTeamObjectives(objectives, options).reduce(function (sum, objective) {
        return sum + normalizeWeight(objective.weight);
    }, 0);
}

export function validateObjectiveForm(form, options) {
    var trimmedTitle = (form.title || '').trim();
    var trimmedDescription = (form.description || '').trim();
    var trimmedSuccessIndicator = (form.successIndicator || '').trim();
    var weight = normalizeWeight(form.weight);
    var remainingWeight = options && typeof options.remainingWeight === 'number' ? options.remainingWeight : 100;
    var requireCycle = !(options && options.allowMissingCycle);

    var errors = {};

    if (trimmedTitle.length < 5) {
        errors.title = 'Title must be at least 5 characters.';
    } else if (trimmedTitle.length > 100) {
        errors.title = 'Title cannot exceed 100 characters.';
    }

    if (trimmedDescription.length > 500) {
        errors.description = 'Description cannot exceed 500 characters.';
    }

    if (trimmedSuccessIndicator.length < 10) {
        errors.successIndicator = 'Success indicator must be at least 10 characters.';
    } else if (trimmedSuccessIndicator.length > 250) {
        errors.successIndicator = 'Success indicator cannot exceed 250 characters.';
    }

    if (weight < 1 || weight > 100) {
        errors.weight = 'Weight must be between 1 and 100.';
    } else if (weight > remainingWeight) {
        errors.weight = 'Weight exceeds the remaining capacity of ' + remainingWeight + '%.';
    }

    if (requireCycle && !form.cycle) {
        errors.cycle = 'Cycle is required.';
    }

    if (form.category === 'team' && !form.targetTeam && options && options.requireTargetTeam) {
        errors.targetTeam = 'Target team is required for team objectives.';
    }

    return {
        errors: errors,
        isValid: Object.keys(errors).length === 0,
        sanitized: {
            title: trimmedTitle,
            description: trimmedDescription,
            successIndicator: trimmedSuccessIndicator,
            weight: weight
        }
    };
}
