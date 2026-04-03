const cron = require('node-cron');
const Cycle = require('../models/Cycle');
const Goal = require('../models/Goal');
const GoalReview = require('../models/GoalReview');
const User = require('../models/User');
const { createNotification } = require('../utils/notificationHelper');

/**
 * Check deadlines and generate notifications for the Annual Cycle workflow.
 * Runs independently — reads data and creates notifications, does not modify goals/cycles.
 */
async function checkGoalDeadlines() {
  const results = { reminders: 0, overdue: 0, errors: [] };

  try {
    const now = new Date();
    const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    // Find active cycles
    const cycles = await Cycle.find({ status: { $in: ['open', 'active', 'in_progress'] } });

    for (const cycle of cycles) {
      try {
        // --- PHASE 1 DEADLINE ---
        if (cycle.currentPhase === 'phase1' && cycle.phase1End) {
          const phase1End = new Date(cycle.phase1End);
          if (phase1End >= now && phase1End <= sevenDaysLater) {
            // Employees with unsubmitted goals
            const draftGoals = await Goal.find({ cycleId: cycle._id, status: { $in: ['draft', 'needs_revision'] } });
            const empIds = [...new Set(draftGoals.map(g => String(g.employeeId)))];
            for (const eid of empIds) {
              await createNotification({
                recipientId: eid, senderId: null, type: 'DEADLINE_REMINDER',
                title: 'Phase 1 Deadline Approaching',
                message: `Phase 1 of "${cycle.name}" ends on ${phase1End.toLocaleDateString()}. You have unsubmitted goals.`,
                link: '/annual-goals',
              });
              results.reminders++;
            }

            // Managers with pending reviews
            const pendingGoals = await Goal.find({ cycleId: cycle._id, status: { $in: ['submitted', 'under_review'] } });
            const mgrIds = [...new Set(pendingGoals.filter(g => g.managerId).map(g => String(g.managerId)))];
            for (const mid of mgrIds) {
              await createNotification({
                recipientId: mid, senderId: null, type: 'DEADLINE_REMINDER',
                title: 'Phase 1 Deadline Approaching',
                message: `Phase 1 of "${cycle.name}" ends on ${phase1End.toLocaleDateString()}. You have goals pending review.`,
                link: '/annual-goals',
              });
              results.reminders++;
            }
          }

          // Overdue check
          if (phase1End < now) {
            const overdueGoals = await Goal.find({ cycleId: cycle._id, status: { $in: ['draft', 'needs_revision', 'submitted', 'under_review'] } });
            const overdueEmpIds = [...new Set(overdueGoals.map(g => String(g.employeeId)))];
            for (const eid of overdueEmpIds) {
              await createNotification({
                recipientId: eid, senderId: null, type: 'OVERDUE_ALERT',
                title: 'Phase 1 Overdue',
                message: `Phase 1 of "${cycle.name}" has ended but your goals are not fully approved.`,
                link: '/annual-goals',
              });
              results.overdue++;
            }
          }
        }

        // --- PHASE 2 DEADLINE ---
        if (cycle.currentPhase === 'phase2' && cycle.phase2End) {
          const phase2End = new Date(cycle.phase2End);
          if (phase2End >= now && phase2End <= sevenDaysLater) {
            const approvedGoals = await Goal.find({ cycleId: cycle._id, status: { $in: ['approved', 'midyear_assessed'] } });
            const midReviews = await GoalReview.find({ cycleId: cycle._id, phase: 'midyear', reviewType: 'manager_assessment' });
            const reviewedIds = new Set(midReviews.map(r => String(r.goalId)));
            const unreviewed = approvedGoals.filter(g => !reviewedIds.has(String(g._id)));
            const mgrIds = [...new Set(unreviewed.filter(g => g.managerId).map(g => String(g.managerId)))];
            for (const mid of mgrIds) {
              await createNotification({
                recipientId: mid, senderId: null, type: 'DEADLINE_REMINDER',
                title: 'Mid-Year Assessment Deadline Approaching',
                message: `Phase 2 of "${cycle.name}" ends on ${phase2End.toLocaleDateString()}. You have incomplete mid-year assessments.`,
                link: '/annual-goals',
              });
              results.reminders++;
            }
          }
        }

        // --- PHASE 3 DEADLINE ---
        if (cycle.currentPhase === 'phase3' && cycle.phase3End) {
          const phase3End = new Date(cycle.phase3End);
          if (phase3End >= now && phase3End <= sevenDaysLater) {
            const eligibleGoals = await Goal.find({ cycleId: cycle._id, status: { $in: ['approved', 'midyear_assessed'] } });

            // Employees without self-assessments
            const selfReviews = await GoalReview.find({ cycleId: cycle._id, phase: 'endyear', reviewType: 'self_assessment' });
            const selfIds = new Set(selfReviews.map(r => String(r.goalId)));
            const noSelf = eligibleGoals.filter(g => !selfIds.has(String(g._id)));
            const empIdsNoSelf = [...new Set(noSelf.map(g => String(g.employeeId)))];
            for (const eid of empIdsNoSelf) {
              await createNotification({
                recipientId: eid, senderId: null, type: 'DEADLINE_REMINDER',
                title: 'End-Year Self Assessment Due',
                message: `Phase 3 of "${cycle.name}" ends on ${phase3End.toLocaleDateString()}. Submit your self-assessments.`,
                link: '/annual-goals',
              });
              results.reminders++;
            }

            // Managers with incomplete evaluations
            const finalReviews = await GoalReview.find({ cycleId: cycle._id, phase: 'endyear', reviewType: 'manager_assessment' });
            const finalIds = new Set(finalReviews.map(r => String(r.goalId)));
            const noFinal = eligibleGoals.filter(g => !finalIds.has(String(g._id)));
            const mgrIdsNoFinal = [...new Set(noFinal.filter(g => g.managerId).map(g => String(g.managerId)))];
            for (const mid of mgrIdsNoFinal) {
              await createNotification({
                recipientId: mid, senderId: null, type: 'DEADLINE_REMINDER',
                title: 'Final Evaluation Deadline Approaching',
                message: `Phase 3 of "${cycle.name}" ends on ${phase3End.toLocaleDateString()}. You have incomplete evaluations.`,
                link: '/annual-goals',
              });
              results.reminders++;
            }
          }
        }
      } catch (cycleErr) {
        results.errors.push({ cycle: cycle.name, error: cycleErr.message });
      }
    }
  } catch (err) {
    results.errors.push({ error: err.message });
  }

  console.log(`✅ Goal deadline check: ${results.reminders} reminders, ${results.overdue} overdue alerts`);
  return results;
}

function startGoalDeadlineCron() {
  // Run daily at 8:00 AM
  cron.schedule('0 8 * * *', async () => {
    console.log('⏰ Running goal deadline check...');
    await checkGoalDeadlines();
  });
  console.log('⏰ Goal deadline cron scheduled (daily at 8:00 AM)');
}

module.exports = { startGoalDeadlineCron, checkGoalDeadlines };
