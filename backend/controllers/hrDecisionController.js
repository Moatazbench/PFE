const HRDecision = require('../models/HRDecision');
const EvaluationReport = require('../models/EvaluationReport');
const EvaluationCycle = require('../models/EvaluationCycle');
const User = require('../models/User');
const Team = require('../models/Team');

// Helper: Calculate category from score
const getCategory = (score) => {
  if (score >= 90) return 'exceptional';
  if (score >= 70) return 'meets-expectations';
  if (score >= 50) return 'below-expectations';
  return 'critical';
};

// Get all employees with their scores for a cycle
exports.getEmployeeScores = async (req, res) => {
  try {
    const { cycleId } = req.params;

    // Get all submitted and reviewed reports for this cycle
    const reports = await EvaluationReport.find({
      cycle: cycleId,
      status: 'submitted',
    })
      .populate('collaborator', 'name email')
      .populate('objective', 'title value');

    // Group by collaborator and calculate weighted scores
    const employeeScores = {};

    reports.forEach((report) => {
      const collabId = report.collaborator._id.toString();

      if (!employeeScores[collabId]) {
        employeeScores[collabId] = {
          collaborator: report.collaborator,
          reports: [],
          totalWeight: 0,
          weightedScoreSum: 0,
          avgProgress: 0,
          reviewedCount: 0,
        };
      }

      employeeScores[collabId].reports.push(report);

      if (report.managerScore !== null) {
        const weight = report.objective?.value || 0;
        employeeScores[collabId].totalWeight += weight;
        employeeScores[collabId].weightedScoreSum += report.managerScore * weight;
        employeeScores[collabId].reviewedCount++;
      }
    });

    // Calculate final scores and categories
    const employees = await Promise.all(
      Object.keys(employeeScores).map(async (collabId) => {
        const data = employeeScores[collabId];

        const overallScore = data.totalWeight > 0
          ? Math.round(data.weightedScoreSum / data.totalWeight)
          : null;

        const avgProgress = data.reports.length > 0
          ? Math.round(data.reports.reduce((sum, r) => sum + (r.progress || 0), 0) / data.reports.length)
          : 0;

        // Get existing decision if any
        const existingDecision = await HRDecision.findOne({
          collaborator: collabId,
          cycle: cycleId,
        });

        // Get team info
        const team = await Team.findOne({ collaborators: collabId }).select('name');

        return {
          collaborator: data.collaborator,
          team: team?.name || 'Unassigned',
          totalReports: data.reports.length,
          reviewedReports: data.reviewedCount,
          avgProgress,
          overallScore,
          category: overallScore !== null ? getCategory(overallScore) : null,
          hasDecision: !!existingDecision,
          decision: existingDecision,
        };
      })
    );

    // Sort by score descending
    employees.sort((a, b) => (b.overallScore || 0) - (a.overallScore || 0));

    // Summary stats
    const summary = {
      total: employees.length,
      withScores: employees.filter((e) => e.overallScore !== null).length,
      withDecisions: employees.filter((e) => e.hasDecision).length,
      categories: {
        exceptional: employees.filter((e) => e.category === 'exceptional').length,
        meetsExpectations: employees.filter((e) => e.category === 'meets-expectations').length,
        belowExpectations: employees.filter((e) => e.category === 'below-expectations').length,
        critical: employees.filter((e) => e.category === 'critical').length,
      },
    };

    res.json({ success: true, employees, summary });
  } catch (err) {
    console.error('Get employee scores error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// Create or update HR decision
exports.saveDecision = async (req, res) => {
  try {
    const { collaboratorId, cycleId } = req.params;
    const { decision, bonusAmount, promotionTitle, trainingPlan, notes } = req.body;
    const decidedBy = req.user.id || req.user._id;

    // Calculate overall score
    const reports = await EvaluationReport.find({
      cycle: cycleId,
      collaborator: collaboratorId,
      status: 'submitted',
      managerScore: { $ne: null },
    }).populate('objective', 'value');

    if (reports.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No reviewed reports found for this employee',
      });
    }

    const totalWeight = reports.reduce((sum, r) => sum + (r.objective?.value || 0), 0);
    const weightedSum = reports.reduce((sum, r) => sum + (r.managerScore * (r.objective?.value || 0)), 0);
    const overallScore = Math.round(weightedSum / totalWeight);
    const category = getCategory(overallScore);

    // Find or create decision
    let hrDecision = await HRDecision.findOne({ collaborator: collaboratorId, cycle: cycleId });

    if (hrDecision) {
      hrDecision.overallScore = overallScore;
      hrDecision.category = category;
      hrDecision.decision = decision;
      hrDecision.bonusAmount = bonusAmount || 0;
      hrDecision.promotionTitle = promotionTitle || '';
      hrDecision.trainingPlan = trainingPlan || '';
      hrDecision.notes = notes || '';
      hrDecision.decidedBy = decidedBy;
      hrDecision.decidedAt = new Date();
    } else {
      hrDecision = new HRDecision({
        collaborator: collaboratorId,
        cycle: cycleId,
        overallScore,
        category,
        decision,
        bonusAmount: bonusAmount || 0,
        promotionTitle: promotionTitle || '',
        trainingPlan: trainingPlan || '',
        notes: notes || '',
        decidedBy,
      });
    }

    await hrDecision.save();

    const populated = await HRDecision.findById(hrDecision._id)
      .populate('collaborator', 'name email')
      .populate('decidedBy', 'name email');

    res.json({ success: true, decision: populated });
  } catch (err) {
    console.error('Save decision error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// Get all decisions for a cycle
exports.getDecisions = async (req, res) => {
  try {
    const { cycleId } = req.params;

    const decisions = await HRDecision.find({ cycle: cycleId })
      .populate('collaborator', 'name email')
      .populate('decidedBy', 'name email')
      .populate('communicatedBy', 'name email')
      .sort({ overallScore: -1 });

    res.json({ success: true, decisions });
  } catch (err) {
    console.error('Get decisions error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// Get single decision
exports.getDecision = async (req, res) => {
  try {
    const { id } = req.params;

    const decision = await HRDecision.findById(id)
      .populate('collaborator', 'name email')
      .populate('cycle', 'name type year')
      .populate('decidedBy', 'name email');

    if (!decision) {
      return res.status(404).json({ success: false, message: 'Decision not found' });
    }

    res.json({ success: true, decision });
  } catch (err) {
    console.error('Get decision error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// Mark decision as communicated
exports.markCommunicated = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id || req.user._id;

    const decision = await HRDecision.findById(id);

    if (!decision) {
      return res.status(404).json({ success: false, message: 'Decision not found' });
    }

    decision.status = 'communicated';
    decision.communicatedAt = new Date();
    decision.communicatedBy = userId;

    await decision.save();

    res.json({ success: true, decision });
  } catch (err) {
    console.error('Mark communicated error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// Delete decision
exports.deleteDecision = async (req, res) => {
  try {
    const { id } = req.params;

    const decision = await HRDecision.findByIdAndDelete(id);

    if (!decision) {
      return res.status(404).json({ success: false, message: 'Decision not found' });
    }

    res.json({ success: true, message: 'Decision deleted' });
  } catch (err) {
    console.error('Delete decision error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};