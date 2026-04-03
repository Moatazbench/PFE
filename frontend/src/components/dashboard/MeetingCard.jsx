import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';

function MeetingCard() {
    var [meetings, setMeetings] = useState([]);
    var [loading, setLoading] = useState(true);

    useEffect(function () {
        async function fetch() {
            try {
                var res = await api.get('/api/meetings', { params: { upcoming: 'true' } });
                setMeetings((res.data.meetings || []).slice(0, 3));
            } catch (err) { console.error(err); }
            finally { setLoading(false); }
        }
        fetch();
    }, []);

    function formatDate(d) {
        return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }

    function getTypeIcon(type) {
        return { one_on_one: '👤', team: '👥', all_hands: '🏢', check_in: '✅', review: '📊', planning: '📋' }[type] || '📌';
    }

    return (
        <div className="dash-card dash-card--meetings">
            <div className="dash-card__header">
                <span className="dash-card__icon">📅</span>
                <h3>Upcoming Meetings</h3>
            </div>
            <div className="dash-card__body">
                {loading ? (
                    <p className="dash-card__loading">Loading...</p>
                ) : meetings.length === 0 ? (
                    <div className="dash-card__empty-state">
                        <div className="dash-card__empty-icon">📅</div>
                        <p>No upcoming meetings</p>
                        <Link to="/meetings" className="dash-card__link">Schedule a meeting →</Link>
                    </div>
                ) : (
                    <div className="dash-card__list">
                        {meetings.map(function (m) {
                            return (
                                <div key={m._id} className="goal-item">
                                    <div className="goal-item__info">
                                        <span className="goal-item__title">{getTypeIcon(m.type)} {m.title}</span>
                                        <div className="goal-item__meta">
                                            <span>{formatDate(m.date)}</span>
                                            <span>{m.startTime} – {m.endTime}</span>
                                        </div>
                                    </div>
                                    <div className="goal-item__progress">
                                        <span style={{ fontSize: '12px', color: '#6c5ce7', fontWeight: 600 }}>
                                            {(m.attendees || []).length} attendees
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                        <Link to="/meetings" className="dash-card__link" style={{ display: 'block', textAlign: 'center', marginTop: '8px', fontSize: '13px', color: '#6c5ce7' }}>View all meetings →</Link>
                    </div>
                )}
            </div>
        </div>
    );
}

export default MeetingCard;
