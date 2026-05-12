const Objective = require('../models/Objective');
const Task = require('../models/Task');
const CheckIn = require('../models/CheckIn');

const calculateAutoScore = async (employee_id, cycle_id) => {
  // Fetch all objectives for employee in cycle
  const objectives = await Objective.find({ owner: employee_id, cycle: cycle_id });
  
  // Objective completion rate (40%)
  // Considering 'completed' or 'evaluated' or 'approved' with 100%? Let's use achievementPercent
  let objScore = 0;
  if (objectives.length > 0) {
    const totalProgress = objectives.reduce((sum, obj) => sum + (obj.achievementPercent || 0), 0);
    objScore = totalProgress / objectives.length;
  }
  
  // Task completion rate (30%)
  // Fetch tasks linked to these objectives
  const objectiveIds = objectives.map(o => o._id);
  const tasks = await Task.find({ assignee: employee_id, linkedGoal: { $in: objectiveIds } });
  let taskScore = 0;
  if (tasks.length > 0) {
    const completedTasks = tasks.filter(t => t.status === 'done').length;
    taskScore = (completedTasks / tasks.length) * 100;
  }
  
  // Check-in approval rate as KPI proxy (20%)
  const checkins = await CheckIn.find({ employee_id, cycle_id });
  let kpiScore = 0;
  if (checkins.length > 0) {
    const approvedCheckins = checkins.filter(c => c.status === 'approved').length;
    kpiScore = (approvedCheckins / checkins.length) * 100;
  }
  
  // Avg progress % (10%)
  let avgProgress = 0;
  if (checkins.length > 0) {
    avgProgress = checkins.reduce((s, c) => s + (c.progress_percent || 0), 0) / checkins.length;
  }
  
  return (objScore * 0.4) + (taskScore * 0.3) + (kpiScore * 0.2) + (avgProgress * 0.1);
};

const determineRatingLabel = (score) => {
  if (score >= 90) return 'exceptional';
  if (score >= 75) return 'strong';
  if (score >= 50) return 'meets_expectations';
  if (score >= 30) return 'needs_improvement';
  return 'unsatisfactory';
};

module.exports = { calculateAutoScore, determineRatingLabel };
