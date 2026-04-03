const Notification = require('../models/Notification');
const User = require('../models/User');

/**
 * Trigger a notification for a user
 * @param {Object} params
 * @param {string} params.recipientId - ID of the user receiving the notification
 * @param {string} params.senderId - ID of the user triggering the notification
 * @param {string} params.type - enum: ['DEADLINE', 'KPI_DROP', 'MENTION', 'GOAL_UPDATE', 'COMMENT', 'FEEDBACK']
 * @param {string} params.title - Notification title
 * @param {string} params.message - Notification message
 * @param {string} params.link - Optional link to the related item
 */
exports.createNotification = async ({ recipientId, senderId, type, title, message, link }) => {
    try {
        const notification = await Notification.create({
            recipient: recipientId,
            sender: senderId,
            type,
            title,
            message,
            link: link || '',
            isRead: false
        });
        return notification;
    } catch (err) {
        console.error('Failed to trigger notification:', err.message);
        return null;
    }
};

/**
 * Notify all team members (except sender)
 * @param {Object} team - Team object with members array
 * @param {Object} params - Notification params
 */
exports.notifyTeam = async (team, { senderId, type, title, message, link }) => {
    if (!team || !team.members) return;
    
    const notifications = [];
    for (const member of team.members) {
        const memberId = member._id || member;
        if (memberId.toString() !== senderId?.toString()) {
            const n = await exports.createNotification({
                recipientId: memberId,
                senderId,
                type,
                title,
                message,
                link
            });
            if (n) notifications.push(n);
        }
    }
    return notifications;
};

/**
 * Notify all active users in the system (for phase open/close broadcasts)
 */
exports.notifyAllActiveUsers = async ({ senderId, type, title, message, link }) => {
    try {
        const users = await User.find({ isActive: { $ne: false } }).select('_id');
        const notifications = [];
        for (const u of users) {
            if (String(u._id) === String(senderId)) continue;
            const n = await exports.createNotification({
                recipientId: u._id,
                senderId,
                type,
                title,
                message,
                link,
            });
            if (n) notifications.push(n);
        }
        return notifications;
    } catch (err) {
        console.error('Bulk notification failed:', err.message);
        return [];
    }
};
