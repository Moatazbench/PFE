const User = require('../models/User');
const Team = require('../models/Team');
const Objective = require('../models/Objective');
const Cycle = require('../models/Cycle');
const Task = require('../models/Task');
const CheckIn = require('../models/CheckIn');
const FinalEvaluation = require('../models/FinalEvaluation');
const HRDecision = require('../models/HRDecision');
const CareerPath = require('../models/CareerPath');
const BonusPenalty = require('../models/BonusPenalty');
const ImprovementPlan = require('../models/ImprovementPlan');

function round(value) {
  return Number(Number(value || 0).toFixed(1));
}

async function getManagedTeams(userId) {
  const roots = await Team.find({ leader: userId }).select('_id name leader members parentTeam').lean();
  const teams = roots.slice();
  let queue = roots.map((team) => team._id);
  while (queue.length) {
    const children = await Team.find({ parentTeam: { $in: queue } }).select('_id name leader members parentTeam').lean();
    teams.push(...children);
    queue = children.map((team) => team._id);
  }
  return teams;
}

async function resolveDashboardScope(req, scope) {
  const actorId = req.user.id || req.user._id;
  if (scope === 'org') {
    if (!['ADMIN', 'HR'].includes(req.user.role)) {
      return { error: { status: 403, message: 'Insufficient permissions for organizational scope.' } };
    }
    const [employees, teams] = await Promise.all([
      User.find({ isDeleted: false, isActive: true, role: { $ne: 'ADMIN' } }).select('_id').lean(),
      Team.find({}).select('_id name leader members parentTeam').lean()
    ]);
    return { employeeIds: employees.map((employee) => employee._id), teams };
  }
  if (scope === 'team') {
    const teams = req.user.role === 'TEAM_LEADER'
      ? await getManagedTeams(actorId)
      : ['ADMIN', 'HR'].includes(req.user.role)
        ? await Team.find({}).select('_id name leader members parentTeam').lean()
        : [];
    const employeeIds = Array.from(new Set(teams.flatMap((team) => [team.leader, ...(team.members || [])]).filter(Boolean).map(String)));
    return { employeeIds, teams };
  }
  return { employeeIds: [actorId], teams: [] };
}

async function buildSubteamSummaries(teams, objectives, tasks, evaluations) {
  return (teams || []).filter((team) => team.parentTeam).map((team) => {
    const memberIds = new Set([team.leader, ...(team.members || [])].filter(Boolean).map(String));
    const teamObjectives = objectives.filter((objective) => memberIds.has(String(objective.owner)));
    const teamTasks = tasks.filter((task) => memberIds.has(String(task.assignee)));
    const teamEvaluations = evaluations.filter((evaluation) => memberIds.has(String(evaluation.employee_id)));
    const completedTasks = teamTasks.filter((task) => task.status === 'done').length;
    return {
      id: team._id,
      name: team.name,
      members: memberIds.size,
      objectiveProgress: teamObjectives.length
        ? round(teamObjectives.reduce((sum, objective) => sum + Number(objective.achievementPercent || 0), 0) / teamObjectives.length)
        : null,
      taskCompletion: teamTasks.length ? round((completedTasks / teamTasks.length) * 100) : null,
      averageScore: teamEvaluations.length
        ? round(teamEvaluations.reduce((sum, evaluation) => sum + Number(evaluation.final_score || 0), 0) / teamEvaluations.length)
        : null
    };
  });
}

