export function normalizeWeight(value) {
    var numeric = Number(value);
    if (!Number.isFinite(numeric)) return 0;
    return Math.max(0, Math.round(numeric));
}

export function isWeightBearingObjective(objective) {
    var status = objective && objective.status ? objective.status : 'draft';
    return ['rejected', 'cancelled', 'archived'].indexOf(status) === -1;
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
