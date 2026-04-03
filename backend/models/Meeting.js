const mongoose = require('mongoose');

const agendaItemSchema = new mongoose.Schema({
    title: { type: String, required: true },
    duration: { type: Number, default: 5 }, // minutes
    presenter: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    notes: { type: String, default: '' },
    completed: { type: Boolean, default: false },
});

const meetingSchema = new mongoose.Schema({
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    organizer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    attendees: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    date: { type: Date, required: true },
    startTime: { type: String, default: '09:00' },
    endTime: { type: String, default: '10:00' },
    type: {
        type: String,
        enum: ['one_on_one', 'team', 'all_hands', 'check_in', 'review', 'planning', 'other'],
        default: 'team',
    },
    status: {
        type: String,
        enum: ['scheduled', 'in_progress', 'completed', 'cancelled'],
        default: 'scheduled',
    },
    agenda: [agendaItemSchema],
    notes: { type: String, default: '' },
    relatedObjectives: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Objective' }],
    team: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
    recurring: {
        type: String,
        enum: ['none', 'daily', 'weekly', 'biweekly', 'monthly'],
        default: 'none',
    },
    location: { type: String, default: '' },
    actionItems: [{
        title: { type: String, required: true },
        assignee: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        dueDate: { type: Date },
        completed: { type: Boolean, default: false },
    }],
}, { timestamps: true });

meetingSchema.index({ organizer: 1, date: -1 });
meetingSchema.index({ attendees: 1, date: -1 });
meetingSchema.index({ team: 1, date: -1 });
meetingSchema.index({ status: 1 });

module.exports = mongoose.model('Meeting', meetingSchema);
