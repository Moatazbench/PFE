const express = require('express');
const router = express.Router();
const Cycle = require('../models/Cycle');
const Objective = require('../models/Objective');
const HRDecision = require('../models/HRDecision');
const auth = require('../middleware/auth');
const role = require('../middleware/role');
const rateLimiter = require('../middleware/rateLimiter');
const validate = require('../middleware/validate');
const schemas = require('../validators/schemas');
const { notifyAllActiveUsers } = require('../utils/notificationHelper');
const { createAuditLog } = require('../utils/auditHelper');



function compareDates(date1, date2) {
  var d1 = new Date(date1);
  var d2 = new Date(date2);
  d1.setHours(0, 0, 0, 0);
  d2.setHours(0, 0, 0, 0);
  return d1.getTime() - d2.getTime();
}

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
    var { name, year, evaluationStart, evaluationEnd, status,
          phase1Start, phase1End, phase2Start, phase2End, phase3Start, phase3End, currentPhase } = req.body;

    if (req.user.role !== 'ADMIN') {
      // Legacy evaluation date validation
      if (evaluationStart && evaluationEnd && compareDates(evaluationEnd, evaluationStart) < 0) {
        return res.status(400).json({ message: 'Evaluation end date cannot be before start date' });
      }

      // Phase date sequential validation
      var phaseError = validatePhaseDatesFromBody(req.body, null);
      if (phaseError) {
        return res.status(400).json({ message: phaseError });
      }
    }

    var cycle = new Cycle({
      name: name,
      year: year,
      status: status || 'draft',
      evaluationStart: evaluationStart || null,
      evaluationEnd: evaluationEnd || null,
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
    var { name, year, evaluationStart, evaluationEnd, status,
          phase1Start, phase1End, phase2Start, phase2End, phase3Start, phase3End, currentPhase } = req.body;
    var cycle = await Cycle.findById(req.params.id);
    if (!cycle) {
      return res.status(404).json({ message: 'Cycle not found' });
    }
    if (cycle.status === 'closed') {
      return res.status(400).json({ message: 'Cannot edit a closed cycle' });
    }

    if (req.user.role !== 'ADMIN') {
      var evalStart = evaluationStart || cycle.evaluationStart;
      var evalEnd = evaluationEnd || cycle.evaluationEnd;
      if (evalStart && evalEnd && compareDates(evalEnd, evalStart) < 0) {
        return res.status(400).json({ message: 'Evaluation end date cannot be before start date' });
      }

      // Phase date sequential validation (merge with existing)
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
      const objectives = await Objective.find({ cycle: cycle._id, status: 'validated' });

      const userScores = {};
      objectives.forEach(o => {
        const ownerId = String(o.owner);
        if (!userScores[ownerId]) userScores[ownerId] = { individual: 0, team: 0 };
        if (o.category === 'individual') userScores[ownerId].individual += (o.weightedScore || 0);
        if (o.category === 'team') userScores[ownerId].team += (o.weightedScore || 0);
      });

      const decisions = [];
      for (const [userId, scores] of Object.entries(userScores)) {
        const indScore = Math.min(scores.individual, 100) * 0.70;
        const teamScore = Math.min(scores.team, 100) * 0.30;
        const finalScore = Number((indScore + teamScore).toFixed(2));

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
    if (evaluationStart) cycle.evaluationStart = evaluationStart;
    if (evaluationEnd) cycle.evaluationEnd = evaluationEnd;

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

    var { name, year, evaluationStart, evaluationEnd, status,
          phase1Start, phase1End, phase2Start, phase2End, phase3Start, phase3End, currentPhase } = req.body;

    if (req.user.role !== 'ADMIN') {
      // Phase date sequential validation (merge with existing)
      var phaseError = validatePhaseDatesFromBody(req.body, cycle);
      if (phaseError) {
        return res.status(400).json({ message: phaseError });
      }

      // Legacy evaluation date validation
      var evalStart = evaluationStart || cycle.evaluationStart;
      var evalEnd = evaluationEnd || cycle.evaluationEnd;
      if (evalStart && evalEnd && compareDates(evalEnd, evalStart) < 0) {
        return res.status(400).json({ message: 'Evaluation end date cannot be before start date' });
      }
    }

    // Apply updates (only fields that are provided)
    if (name !== undefined) cycle.name = name;
    if (year !== undefined) cycle.year = year;
    if (evaluationStart !== undefined) cycle.evaluationStart = evaluationStart || null;
    if (evaluationEnd !== undefined) cycle.evaluationEnd = evaluationEnd || null;
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
    notifyAllActiveUsers({ senderId: req.user.id, type: notifType, title: phaseLabel + ' — ' + cycle.name, message: 'Cycle "' + cycle.name + '" has moved to ' + phaseLabel + '.', link: '/annual-cycles' });
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