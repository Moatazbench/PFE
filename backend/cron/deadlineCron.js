const cron = require('node-cron');
const Objective = require('../models/Objective');
const User = require('../models/User');
const { notifyDeadlineApproaching } = require('../utils/notificationHelper');
const { sendDeadlineReminderEmail } = require('../utils/mailer');

function startDeadlineCron() {
  // Run every day at 9:00 AM
  cron.schedule('0 9 * * *', async function() {
    console.log('⏰ Running deadline check cron job...');
    
    try {
      const today = new Date();
      const threeDaysLater = new Date();
      threeDaysLater.setDate(today.getDate() + 3);

      // Find objectives with deadlines in the next 3 days
      const objectives = await Objective.find({
        deadline: {
          $gte: today,
          $lte: threeDaysLater
        },
        status: { $ne: 'completed' }
      }).populate('user', 'name email');

      console.log('Found ' + objectives.length + ' objectives with upcoming deadlines');

      for (var i = 0; i < objectives.length; i++) {
        var objective = objectives[i];
        
        if (objective.user) {
          var deadline = new Date(objective.deadline);
          var diffTime = deadline.getTime() - today.getTime();
          var diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

          // Send notification
          await notifyDeadlineApproaching(
            objective.user._id,
            objective.title,
            diffDays
          );

          // Send email
          await sendDeadlineReminderEmail(objective.user, objective);

          console.log('Sent deadline reminder to: ' + objective.user.email);
        }
      }

      console.log('✅ Deadline check completed');
    } catch (err) {
      console.error('Deadline cron error:', err);
    }
  });

  console.log('⏰ Deadline cron job scheduled (runs daily at 9:00 AM)');
}

// Also run immediately for testing (optional)
async function checkDeadlinesNow() {
  console.log('⏰ Running immediate deadline check...');
  
  try {
    const today = new Date();
    const threeDaysLater = new Date();
    threeDaysLater.setDate(today.getDate() + 3);

    const objectives = await Objective.find({
      deadline: {
        $gte: today,
        $lte: threeDaysLater
      },
      status: { $ne: 'completed' }
    }).populate('user', 'name email');

    console.log('Found ' + objectives.length + ' objectives with upcoming deadlines');

    for (var i = 0; i < objectives.length; i++) {
      var objective = objectives[i];
      
      if (objective.user) {
        var deadline = new Date(objective.deadline);
        var diffTime = deadline.getTime() - today.getTime();
        var diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        await notifyDeadlineApproaching(
          objective.user._id,
          objective.title,
          diffDays
        );

        console.log('Created notification for: ' + objective.user.name);
      }
    }

    return { success: true, count: objectives.length };
  } catch (err) {
    console.error('Immediate deadline check error:', err);
    return { success: false, error: err.message };
  }
}

module.exports = {
  startDeadlineCron: startDeadlineCron,
  checkDeadlinesNow: checkDeadlinesNow
};