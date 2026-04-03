const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification');
const User = require('../models/User');
const auth = require('../middleware/auth');
const { sendNotificationEmail } = require('../utils/mailer');

// Get all notifications for current user
router.get('/', auth, async function(req, res) {
  try {
    const notifications = await Notification.find({ recipient: req.user.id })
      .populate('sender', 'name profileImage') // Populate sender info
      .sort({ createdAt: -1 })
      .limit(50);
    res.json(notifications);
  } catch (err) {
    console.error('Get notifications error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get unread count
router.get('/unread-count', auth, async function(req, res) {
  try {
    const count = await Notification.countDocuments({ 
      recipient: req.user.id, 
      isRead: false 
    });
    res.json({ count: count });
  } catch (err) {
    console.error('Get unread count error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create notification
router.post('/', auth, async function(req, res) {
  try {
    // NOTE: 'sendEmailFlag' is a boolean from caller — renamed to avoid shadowing the imported sendNotificationEmail
    const { recipientId, type, title, message, link, sendEmail: sendEmailFlag } = req.body;

    const notification = await Notification.create({
      recipient: recipientId || req.user.id,
      sender: req.user.id,
      type: type || 'GOAL_UPDATE',
      title: title,
      message: message,
      link: link || '',
      isRead: false
    });

    // Send email if caller requested it
    if (sendEmailFlag) {
      const user = await User.findById(recipientId || req.user.id);
      if (user && user.email) {
        try {
          // Use the already-imported sendNotificationEmail (no re-require needed)
          await sendNotificationEmail(user, notification);
        } catch (mErr) {
          console.error('Mail send failed (non-fatal):', mErr.message);
        }
      }
    }

    res.status(201).json(notification);
  } catch (err) {
    console.error('Create notification error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});


// Mark notification as read
router.post('/:id/read', auth, async function(req, res) {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, recipient: req.user.id }, 
      { isRead: true },
      { new: true }
    );
    
    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }
    
    res.json(notification);
  } catch (err) {
    console.error('Mark read error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Mark all notifications as read
router.post('/read-all', auth, async function(req, res) {
  try {
    await Notification.updateMany(
      { recipient: req.user.id, isRead: false },
      { isRead: true }
    );
    res.json({ message: 'All notifications marked as read' });
  } catch (err) {
    console.error('Mark all read error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete notification
router.delete('/:id', auth, async function(req, res) {
  try {
    await Notification.findOneAndDelete({ _id: req.params.id, recipient: req.user.id });
    res.json({ message: 'Notification deleted' });
  } catch (err) {
    console.error('Delete notification error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;