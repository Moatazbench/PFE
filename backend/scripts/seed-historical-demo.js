require('dotenv').config();

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { EJSON } = require('bson');

const User = require('../models/User');
const Team = require('../models/Team');
const Cycle = require('../models/Cycle');
const Objective = require('../models/Objective');
const Task = require('../models/Task');
const CheckIn = require('../models/CheckIn');
const Feedback = require('../models/Feedback');
const FinalEvaluation = require('../models/FinalEvaluation');
const HRDecision = require('../models/HRDecision');
const BonusPenalty = require('../models/BonusPenalty');
const CareerRecommendation = require('../models/CareerRecommendation');
const CareerPath = require('../models/CareerPath');
const ImprovementPlan = require('../models/ImprovementPlan');
const Meeting = require('../models/Meeting');
const Notification = require('../models/Notification');

const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has('--dry-run');
const YEARS = [2022, 2023, 2024, 2025, 2026];
const COLLECTIONS_TO_REPLACE = [
  'cycles',
  'objectives',
  'tasks',
  'checkins',
  'feedbacks',
  'finalevaluations',
  'hrdecisions',
  'bonuspenalties',
  'careerrecommendations',
  'careerpaths',
  'improvementplans',
  'evaluations',
  'meetings',
  'correctionrequests',
  'notifications',
  'auditlogs'
];
const COLLECTIONS_TO_BACKUP = COLLECTIONS_TO_REPLACE.concat(['teams']);

const PROFILE_SCORES = {
  high: [82, 87, 91, 93, 94],
  medium: [68, 72, 74, 76, 78],
  low: [70, 62, 55, 48, 52],
  steady: [74, 76, 77, 79, 80],
  recovering: [58, 54, 61, 67, 72]
};

const PROFILE_LABELS = {
  high: 'High performer',
  medium: 'Medium performer',
  low: 'At-risk performer',
  steady: 'Steady contributor',
  recovering: 'Recovering contributor'
};

const PROFILE_OBJECTIVES = {
  high: [
    ['Lead critical module delivery', 'individual', 25, 5],
    ['Mentor and raise engineering standards', 'individual', 15, 1],
    ['Improve delivery quality', 'team', 30, -1],
    ['Automate reporting and analytics', 'subteam', 30, 3]
  ],
  medium: [
    ['Deliver assigned features predictably', 'individual', 25, 0],
    ['Improve documentation and handover quality', 'individual', 15, -6],
    ['Improve customer workflow reliability', 'team', 30, 2],
    ['Reduce escaped defects', 'subteam', 30, -3]
  ],
  low: [
    ['Complete assigned sprint commitments', 'individual', 25, -8],
    ['Improve technical ownership', 'individual', 15, -12],
    ['Contribute to service reliability', 'team', 30, 4],
    ['Reduce operational backlog', 'subteam', 30, -5]
  ],
  steady: [
    ['Deliver planned roadmap commitments', 'individual', 25, 0],
    ['Strengthen stakeholder communication', 'individual', 15, -2],
    ['Improve team delivery cadence', 'team', 30, 1],
    ['Increase platform quality coverage', 'subteam', 30, 2]
  ],
  recovering: [
    ['Rebuild delivery consistency', 'individual', 25, -3],
    ['Escalate blockers earlier', 'individual', 15, -6],
    ['Support service quality goals', 'team', 30, 2],
    ['Improve backlog predictability', 'subteam', 30, 1]
  ]
};

function clamp(value) {
  return Math.max(0, Math.min(100, Number(value)));
}

function stableNumber(value) {
  return String(value).split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
}

function dateAt(year, month, day, hour = 12) {
  return new Date(Date.UTC(year, month, day, hour, 0, 0));
}

function ratingForScore(score) {
  if (score >= 90) return 'exceptional';
  if (score >= 75) return 'strong';
  if (score >= 50) return 'meets_expectations';
  if (score >= 30) return 'needs_improvement';
  return 'unsatisfactory';
}

function decisionForScore(score) {
  if (score >= 90) return 'promotion';
  if (score >= 80) return 'bonus';
  if (score >= 65) return 'satisfactory';
  if (score >= 50) return 'training';
  return 'coaching';
}

function performanceStatusForScore(score) {
  if (score >= 85) return 'excellent_performance';
  if (score >= 60) return 'satisfactory';
  if (score >= 40) return 'needs_improvement';
  return 'critical_attention';
}

function profileForIndex(index) {
  if (index === 0) return 'high';
  if (index === 1) return 'medium';
  if (index === 2) return 'low';
  return ['high', 'medium', 'steady', 'recovering', 'low'][index % 5];
}

function taskStatusFor(profile, progress, taskIndex) {
  if (profile === 'high') return taskIndex < 4 ? 'done' : 'in_progress';
  if (profile === 'medium' || profile === 'steady') return taskIndex < 3 ? 'done' : taskIndex === 3 ? 'in_progress' : 'todo';
  if (profile === 'recovering') return progress >= 65 && taskIndex < 3 ? 'done' : taskIndex < 2 ? 'done' : 'in_progress';
  return taskIndex < 2 ? 'done' : taskIndex === 2 ? 'in_progress' : 'todo';
}

