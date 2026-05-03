const User = require('../models/User');
const Cycle = require('../models/Cycle');
const Objective = require('../models/Objective');
const Feedback = require('../models/Feedback');
const Meeting = require('../models/Meeting');
const Evaluation = require('../models/Evaluation');

const MAX_TEXT_LENGTH = 400;
const MAX_ITEMS = 10;

function trimText(value, max = MAX_TEXT_LENGTH) {
  if (!value) return '';
  const normalized = String(value || '').replace(/\s+/g, ' ').trim();
  return normalized.length > max ? normalized.slice(0, max - 1).trim() + '…' : normalized;
}

function summarizeFields(obj, fields) {
  const result = {};
  fields.forEach(field => {
    if (obj[field]) result[field] = trimText(obj[field]);
  });
  return result;
}

function buildObjectiveSummary(objective) {
  return {
    id: objective._id?.toString(),
    title: trimText(objective.title, 120),
    description: trimText(objective.description, 280),
    successIndicator: trimText(objective.successIndicator, 240),
    status: objective.status || '',
    achievementPercent: objective.achievementPercent != null ? objective.achievementPercent : null,
    selfAssessment: trimText(objective.selfAssessment || objective.finalSelfAssessment || ''),
    finalSelfAssessment: trimText(objective.finalSelfAssessment || ''),
    managerComments: trimText(objective.managerComments || ''),
    evaluationRating: objective.evaluationRating || '',
    evaluationComment: trimText(objective.evaluationComment || ''),
    kpis: (objective.kpis || []).slice(0, 4).map(kpi => ({
      title: trimText(kpi.title, 120),
      metricType: kpi.metricType,
      initialValue: kpi.initialValue,
      currentValue: kpi.currentValue,
      targetValue: kpi.targetValue,
      unit: kpi.unit,
      status: kpi.status,
    })),
    recentProgress: (objective.progressUpdates || [])
      .slice(-3)
      .map(update => ({
        by: update.user?.name || 'Unknown',
        message: trimText(update.message, 200),
        date: update.createdAt ? new Date(update.createdAt).toISOString().slice(0, 10) : null,
      })),
    recentComments: (objective.comments || [])
      .slice(-2)
      .map(comment => ({
        by: comment.user?.name || 'Unknown',
        text: trimText(comment.text, 220),
        date: comment.createdAt ? new Date(comment.createdAt).toISOString().slice(0, 10) : null,
      })),
  };
}

function buildFeedbackSummary(feedback) {
  return {
    id: feedback._id?.toString(),
    type: feedback.type,
    message: trimText(feedback.message, 260),
    rating: feedback.rating != null ? feedback.rating : null,
    anonymous: feedback.anonymous || false,
    visibility: feedback.visibility || '',
    sender: feedback.anonymous ? 'Anonymous' : feedback.sender?.name || 'Unknown',
    relatedObjectiveId: feedback.relatedObjective?.toString() || null,
  };
}

function buildMeetingSummary(meeting) {
  return {
    id: meeting._id?.toString(),
    title: trimText(meeting.title, 120),
    type: meeting.type,
    date: meeting.date ? new Date(meeting.date).toISOString().slice(0, 10) : null,
    notes: trimText(meeting.notes, 280),
    agenda: (meeting.agenda || []).slice(0, 3).map(item => trimText(item.title, 120)),
  };
}

function buildEvaluationSummary(evaluation) {
  if (!evaluation) return null;

  return {
    id: evaluation._id?.toString(),
    evaluator: evaluation.evaluatorId?.name || 'Unknown',
    period: evaluation.period || '',
    status: evaluation.status || '',
    overallComments: trimText(evaluation.overallComments, 340),
    strengths: trimText(evaluation.strengths, 280),
    areasForImprovement: trimText(evaluation.areasForImprovement, 280),
    developmentRecommendations: trimText(evaluation.developmentRecommendations, 280),
    nextSteps: trimText(evaluation.nextSteps, 280),
    suggestedScore: evaluation.suggestedScore != null ? evaluation.suggestedScore : null,
    finalScore: evaluation.finalScore != null ? evaluation.finalScore : null,
    objectiveAssessments: (evaluation.objectiveAssessments || []).slice(0, 8).map((assessment) => ({
      objectiveId: assessment.objectiveId?.toString(),
    })),
  };
}

