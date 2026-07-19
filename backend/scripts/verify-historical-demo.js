require('dotenv').config();
const mongoose = require('mongoose');

const EXPECTED_YEARS = [2022, 2023, 2024, 2025, 2026];

async function main() {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI is required.');
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;

  const cycles = await db.collection('cycles').find({})
    .project({ year: 1, status: 1, currentPhase: 1 })
    .sort({ year: 1 })
    .toArray();
  const counts = {};
  for (const name of [
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
    'meetings',
    'notifications'
  ]) {
    counts[name] = await db.collection(name).countDocuments();
  }

  const evaluationStatuses = await db.collection('finalevaluations').aggregate([
    { $group: { _id: '$status', count: { $sum: 1 } } },
    { $sort: { _id: 1 } }
  ]).toArray();
  const ratings = await db.collection('finalevaluations').aggregate([
    { $group: { _id: '$rating_label', count: { $sum: 1 } } },
    { $sort: { _id: 1 } }
  ]).toArray();
  const bonusTypes = await db.collection('bonuspenalties').aggregate([
    { $group: { _id: { type: '$type', status: '$approvalStatus' }, count: { $sum: 1 } } },
    { $sort: { '_id.type': 1 } }
  ]).toArray();
  const scoreRange = await db.collection('finalevaluations').aggregate([
    { $group: { _id: null, min: { $min: '$final_score' }, max: { $max: '$final_score' }, average: { $avg: '$final_score' } } }
  ]).toArray();
  const employeesWithInsufficientHistory = await db.collection('finalevaluations').aggregate([
    { $group: { _id: '$employee_id', cycles: { $sum: 1 } } },
    { $match: { cycles: { $lt: 5 } } },
    { $count: 'count' }
  ]).toArray();
  const badWeightTotals = await db.collection('finalevaluations').aggregate([
    { $project: { weightTotal: { $sum: '$objective_breakdown.weight' } } },
    { $match: { weightTotal: { $ne: 100 } } },
    { $count: 'count' }
  ]).toArray();
  const objectiveScopes = await db.collection('finalevaluations').aggregate([
    { $unwind: '$objective_breakdown' },
    { $group: { _id: '$objective_breakdown.category', count: { $sum: 1 } } },
    { $sort: { _id: 1 } }
  ]).toArray();
  const teamTree = await db.collection('teams').aggregate([
    { $group: { _id: { hasParent: { $ne: ['$parentTeam', null] } }, count: { $sum: 1 } } }
  ]).toArray();
  const integrity = {
    usersStillPresent: await db.collection('users').countDocuments({ isDeleted: { $ne: true } }),
    decisionsMissingFinalEvaluation: await db.collection('hrdecisions').countDocuments({ finalEvaluation: { $exists: false } }),
    bonusesMissingFinalEvaluation: await db.collection('bonuspenalties').countDocuments({ finalEvaluation: { $exists: false } }),
    bonusesWithInvalidValue: await db.collection('bonuspenalties').countDocuments({ value: { $lte: 0 } }),
    employeesWithInsufficientHistory: employeesWithInsufficientHistory[0]?.count || 0,
    finalEvaluationsWithBadWeightTotal: badWeightTotals[0]?.count || 0
  };

  const result = {
    database: mongoose.connection.name,
    cycles,
    counts,
    evaluationStatuses,
    ratings,
    bonusTypes,
    scoreRange,
    objectiveScopes,
    teamTree,
    integrity
  };
  console.log(JSON.stringify(result, null, 2));

  const years = cycles.map((cycle) => cycle.year);
  const expectedYearsPresent = EXPECTED_YEARS.every((year) => years.includes(year));
  if (
    !expectedYearsPresent ||
    counts.objectives === 0 ||
    counts.tasks === 0 ||
    counts.checkins === 0 ||
    counts.finalevaluations === 0 ||
    counts.hrdecisions === 0 ||
    counts.careerpaths === 0 ||
    counts.meetings === 0 ||
    counts.notifications === 0 ||
    integrity.usersStillPresent === 0 ||
    integrity.decisionsMissingFinalEvaluation ||
    integrity.bonusesMissingFinalEvaluation ||
    integrity.bonusesWithInvalidValue ||
    integrity.employeesWithInsufficientHistory ||
    integrity.finalEvaluationsWithBadWeightTotal
  ) {
    throw new Error('Historical demo verification failed.');
  }

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error.message);
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
});
