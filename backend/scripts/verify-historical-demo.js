require('dotenv').config();
const mongoose = require('mongoose');

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;
  const cycles = await db.collection('cycles').find({})
    .project({ year: 1, status: 1, currentPhase: 1 })
    .sort({ year: 1 })
    .toArray();
  const counts = {};
  for (const name of ['objectives', 'tasks', 'checkins', 'feedbacks', 'finalevaluations', 'hrdecisions', 'bonuspenalties', 'careerrecommendations', 'careerpaths']) {
    counts[name] = await db.collection(name).countDocuments();
  }
  const evaluationStatuses = await db.collection('finalevaluations').aggregate([
    { $group: { _id: '$status', count: { $sum: 1 } } }
  ]).toArray();
  const bonusTypes = await db.collection('bonuspenalties').aggregate([
    { $group: { _id: { type: '$type', status: '$approvalStatus' }, count: { $sum: 1 } } }
  ]).toArray();
  const scoreRange = await db.collection('finalevaluations').aggregate([
    { $group: { _id: null, min: { $min: '$final_score' }, max: { $max: '$final_score' }, average: { $avg: '$final_score' } } }
  ]).toArray();
  const employeesWithInsufficientHistory = await db.collection('finalevaluations').aggregate([
    { $group: { _id: '$employee_id', cycles: { $sum: 1 } } },
    { $match: { cycles: { $lt: 5 } } },
    { $count: 'count' }
  ]).toArray();
  const integrity = {
    decisionsMissingFinalEvaluation: await db.collection('hrdecisions').countDocuments({ finalEvaluation: { $exists: false } }),
    bonusesMissingFinalEvaluation: await db.collection('bonuspenalties').countDocuments({ finalEvaluation: { $exists: false } }),
    employeesWithInsufficientHistory: employeesWithInsufficientHistory[0]?.count || 0
  };

  console.log(JSON.stringify({ cycles, counts, evaluationStatuses, bonusTypes, scoreRange, integrity }, null, 2));
  if (
    cycles.length !== 5 ||
    integrity.decisionsMissingFinalEvaluation ||
    integrity.bonusesMissingFinalEvaluation ||
    integrity.employeesWithInsufficientHistory
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
