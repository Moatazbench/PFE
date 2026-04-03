const express = require('express');
const router = express.Router();
const Objective = require('../models/Objective');
const Notification = require('../models/Notification');
const User = require('../models/User');
const auth = require('../middleware/auth');

// Get upcoming deadlines for current user
router.get('/upcoming', auth, async function(req, res) {
  try {
    var now = new Date();
    var sevenDaysLater = new Date();
    sevenDaysLater.setDate(now.getDate() + 7);
    
    var objectives = await Objective.find({
      user: req.user.id,
      deadline: { $gte: now, $lte: sevenDaysLater },
      status: { $nin: ['completed', 'validated'] }
    })
    .populate('cycle', 'name')
    .sort({ deadline: 1 });
    
    var upcoming = objectives.map(function(obj) {
      var daysLeft = Math.ceil((new Date(obj.deadline) - now) / (1000 * 60 * 60 * 24));
      return {
        _id: obj._id,
        title: obj.title,
        deadline: obj.deadline,
        daysLeft: daysLeft,
        status: obj.status,
        cycle: obj.cycle
      };
    });
    
    res.json(upcoming);
  } catch (err) {
    console.error('Get upcoming deadlines error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get overdue objectives
router.get('/overdue', auth, async function(req, res) {
  try {
    var now = new Date();
    
    var objectives = await Objective.find({
      user: req.user.id,
      deadline: { $lt: now },
      status: { $nin: ['completed', 'validated'] }
    })
    .populate('cycle', 'name')
    .sort({ deadline: 1 });
    
    var overdue = objectives.map(function(obj) {
      var daysOverdue = Math.ceil((now - new Date(obj.deadline)) / (1000 * 60 * 60 * 24));
      return {
        _id: obj._id,
        title: obj.title,
        deadline: obj.deadline,
        daysOverdue: daysOverdue,
        status: obj.status,
        cycle: obj.cycle
      };
    });
    
    res.json(overdue);
  } catch (err) {
    console.error('Get overdue objectives error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Manually trigger reminder check (for testing)
router.post('/check', auth, async function(req, res) {
  try {
    var now = new Date();
    var oneDayLater = new Date();
    oneDayLater.setDate(now.getDate() + 1);
    var threeDaysLater = new Date();
    threeDaysLater.setDate(now.getDate() + 3);
    
    var notificationsSent = 0;
    
    // Find objectives with deadlines in 3 days
    var threeDayObjectives = await Objective.find({
      deadline: { $gte: now, $lte: threeDaysLater },
      status: { $nin: ['completed', 'validated'] },
      'reminderSent.threeDays': false
    }).populate('user', 'name email');
    
    for (var i = 0; i < threeDayObjectives.length; i++) {
      var obj = threeDayObjectives[i];
      
      await Notification.create({
        user: obj.user._id,
        title: '⏰ Deadline in 3 days',
        message: 'Your objective "' + obj.title + '" is due in 3 days',
        link: '/objectives'
      });
      
      obj.reminderSent.threeDays = true;
      await obj.save();
      notificationsSent++;
    }
    
    // Find objectives with deadlines in 1 day
    var oneDayObjectives = await Objective.find({
      deadline: { $gte: now, $lte: oneDayLater },
      status: { $nin: ['completed', 'validated'] },
      'reminderSent.oneDay': false
    }).populate('user', 'name email');
    
    for (var j = 0; j < oneDayObjectives.length; j++) {
      var obj2 = oneDayObjectives[j];
      
      await Notification.create({
        user: obj2.user._id,
        title: '🚨 Deadline Tomorrow!',
        message: 'Your objective "' + obj2.title + '" is due tomorrow!',
        link: '/objectives'
      });
      
      obj2.reminderSent.oneDay = true;
      await obj2.save();
      notificationsSent++;
    }
    
    // Find overdue objectives
    var overdueObjectives = await Objective.find({
      deadline: { $lt: now },
      status: { $nin: ['completed', 'validated'] },
      'reminderSent.overdue': false
    }).populate('user', 'name email');
    
    for (var k = 0; k < overdueObjectives.length; k++) {
      var obj3 = overdueObjectives[k];
      
      await Notification.create({
        user: obj3.user._id,
        title: '⚠️ Objective Overdue!',
        message: 'Your objective "' + obj3.title + '" is past its deadline!',
        link: '/objectives'
      });
      
      obj3.reminderSent.overdue = true;
      await obj3.save();
      notificationsSent++;
    }
    
    res.json({ 
      message: 'Reminder check completed',
      notificationsSent: notificationsSent 
    });
  } catch (err) {
    console.error('Check reminders error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;