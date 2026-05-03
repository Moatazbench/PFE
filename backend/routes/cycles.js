const express = require('express');
const router = express.Router();
const Cycle = require('../models/Cycle');
const Objective = require('../models/Objective');
const Evaluation = require('../models/Evaluation');
const HRDecision = require('../models/HRDecision');
const auth = require('../middleware/auth');
const role = require('../middleware/role');
const rateLimiter = require('../middleware/rateLimiter');
const validate = require('../middleware/validate');
const schemas = require('../validators/schemas');
const { notifyAllActiveUsers } = require('../utils/notificationHelper');
const { createAuditLog } = require('../utils/auditHelper');

/**
 * Validate that phase dates are sequential when provided.
 * Returns an error message string or null if valid.
 */
function validatePhaseDatesFromBody(body, existing) {
  var fields = ['phase1Start', 'phase1End', 'phase2Start', 'phase2End', 'phase3Start', 'phase3End'];
  var dates = {};

  // Merge existing cycle dates with incoming body (body takes priority)
  fields.forEach(function (f) {
    if (body[f] !== undefined && body[f] !== null && body[f] !== '') {
      dates[f] = new Date(body[f]);
    } else if (existing && existing[f]) {
      dates[f] = new Date(existing[f]);
    }
  });

  // Check sequential ordering for all provided dates
  var ordered = fields.filter(function (f) { return dates[f] != null; });
  for (var i = 1; i < ordered.length; i++) {
    if (dates[ordered[i]] < dates[ordered[i - 1]]) {
      return 'Phase dates must be sequential: ' + ordered[i] + ' cannot be before ' + ordered[i - 1];
    }
  }
  return null;
}