exports.getDashboardStats = async (req, res) => {
  try {
    const scope = req.query.scope || 'me';
    const scoped = await resolveDashboardScope(req, scope);
    if (scoped.error) return res.status(scoped.error.status).json({ success: false, message: scoped.error.message });

    const activeCycle = await Cycle.findOne({ status: { $in: ['open', 'active', 'in_progress'] } }).sort({ year: -1 }).lean();
    const objectiveFilter = { owner: { $in: scoped.employeeIds } };
    const evaluationFilter = { employee_id: { $in: scoped.employeeIds } };
    if (activeCycle) {
      objectiveFilter.cycle = activeCycle._id;
      evaluationFilter.cycle_id = activeCycle._id;
    }

    const objectives = await Objective.find(objectiveFilter)
      .select('_id title owner status achievementPercent finalSelfSubmittedAt managerAdjustedPercent updatedAt createdAt')
      .lean();
    const objectiveIds = objectives.map((objective) => objective._id);
    const [tasks, checkIns, evaluations, careerPaths, pendingCompensation, cycles] = await Promise.all([
      Task.find({
        assignee: { $in: scoped.employeeIds },
        $or: [{ linkedGoal: { $in: objectiveIds } }, { objective_id: { $in: objectiveIds } }]
      }).select('_id title assignee status workflowStage dueDate completedAt updatedAt createdAt').lean(),
      activeCycle
        ? CheckIn.find({ employee_id: { $in: scoped.employeeIds }, cycle_id: activeCycle._id })
          .select('_id employee_id status progress_percent submitted_at updatedAt createdAt').lean()
        : [],
      FinalEvaluation.find(evaluationFilter)
        .select('_id employee_id cycle_id status final_score performance_status hr_return_reason consistency_warnings hr_validated_at updatedAt createdAt')
        .lean(),
      CareerPath.find({ user: { $in: scoped.employeeIds }, status: 'active' }).select('user developmentPlan').lean(),
      BonusPenalty.countDocuments({ employee: { $in: scoped.employeeIds }, approvalStatus: 'pending' }),
      Cycle.find({ status: { $ne: 'draft' } }).select('_id name year').sort({ year: 1 }).lean()
    ]);

    const [usersCount, teamsCount, objectivesCount, cyclesCount] = await Promise.all([
      scope === 'me' ? 1 : scoped.employeeIds.length,
      scope === 'me' ? Team.countDocuments({ $or: [{ leader: scoped.employeeIds[0] }, { members: scoped.employeeIds[0] }] }) : scoped.teams.length,
      Objective.countDocuments(objectiveFilter),
      Cycle.countDocuments()
    ]);

    const activeObjectives = objectives.filter((objective) => !['draft', 'rejected', 'cancelled', 'archived'].includes(objective.status));
    const completedTasks = tasks.filter((task) => task.status === 'done' || task.workflowStage === 'completed');
    const pendingTasks = tasks.filter((task) => !['done', 'cancelled'].includes(task.status));
    const overdueTasks = pendingTasks.filter((task) => task.dueDate && new Date(task.dueDate) < new Date());
    const approvedCheckIns = checkIns.filter((checkIn) => checkIn.status === 'approved');
    const validatedEvaluations = evaluations.filter((evaluation) => ['validated', 'closed'].includes(evaluation.status));
    const currentAverageScore = validatedEvaluations.length
      ? round(validatedEvaluations.reduce((sum, evaluation) => sum + Number(evaluation.final_score || 0), 0) / validatedEvaluations.length)
      : null;

    const historicalEvaluations = await FinalEvaluation.find({
      employee_id: { $in: scoped.employeeIds },
      status: { $in: ['validated', 'closed'] }
    }).select('cycle_id final_score').lean();
    const evaluationTrend = cycles.map((cycle) => {
      const cycleEvaluations = historicalEvaluations.filter((evaluation) => String(evaluation.cycle_id) === String(cycle._id));
      return {
        label: String(cycle.year),
        score: cycleEvaluations.length
          ? round(cycleEvaluations.reduce((sum, evaluation) => sum + Number(evaluation.final_score || 0), 0) / cycleEvaluations.length)
          : null
      };
    }).filter((entry) => entry.score != null);

    const developmentActions = careerPaths.flatMap((path) => path.developmentPlan || []);
    const improvementPlans = await ImprovementPlan.find({
      employee_id: { $in: scoped.employeeIds },
      progress_status: { $in: ['not_started', 'in_progress'] }
    }).select('evaluation_id employee_id progress_status').lean();
    const evaluationsWithPlans = new Set(improvementPlans.map((plan) => String(plan.evaluation_id)));
    const lowPerformanceEvaluations = evaluations.filter((evaluation) =>
      ['needs_improvement', 'critical_attention'].includes(evaluation.performance_status)
      || Number(evaluation.final_score || 0) < 50
    );
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const subteams = await buildSubteamSummaries(scoped.teams, objectives, tasks, evaluations);
    const recentActivity = []
      .concat(objectives.map((objective) => ({ id: `objective-${objective._id}`, type: 'Objective', title: objective.title, status: objective.status, date: objective.updatedAt || objective.createdAt })))
      .concat(completedTasks.map((task) => ({ id: `task-${task._id}`, type: 'Task completed', title: task.title, status: 'completed', date: task.completedAt || task.updatedAt })))
      .concat(checkIns.map((checkIn) => ({ id: `checkin-${checkIn._id}`, type: 'Check-in', title: `${checkIn.progress_percent || 0}% progress update`, status: checkIn.status, date: checkIn.submitted_at || checkIn.updatedAt })))
      .concat(evaluations.map((evaluation) => ({ id: `evaluation-${evaluation._id}`, type: 'Final evaluation', title: `${evaluation.status.replace(/_/g, ' ')} · ${evaluation.final_score || 0}%`, status: evaluation.status, date: evaluation.updatedAt || evaluation.createdAt })))
      .sort((left, right) => new Date(right.date || 0) - new Date(left.date || 0))
      .slice(0, 10);

    return res.json({
      users: usersCount,
      teams: teamsCount,
      objectives: objectivesCount,
      cycles: cyclesCount,
      insights: {
        activeObjectives: activeObjectives.length,
        averageObjectiveProgress: activeObjectives.length
          ? round(activeObjectives.reduce((sum, objective) => sum + Number(objective.achievementPercent || 0), 0) / activeObjectives.length)
          : 0,
        completedTasks: completedTasks.length,
        pendingTasks: pendingTasks.length,
        overdueTasks: overdueTasks.length,
        checkInCompletionRate: checkIns.length ? round((approvedCheckIns.length / checkIns.length) * 100) : 0,
        averagePerformanceScore: currentAverageScore,
        pendingSelfAssessments: activeObjectives.filter((objective) => !objective.finalSelfSubmittedAt).length,
        pendingManagerReviews: activeObjectives.filter((objective) => objective.managerAdjustedPercent == null).length,
        finalEvaluationsGenerated: evaluations.length,
        pendingHrValidation: evaluations.filter((evaluation) => evaluation.status === 'pending_hr').length,
        hrSendBacks: evaluations.filter((evaluation) => evaluation.hr_return_reason).length,
        recentlyValidated: validatedEvaluations.filter((evaluation) =>
          evaluation.hr_validated_at && new Date(evaluation.hr_validated_at) >= thirtyDaysAgo
        ).length,
        evaluationsWithWarnings: evaluations.filter((evaluation) =>
          Array.isArray(evaluation.consistency_warnings) && evaluation.consistency_warnings.length > 0
        ).length,
        lowPerformanceWithoutPlans: lowPerformanceEvaluations.filter((evaluation) =>
          !evaluationsWithPlans.has(String(evaluation._id))
        ).length,
        activeImprovementPlans: improvementPlans.length,
        atRiskEmployees: validatedEvaluations.filter((evaluation) =>
          ['needs_improvement', 'critical_attention'].includes(evaluation.performance_status) || Number(evaluation.final_score || 0) < 50
        ).length,
        pendingCompensation,
        careerActions: developmentActions.length,
        completedCareerActions: developmentActions.filter((action) => action.status === 'completed').length,
        pendingCareerActions: developmentActions.filter((action) => ['planned', 'in_progress'].includes(action.status)).length,
        evaluationTrend,
        subteams,
        recentActivity
      }
    });
  } catch (err) {
    console.error('Dashboard stats error:', err);
    return res.status(500).json({ success: false, message: 'Server error during dashboard aggregation.' });
  }
};

