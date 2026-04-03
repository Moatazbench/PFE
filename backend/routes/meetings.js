const express = require('express');
const router = express.Router();
const Meeting = require('../models/Meeting');
const auth = require('../middleware/auth');
const rateLimiter = require('../middleware/rateLimiter');
const { createNotification } = require('../controllers/notificationController');

// Get all meetings for current user (as organizer or attendee)
router.get('/', rateLimiter, auth, async function (req, res) {
    try {
        var { status, type, team, upcoming } = req.query;
        var filter = {
            $or: [
                { organizer: req.user.id },
                { attendees: req.user.id }
            ]
        };

        if (status) {
            if (status.includes(',')) {
                filter.status = { $in: status.split(',') };
            } else {
                filter.status = status;
            }
        }
        if (type) filter.type = type;
        if (team) filter.team = team;
        if (upcoming === 'true') {
            const today = new Date();
            today.setHours(0, 0, 0, 0); // Start of today
            filter.date = { $gte: today };
        }

        // Auto-complete past meetings that are still "scheduled"
        const now = new Date();
        const activeMeetings = await Meeting.find({
            $or: [{ organizer: req.user.id }, { attendees: req.user.id }],
            status: { $in: ['scheduled', 'in_progress'] }
        });

        for (const m of activeMeetings) {
            let isPast = false;
            if (m.date) {
                const meetingDate = new Date(m.date);
                // If meeting was purely scheduled for a day before today, it's definitely past
                if (meetingDate < new Date(now.getFullYear(), now.getMonth(), now.getDate())) {
                    isPast = true;
                } else if (meetingDate.getFullYear() === now.getFullYear() && 
                           meetingDate.getMonth() === now.getMonth() && 
                           meetingDate.getDate() === now.getDate() && 
                           m.endTime) {
                    // It's today. Let's check the endTime
                    const [hours, mins] = m.endTime.split(':').map(Number);
                    if (!isNaN(hours) && !isNaN(mins)) {
                        const endDateTime = new Date();
                        endDateTime.setHours(hours, mins, 0, 0);
                        if (now > endDateTime) {
                            isPast = true;
                        }
                    }
                }
            }
            if (isPast) {
                m.status = 'completed';
                await m.save();
            }
        }

        var meetings = await Meeting.find(filter)
            .populate('organizer', 'name email role')
            .populate('attendees', 'name email role')
            .populate('team', 'name')
            .populate('relatedObjectives', 'title')
            .sort({ date: -1 });

        res.json({ success: true, count: meetings.length, meetings });
    } catch (err) {
        console.error('Get meetings error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// Get single meeting
router.get('/:id', rateLimiter, auth, async function (req, res) {
    try {
        var meeting = await Meeting.findById(req.params.id)
            .populate('organizer', 'name email role')
            .populate('attendees', 'name email role')
            .populate('team', 'name')
            .populate('relatedObjectives', 'title achievementPercent')
            .populate('agenda.presenter', 'name')
            .populate('actionItems.assignee', 'name email');

        if (!meeting) {
            return res.status(404).json({ success: false, message: 'Meeting not found' });
        }

        res.json({ success: true, meeting });
    } catch (err) {
        console.error('Get meeting error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// Create meeting
router.post('/', rateLimiter, auth, async function (req, res) {
    try {
        var { title, description, attendees, date, startTime, endTime, type, agenda, relatedObjectives, team, recurring, location } = req.body;

        if (!title || !date) {
            return res.status(400).json({ success: false, message: 'Title and date are required' });
        }

        // Sanitize team: empty string is not a valid ObjectId
        var sanitizedTeam = (team && team.length > 0) ? team : null;
        // Filter out any empty strings from attendees
        var sanitizedAttendees = (attendees || []).filter(function (a) { return a && a.length > 0; });

        var meeting = await Meeting.create({
            title,
            description: description || '',
            organizer: req.user.id,
            attendees: sanitizedAttendees,
            date,
            startTime: startTime || '09:00',
            endTime: endTime || '10:00',
            type: type || 'team',
            agenda: agenda || [],
            relatedObjectives: relatedObjectives || [],
            team: sanitizedTeam,
            recurring: recurring || 'none',
            location: location || '',
        });

        var populated = await Meeting.findById(meeting._id)
            .populate('organizer', 'name email role')
            .populate('attendees', 'name email role')
            .populate('team', 'name');

        // Send notifications (don't fail meeting creation if notifications fail)
        try {
            if (populated.attendees && populated.attendees.length > 0) {
                for (const attendee of populated.attendees) {
                    if (String(attendee._id) !== String(req.user.id)) {
                        await createNotification(
                            attendee._id,
                            'New Meeting Scheduled',
                            `You have been invited to a new meeting: "${title}" by ${populated.organizer.name}.`,
                            '/meetings',
                            'MEETING_INVITE'
                        );
                    }
                }
            }
        } catch (notifErr) {
            console.error('Meeting notification error (non-blocking):', notifErr.message);
        }

        res.status(201).json({ success: true, meeting: populated });
    } catch (err) {
        console.error('Create meeting error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// Update meeting
router.put('/:id', rateLimiter, auth, async function (req, res) {
    try {
        var meeting = await Meeting.findById(req.params.id);
        if (!meeting) {
            return res.status(404).json({ success: false, message: 'Meeting not found' });
        }

        var fields = ['title', 'description', 'attendees', 'date', 'startTime', 'endTime', 'type', 'status', 'agenda', 'notes', 'relatedObjectives', 'team', 'recurring', 'location', 'actionItems'];
        fields.forEach(function (field) {
            if (req.body[field] !== undefined) {
                if (field === 'team') {
                    meeting[field] = (req.body[field] && req.body[field].length > 0) ? req.body[field] : null;
                } else if (field === 'attendees') {
                    meeting[field] = (req.body[field] || []).filter(function (a) { return a && a.length > 0; });
                } else {
                    meeting[field] = req.body[field];
                }
            }
        });

        await meeting.save();

        var populated = await Meeting.findById(meeting._id)
            .populate('organizer', 'name email role')
            .populate('attendees', 'name email role')
            .populate('relatedObjectives', 'title');

        // Send notifications (don't fail meeting update if notifications fail)
        try {
            if (populated.attendees && populated.attendees.length > 0) {
                for (const attendee of populated.attendees) {
                    if (String(attendee._id) !== String(req.user.id)) {
                        const msg = req.body.status === 'cancelled'
                            ? `Meeting "${meeting.title}" has been cancelled.`
                            : `Meeting details updated for "${meeting.title}".`;
                        await createNotification(
                            attendee._id,
                            req.body.status === 'cancelled' ? 'Meeting Cancelled' : 'Meeting Updated',
                            msg,
                            '/meetings',
                            'MEETING_UPDATE'
                        );
                    }
                }
            }
        } catch (notifErr) {
            console.error('Meeting update notification error (non-blocking):', notifErr.message);
        }

        res.json({ success: true, meeting: populated });
    } catch (err) {
        console.error('Update meeting error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// Delete meeting
router.delete('/:id', rateLimiter, auth, async function (req, res) {
    try {
        var meeting = await Meeting.findById(req.params.id);
        if (!meeting) {
            return res.status(404).json({ success: false, message: 'Meeting not found' });
        }

        await Meeting.findByIdAndDelete(req.params.id);
        res.json({ success: true, message: 'Meeting deleted' });
    } catch (err) {
        console.error('Delete meeting error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// Duplicate meeting
router.post('/:id/duplicate', rateLimiter, auth, async function (req, res) {
    try {
        var original = await Meeting.findById(req.params.id);
        if (!original) {
            return res.status(404).json({ success: false, message: 'Meeting not found' });
        }

        var newMeeting = await Meeting.create({
            title: original.title + ' (Copy)',
            description: original.description,
            organizer: req.user.id,
            attendees: original.attendees,
            date: new Date(),
            startTime: original.startTime,
            endTime: original.endTime,
            type: original.type,
            agenda: original.agenda.map(function (item) {
                return { title: item.title, duration: item.duration, notes: '', completed: false };
            }),
            relatedObjectives: original.relatedObjectives,
            team: original.team,
            recurring: 'none',
            location: original.location,
        });

        var populated = await Meeting.findById(newMeeting._id)
            .populate('organizer', 'name email role')
            .populate('attendees', 'name email role');

        res.status(201).json({ success: true, meeting: populated });
    } catch (err) {
        console.error('Duplicate meeting error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// Add action item
router.post('/:id/actions', rateLimiter, auth, async function (req, res) {
    try {
        var meeting = await Meeting.findById(req.params.id);
        if (!meeting) {
            return res.status(404).json({ success: false, message: 'Meeting not found' });
        }

        meeting.actionItems.push({
            title: req.body.title,
            assignee: req.body.assignee || null,
            dueDate: req.body.dueDate || null,
            completed: false,
        });

        await meeting.save();
        var populated = await Meeting.findById(meeting._id)
            .populate('actionItems.assignee', 'name email');

        res.json({ success: true, actionItems: populated.actionItems });
    } catch (err) {
        console.error('Add action item error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
