const Notification = require('../models/Notification');
const User = require('../models/User');

/**
 * Get current user notifications
 */
exports.getMyNotifications = async (req, res) => {
    try {
        const notifs = await Notification.find({ recipient: req.user.id })
            .populate('sender', 'name profileImage')
            .sort({ createdAt: -1 })
            .limit(50);
        res.json(notifs);
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * Mark notification as read
 */
exports.markAsRead = async (req, res) => {
    try {
        await Notification.findOneAndUpdate(
            { _id: req.params.id, recipient: req.user.id },
            { isRead: true }
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * Mark all as read
 */
exports.markAllRead = async (req, res) => {
    try {
        await Notification.updateMany(
            { recipient: req.user.id, isRead: false },
            { isRead: true }
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * Legacy support for createNotification used by other controllers
 */
exports.createNotification = async (recipientId, title, message, link, type = 'GOAL_UPDATE') => {
    try {
        return await Notification.create({
            recipient: recipientId,
            title,
            message,
            link,
            type,
            isRead: false
        });
    } catch (err) {
        console.error('Legacy createNotification failed:', err.message);
        return null;
    }
};