function buildCycle(year, createdBy) {
  const current = year === 2026;
  return {
    _id: new mongoose.Types.ObjectId(),
    name: `${year} Annual Performance Cycle`,
    year,
    status: current ? 'active' : 'closed',
    currentPhase: current ? 'phase3' : 'closed',
    phase1Start: dateAt(year, 0, 5),
    phase1End: dateAt(year, 1, 28),
    phase2Start: dateAt(year, 2, 1),
    phase2End: dateAt(year, 5, 30),
    phase3Start: dateAt(year, 6, 1),
    phase3End: dateAt(year, 11, 15),
    createdBy,
    createdAt: dateAt(year, 0, 2),
    updatedAt: current ? new Date() : dateAt(year, 11, 20)
  };
}

function assertNonProduction() {
  const nodeEnv = String(process.env.NODE_ENV || '').toLowerCase();
  const appEnv = String(process.env.APP_ENV || process.env.ENVIRONMENT || '').toLowerCase();
  const mongoUri = String(process.env.MONGO_URI || '').toLowerCase();
  const looksProd = ['production', 'prod'].includes(nodeEnv)
    || ['production', 'prod'].includes(appEnv)
    || mongoUri.includes('prod')
    || mongoUri.includes('production');
  if (looksProd) {
    throw new Error('Refusing to seed because the environment looks like production.');
  }
  return {
    NODE_ENV: process.env.NODE_ENV || '(unset)',
    APP_ENV: process.env.APP_ENV || process.env.ENVIRONMENT || '(unset)',
    database: mongoose.connection.name || '(unknown)'
  };
}

