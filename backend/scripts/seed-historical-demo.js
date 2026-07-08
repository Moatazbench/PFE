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

const APPLY = process.argv.includes('--apply');
const COLLECTIONS_TO_REPLACE = [
  'cycles', 'objectives', 'tasks', 'checkins', 'feedbacks', 'finalevaluations',
  'hrdecisions', 'bonuspenalties', 'careerrecommendations', 'careerpaths',
  'improvementplans', 'evaluations', 'meetings', 'correctionrequests',
  'notifications', 'auditlogs'
];

function clamp(value) {
  return Math.max(0, Math.min(100, Number(value)));
}

function stableNumber(value) {
  return String(value).split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
}

function ratingForScore(score) {
  if (score >= 90) return 'exceptional';
  if (score >= 75) return 'strong';
  if (score >= 50) return 'meets_expectations';
  if (score >= 30) return 'needs_improvement';
  return 'unsatisfactory';
}

function decisionForScore(score) {
  if (score >= 90) return 'reward';
  if (score >= 82) return 'promotion';
  if (score >= 72) return 'bonus';
  if (score >= 55) return 'satisfactory';
  if (score >= 40) return 'coaching';
  return 'training';
}

function performanceStatusForScore(score) {
  if (score >= 85) return 'excellent_performance';
  if (score >= 60) return 'satisfactory';
  if (score >= 40) return 'needs_improvement';
  return 'critical_attention';
}

function dateAt(year, month, day) {
  return new Date(Date.UTC(year, month, day, 12, 0, 0));
}

