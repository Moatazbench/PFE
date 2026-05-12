const CheckIn = require('../models/CheckIn');
const Objective = require('../models/Objective');
const Task = require('../models/Task');
const Cycle = require('../models/Cycle');
const auditLogger = require('../utils/auditLogger');

const PHASE2_ACCESS_ROLES = ['ADMIN', 'HR', 'TEAM_LEADER'];

async function enforceCyclePhaseAccess(cycleId, allowedPhases) {
  const cycle = await Cycle.findById(cycleId).select('currentPhase status');
  if (!cycle) {
    return { error: true, status: 404, message: 'Cycle not found.' };
  }

  if (cycle.status === 'draft' || !allowedPhases.includes(cycle.currentPhase)) {
    return { error: true, status: 403, message: `This section is only available during ${allowedPhases.join(' or ')}.` };
  }

  return { error: false, cycle };
}

// Employee: get check-ins
exports.getCheckIns = async (req, res) => {
  try {
    const { cycle_id, objective_id } = req.query;
    if (!cycle_id) return res.status(400).json({ success: false, message: 'cycle_id is required.' });
    const phaseCheck = await enforceCyclePhaseAccess(cycle_id, ['phase2', 'phase3']);
    if (phaseCheck.error) return res.status(phaseCheck.status).json({ success: false, message: phaseCheck.message });

    const filter = { employee_id: req.user.id };
    if (cycle_id) filter.cycle_id = cycle_id;
    if (objective_id) filter.objective_id = objective_id;

    const checkIns = await CheckIn.find(filter).populate('objective_id', 'title dueDate').sort({ createdAt: -1 });
    res.json({ success: true, checkIns });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Manager: get team check-ins
exports.getTeamCheckIns = async (req, res) => {
  try {
    const { cycle_id } = req.query;
    if (!cycle_id) return res.status(400).json({ success: false, message: 'cycle_id required' });
    const phaseCheck = await enforceCyclePhaseAccess(cycle_id, ['phase2', 'phase3']);
    if (phaseCheck.error) return res.status(phaseCheck.status).json({ success: false, message: phaseCheck.message });

    // Assuming we want all check-ins for the manager's team.
    // For now, let's just get check-ins where objective's owner has manager = req.user.id
    // But since CheckIn has employee_id, we can just find check-ins for employees managed by req.user.id
    const User = require('../models/User');
    const teamMembers = await User.find({ manager: req.user.id }).select('_id');
    const memberIds = teamMembers.map(m => m._id);

    const checkIns = await CheckIn.find({ employee_id: { $in: memberIds }, cycle_id })
      .populate('objective_id', 'title dueDate')
      .populate('employee_id', 'name email profileImage');

    res.json({ success: true, checkIns });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Employee: submit new check-in
exports.submitCheckIn = async (req, res) => {
  try {
    const { objective_id, cycle_id, progress_percent, notes, priority, attachments } = req.body;

    if (!objective_id) return res.status(400).json({ success: false, message: 'objective_id is required.' });
    if (!cycle_id) return res.status(400).json({ success: false, message: 'cycle_id is required.' });
    if (progress_percent == null) return res.status(400).json({ success: false, message: 'progress_percent is required.' });

    const mongoose = require('mongoose');
    if (!mongoose.Types.ObjectId.isValid(objective_id)) return res.status(400).json({ success: false, message: 'Invalid objective_id format.' });
    if (!mongoose.Types.ObjectId.isValid(cycle_id)) return res.status(400).json({ success: false, message: 'Invalid cycle_id format.' });
    const phaseCheck = await enforceCyclePhaseAccess(cycle_id, ['phase2']);
    if (phaseCheck.error) return res.status(phaseCheck.status).json({ success: false, message: phaseCheck.message });

    // Sanitize attachments — only keep fields the schema allows
    const safeAttachments = Array.isArray(attachments) ? attachments.map(a => ({
      name: String(a.name || ''),
      url: String(a.url || ''),
      type: String(a.type || 'file'),
      size: Number(a.size) || 0,
      mimetype: String(a.mimetype || '')
    })) : [];

    let checkIn = await CheckIn.findOne({ objective_id, cycle_id, employee_id: req.user.id });

    if (checkIn) {
      if (checkIn.status === 'approved') {
        return res.status(400).json({ success: false, message: 'Check-in already approved and cannot be modified.' });
      }

      if (checkIn.status === 'revision_requested') {
        checkIn.history.push({
          submitted_at: checkIn.submitted_at,
          content: checkIn.notes,
          status: checkIn.status,
          manager_feedback: checkIn.manager_feedback
        });
      }

      checkIn.progress_percent = Number(progress_percent);
      checkIn.notes = notes || '';
      checkIn.priority = priority || checkIn.priority;
      checkIn.attachments = safeAttachments;
      checkIn.status = 'pending_review';
      checkIn.submitted_at = new Date();
      checkIn.last_edited_at = new Date();
      await checkIn.save();
    } else {
      checkIn = new CheckIn({
        objective_id,
        employee_id: req.user.id,
        cycle_id,
        progress_percent: Number(progress_percent),
        notes: notes || '',
        priority: priority || 'medium',
        attachments: safeAttachments,
        status: 'pending_review',
        submitted_at: new Date()
      });
      await checkIn.save();
    }

    await Objective.findByIdAndUpdate(objective_id, { achievementPercent: Number(progress_percent) });

    auditLogger.log(req.user.id, 'checkin.submitted', 'CheckIn', checkIn._id, {
      objective_id, progress_percent, status: checkIn.status
    }).catch(() => { });

    res.status(201).json({ success: true, checkIn });
  } catch (err) {
    console.error('submitCheckIn error:', err.message);
    require('fs').writeFileSync(__dirname + '/../checkin_error.log', new Date().toISOString() + '\n' + err.stack + '\nBody: ' + JSON.stringify(req.body) + '\n', { flag: 'a' });
    res.status(500).json({ success: false, message: err.message });
  }
};

// Manager: review check-in
exports.reviewCheckIn = async (req, res) => {
  try {
    const { id } = req.params;
    const { action, feedback, progress_percent } = req.body; // action: 'approve' or 'request_revision'

    // Validation
    if (!action || !['approve', 'request_revision'].includes(action)) {
      return res.status(400).json({ success: false, message: 'Invalid action. Must be "approve" or "request_revision"' });
    }

    // If requesting revision, feedback is required
    if (action === 'request_revision' && (!feedback || feedback.trim() === '')) {
      return res.status(400).json({ success: false, message: 'Feedback is required when requesting revision' });
    }

    // Validate progress if provided
    if (progress_percent !== undefined && progress_percent !== null) {
      const prog = Number(progress_percent);
      if (isNaN(prog) || prog < 0 || prog > 100) {
        return res.status(400).json({ success: false, message: 'Progress must be a number between 0 and 100' });
      }
    }

    const checkIn = await CheckIn.findById(id).populate('objective_id');
    if (!checkIn) return res.status(404).json({ success: false, message: 'Check-in not found' });
    const phaseCheck = await enforceCyclePhaseAccess(checkIn.cycle_id, ['phase2']);
    if (phaseCheck.error) return res.status(phaseCheck.status).json({ success: false, message: phaseCheck.message });

    // Verify manager has authority over this employee
    const User = require('../models/User');
    const employee = await User.findById(checkIn.employee_id);
    if (!employee) return res.status(404).json({ success: false, message: 'Employee not found' });

    // Check if manager supervises this employee
    if (String(employee.manager) !== String(req.user.id) && req.user.role !== 'ADMIN' && req.user.role !== 'HR') {
      return res.status(403).json({ success: false, message: 'You do not have permission to review this check-in' });
    }

    // Update check-in
    if (action === 'approve') {
      checkIn.status = 'approved';
      checkIn.manager_feedback = feedback || '';
    } else if (action === 'request_revision') {
      checkIn.status = 'revision_requested';
      checkIn.manager_feedback = feedback;
    }

    // Update progress if provided
    if (progress_percent !== undefined && progress_percent !== null) {
      checkIn.progress_percent = Number(progress_percent);
      // Also update objective achievement percent
      if (checkIn.objective_id) {
        await require('../models/Objective').findByIdAndUpdate(checkIn.objective_id, { achievementPercent: Number(progress_percent) });
      }
    }

    checkIn.manager_id = req.user.id;
    checkIn.reviewedBy = req.user.id;
    checkIn.reviewedAt = new Date();
    await checkIn.save();

    await auditLogger.log(req.user.id, `checkin.${action === 'approve' ? 'approved' : 'revision_requested'}`, 'CheckIn', checkIn._id, {
      objective_id: checkIn.objective_id,
      action,
      progress_percent: checkIn.progress_percent
    });

    res.json({ success: true, checkIn });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Manager: get check-ins by objective ID (for goal check-up panel)
exports.getCheckInsByObjective = async (req, res) => {
  try {
    const { objective_id } = req.query;
    if (!objective_id) return res.status(400).json({ success: false, message: 'objective_id is required.' });
    const objective = await Objective.findById(objective_id).select('cycle');
    if (!objective) return res.status(404).json({ success: false, message: 'Objective not found.' });
    const phaseCheck = await enforceCyclePhaseAccess(objective.cycle, ['phase2', 'phase3']);
    if (phaseCheck.error) return res.status(phaseCheck.status).json({ success: false, message: phaseCheck.message });

    const checkIns = await CheckIn.find({ objective_id })
      .populate('employee_id', 'name email profileImage')
      .sort({ submitted_at: -1 });

    res.json({ success: true, checkIns });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getTasksForObjective = async (req, res) => {
  try {
    const { objective_id } = req.params;
    const objective = await Objective.findById(objective_id).select('cycle');
    if (!objective) return res.status(404).json({ success: false, message: 'Objective not found.' });
    const phaseCheck = await enforceCyclePhaseAccess(objective.cycle, ['phase2', 'phase3']);
    if (phaseCheck.error) return res.status(phaseCheck.status).json({ success: false, message: phaseCheck.message });

    const tasks = await Task.find({ linkedGoal: objective_id });
    res.json({ success: true, tasks });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
