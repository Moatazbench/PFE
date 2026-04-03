const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    recipient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    type: {
        type: String,
        enum: [
            'DEADLINE', 'KPI_DROP', 'MENTION', 'GOAL_UPDATE', 'COMMENT', 'FEEDBACK',
            'GOAL_SUBMITTED', 'GOAL_APPROVED', 'GOAL_REJECTED', 'GOAL_REVISION_REQUESTED',
            'GOAL_ASSIGNED', 'GOAL_ACKNOWLEDGED', 'GOAL_COMPLETED', 'GOAL_EVALUATED',
            'CHANGE_REQUEST', 'CHANGE_REQUEST_RESOLVED', 'GOAL_CANCELLED',
            'MEETING_INVITE', 'MEETING_UPDATE',
            'MIDYEAR_REVIEW_COMPLETED', 'FINAL_EVALUATION_COMPLETED',
            'PHASE_OPENED', 'PHASE_CLOSED',
            'DEADLINE_REMINDER', 'OVERDUE_ALERT',
            'EVALUATION_CREATED', 'EVALUATION_SUBMITTED', 'EVALUATION_APPROVED',
            'EVALUATION_REJECTED', 'EVALUATION_COMPLETED'
        ],
        required: true
    },
    title: {
        type: String,
        required: true
    },
    message: {
        type: String,
        required: true
    },
    link: {
        type: String // URL to the specific goal or page
    },
    isRead: {
        type: Boolean,
        default: false
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

module.exports = mongoose.model('Notification', notificationSchema);