async function buildReviewContext({ employeeId, cycleId, objectiveId = null }) {
  if (!employeeId) {
    throw new Error('employeeId is required to build review context');
  }
  if (!cycleId) {
    throw new Error('cycleId is required to build review context');
  }

  const employeePromise = User.findById(employeeId)
    .select('name email role manager')
    .populate('manager', 'name role')
    .lean();
  const cyclePromise = Cycle.findById(cycleId).lean();
  const objectivesPromise = Objective.find({
    owner: employeeId,
    cycle: cycleId,
    ...(objectiveId ? { _id: objectiveId } : {}),
  })
    .populate('progressUpdates.user', 'name')
    .populate('comments.user', 'name role')
    .lean();
  const feedbackPromise = Feedback.find({ recipient: employeeId, status: 'active' })
    .sort({ createdAt: -1 })
    .limit(MAX_ITEMS)
    .populate('sender', 'name role')
    .lean();
  const meetingPromise = Meeting.find({
    attendees: employeeId,
    status: 'completed',
    type: { $in: ['review', 'one_on_one', 'check_in'] },
  })
    .sort({ date: -1 })
    .limit(MAX_ITEMS)
    .lean();
  const evaluationPromise = Evaluation.findOne({ employeeId, cycleId }).populate('evaluatorId', 'name role').lean();

  const [employee, cycle, objectives, feedbacks, meetings, evaluation] = await Promise.all([
    employeePromise,
    cyclePromise,
    objectivesPromise,
    feedbackPromise,
    meetingPromise,
    evaluationPromise,
  ]);

  if (!employee) {
    throw new Error('Employee not found');
  }
  if (!cycle) {
    throw new Error('Cycle not found');
  }

  return {
    employee: {
      id: employee._id?.toString(),
      name: employee.name,
      email: employee.email,
      role: employee.role,
      manager: employee.manager ? {
        name: employee.manager.name,
        role: employee.manager.role,
      } : null,
    },
    cycle: {
      id: cycle._id?.toString(),
      name: cycle.name,
      year: cycle.year,
      status: cycle.status,
      currentPhase: cycle.currentPhase,
      phase1Start: cycle.phase1Start ? new Date(cycle.phase1Start).toISOString().slice(0, 10) : null,
      phase1End: cycle.phase1End ? new Date(cycle.phase1End).toISOString().slice(0, 10) : null,
      phase2Start: cycle.phase2Start ? new Date(cycle.phase2Start).toISOString().slice(0, 10) : null,
      phase2End: cycle.phase2End ? new Date(cycle.phase2End).toISOString().slice(0, 10) : null,
      phase3Start: cycle.phase3Start ? new Date(cycle.phase3Start).toISOString().slice(0, 10) : null,
      phase3End: cycle.phase3End ? new Date(cycle.phase3End).toISOString().slice(0, 10) : null,
    },
    objectives: (objectives || []).slice(0, MAX_ITEMS).map(buildObjectiveSummary),
    feedbacks: (feedbacks || []).map(buildFeedbackSummary),
    meetings: (meetings || []).map(buildMeetingSummary),
    evaluation: buildEvaluationSummary(evaluation),
    meta: {
      cycleId: cycleId.toString(),
      employeeId: employeeId.toString(),
      objectiveId: objectiveId ? objectiveId.toString() : null,
      objectiveCount: (objectives || []).length,
      feedbackCount: (feedbacks || []).length,
      meetingCount: (meetings || []).length,
    },
  };
}

module.exports = {
  buildReviewContext,
};
