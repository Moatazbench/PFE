const cron = require('node-cron');
const Objective = require('../models/Objective');
const Notification = require('../models/Notification');

function startReminderCron() {
  // Run every day at 8:00 AM
  cron.schedule('0 8 * * *', async function() {
    console.log('⏰ Running deadline reminder check...');
    
    try {
      var now = new Date();
      var oneDayLater = new Date();
      oneDayLater.setDate(now.getDate() + 1);
      var threeDaysLater = new Date();
      threeDaysLater.setDate(now.getDate() + 3);
      
      var notificationsSent = 0;
      
      // 3-day reminders
      var threeDayObjectives = await Objective.find({
        deadline: { $gte: now, $lte: threeDaysLater },
        status: { $nin: ['completed', 'validated'] },
        'reminderSent.threeDays': false
      });
      
      for (var i = 0; i < threeDayObjectives.length; i++) {
        var obj = threeDayObjectives[i];
        
        await Notification.create({
          user: obj.user,
          title: '⏰ Deadline in 3 days',
          message: 'Your objective "' + obj.title + '" is due in 3 days',
          link: '/objectives'
        });
        
        obj.reminderSent.threeDays = true;
        await obj.save();
        notificationsSent++;
      }
      
      // 1-day reminders
      var oneDayObjectives = await Objective.find({
        deadline: { $gte: now, $lte: oneDayLater },
        status: { $nin: ['completed', 'validated'] },
        'reminderSent.oneDay': false
      });
      
      for (var j = 0; j < oneDayObjectives.length; j++) {
        var obj2 = oneDayObjectives[j];
        
        await Notification.create({
          user: obj2.user,
          title: '🚨 Deadline Tomorrow!',
          message: 'Your objective "' + obj2.title + '" is due tomorrow!',
          link: '/objectives'
        });
        
        obj2.reminderSent.oneDay = true;
        await obj2.save();
        notificationsSent++;
      }
      
      // Overdue reminders
      var overdueObjectives = await Objective.find({
        deadline: { $lt: now },
        status: { $nin: ['completed', 'validated'] },
        'reminderSent.overdue': false
      });
      
      for (var k = 0; k < overdueObjectives.length; k++) {
        var obj3 = overdueObjectives[k];
        
        await Notification.create({
          user: obj3.user,
          title: '⚠️ Objective Overdue!',
          message: 'Your objective "' + obj3.title + '" is past its deadline!',
          link: '/objectives'
        });
        
        obj3.reminderSent.overdue = true;
        await obj3.save();
        notificationsSent++;
      }
      
      console.log('✅ Sent ' + notificationsSent + ' deadline reminders');
    } catch (err) {
      console.error('Reminder cron error:', err);
    }
  });
  
  console.log('⏰ Deadline reminder cron job started (runs daily at 8:00 AM)');
}

module.exports = { startReminderCron: startReminderCron };