exports.getScoreDistribution = async (req, res) => {
  try {
    const stats = await HRDecision.aggregate([{
      $bucket: {
        groupBy: '$finalScore',
        boundaries: [0, 60, 70, 80, 90, 101],
        default: 'Other',
        output: { count: { $sum: 1 } }
      }
    }]);
    const result = { '0-59 (Red Flag)': 0, '60-69': 0, '70-79': 0, '80-89': 0, '90-100': 0 };
    const mapping = { 0: '0-59 (Red Flag)', 60: '60-69', 70: '70-79', 80: '80-89', 90: '90-100' };
    stats.forEach((entry) => { if (mapping[entry._id] !== undefined) result[mapping[entry._id]] = entry.count; });
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getObjectivesByStatus = async (req, res) => {
  try {
    const stats = await Objective.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]);
    const result = { draft: 0, active: 0, submitted: 0, validated: 0, rejected: 0, completed: 0 };
    stats.forEach((entry) => { if (entry._id) result[entry._id] = entry.count; });
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getUsersByRole = async (req, res) => {
  try {
    const stats = await User.aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }]);
    const result = { ADMIN: 0, HR: 0, TEAM_LEADER: 0, COLLABORATOR: 0 };
    stats.forEach((entry) => { if (entry._id) result[entry._id] = entry.count; });
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};