async function backupCollections() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(__dirname, '..', 'backups', `before-historical-demo-${timestamp}`);
  fs.mkdirSync(backupDir, { recursive: true });

  const manifest = {};
  for (const collectionName of COLLECTIONS_TO_REPLACE) {
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

function buildCycle(year) {
  const current = year === 2026;
  return {
    _id: new mongoose.Types.ObjectId(),
    name: `${year} Performance Cycle`,
    year,
    status: current ? 'active' : 'closed',
    currentPhase: current ? 'phase3' : 'closed',
    phase1Start: dateAt(year, 0, 5),
    phase1End: dateAt(year, 1, 28),
    phase2Start: dateAt(year, 2, 1),
    phase2End: dateAt(year, 3, 30),
    phase3Start: dateAt(year, 4, 1),
    phase3End: dateAt(year, 11, 15),
    createdAt: dateAt(year, 0, 2),
    updatedAt: current ? new Date() : dateAt(year, 11, 20)
  };
}

async function main() {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI is required.');
  await mongoose.connect(process.env.MONGO_URI);

  const [users, teams] = await Promise.all([
    User.find({ isDeleted: false, isActive: true }).select('_id name email role team manager').lean(),
    Team.find({}).select('_id name leader members parentTeam').lean()
  ]);
  const employees = users.filter((user) => user.role !== 'ADMIN');
  const administrators = users.filter((user) => ['ADMIN', 'HR'].includes(user.role));
  const defaultDecisionMaker = administrators[0] || users[0];
  if (!employees.length || !defaultDecisionMaker) throw new Error('Seed requires existing active users.');

  const counts = {};
  for (const collectionName of COLLECTIONS_TO_REPLACE) {
    counts[collectionName] = await mongoose.connection.db.collection(collectionName).countDocuments();
  }
  console.log('Existing records:', counts);
  console.log(`Will preserve ${users.length} active users and ${teams.length} teams.`);

  if (!APPLY) {
    console.log('Dry run complete. Re-run with --apply to back up and replace performance data.');
    await mongoose.disconnect();
    return;
  }

  const backup = await backupCollections();
  console.log(`Backup created: ${backup.backupDir}`);

  const hrDecisionCollection = mongoose.connection.db.collection('hrdecisions');
  const hrDecisionIndexes = await hrDecisionCollection.indexes();
  if (hrDecisionIndexes.some((index) => index.name === 'collaborator_1_cycle_1')) {
    await hrDecisionCollection.dropIndex('collaborator_1_cycle_1');
    console.log('Removed obsolete HRDecision collaborator/cycle index.');
  }

  for (const collectionName of COLLECTIONS_TO_REPLACE) {
    await mongoose.connection.db.collection(collectionName).deleteMany({});
  }

  const cycles = [2022, 2023, 2024, 2025, 2026].map(buildCycle);
  await Cycle.collection.insertMany(cycles);

  const teamByMember = new Map();
  teams.forEach((team) => {
    (team.members || []).forEach((memberId) => teamByMember.set(String(memberId), team));
    if (team.leader) teamByMember.set(String(team.leader), team);
  });

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

  for (const [employeeIndex, employee] of employees.entries()) {
    const seed = stableNumber(employee._id);
    const needsSupportProfile = employeeIndex % 7 === 0;
    const personalTrend = needsSupportProfile ? 1 : (seed % 7) - 2;
    const baseScore = needsSupportProfile ? 40 + (seed % 4) : 52 + (seed % 32);
    const team = teamByMember.get(String(employee._id)) || teams[seed % Math.max(teams.length, 1)] || null;
    const managerId = employee.manager || team?.leader || defaultDecisionMaker._id;
    const assignedUsers = team?.members || [employee._id];

    for (let cycleIndex = 0; cycleIndex < cycles.length; cycleIndex += 1) {
      const cycle = cycles[cycleIndex];
      const historical = cycle.year < 2026;
      const yearlyScore = clamp(baseScore + personalTrend * cycleIndex + ((cycleIndex % 2) ? 2 : 0));
      const objectiveDefinitions = [
        { title: 'Deliver strategic business outcomes', category: 'individual', weight: 40, offset: 4 },
        { title: 'Improve quality and execution reliability', category: 'individual', weight: 35, offset: -3 },
        { title: `Contribute to ${team?.name || 'team'} performance`, category: 'team', weight: 25, offset: 1 }
      ];
      const breakdown = [];

      for (let objectiveIndex = 0; objectiveIndex < objectiveDefinitions.length; objectiveIndex += 1) {
        const definition = objectiveDefinitions[objectiveIndex];
        const progress = clamp(yearlyScore + definition.offset + ((seed + objectiveIndex + cycleIndex) % 7) - 3);
        const objectiveId = new mongoose.Types.ObjectId();
        const weightedPoints = Number(((definition.weight * progress) / 100).toFixed(2));
        objectives.push({
          _id: objectiveId,
          title: definition.title,
          description: `Measurable ${cycle.year} objective based on role responsibilities and recorded delivery.`,
          successIndicator: `Reach at least ${Math.max(60, Math.round(progress / 5) * 5)}% verified achievement by cycle end.`,
          owner: employee._id,
          cycle: cycle._id,
          category: definition.category,
          team: definition.category === 'team' ? team?._id || null : null,
          assignedUsers: definition.category === 'team' ? assignedUsers : [],
          weight: definition.weight,
          priority: objectiveIndex === 0 ? 'high' : 'medium',
          achievementPercent: progress,
          finalSelfAssessment: `Delivered ${progress}% of the expected outcome with documented milestones and regular progress updates.`,
          finalSelfRating: Math.max(1, Math.min(5, Math.round(progress / 20))),
          finalSelfPercent: progress,
          finalSelfSubmittedAt: dateAt(cycle.year, 10, 10 + objectiveIndex),
          managerAdjustedPercent: progress,
          managerComments: `Achievement confirmed from objective evidence, completed work, and check-in history.`,
          weightedScore: weightedPoints,
          status: historical ? 'evaluated' : 'approved',
          evaluationRating: progress >= 100 ? 'exceeded' : progress >= 75 ? 'met' : progress >= 40 ? 'partially_met' : 'not_met',
          evaluationComment: 'Manager-confirmed achievement based on submitted evidence.',
          evaluatedBy: managerId,
          evaluatedAt: historical ? dateAt(cycle.year, 11, 10) : null,
          createdAt: dateAt(cycle.year, 0, 15 + objectiveIndex),
          updatedAt: dateAt(cycle.year, 10, 15)
        });
        breakdown.push({
          objective_id: objectiveId,
          title: definition.title,
          category: definition.category,
          weight: definition.weight,
          employee_achievement: progress,
          manager_confirmed_achievement: progress,
          achievement_used: progress,
          weighted_points: weightedPoints,
          status: historical ? 'evaluated' : 'approved'
        });

        for (let taskIndex = 0; taskIndex < 4; taskIndex += 1) {
          const completionThreshold = Math.round(progress / 25);
          const completed = taskIndex < completionThreshold;
          tasks.push({
            _id: new mongoose.Types.ObjectId(),
            title: `${definition.title} – milestone ${taskIndex + 1}`,
            description: `Cycle ${cycle.year} delivery milestone.`,
            assignee: employee._id,
            assignedBy: managerId,
            status: completed ? 'done' : taskIndex === completionThreshold ? 'in_progress' : 'todo',
            workflowStage: completed ? 'completed' : taskIndex === completionThreshold ? 'in_progress' : 'todo',
            progress: completed ? 100 : taskIndex === completionThreshold ? Math.max(20, progress - 40) : 0,
            priority: taskIndex === 0 ? 'high' : 'medium',
            dueDate: dateAt(cycle.year, 2 + taskIndex * 2, 20),
            completedAt: completed ? dateAt(cycle.year, 2 + taskIndex * 2, 18) : null,
            linkedGoal: objectiveId,
            objective_id: objectiveId,
            team: team?._id || null,
            createdAt: dateAt(cycle.year, 1, 5 + taskIndex),
            updatedAt: dateAt(cycle.year, 9, 20)
          });
        }

        for (let checkinIndex = 0; checkinIndex < 3; checkinIndex += 1) {
          const progressAtCheckin = clamp(progress * ((checkinIndex + 1) / 3));
          checkins.push({
            _id: new mongoose.Types.ObjectId(),
            objective_id: objectiveId,
            employee_id: employee._id,
            cycle_id: cycle._id,
            status: progressAtCheckin > 20 ? 'approved' : 'pending_review',
            manager_feedback: 'Progress reviewed against the agreed milestone.',
            manager_id: managerId,
            reviewedBy: managerId,
            reviewedAt: dateAt(cycle.year, 3 + checkinIndex * 2, 16),
            progress_percent: Number(progressAtCheckin.toFixed(1)),
            notes: `Checkpoint ${checkinIndex + 1}: progress and blockers documented.`,
            priority: progressAtCheckin < 45 ? 'high' : 'medium',
            submitted_at: dateAt(cycle.year, 3 + checkinIndex * 2, 15),
            createdAt: dateAt(cycle.year, 3 + checkinIndex * 2, 15),
            updatedAt: dateAt(cycle.year, 3 + checkinIndex * 2, 16)
          });
        }
      }

      const finalScore = Number(breakdown.reduce((sum, item) => sum + item.weighted_points, 0).toFixed(2));
      const completedTaskCount = tasks.filter((task) => String(task.assignee) === String(employee._id) && task.status === 'done' && task.createdAt.getUTCFullYear() === cycle.year).length;
      const totalTaskCount = 12;
      const evaluationId = new mongoose.Types.ObjectId();
      const currentStatusOptions = ['draft', 'pending_hr', 'validated'];
      const evaluationStatus = historical ? 'closed' : currentStatusOptions[seed % currentStatusOptions.length];
      finalEvaluations.push({
        _id: evaluationId,
        employee_id: employee._id,
        cycle_id: cycle._id,
        auto_score: finalScore,
        manager_score: finalScore,
        final_score: finalScore,
        rating_label: ratingForScore(finalScore),
        objective_weight_total: 100,
        objective_score_normalized: false,
        objective_breakdown: breakdown,
        evidence_summary: {
          tasks: { total: totalTaskCount, completed: completedTaskCount, completion_rate: Number(((completedTaskCount / totalTaskCount) * 100).toFixed(1)) },
          checkins: { total: 9, approved: 9, approval_rate: 100, average_progress: Number((finalScore * 0.67).toFixed(1)) }
        },
        strengths: finalScore >= 75 ? ['Consistent objective delivery', 'Reliable team contribution'] : ['Maintained engagement with assigned objectives'],
        weaknesses: finalScore < 65 ? ['Execution consistency', 'Progress communication'] : ['Continue developing strategic influence'],
        improvement_suggestions: ['Review progress monthly', 'Convert development gaps into measurable actions'],
        manager_comments: `Final ${cycle.year} review based on weighted objectives, task completion, and check-in evidence.`,
        recommendation: finalScore >= 88 ? 'promotion' : finalScore < 50 ? 'performance_improvement_plan' : finalScore >= 75 ? 'bonus_eligible' : 'no_action',
        evaluator_id: managerId,
        evaluator_role: users.find((user) => String(user._id) === String(managerId))?.role || 'TEAM_LEADER',
        evaluated_at: dateAt(cycle.year, 11, 12),
        status: evaluationStatus,
        hr_validated_by: ['validated', 'closed'].includes(evaluationStatus) ? defaultDecisionMaker._id : null,
        hr_validated_at: ['validated', 'closed'].includes(evaluationStatus) ? dateAt(cycle.year, 11, 15) : null,
        performance_status: ['validated', 'closed'].includes(evaluationStatus) ? performanceStatusForScore(finalScore) : null,
        ai_assisted: true,
        ai_draft_generated_at: dateAt(cycle.year, 11, 11),
        workflow_history: [
          { action: 'submitted', performed_by: managerId, performed_at: dateAt(cycle.year, 11, 12) },
          ...(['validated', 'closed'].includes(evaluationStatus) ? [{ action: 'validated', performed_by: defaultDecisionMaker._id, performed_at: dateAt(cycle.year, 11, 15) }] : [])
        ],
        createdAt: dateAt(cycle.year, 11, 10),
        updatedAt: dateAt(cycle.year, 11, 15)
      });

      feedbacks.push({
        _id: new mongoose.Types.ObjectId(),
        sender: managerId,
        recipient: employee._id,
        type: finalScore >= 70 ? 'praise' : 'suggestion',
        message: finalScore >= 70 ? 'Strong delivery and reliable collaboration this cycle.' : 'Focus on predictable delivery and earlier blocker escalation.',
        visibility: 'private',
        cycle_id: cycle._id,
        rating: Math.max(1, Math.min(5, Math.round(finalScore / 20))),
        status: 'active',
        createdAt: dateAt(cycle.year, 9, 20),
        updatedAt: dateAt(cycle.year, 9, 20)
      });

      if (historical) {
        const decisionId = new mongoose.Types.ObjectId();
        decisions.push({
          _id: decisionId,
          user: employee._id,
          cycle: cycle._id,
          finalEvaluation: evaluationId,
          individualScore: Number(breakdown.filter((item) => item.category === 'individual').reduce((sum, item) => sum + item.weighted_points, 0).toFixed(2)),
          teamScore: Number(breakdown.filter((item) => item.category === 'team').reduce((sum, item) => sum + item.weighted_points, 0).toFixed(2)),
          finalScore,
          action: decisionForScore(finalScore),
          actionLabel: decisionForScore(finalScore).replace(/_/g, ' '),
          decidedBy: defaultDecisionMaker._id,
          decidedAt: dateAt(cycle.year, 11, 16),
          notes: 'Decision linked to the validated final evaluation and objective contribution evidence.',
          createdAt: dateAt(cycle.year, 11, 16)
        });

        if (cycle.year === 2025 && (finalScore >= 72 || finalScore < 50)) {
          bonusPenalties.push({
            _id: new mongoose.Types.ObjectId(),
            employee: employee._id,
            assignedBy: defaultDecisionMaker._id,
            type: finalScore >= 72 ? 'bonus' : 'penalty',
            value: finalScore >= 72 ? 500 + (seed % 5) * 100 : 100,
            reason: finalScore >= 72
              ? 'Approved recognition linked to the validated annual evaluation.'
              : 'Documented corrective action following HR review; not automatically generated from score alone.',
            finalEvaluation: evaluationId,
            hrDecision: decisionId,
            approvalStatus: 'approved',
            paymentDate: finalScore >= 72 ? dateAt(2026, 0, 31) : null,
            createdAt: dateAt(2025, 11, 18)
          });
        }
      }

      if (cycle.year === 2025) {
        recommendations.push({
          _id: new mongoose.Types.ObjectId(),
          employee_id: employee._id,
          cycle_id: cycle._id,
          suggested_path: finalScore >= 82 ? 'Expanded leadership responsibility' : 'Focused capability development',
          skills_to_develop: finalScore >= 82 ? ['Strategic leadership', 'Mentoring'] : ['Delivery planning', 'Stakeholder communication'],
          source: 'manager',
          basis: `Based on the validated ${cycle.year} evaluation and recorded development gaps.`,
          createdAt: dateAt(2025, 11, 17),
          updatedAt: dateAt(2025, 11, 17)
        });
      }

      if (cycle.year === 2025 && finalScore < 50) {
        improvementPlans.push({
          _id: new mongoose.Types.ObjectId(),
          evaluation_id: evaluationId,
          employee_id: employee._id,
          cycle_id: cycle._id,
          objective_goal: 'Improve delivery consistency and progress visibility',
          deadline: dateAt(2026, 2, 31),
          expected_outcome: 'Reach at least 70% objective progress with monthly reviewed check-ins.',
          notes: 'Created from the validated annual evaluation.',
          progress_status: 'in_progress',
          created_by: defaultDecisionMaker._id,
          updated_by: managerId,
          createdAt: dateAt(2025, 11, 18),
          updatedAt: dateAt(2026, 0, 15)
        });
      }
    }

    careerPaths.push({
      _id: new mongoose.Types.ObjectId(),
      user: employee._id,
      currentRole: employee.role === 'TEAM_LEADER' ? 'Team Leader' : 'Collaborator',
      currentLevel: 'intermediate',
      targetRole: employee.role === 'TEAM_LEADER' ? 'Senior Team Leader' : 'Senior Specialist',
      targetLevel: 'advanced',
      targetDate: dateAt(2027, 5, 30),
      developmentPlan: [
        { title: 'Complete targeted capability training', type: 'training', status: seed % 3 === 0 ? 'completed' : 'in_progress', dueDate: dateAt(2026, 8, 30) },
        { title: 'Apply learning through a stretch project', type: 'project', status: 'planned', dueDate: dateAt(2026, 11, 15) }
      ],
      mentorId: managerId,
      status: 'active',
      notes: 'Career path connected to the latest evaluation recommendation.',
      createdBy: employee._id,
      createdAt: dateAt(2026, 0, 20),
      updatedAt: dateAt(2026, 5, 1)
    });
  }

  const inserts = [
    [Objective, objectives],
    [Task, tasks],
    [CheckIn, checkins],
    [Feedback, feedbacks],
    [FinalEvaluation, finalEvaluations],
    [HRDecision, decisions],
    [CareerRecommendation, recommendations],
    [CareerPath, careerPaths],
    [ImprovementPlan, improvementPlans],
    [BonusPenalty, bonusPenalties]
  ];
  for (const [Model, documents] of inserts) {
    if (documents.length) await Model.collection.insertMany(documents);
  }

  console.log('Historical demo data created:', {
    cycles: cycles.length,
    employees: employees.length,
    objectives: objectives.length,
    tasks: tasks.length,
    checkins: checkins.length,
    feedbacks: feedbacks.length,
    finalEvaluations: finalEvaluations.length,
    hrDecisions: decisions.length,
    bonusPenalties: bonusPenalties.length,
    careerRecommendations: recommendations.length,
    careerPaths: careerPaths.length,
    improvementPlans: improvementPlans.length
  });
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error('Historical demo seed failed:', error);
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
});
