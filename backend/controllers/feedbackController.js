const Feedback = require('../models/Feedback');
const User = require('../models/User');

// Create feedback
exports.createFeedback = async (req, res) => {
  try {
    const { recipientId, type, message, anonymous, visibility, rating, tags, relatedMeeting, relatedReview, relatedObjective } = req.body;

    if (!recipientId || !message) {
      return res.status(400).json({ success: false, message: 'Recipient and message are required' });
    }

    const recipient = await User.findById(recipientId);
    if (!recipient) {
      return res.status(404).json({ success: false, message: 'Recipient not found' });
    }

    if (recipientId === req.user._id.toString()) {
      if (type !== 'self') {
        return res.status(400).json({ success: false, message: 'Cannot send non-self feedback to yourself' });
      }
    }

    const feedback = await Feedback.create({
      sender: req.user._id,
      recipient: recipientId,
      type: type || 'praise',
      message,
      anonymous: anonymous || false,
      visibility: visibility || 'private',
      rating: rating || null,
      tags: tags || [],
      relatedMeeting: relatedMeeting || null,
      relatedReview: relatedReview || null,
      relatedObjective: relatedObjective || null,
    });

    const populated = await Feedback.findById(feedback._id)
      .populate('sender', 'name email role')
      .populate('recipient', 'name email role');

    res.status(201).json({ success: true, feedback: populated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Request feedback (360-degree)
exports.requestFeedback = async (req, res) => {
  try {
    const { recipientId, respondentIds, message } = req.body;
    if (!recipientId || !respondentIds || !respondentIds.length) {
      return res.status(400).json({ success: false, message: 'Recipient and respondents are required' });
    }

    const feedbackRequests = [];
    for (const respondentId of respondentIds) {
      const fb = await Feedback.create({
        sender: respondentId,
        recipient: recipientId,
        type: '360',
        message: message || 'Feedback requested',
        isRequested: true,
        requestedBy: req.user._id,
        status: 'active',
        visibility: 'manager_only',
      });
      feedbackRequests.push(fb);
    }

    res.status(201).json({ success: true, feedbackRequests });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Get feedback received by current user
exports.getReceived = async (req, res) => {
  try {
    const { type, page = 1, limit = 20 } = req.query;
    const filter = { recipient: req.user._id, status: 'active' };
    if (type) filter.type = type;

    const feedbacks = await Feedback.find(filter)
      .populate('sender', 'name email role')
      .populate('recipient', 'name email role')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    // Mask sender for anonymous feedback
    const masked = feedbacks.map(fb => {
      const obj = fb.toObject();
      if (obj.anonymous) {
        obj.sender = { name: 'Anonymous', email: '', role: '' };
      }
      return obj;
    });

    const total = await Feedback.countDocuments(filter);
    res.json({ success: true, feedbacks: masked, total, page: parseInt(page), pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Get feedback sent by current user
exports.getSent = async (req, res) => {
  try {
    const feedbacks = await Feedback.find({ sender: req.user._id })
      .populate('sender', 'name email role')
      .populate('recipient', 'name email role')
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({ success: true, feedbacks });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Get all feedback (admin/HR)
exports.getAll = async (req, res) => {
  try {
    const { type, page = 1, limit = 50 } = req.query;
    const filter = {};
    if (type) filter.type = type;

    const feedbacks = await Feedback.find(filter)
      .populate('sender', 'name email role')
      .populate('recipient', 'name email role')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Feedback.countDocuments(filter);
    res.json({ success: true, feedbacks, total, page: parseInt(page), pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Get feedback for a specific user (manager view)
exports.getForUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const feedbacks = await Feedback.find({ recipient: userId, status: 'active' })
      .populate('sender', 'name email role')
      .sort({ createdAt: -1 });

    const masked = feedbacks.map(fb => {
      const obj = fb.toObject();
      if (obj.anonymous) {
        obj.sender = { name: 'Anonymous', email: '', role: '' };
      }
      return obj;
    });

    res.json({ success: true, feedbacks: masked });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Delete feedback
exports.deleteFeedback = async (req, res) => {
  try {
    const feedback = await Feedback.findById(req.params.id);
    if (!feedback) {
      return res.status(404).json({ success: false, message: 'Feedback not found' });
    }

    if (feedback.sender.toString() !== req.user._id.toString() && !['ADMIN', 'HR'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this feedback' });
    }

    await Feedback.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Feedback deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Get feedback summary/stats
exports.getStats = async (req, res) => {
  try {
    const userId = req.params.userId || req.user._id;
    const [received, sent, byType] = await Promise.all([
      Feedback.countDocuments({ recipient: userId, status: 'active' }),
      Feedback.countDocuments({ sender: userId }),
      Feedback.aggregate([
        { $match: { recipient: new (require('mongoose').Types.ObjectId)(userId), status: 'active' } },
        { $group: { _id: '$type', count: { $sum: 1 }, avgRating: { $avg: '$rating' } } }
      ])
    ]);

    res.json({ success: true, stats: { received, sent, byType } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
