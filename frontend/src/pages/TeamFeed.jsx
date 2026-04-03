import React, { useState, useEffect } from 'react';
import axios from 'axios';
import UserAvatar from '../components/UserAvatar';
import { formatDistanceToNow } from 'date-fns';

function TeamFeed() {
    const [activities, setActivities] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');

    useEffect(() => {
        fetchFeed();
    }, []);

    const fetchFeed = async () => {
        try {
            setLoading(true);
            const res = await axios.get('/api/feed');
            setActivities(res.data);
        } catch (err) {
            console.error('Error fetching feed:', err);
        } finally {
            setLoading(false);
        }
    };

    const getIcon = (type) => {
        switch (type) {
            case 'GOAL_UPDATE': return '🎯';
            case 'PROGRESS_UPDATE': return '📈';
            case 'COMMENT': return '💬';
            default: return '🔔';
        }
    };

    const filteredActivities = activities.filter(a => {
        if (filter === 'all') return true;
        if (filter === 'goals') return a.type === 'GOAL_UPDATE';
        if (filter === 'progress') return a.type === 'PROGRESS_UPDATE';
        if (filter === 'comments') return a.type === 'COMMENT';
        return true;
    });

    return (
        <div className="feed-page">
            <header className="feed-header" style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1 style={{ margin: 0 }}>Team Feed</h1>
                    <p className="text-muted">Real-time updates from your collaborators</p>
                </div>
                <div className="feed-filters" style={{ display: 'flex', gap: '0.5rem' }}>
                    {['all', 'goals', 'progress', 'comments'].map(f => (
                        <button 
                            key={f}
                            onClick={() => setFilter(f)}
                            className={`btn btn--sm ${filter === f ? 'btn--primary' : 'btn--outline'}`}
                            style={{ textTransform: 'capitalize' }}
                        >
                            {f}
                        </button>
                    ))}
                </div>
            </header>

            {loading ? (
                <div className="loading-state">Loading activities...</div>
            ) : filteredActivities.length === 0 ? (
                <div className="empty-state card" style={{ padding: '3rem', textAlign: 'center' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📭</div>
                    <h3>No activity yet</h3>
                    <p className="text-muted">Activity from your team will appear here.</p>
                </div>
            ) : (
                <div className="activity-timeline" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {filteredActivities.map((activity) => (
                        <div key={activity.id} className="activity-card card" style={{ padding: '1.25rem', display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                            <UserAvatar user={activity.user} size={40} />
                            <div className="activity-content" style={{ flex: 1 }}>
                                <div className="activity-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                                    <span style={{ fontWeight: '600' }}>{activity.user?.name}</span>
                                    <span className="text-muted" style={{ fontSize: '0.8rem' }}>
                                        {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                                    </span>
                                </div>
                                <div className="activity-body" style={{ marginTop: '0.25rem' }}>
                                    <span className="activity-icon" style={{ marginRight: '0.5rem' }}>{getIcon(activity.type)}</span>
                                    <span style={{ fontWeight: '500' }}>{activity.goalTitle}</span>: {activity.message}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default TeamFeed;