// ========== GET ALL CYCLES ==========
router.get('/', rateLimiter, auth, async function (req, res) {
  try {
    var cycles = await Cycle.find()
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 });
    res.json(cycles);
  } catch (err) {
    console.error('Get cycles error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ========== GET SINGLE CYCLE ==========
router.get('/:id', rateLimiter, auth, async function (req, res) {
  try {
    var cycle = await Cycle.findById(req.params.id)
      .populate('createdBy', 'name email');
    if (!cycle) {
      return res.status(404).json({ message: 'Cycle not found' });
    }
    res.json(cycle);
  } catch (err) {
    console.error('Get cycle error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ========== CREATE CYCLE (ADMIN / HR) ==========
router.post('/', rateLimiter, auth, role('ADMIN', 'HR'), validate(schemas.cycle.create), async function (req, res) {
  try {
    var { name, year, status,
          phase1Start, phase1End, phase2Start, phase2End, phase3Start, phase3End, currentPhase } = req.body;

    if (req.user.role !== 'ADMIN') {
      var phaseError = validatePhaseDatesFromBody(req.body, null);
      if (phaseError) {
        return res.status(400).json({ message: phaseError });
      }
    }

    var cycle = new Cycle({
      name: name,
      year: year,
      status: status || 'draft',
      phase1Start: phase1Start || null,
      phase1End: phase1End || null,
      phase2Start: phase2Start || null,
      phase2End: phase2End || null,
      phase3Start: phase3Start || null,
      phase3End: phase3End || null,
      currentPhase: currentPhase || 'phase1',
      createdBy: req.user.id
    });
    
    if (req.user.role === 'ADMIN') cycle.$ignoreSequentialValidation = true;
    
    await cycle.save();
    var populated = await Cycle.findById(cycle._id)
      .populate('createdBy', 'name email');
    res.status(201).json(populated);
  } catch (err) {
    console.error('Create cycle error:', err);
    if (err.code === 11000) {
      return res.status(409).json({ message: 'A cycle for year ' + req.body.year + ' already exists.' });
    }
    res.status(500).json({ message: err.message || 'Server error' });
  }
});

// ========== UPDATE CYCLE — PUT (ADMIN / HR, backward compatible) ==========
router.put('/:id', rateLimiter, auth, role('ADMIN', 'HR'), validate(schemas.cycle.update), async function (req, res) {
  try {
    var { name, year, status,
          phase1Start, phase1End, phase2Start, phase2End, phase3Start, phase3End, currentPhase } = req.body;
    var cycle = await Cycle.findById(req.params.id);
    if (!cycle) {
      return res.status(404).json({ message: 'Cycle not found' });
    }
    if (cycle.status === 'closed') {
      return res.status(400).json({ message: 'Cannot edit a closed cycle' });
    }

    if (req.user.role !== 'ADMIN') {
      var phaseError = validatePhaseDatesFromBody(req.body, cycle);
      if (phaseError) {
        return res.status(400).json({ message: phaseError });
      }
    }

    if (name) cycle.name = name;
    if (year) cycle.year = year;

    // Phase fields
    if (phase1Start !== undefined) cycle.phase1Start = phase1Start || null;
    if (phase1End !== undefined) cycle.phase1End = phase1End || null;
    if (phase2Start !== undefined) cycle.phase2Start = phase2Start || null;
    if (phase2End !== undefined) cycle.phase2End = phase2End || null;
    if (phase3Start !== undefined) cycle.phase3Start = phase3Start || null;
    if (phase3End !== undefined) cycle.phase3End = phase3End || null;
    if (currentPhase !== undefined) cycle.currentPhase = currentPhase;

    // Check if transitioning to closed — generate HR decisions
    if (status === 'closed' && cycle.status !== 'closed') {
      const evaluations = await Evaluation.find({
        cycleId: cycle._id,
        status: { $in: ['submitted', 'approved', 'completed'] },
      });

      const objectiveMap = {};
      const cycleObjectives = await Objective.find({
        cycle: cycle._id,
        status: { $nin: ['rejected', 'cancelled', 'archived'] },
      });
      cycleObjectives.forEach(function (objective) {
        const ownerId = String(objective.owner);
        if (!objectiveMap[ownerId]) {
          objectiveMap[ownerId] = { individual: 0, team: 0 };
        }
        const weightedScore = Number(objective.weightedScore || 0);
        if (objective.category === 'team') {
          objectiveMap[ownerId].team += weightedScore;
        } else {
          objectiveMap[ownerId].individual += weightedScore;
        }
      });

      const decisions = [];
      for (const evaluation of evaluations) {
        const userId = String(evaluation.employeeId);
        const scores = objectiveMap[userId] || { individual: 0, team: 0 };
        const finalScore = Number((evaluation.finalScore ?? evaluation.suggestedScore ?? 0).toFixed(2));

        let action = 'satisfactory';
        if (finalScore >= 90) action = 'reward';
        else if (finalScore < 60) action = 'termination_review';

        decisions.push({
          user: userId,
          cycle: cycle._id,
          individualScore: Number(Math.min(scores.individual, 100).toFixed(2)),
          teamScore: Number(Math.min(scores.team, 100).toFixed(2)),
          finalScore,
          action
        });
      }

      if (decisions.length > 0) {
        await HRDecision.deleteMany({ cycle: cycle._id });
        await HRDecision.insertMany(decisions);
      }

      // Also set currentPhase to closed when cycle is closed
      cycle.currentPhase = 'closed';
    }

    if (status) cycle.status = status;

    if (req.user.role === 'ADMIN') cycle.$ignoreSequentialValidation = true;

    await cycle.save();
    var populated = await Cycle.findById(cycle._id)
      .populate('createdBy', 'name email');
    res.json(populated);
  } catch (err) {
    console.error('Update cycle error:', err);
    if (err.code === 11000) {
      return res.status(409).json({ message: 'A cycle for that year already exists.' });
    }
    res.status(500).json({ message: err.message || 'Server error' });
  }
});

// ========== PATCH CYCLE CONFIG (ADMIN / HR) — partial update for dates & name ==========
router.patch('/:id', rateLimiter, auth, role('ADMIN', 'HR'), validate(schemas.cycle.update), async function (req, res) {
  try {
    var cycle = await Cycle.findById(req.params.id);
    if (!cycle) {
      return res.status(404).json({ message: 'Cycle not found' });
    }
    if (cycle.status === 'closed') {
      return res.status(400).json({ message: 'Cannot edit a closed cycle' });
    }

    var { name, year, status,
          phase1Start, phase1End, phase2Start, phase2End, phase3Start, phase3End, currentPhase } = req.body;

    if (req.user.role !== 'ADMIN') {
      var phaseError = validatePhaseDatesFromBody(req.body, cycle);
      if (phaseError) {
        return res.status(400).json({ message: phaseError });
      }
    }

    // Apply updates (only fields that are provided)
    if (name !== undefined) cycle.name = name;
    if (year !== undefined) cycle.year = year;
    if (status !== undefined) cycle.status = status;
    if (phase1Start !== undefined) cycle.phase1Start = phase1Start || null;
    if (phase1End !== undefined) cycle.phase1End = phase1End || null;
    if (phase2Start !== undefined) cycle.phase2Start = phase2Start || null;
    if (phase2End !== undefined) cycle.phase2End = phase2End || null;
    if (phase3Start !== undefined) cycle.phase3Start = phase3Start || null;
    if (phase3End !== undefined) cycle.phase3End = phase3End || null;
    if (currentPhase !== undefined) cycle.currentPhase = currentPhase;

    if (req.user.role === 'ADMIN') cycle.$ignoreSequentialValidation = true;

    await cycle.save();
    var populated = await Cycle.findById(cycle._id)
      .populate('createdBy', 'name email');
    res.json(populated);
  } catch (err) {
    console.error('Patch cycle error:', err);
    if (err.code === 11000) {
      return res.status(409).json({ message: 'A cycle for that year already exists.' });
    }
    res.status(500).json({ message: err.message || 'Server error' });
  }
});

// ========== PATCH CYCLE PHASE (ADMIN / HR) — advance or set current phase ==========
router.patch('/:id/phase', rateLimiter, auth, role('ADMIN', 'HR'), validate(schemas.cycle.updatePhase), async function (req, res) {
  try {
    var cycle = await Cycle.findById(req.params.id);
    if (!cycle) {
      return res.status(404).json({ message: 'Cycle not found' });
    }
    if (cycle.status === 'closed') {
      return res.status(400).json({ message: 'Cannot change phase of a closed cycle' });
    }

    var { currentPhase } = req.body;
    var oldPhase = cycle.currentPhase;

    // ===== PHASE TRANSITION VALIDATION =====
    var phaseOrder = ['phase1', 'phase2', 'phase3', 'closed'];
    var newIndex = phaseOrder.indexOf(currentPhase);

    if (newIndex === -1) {
      return res.status(400).json({ message: 'Invalid phase: ' + currentPhase });
    }

    // ADMIN can freely move between any phases — no guards
    if (currentPhase === 'phase2') {
      var objBlockingStatuses = ['draft', 'pending', 'submitted', 'pending_approval', 'revision_requested', 'assigned', 'acknowledged', 'rejected'];
      var unapprovedObjectives = await Objective.find({
        cycle: cycle._id,
        status: { $in: objBlockingStatuses }
      }).select('_id title status owner').populate('owner', 'name');

      var totalObjectives = await Objective.countDocuments({ cycle: cycle._id });

      if (totalObjectives === 0) {
        return res.status(400).json({
          message: 'Cannot advance to Mid-Year Execution: No objectives exist in this cycle.'
        });
      }

      if (unapprovedObjectives.length > 0) {
        return res.status(400).json({
          message: unapprovedObjectives.length + ' objectives are not yet approved. Resolve before advancing.',
          unapprovedObjectives: unapprovedObjectives.map(function(o) { return { _id: o._id, title: o.title, status: o.status, owner: o.owner?.name || 'Unknown' }; })
        });
      }
    }

    if (req.user.role === 'ADMIN') {
      // Admin override: allow any valid phase transition after Phase 2 readiness passes
      if (cycle.status === 'draft' && currentPhase !== 'phase1') {
        // Even admin must start a draft cycle at phase1
        // (but can then jump freely once active)
      }
    } else {
      // Non-admin: enforce forward-only sequential transitions
      if (cycle.status === 'draft') {
        if (currentPhase !== 'phase1') {
          return res.status(400).json({ message: 'Draft cycles must start at Phase 1.' });
        }
      } else {
        var oldIndex = phaseOrder.indexOf(oldPhase);
        if (newIndex <= oldIndex) {
          return res.status(400).json({ message: 'Cannot go backwards. Current phase: ' + oldPhase + '. Requested: ' + currentPhase });
        }
        if (newIndex !== oldIndex + 1) {
          return res.status(400).json({ message: 'Cannot skip phases. Must advance from ' + oldPhase + ' to ' + phaseOrder[oldIndex + 1] });
        }
      }

      // ===== WORKFLOW READINESS GUARDS (non-admin only) =====

      // All objectives must have progress tracked before advancing to Phase 3
      if (currentPhase === 'phase3') {
        var objNoProgress = await Objective.countDocuments({
          cycle: cycle._id,
          status: { $in: ['approved', 'validated'] },
          $or: [{ achievementPercent: null }, { achievementPercent: 0, 'kpis.0': { $exists: false } }]
        });
        if (objNoProgress > 0) {
          return res.status(400).json({
            message: 'Cannot advance to Phase 3: ' + objNoProgress + ' objective(s) have no progress recorded.'
          });
        }
      }
    }

    cycle.currentPhase = currentPhase;

    // Auto-update status based on phase
    if (currentPhase === 'closed') {
      cycle.status = 'closed';
    } else if (cycle.status === 'draft') {
      cycle.status = 'in_progress';
    }

    await cycle.save();
    var populated = await Cycle.findById(cycle._id)
      .populate('createdBy', 'name email');

    // Broadcast phase change notification to all users
    var notifType = currentPhase === 'closed' ? 'PHASE_CLOSED' : 'PHASE_OPENED';
    var phaseLabel = currentPhase === 'closed' ? 'Cycle Closed' : currentPhase.replace('phase', 'Phase ');
    notifyAllActiveUsers({ senderId: req.user.id, type: notifType, title: phaseLabel + ' — ' + cycle.name, message: 'Cycle "' + cycle.name + '" has moved to ' + phaseLabel + '.', link: '/cycles' });
    createAuditLog({ entityType: 'cycle', entityId: cycle._id, action: 'phase_changed', performedBy: req.user.id, oldValue: { currentPhase: oldPhase }, newValue: { currentPhase: currentPhase }, description: 'Cycle "' + cycle.name + '" phase changed from ' + oldPhase + ' to ' + currentPhase, ipAddress: req.ip });

    res.json({
      message: 'Phase updated from ' + oldPhase + ' to ' + currentPhase,
      cycle: populated
    });
  } catch (err) {
    console.error('Update phase error:', err);
    res.status(500).json({ message: err.message || 'Server error' });
  }
});

// ========== PHASE PRE-CHECK (before advancing) ==========
router.get('/:id/phase-check', rateLimiter, auth, role('ADMIN', 'HR'), async function (req, res) {
  try {
    var cycle = await Cycle.findById(req.params.id);
    if (!cycle) return res.status(404).json({ message: 'Cycle not found' });

    var nextPhase = 'phase1';
    if (cycle.status === 'draft') nextPhase = 'phase1';
    else if (cycle.currentPhase === 'phase1') nextPhase = 'phase2';
    else if (cycle.currentPhase === 'phase2') nextPhase = 'phase3';
    else if (cycle.currentPhase === 'phase3') nextPhase = 'closed';

    var issues = [];
    var unapprovedObjectives = [];

    if (nextPhase === 'phase2') {
      var objBlockingStatuses = ['draft', 'pending', 'submitted', 'pending_approval', 'revision_requested', 'assigned', 'acknowledged', 'rejected'];
      var blockedObjs = await Objective.find({
        cycle: cycle._id,
        status: { $in: objBlockingStatuses }
      }).select('_id title status owner').populate('owner', 'name');

      var totalObjectives = await Objective.countDocuments({ cycle: cycle._id });

      if (totalObjectives === 0) {
        issues.push('No objectives exist in this cycle.');
      }
      if (blockedObjs.length > 0) {
        issues.push(blockedObjs.length + ' objectives are not yet approved. Resolve before advancing.');
        unapprovedObjectives = blockedObjs.map(function(o) {
          return { _id: o._id, title: o.title, status: o.status, owner: o.owner?.name || 'Unknown' };
        });
      }
    }

    if (nextPhase === 'phase3') {
      var objNoProgress = await Objective.countDocuments({
        cycle: cycle._id,
        status: { $in: ['approved', 'validated'] },
        $or: [{ achievementPercent: null }, { achievementPercent: 0, 'kpis.0': { $exists: false } }]
      });
      if (objNoProgress > 0) {
        issues.push(objNoProgress + ' objective(s) have no progress recorded.');
      }
    }

    res.json({
      ready: issues.length === 0,
      nextPhase: nextPhase,
      currentPhase: cycle.currentPhase,
      issues: issues,
      unapprovedObjectives: unapprovedObjectives
    });
  } catch (err) {
    console.error('Phase check error:', err);
    res.status(500).json({ message: err.message || 'Server error' });
  }
});

// ========== ROLLBACK PHASE (phase2 → phase1, ADMIN only) ==========
router.post('/:id/rollback', rateLimiter, auth, role('ADMIN'), async function (req, res) {
  try {
    var cycle = await Cycle.findById(req.params.id);
    if (!cycle) return res.status(404).json({ message: 'Cycle not found' });
    if (cycle.currentPhase !== 'phase2') {
      return res.status(400).json({ message: 'Rollback is only allowed from phase2 to phase1.' });
    }

    // Check for submitted assessments (mid-year reviews or self-assessments)
    var assessmentCount = await Objective.countDocuments({
      cycle: cycle._id,
      $or: [
        { selfAssessment: { $exists: true, $ne: '' } },
        { managerComments: { $exists: true, $ne: '' } }
      ]
    });

    if (assessmentCount > 0) {
      return res.status(400).json({
        message: 'Cannot roll back. ' + assessmentCount + ' assessments already submitted.'
      });
    }

    var oldPhase = cycle.currentPhase;
    cycle.currentPhase = 'phase1';
    cycle.$ignoreSequentialValidation = true;
    await cycle.save();

    var populated = await Cycle.findById(cycle._id).populate('createdBy', 'name email');

    createAuditLog({
      entityType: 'cycle', entityId: cycle._id, action: 'phase_rollback',
      performedBy: req.user.id,
      oldValue: { currentPhase: oldPhase }, newValue: { currentPhase: 'phase1' },
      description: 'Cycle "' + cycle.name + '" rolled back from ' + oldPhase + ' to phase1',
      ipAddress: req.ip
    });

    res.json({ message: 'Phase rolled back from ' + oldPhase + ' to phase1', cycle: populated });
  } catch (err) {
    console.error('Rollback error:', err);
    res.status(500).json({ message: err.message || 'Server error' });
  }
});

// ========== DELETE CYCLE (ADMIN / HR — draft only for non-admin) ==========
router.delete('/:id', rateLimiter, auth, role('ADMIN', 'HR'), async function (req, res) {
  try {
    var cycle = await Cycle.findById(req.params.id);
    if (!cycle) {
      return res.status(404).json({ message: 'Cycle not found' });
    }

    // Admin can delete any cycle; HR/others can only delete draft cycles
    if (req.user.role !== 'ADMIN' && cycle.status !== 'draft') {
      return res.status(403).json({ message: 'LOCKED: You cannot delete a cycle once its evaluation period has started (Active) or Closed.' });
    }

    // Use direct deleteMany/findByIdAndDelete — no save hooks, no validation
    await Objective.deleteMany({ cycle: cycle._id });
    await HRDecision.deleteMany({ cycle: cycle._id });
    await Cycle.findByIdAndDelete(req.params.id);
    res.json({ message: 'Cycle and all associated data deleted successfully' });
  } catch (err) {
    console.error('Delete cycle error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
