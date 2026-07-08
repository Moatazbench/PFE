const Feedback = require('../models/Feedback');
const User = require('../models/User');
const Team = require('../models/Team');
const FinalEvaluation = require('../models/FinalEvaluation');

async function getRelatedFeedbackUserIds(actor) {
  const actorId = String(actor.id || actor._id);
  if (actor.role === 'ADMIN') return null;

  const ids = new Set([actorId]);
  if (actor.role === 'HR') {
    const evaluations = await FinalEvaluation.find({
      $or: [
        { status: 'pending_hr' },
        { hr_validated_by: actorId }
      ]
    }).select('employee_id evaluator_id').lean();
    evaluations.forEach((evaluation) => {
      if (evaluation.employee_id) ids.add(String(evaluation.employee_id));
      if (evaluation.evaluator_id) ids.add(String(evaluation.evaluator_id));
    });
    return Array.from(ids);
  }

  let teams = await Team.find({
    $or: [{ leader: actorId }, { members: actorId }]
  }).select('_id leader members').lean();
  const visited = new Set();
  while (teams.length > 0) {
    const parentIds = [];
    teams.forEach((team) => {
      const teamId = String(team._id);
      if (visited.has(teamId)) return;
      visited.add(teamId);
      parentIds.push(team._id);
      if (team.leader) ids.add(String(team.leader));
      (team.members || []).forEach((memberId) => ids.add(String(memberId)));
    });
    teams = actor.role === 'TEAM_LEADER' && parentIds.length > 0
      ? await Team.find({ parentTeam: { $in: parentIds } }).select('_id leader members').lean()
      : [];
  }

  if (actor.role === 'TEAM_LEADER') {
    const directReports = await User.find({ manager: actorId, isDeleted: false }).select('_id').lean();
    directReports.forEach((employee) => ids.add(String(employee._id)));
  }
  return Array.from(ids);
}

async function canAccessFeedbackUser(actor, targetUserId) {
  const allowedIds = await getRelatedFeedbackUserIds(actor);
  return allowedIds === null || allowedIds.includes(String(targetUserId));
}

exports.getAvailableRecipients = async (req, res) => {
  try {
    const allowedIds = await getRelatedFeedbackUserIds(req.user);
    const filter = { isDeleted: false, isActive: true };
    if (allowedIds !== null) filter._id = { $in: allowedIds };
    const users = await User.find(filter).select('_id name role profileImage').sort({ name: 1 }).lean();
    res.json({ success: true, users });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

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
    if (!await canAccessFeedbackUser(req.user, recipientId)) {
      return res.status(403).json({ success: false, message: 'You can only send feedback to people related to your permitted work scope.' });
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
    if (!await canAccessFeedbackUser(req.user, userId)) {
      return res.status(403).json({ success: false, message: 'Not authorized to view feedback for this user' });
    }
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

    if (feedback.sender.toString() !== req.user._id.toString() && req.user.role !== 'ADMIN') {
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
    if (req.params.userId && !await canAccessFeedbackUser(req.user, userId)) {
      return res.status(403).json({ success: false, message: 'Not authorized to view feedback statistics for this user' });
    }
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