async function backupCollections() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(__dirname, '..', 'backups', `before-historical-demo-${timestamp}`);
  fs.mkdirSync(backupDir, { recursive: true });

  const manifest = {};
  for (const collectionName of COLLECTIONS_TO_BACKUP) {
    const collection = mongoose.connection.db.collection(collectionName);
    const documents = await collection.find({}).toArray();
    fs.writeFileSync(
      path.join(backupDir, `${collectionName}.ejson`),
      EJSON.stringify(documents, { relaxed: false }, 2),
      'utf8'
    );
    manifest[collectionName] = documents.length;
  }
  fs.writeFileSync(path.join(backupDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
  return { backupDir, manifest };
}

async function ensureDemoTeams(users, admin) {
  const leaders = users.filter((user) => user.role === 'TEAM_LEADER');
  const collaborators = users.filter((user) => user.role === 'COLLABORATOR');
  const fallbackLeader = leaders[0] || users.find((user) => !['ADMIN', 'HR'].includes(user.role)) || admin;
  const parent = await Team.findOneAndUpdate(
    { name: 'Digital Solutions' },
    {
      $set: {
        description: 'Demo parent team for product delivery, platform engineering, and AI analytics.',
        leader: fallbackLeader._id,
        members: collaborators.map((user) => user._id),
        parentTeam: null,
        createdBy: admin._id
      }
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean();

  const names = ['Frontend Squad', 'Backend Squad', 'AI & Analytics Squad'];
  const subteams = [];
  for (let index = 0; index < names.length; index += 1) {
    const squadMembers = collaborators.filter((_, memberIndex) => memberIndex % names.length === index);
    const leader = leaders[index % Math.max(leaders.length, 1)] || fallbackLeader;
    const subteam = await Team.findOneAndUpdate(
      { name: names[index] },
      {
        $set: {
          description: `${names[index]} delivery subteam for historical demo data.`,
          leader: leader._id,
          members: squadMembers.length ? squadMembers.map((user) => user._id) : collaborators.map((user) => user._id),
          parentTeam: parent._id,
          createdBy: admin._id
        }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();
    subteams.push(subteam);
  }

  return { parent, subteams };
}

function buildManagerComment(profile, year, score) {
  if (profile === 'high') {
    return `${year} performance shows strong ownership, measurable delivery quality, and positive influence on peers. Final score ${score} supports leadership or specialization readiness.`;
  }
  if (profile === 'low') {
    return `${year} performance requires closer follow-up. Delivery gaps were documented, and the next cycle needs structured coaching, clearer milestones, and monthly progress review.`;
  }
  if (profile === 'recovering') {
    return `${year} performance shows recovery signs with better communication and improving task completion. Continue structured check-ins to stabilize delivery.`;
  }
  return `${year} performance is dependable with some delays. Strengths are visible, and targeted training should improve execution consistency and stakeholder communication.`;
}

function buildAiDraft(profile, year, score) {
  const direction = profile === 'high' ? 'inclining high performance' : profile === 'low' ? 'declining with slight recovery risk' : 'stable to slightly improving';
  return `AI-assisted ${year} draft: weighted score ${score}, direction ${direction}. Recommendation generated from objective contribution, task completion, check-in consistency, and historical evaluation pattern.`;
}

function buildDocuments({ users, cycles, demoTeams, hrUser }) {
  const employees = users.filter((user) => !['ADMIN', 'HR'].includes(user.role));
  const objectives = [];
  const tasks = [];
  const checkins = [];
  const feedbacks = [];
  const finalEvaluations = [];
  const decisions = [];
  const recommendations = [];
  const careerPaths = [];
  const improvementPlans = [];
  const bonusPenalties = [];
  const meetings = [];
  const notifications = [];
  const profileSummary = {};

  const teamByEmployee = new Map();
  demoTeams.subteams.forEach((team) => {
    (team.members || []).forEach((memberId) => teamByEmployee.set(String(memberId), team));
    if (team.leader) teamByEmployee.set(String(team.leader), team);
  });

  employees.forEach((employee, employeeIndex) => {
    const seed = stableNumber(employee._id);
    const profile = profileForIndex(employeeIndex);
    const subteam = teamByEmployee.get(String(employee._id)) || demoTeams.subteams[employeeIndex % demoTeams.subteams.length];
    const managerId = employee.manager || subteam?.leader || demoTeams.parent.leader || hrUser._id;
    const scores = PROFILE_SCORES[profile];
    profileSummary[profile] = profileSummary[profile] || { label: PROFILE_LABELS[profile], employees: 0, scorePath: scores };
    profileSummary[profile].employees += 1;

    cycles.forEach((cycle, cycleIndex) => {
      const historical = cycle.year < 2026;
      const targetScore = scores[cycleIndex];
      const objectiveDefinitions = PROFILE_OBJECTIVES[profile];
      const breakdown = [];
      const employeeObjectiveIds = [];

      objectiveDefinitions.forEach(([title, scope, weight, offset], objectiveIndex) => {
        const progress = clamp(targetScore + offset + ((seed + cycleIndex + objectiveIndex) % 5) - 2);
        const objectiveId = new mongoose.Types.ObjectId();
        const category = scope === 'individual' ? 'individual' : 'team';
        const weightedPoints = Number(((weight * progress) / 100).toFixed(2));
        const teamForObjective = scope === 'team' ? demoTeams.parent : scope === 'subteam' ? subteam : null;
        const assignedUsers = scope === 'team'
          ? employees.map((user) => user._id)
          : scope === 'subteam'
            ? (subteam?.members || [employee._id])
            : [];

        objectives.push({
          _id: objectiveId,
          title: `${cycle.year} - ${title}`,
          dueDate: dateAt(cycle.year, 10, 30),
          description: `${PROFILE_LABELS[profile]} ${scope} objective for ${cycle.year}. Scope: ${scope}. Team: ${teamForObjective?.name || 'Individual'}.`,
          successIndicator: `Reach ${Math.max(55, Math.round(progress / 5) * 5)}% verified achievement with evidence and manager review.`,
          owner: employee._id,
          cycle: cycle._id,
          category,
          team: teamForObjective?._id || null,
          assignedUsers,
          weight,
          priority: profile === 'low' && objectiveIndex < 2 ? 'critical' : objectiveIndex === 0 ? 'high' : 'medium',
          achievementPercent: progress,
          selfAssessment: `Progress tracked through tasks, check-ins, and objective evidence.`,
          finalSelfAssessment: `Self-assessment: ${progress}% achieved. Key results and blockers were documented during ${cycle.year}.`,
          finalSelfRating: Math.max(1, Math.min(5, Math.round(progress / 20))),
          finalSelfPercent: progress,
          finalSelfSubmittedAt: dateAt(cycle.year, 9, 25 + objectiveIndex),
          managerAdjustedPercent: progress,
          managerComments: buildManagerComment(profile, cycle.year, targetScore),
          weightedScore: weightedPoints,
          status: historical ? 'evaluated' : 'approved',
          source: scope === 'individual' ? 'employee_created' : 'manager_assigned',
          assignedBy: scope === 'individual' ? null : managerId,
          submittedTo: managerId,
          submittedBy: employee._id,
          evaluatedBy: historical ? managerId : null,
          evaluatedAt: historical ? dateAt(cycle.year, 11, 8) : null,
          evaluationRating: progress >= 90 ? 'exceeded' : progress >= 75 ? 'met' : progress >= 45 ? 'partially_met' : 'not_met',
          evaluationNumericRating: Math.max(1, Math.min(5, Math.round(progress / 20))),
          evaluationComment: `Confirmed from ${scope} contribution evidence. Weight impact for this employee is ${weight}%, not divided by member count.`,
          labels: [`demo:${profile}`, `scope:${scope}`, `team:${teamForObjective?.name || 'individual'}`],
          visibility: scope === 'individual' ? 'private' : 'team',
          kpis: [
            {
              title: `${scope} achievement`,
              metricType: 'percent',
              initialValue: 0,
              targetValue: 100,
              currentValue: progress,
              unit: '%',
              status: progress >= 95 ? 'completed' : 'in_progress'
            }
          ],
          progressUpdates: [
            { user: employee._id, message: 'Goals set and success measures agreed.', createdAt: dateAt(cycle.year, 1, 10) },
            { user: employee._id, message: 'Mid-year progress and blockers documented.', createdAt: dateAt(cycle.year, 5, 20) }
          ],
          activityLog: [
            { user: employee._id, action: 'submitted', details: 'Objective submitted for manager approval.', toStatus: 'pending', createdAt: dateAt(cycle.year, 0, 25) },
            { user: managerId, action: 'approved', details: 'Objective approved for the annual cycle.', fromStatus: 'pending', toStatus: 'approved', createdAt: dateAt(cycle.year, 1, 5) }
          ],
          createdAt: dateAt(cycle.year, 0, 15 + objectiveIndex),
          updatedAt: dateAt(cycle.year, 10, 15)
        });
        employeeObjectiveIds.push(objectiveId);
        breakdown.push({
          objective_id: objectiveId,
          title: `${cycle.year} - ${title}`,
          category: scope,
          weight,
          employee_achievement: progress,
          manager_confirmed_achievement: progress,
          achievement_used: progress,
          weighted_points: weightedPoints,
          status: historical ? 'evaluated' : 'approved'
        });

        for (let taskIndex = 0; taskIndex < 5; taskIndex += 1) {
          const status = taskStatusFor(profile, progress, taskIndex);
          const dueMonth = 2 + taskIndex * 2;
          const dueDate = dateAt(cycle.year, Math.min(dueMonth, 10), 20);
          const completedAt = status === 'done'
            ? dateAt(cycle.year, Math.min(dueMonth, 10), profile === 'low' && taskIndex === 1 ? 26 : 18)
            : null;
          const trackedSeconds = status === 'done' ? (6 + taskIndex + (seed % 4)) * 3600 : (2 + taskIndex) * 1800;
          tasks.push({
            _id: new mongoose.Types.ObjectId(),
            title: `${title} milestone ${taskIndex + 1}`,
            description: `${cycle.year} ${scope} milestone linked to weighted objective contribution.`,
            assignee: employee._id,
            assignedBy: managerId,
            status,
            workflowStage: status === 'done' ? 'completed' : status === 'in_progress' ? 'in_progress' : 'todo',
            progress: status === 'done' ? 100 : status === 'in_progress' ? Math.max(20, progress - 35) : 0,
            priority: taskIndex === 0 ? 'high' : profile === 'low' && taskIndex > 2 ? 'urgent' : 'medium',
            dueDate,
            completedAt,
            linkedGoal: objectiveId,
            objective_id: objectiveId,
            phase: taskIndex < 2 ? 1 : taskIndex < 4 ? 2 : 3,
            team: teamForObjective?._id || subteam?._id || null,
            notes: status === 'todo' ? 'Pending follow-up; visible in overdue graphs when past due.' : 'Demo task with realistic progress tracking.',
            totalTimeSpent: trackedSeconds,
            totalTrackedTime: trackedSeconds,
            timeTracking: {
              totalSeconds: trackedSeconds,
              lastTrackedAt: status === 'done' ? completedAt : dateAt(cycle.year, 8, 10),
              sessions: [{
                startedAt: dateAt(cycle.year, 3, 10 + taskIndex, 9),
                endedAt: dateAt(cycle.year, 3, 10 + taskIndex, 11),
                durationSeconds: Math.min(trackedSeconds, 7200),
                focusMode: taskIndex % 2 === 0,
                source: 'timer',
                notes: 'Historical focus session'
              }]
            },
            createdAt: dateAt(cycle.year, 1, 5 + taskIndex),
            updatedAt: status === 'done' ? completedAt : dateAt(cycle.year, 8, 15)
          });
        }

        const checkinCount = profile === 'low' ? 2 : profile === 'medium' ? 3 : 4;
        for (let checkinIndex = 0; checkinIndex < checkinCount; checkinIndex += 1) {
          const progressAtCheckin = clamp(progress * ((checkinIndex + 1) / checkinCount));
          const approved = !(profile === 'low' && checkinIndex === 0 && progressAtCheckin < 30);
          checkins.push({
            _id: new mongoose.Types.ObjectId(),
            objective_id: objectiveId,
            employee_id: employee._id,
            cycle_id: cycle._id,
            status: approved ? 'approved' : 'pending_review',
            manager_feedback: approved ? 'Progress reviewed against milestone evidence.' : 'More detail required on blocker resolution and next steps.',
            manager_id: managerId,
            reviewedBy: approved ? managerId : null,
            reviewedAt: approved ? dateAt(cycle.year, 3 + checkinIndex * 2, 16) : null,
            progress_percent: Number(progressAtCheckin.toFixed(1)),
            notes: profile === 'low' && checkinIndex === 0 ? 'Blockers raised late; coaching follow-up required.' : `Checkpoint ${checkinIndex + 1}: progress, blockers, and evidence documented.`,
            priority: progressAtCheckin < 45 ? 'high' : 'medium',
            history: [{
              submitted_at: dateAt(cycle.year, 3 + checkinIndex * 2, 15),
              content: 'Historical progress update submitted.',
              status: approved ? 'approved' : 'pending_review',
              manager_feedback: approved ? 'Approved.' : 'Needs stronger evidence.'
            }],
            submitted_at: dateAt(cycle.year, 3 + checkinIndex * 2, 15),
            last_edited_at: dateAt(cycle.year, 3 + checkinIndex * 2, 15),
            createdAt: dateAt(cycle.year, 3 + checkinIndex * 2, 15),
            updatedAt: dateAt(cycle.year, 3 + checkinIndex * 2, 16)
          });
        }
      });

      const finalScore = Number(breakdown.reduce((sum, item) => sum + item.weighted_points, 0).toFixed(2));
      const managerScore = profile === 'medium' && cycle.year === 2024 ? finalScore + 2 : finalScore;
      const evaluationId = new mongoose.Types.ObjectId();
      const status = historical ? 'closed' : profile === 'low' ? 'pending_hr' : 'validated';
      const employeeTasks = tasks.filter((task) => String(task.assignee) === String(employee._id) && task.createdAt.getUTCFullYear() === cycle.year);
      const completedTaskCount = employeeTasks.filter((task) => task.status === 'done').length;
      const employeeCheckins = checkins.filter((checkin) => String(checkin.employee_id) === String(employee._id) && String(checkin.cycle_id) === String(cycle._id));
      const approvedCheckins = employeeCheckins.filter((checkin) => checkin.status === 'approved').length;

      finalEvaluations.push({
        _id: evaluationId,
        employee_id: employee._id,
        cycle_id: cycle._id,
        auto_score: finalScore,
        manager_score: Number(managerScore.toFixed(2)),
        final_score: Number(managerScore.toFixed(2)),
        rating_label: ratingForScore(managerScore),
        score_difference: Number((managerScore - finalScore).toFixed(2)),
        manager_adjustment_justification: managerScore !== finalScore ? 'Manager adjusted score after reviewing additional delivery evidence and customer feedback.' : '',
        objective_weight_total: 100,
        objective_score_normalized: false,
        objective_breakdown: breakdown,
        evidence_summary: {
          tasks: {
            total: employeeTasks.length,
            completed: completedTaskCount,
            completion_rate: employeeTasks.length ? Number(((completedTaskCount / employeeTasks.length) * 100).toFixed(1)) : 0
          },
          checkins: {
            total: employeeCheckins.length,
            approved: approvedCheckins,
            approval_rate: employeeCheckins.length ? Number(((approvedCheckins / employeeCheckins.length) * 100).toFixed(1)) : 0,
            average_progress: employeeCheckins.length ? Number((employeeCheckins.reduce((sum, item) => sum + item.progress_percent, 0) / employeeCheckins.length).toFixed(1)) : 0
          }
        },
        consistency_warnings: profile === 'low' ? ['Irregular check-in cadence', 'Several delayed or incomplete tasks'] : [],
        ai_assisted: true,
        ai_draft_generated_at: dateAt(cycle.year, 11, 10),
        ai_reviewed_by_manager: true,
        strengths: profile === 'high'
          ? ['Consistent objective overachievement', 'Strong team contribution', 'Mentoring impact']
          : profile === 'low'
            ? ['Engaged with the improvement process', 'Some recovery visible in latest cycle']
            : ['Reliable delivery on priority work', 'Constructive collaboration'],
        weaknesses: profile === 'low'
          ? ['Execution consistency', 'Progress communication', 'Deadline reliability']
          : profile === 'medium'
            ? ['Earlier risk escalation', 'Documentation consistency']
            : ['Broaden strategic influence'],
        improvement_suggestions: profile === 'high'
          ? ['Prepare for expanded leadership ownership', 'Continue mentoring and knowledge sharing']
          : profile === 'low'
            ? ['Monthly coaching plan', 'Weekly milestone review', 'Clearer blocker escalation']
            : ['Targeted technical training', 'Improve planning and communication rhythm'],
        manager_comments: `${buildManagerComment(profile, cycle.year, managerScore)} ${buildAiDraft(profile, cycle.year, managerScore)}`,
        recommendation: managerScore >= 88 ? 'promotion' : managerScore >= 75 ? 'bonus_eligible' : managerScore < 55 ? 'performance_improvement_plan' : 'no_action',
        evaluator_id: managerId,
        evaluator_role: 'TEAM_LEADER',
        evaluated_at: dateAt(cycle.year, 11, 12),
        status,
        hr_validated_by: ['validated', 'closed'].includes(status) ? hrUser._id : null,
        hr_validated_at: ['validated', 'closed'].includes(status) ? dateAt(cycle.year, 11, 15) : null,
        hr_review_notes: profile === 'low'
          ? 'HR reviewed documentation and requested improvement-plan follow-up.'
          : profile === 'high'
            ? 'HR validated consistency and bonus/promotion documentation.'
            : 'HR validated completeness and development recommendations.',
        hr_return_reason: profile === 'medium' && cycle.year === 2024 ? 'Returned once for clearer manager adjustment justification, then validated.' : '',
        workflow_history: [
          { action: 'submitted', performed_by: managerId, performed_at: dateAt(cycle.year, 11, 12) },
          ...(profile === 'medium' && cycle.year === 2024 ? [{ action: 'sent_back', reason: 'Clarify manager score adjustment.', performed_by: hrUser._id, performed_at: dateAt(cycle.year, 11, 13) }] : []),
          ...(['validated', 'closed'].includes(status) ? [{ action: 'validated', performed_by: hrUser._id, performed_at: dateAt(cycle.year, 11, 15) }] : [])
        ],
        performance_status: ['validated', 'closed'].includes(status) ? performanceStatusForScore(managerScore) : null,
        hr_decision: historical ? {
          action: managerScore >= 88 ? 'promotion' : managerScore >= 75 ? 'bonus' : managerScore < 55 ? 'pip' : 'no_action',
          notes: 'HR action selected after completeness and consistency review.',
          decided_by: hrUser._id,
          decided_at: dateAt(cycle.year, 11, 16)
        } : undefined,
        employee_feedback: {
          acknowledged: historical,
          comment: historical ? 'Acknowledged after final review discussion.' : '',
          acknowledged_at: historical ? dateAt(cycle.year, 11, 18) : null,
          updated_at: historical ? dateAt(cycle.year, 11, 18) : null
        },
        createdAt: dateAt(cycle.year, 11, 10),
        updatedAt: dateAt(cycle.year, 11, 15)
      });

      feedbacks.push({
        _id: new mongoose.Types.ObjectId(),
        sender: managerId,
        recipient: employee._id,
        type: managerScore >= 75 ? 'praise' : 'suggestion',
        message: managerScore >= 75
          ? 'Strong delivery and visible contribution to team goals this cycle.'
          : 'Focus on predictable delivery, earlier blocker escalation, and documented progress.',
        visibility: 'private',
        cycle_id: cycle._id,
        rating: Math.max(1, Math.min(5, Math.round(managerScore / 20))),
        status: 'active',
        createdAt: dateAt(cycle.year, 8, 20),
        updatedAt: dateAt(cycle.year, 8, 20)
      });

      meetings.push({
        _id: new mongoose.Types.ObjectId(),
        title: `${cycle.year} ${employee.name || employee.email} performance review`,
        description: 'Historical demo performance review meeting.',
        organizer: managerId,
        attendees: [employee._id, managerId],
        participants: [employee._id, managerId, hrUser._id],
        meeting_type: historical ? 'final-evaluation' : 'mid-year-review',
        cycle_id: cycle._id,
        employee_id: employee._id,
        final_evaluation_id: evaluationId,
        date: historical ? dateAt(cycle.year, 11, 14, 10) : dateAt(cycle.year, 6, 10, 10),
        startTime: '10:00',
        endTime: '10:45',
        type: 'review',
        status: historical ? 'completed' : 'scheduled',
        agenda: [
          { title: 'Review objective progress', duration: 15, presenter: employee._id, completed: historical },
          { title: 'Confirm manager assessment', duration: 15, presenter: managerId, completed: historical },
          { title: 'Agree development follow-up', duration: 15, presenter: hrUser._id, completed: historical }
        ],
        notes: 'Demo meeting linked to evaluation history and calendar views.',
        relatedObjectives: employeeObjectiveIds,
        team: subteam?._id || demoTeams.parent._id,
        recurring: 'none',
        location: 'Teams',
        actionItems: [
          { title: 'Document development actions', assignee: managerId, dueDate: dateAt(cycle.year, 11, 20), completed: historical }
        ],
        createdAt: dateAt(cycle.year, 10, 20),
        updatedAt: dateAt(cycle.year, 11, 14)
      });

      notifications.push({
        _id: new mongoose.Types.ObjectId(),
        recipient: employee._id,
        sender: managerId,
        type: historical ? 'FINAL_EVALUATION_COMPLETED' : 'MEETING_INVITE',
        title: historical ? `${cycle.year} final evaluation completed` : `${cycle.year} review meeting scheduled`,
        message: historical ? 'Your final evaluation report is available for acknowledgement.' : 'A performance review meeting has been scheduled.',
        link: historical ? '/final-evaluation/report' : '/meetings',
        isRead: historical,
        createdAt: historical ? dateAt(cycle.year, 11, 16) : dateAt(cycle.year, 6, 1)
      });

      if (historical) {
        const decisionId = new mongoose.Types.ObjectId();
        decisions.push({
          _id: decisionId,
          user: employee._id,
          cycle: cycle._id,
          finalEvaluation: evaluationId,
          individualScore: Number(breakdown.filter((item) => item.category === 'individual').reduce((sum, item) => sum + item.weighted_points, 0).toFixed(2)),
          teamScore: Number(breakdown.filter((item) => item.category !== 'individual').reduce((sum, item) => sum + item.weighted_points, 0).toFixed(2)),
          finalScore: managerScore,
          action: decisionForScore(managerScore),
          actionLabel: decisionForScore(managerScore).replace(/_/g, ' '),
          decidedBy: hrUser._id,
          decidedAt: dateAt(cycle.year, 11, 16),
          notes: profile === 'low'
            ? 'HR confirmed improvement follow-up is documented. No penalty is automatic from score alone.'
            : 'HR confirmed completeness, consistency, and career or reward documentation.',
          createdAt: dateAt(cycle.year, 11, 16)
        });

        if (cycle.year === 2025 && (managerScore >= 75 || profile === 'low')) {
          if (managerScore >= 75) {
            bonusPenalties.push({
              _id: new mongoose.Types.ObjectId(),
              employee: employee._id,
              assignedBy: hrUser._id,
              type: 'bonus',
              value: managerScore >= 90 ? 1200 : 700,
              reason: 'Approved recognition linked to validated annual evaluation and HR decision.',
              finalEvaluation: evaluationId,
              hrDecision: decisionId,
              objective: breakdown[0]?.objective_id || null,
              approvalStatus: 'approved',
              reviewNotes: 'Bonus value is positive and documented against final evaluation evidence.',
              reviewedBy: hrUser._id,
              reviewedAt: dateAt(2025, 11, 18),
              paymentDate: dateAt(2026, 0, 31),
              createdAt: dateAt(2025, 11, 18)
            });
          } else {
            bonusPenalties.push({
              _id: new mongoose.Types.ObjectId(),
              employee: employee._id,
              assignedBy: hrUser._id,
              type: 'penalty',
              value: 100,
              reason: 'Documented missed handover incident reviewed by HR; not generated automatically from low score.',
              finalEvaluation: evaluationId,
              hrDecision: decisionId,
              objective: breakdown[0]?.objective_id || null,
              approvalStatus: 'approved',
              reviewNotes: 'Penalty has explicit incident rationale and HR approval.',
              reviewedBy: hrUser._id,
              reviewedAt: dateAt(2025, 11, 18),
              createdAt: dateAt(2025, 11, 18)
            });
          }
        }
      }

      if (cycle.year === 2025) {
        recommendations.push({
          _id: new mongoose.Types.ObjectId(),
          employee_id: employee._id,
          cycle_id: cycle._id,
          suggested_path: profile === 'high' ? 'Accelerated Leadership Track' : profile === 'low' ? 'Core Competency Reinforcement' : 'Focused Capability Development',
          skills_to_develop: profile === 'high'
            ? ['Strategic leadership', 'Advanced mentoring', 'Cross-team influence']
            : profile === 'low'
              ? ['Delivery ownership', 'Progress communication', 'Planning discipline']
              : ['Technical depth', 'Stakeholder communication', 'Documentation quality'],
          source: 'manager',
          basis: `Based on validated ${cycle.year} evaluation, AI-assisted draft, and HR follow-up.`,
          createdAt: dateAt(2025, 11, 17),
          updatedAt: dateAt(2025, 11, 17)
        });
      }

      if (cycle.year === 2025 && profile === 'low') {
        improvementPlans.push({
          _id: new mongoose.Types.ObjectId(),
          evaluation_id: evaluationId,
          employee_id: employee._id,
          cycle_id: cycle._id,
          objective_goal: 'Improve delivery consistency and progress visibility',
          deadline: dateAt(2026, 2, 31),
          expected_outcome: 'Reach at least 70% objective progress with monthly reviewed check-ins.',
          notes: 'Created from HR-reviewed final evaluation. Penalty, if present, is incident-linked and not automatic.',
          progress_status: 'in_progress',
          created_by: hrUser._id,
          updated_by: managerId,
          createdAt: dateAt(2025, 11, 18),
          updatedAt: dateAt(2026, 0, 15)
        });
      }
    });

    const latestEvaluation = finalEvaluations.find((evaluation) => String(evaluation.employee_id) === String(employee._id) && evaluation.cycle_id === cycles[3]._id);
    careerPaths.push({
      _id: new mongoose.Types.ObjectId(),
      user: employee._id,
      currentRole: employee.role === 'TEAM_LEADER' ? 'Team Leader' : 'Collaborator',
      currentLevel: profile === 'high' ? 'advanced' : 'intermediate',
      targetRole: profile === 'high' ? 'Engineering Lead / Principal Specialist' : profile === 'low' ? 'Reliable Core Contributor' : 'Senior Specialist',
      targetLevel: profile === 'high' ? 'expert' : 'advanced',
      targetDate: dateAt(2027, 5, 30),
      developmentPlan: [
        {
          title: profile === 'high' ? 'Leadership acceleration program' : profile === 'low' ? 'Delivery ownership coaching' : 'Targeted technical training',
          type: profile === 'high' ? 'mentoring' : 'training',
          status: profile === 'high' ? 'completed' : profile === 'low' ? 'in_progress' : 'planned',
          dueDate: dateAt(2026, 8, 30),
          completedAt: profile === 'high' ? dateAt(2026, 5, 15) : null,
          notes: 'Development action linked to historical performance trend.',
          createdFromEvaluation: latestEvaluation?._id || null
        },
        {
          title: 'Apply learning through stretch project',
          type: 'project',
          status: profile === 'low' ? 'overdue' : 'in_progress',
          dueDate: profile === 'low' ? dateAt(2026, 4, 30) : dateAt(2026, 11, 15),
          notes: 'Provides dashboard diversity across planned, in-progress, completed, and overdue actions.',
          createdFromEvaluation: latestEvaluation?._id || null
        },
        {
          title: 'Quarterly mentoring checkpoint',
          type: 'mentoring',
          status: employeeIndex % 4 === 0 ? 'cancelled' : 'planned',
          dueDate: dateAt(2026, 10, 15),
          notes: 'Career follow-up action for demo pipeline variety.',
          createdFromEvaluation: latestEvaluation?._id || null
        }
      ],
      finalEvaluation: latestEvaluation?._id || null,
      mentorId: managerId,
      status: 'active',
      notes: `Career path for ${PROFILE_LABELS[profile]} with realistic development follow-up.`,
      createdBy: hrUser._id,
      createdAt: dateAt(2026, 0, 20),
      updatedAt: dateAt(2026, 5, 1)
    });
  });

  return {
    objectives,
    tasks,
    checkins,
    feedbacks,
    finalEvaluations,
    decisions,
    recommendations,
    careerPaths,
    improvementPlans,
    bonusPenalties,
    meetings,
    notifications,
    profileSummary
  };
}

async function collectCounts() {
  const counts = {};
  for (const collectionName of COLLECTIONS_TO_REPLACE) {
    counts[collectionName] = await mongoose.connection.db.collection(collectionName).countDocuments();
  }
  return counts;
}

async function insertGeneratedDocuments(docs) {
  const inserts = [
    [Objective, docs.objectives],
    [Task, docs.tasks],
    [CheckIn, docs.checkins],
    [Feedback, docs.feedbacks],
    [FinalEvaluation, docs.finalEvaluations],
    [HRDecision, docs.decisions],
    [CareerRecommendation, docs.recommendations],
    [CareerPath, docs.careerPaths],
    [ImprovementPlan, docs.improvementPlans],
    [BonusPenalty, docs.bonusPenalties],
    [Meeting, docs.meetings],
    [Notification, docs.notifications]
  ];
  for (const [Model, documents] of inserts) {
    if (documents.length) await Model.collection.insertMany(documents);
  }
}

async function main() {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI is required.');
  await mongoose.connect(process.env.MONGO_URI);
  const environment = assertNonProduction();

  const users = await User.find({ isDeleted: { $ne: true }, isActive: { $ne: false } })
    .select('_id name email role team manager profileImage')
    .sort({ role: 1, name: 1, email: 1 })
    .lean();
  const hrUser = users.find((user) => user.role === 'HR') || users.find((user) => user.role === 'ADMIN') || users[0];
  const employees = users.filter((user) => !['ADMIN', 'HR'].includes(user.role));
  if (!users.length || !employees.length || !hrUser) {
    throw new Error('Seed requires existing active users, including at least one non-HR/admin employee.');
  }

  const counts = await collectCounts();
  const existingTeams = await Team.countDocuments({});
  const cycles = YEARS.map((year) => buildCycle(year, hrUser._id));

  const dryRunTeams = {
    parent: { _id: new mongoose.Types.ObjectId(), name: 'Digital Solutions', leader: hrUser._id, members: employees.map((user) => user._id) },
    subteams: ['Frontend Squad', 'Backend Squad', 'AI & Analytics Squad'].map((name) => ({ _id: new mongoose.Types.ObjectId(), name, leader: hrUser._id, members: employees.map((user) => user._id) }))
  };

  if (DRY_RUN) {
    const docs = buildDocuments({ users, cycles, demoTeams: dryRunTeams, hrUser });
    const planned = {
      cycles: cycles.length,
      teamsExisting: existingTeams,
      demoTeamsUpserted: 4,
      usersPreserved: users.length,
      objectives: docs.objectives.length,
      tasks: docs.tasks.length,
      checkins: docs.checkins.length,
      feedbacks: docs.feedbacks.length,
      finalEvaluations: docs.finalEvaluations.length,
      hrDecisions: docs.decisions.length,
      bonusPenalties: docs.bonusPenalties.length,
      careerRecommendations: docs.recommendations.length,
      careerPaths: docs.careerPaths.length,
      improvementPlans: docs.improvementPlans.length,
      meetings: docs.meetings.length,
      notifications: docs.notifications.length
    };

    console.log(JSON.stringify({
      mode: 'dry-run',
      environment,
      usersPreserved: users.length,
      usersDeleted: 0,
      collectionsToClear: counts,
      plannedCreates: planned,
      performanceProfiles: docs.profileSummary
    }, null, 2));
    console.log('Dry run complete. No data was changed.');
    await mongoose.disconnect();
    return;
  }

  const backup = await backupCollections();
  console.log(`Backup created: ${backup.backupDir}`);

  const demoTeams = await ensureDemoTeams(users, hrUser);
  const docs = buildDocuments({ users, cycles, demoTeams, hrUser });
  const planned = {
    cycles: cycles.length,
    teamsExisting: existingTeams,
    demoTeamsUpserted: 4,
    usersPreserved: users.length,
    objectives: docs.objectives.length,
    tasks: docs.tasks.length,
    checkins: docs.checkins.length,
    feedbacks: docs.feedbacks.length,
    finalEvaluations: docs.finalEvaluations.length,
    hrDecisions: docs.decisions.length,
    bonusPenalties: docs.bonusPenalties.length,
    careerRecommendations: docs.recommendations.length,
    careerPaths: docs.careerPaths.length,
    improvementPlans: docs.improvementPlans.length,
    meetings: docs.meetings.length,
    notifications: docs.notifications.length
  };

  console.log(JSON.stringify({
    mode: 'apply',
    environment,
    usersPreserved: users.length,
    usersDeleted: 0,
    collectionsToClear: counts,
    plannedCreates: planned,
    performanceProfiles: docs.profileSummary
  }, null, 2));

  const hrDecisionCollection = mongoose.connection.db.collection('hrdecisions');
  const hrDecisionIndexes = await hrDecisionCollection.indexes();
  if (hrDecisionIndexes.some((index) => index.name === 'collaborator_1_cycle_1')) {
    await hrDecisionCollection.dropIndex('collaborator_1_cycle_1');
    console.log('Removed obsolete HRDecision collaborator/cycle index.');
  }

  for (const collectionName of COLLECTIONS_TO_REPLACE) {
    await mongoose.connection.db.collection(collectionName).deleteMany({});
  }
  await Cycle.collection.insertMany(cycles);
  await insertGeneratedDocuments(docs);

  console.log(JSON.stringify({
    status: 'Historical demo data created',
    backupDir: backup.backupDir,
    created: planned,
    usersPreserved: users.length,
    usersDeleted: 0
  }, null, 2));

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error('Historical demo seed failed:', error.message);
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
});
