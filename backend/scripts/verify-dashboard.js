require('dotenv').config();
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const app = require('../app');
const User = require('../models/User');
const Team = require('../models/Team');

function tokenFor(user) {
  return jwt.sign({ id: String(user._id), role: user.role }, process.env.JWT_SECRET, { expiresIn: '5m' });
}

async function checkDashboard(user, scope) {
  const response = await request(app)
    .get(`/api/stats/dashboard?scope=${scope}`)
    .set('Authorization', `Bearer ${tokenFor(user)}`);
  if (response.status !== 200) throw new Error(`${user.role}/${scope} dashboard returned ${response.status}.`);
  const insights = response.body.insights || {};
  if (!insights.activeObjectives || !insights.completedTasks || !(insights.evaluationTrend || []).length) {
    throw new Error(`${user.role}/${scope} dashboard did not return seeded objectives, tasks, and history.`);
  }
  return {
    role: user.role,
    scope,
    activeObjectives: insights.activeObjectives,
    completedTasks: insights.completedTasks,
    checkInCompletionRate: insights.checkInCompletionRate,
    finalEvaluations: insights.finalEvaluationsGenerated,
    historicalCycles: insights.evaluationTrend.length
  };
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  const team = await Team.findOne({}).lean();
  const leader = team?.leader ? await User.findById(team.leader).lean() : null;
  const collaborator = await User.findOne({ role: 'COLLABORATOR', isActive: true, isDeleted: false }).lean();
  const hr = await User.findOne({ role: 'HR', isActive: true, isDeleted: false }).lean();
  if (!leader || !collaborator || !hr) throw new Error('Required seeded roles are unavailable.');

  const results = [];
  results.push(await checkDashboard(collaborator, 'me'));
  results.push(await checkDashboard(leader, 'team'));
  results.push(await checkDashboard(hr, 'org'));

  const myTasks = await request(app)
    .get('/api/tasks/my?limit=10')
    .set('Authorization', `Bearer ${tokenFor(collaborator)}`);
  if (myTasks.status !== 200 || !(myTasks.body.tasks || []).length) {
    throw new Error('Employee task endpoint did not return assigned tasks.');
  }

  console.log(JSON.stringify({ dashboards: results, employeeTaskSample: myTasks.body.tasks.length }, null, 2));
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error.message);
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
});
