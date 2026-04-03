import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../components/AuthContext';
import { useNavigate } from 'react-router-dom';
import './MyTeamPage.css'; 

function MyTeamPage() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [teamMembers, setTeamMembers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        fetchTeamMembers();
    }, []);

    const fetchTeamMembers = async () => {
        setLoading(true);
        setError('');
        try {
            const res = await api.get('/api/team-members');
            // Ensure we strictly set an array, even if API returned empty or weird object
            if (Array.isArray(res.data)) {
                setTeamMembers(res.data);
            } else if (res.data && res.data.members && Array.isArray(res.data.members)) {
                setTeamMembers(res.data.members);
            } else {
                setTeamMembers([]);
            }
        } catch (err) {
            console.error('Failed to load team dashboard:', err);
            setError('Failed to load team information.');
        } finally {
            setLoading(false);
        }
    };

    const getInitials = (name) => {
        if (!name || typeof name !== 'string') return '?';
        return name.split(' ').map(w => w?.[0] || '').join('').toUpperCase().substring(0, 2);
    };

    const getAvatarColor = (name) => {
        if (!name || typeof name !== 'string') return '#6366f1';
        const colors = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4', '#6366f1', '#ef4444', '#84cc16', '#f97316'];
        let hash = 0;
        for (let i = 0; i < name.length; i++) { hash = name.charCodeAt(i) + ((hash << 5) - hash); }
        return colors[Math.abs(hash) % colors.length];
    };

    const formatStatus = (status) => {
        switch(status) {
            case 'available': return 'Available';
            case 'busy': return 'Busy';
            case 'do_not_disturb': return 'Do Not Disturb';
            case 'offline': return 'Offline';
            default: return 'Online';
        }
    };

    if (loading) {
        return (
            <div className="team-dashboard dashboard-loading">
                <div className="spinner"></div>
                <h2>Loading Team Members...</h2>
            </div>
        );
    }

    if (error) {
        return (
            <div className="team-dashboard">
                <div className="team-dashboard__header">
                    <h1 className="team-dashboard__title">👥 Team Dashboard</h1>
                </div>
                <div className="my-team-page__empty">
                    <h2 style={{ color: 'var(--apple-text-primary)' }}>Failed to Load</h2>
                    <p style={{ color: 'var(--apple-text-secondary)' }}>{error}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="team-dashboard">
            <div className="team-dashboard__header">
                <div>
                    <h1 className="team-dashboard__title">👥 Team Dashboard</h1>
                    <p className="team-dashboard__subtitle">Overview of your team members, their ongoing tasks, and goals.</p>
                </div>
                <div className="team-dashboard__stats">
                    <span style={{ fontWeight: '600', color: 'var(--apple-text-secondary)' }}>
                        {teamMembers.length} Members
                    </span>
                </div>
            </div>

            {teamMembers.length === 0 ? (
                <div className="my-team-page__empty" style={{ textAlign: 'center', padding: '60px 20px' }}>
                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>👥</div>
                    <h2 style={{ color: 'var(--apple-text-primary)' }}>No Team Members Found</h2>
                    <p style={{ color: 'var(--apple-text-secondary)' }}>You aren't assigned to any team or no members were found.</p>
                </div>
            ) : (
                <div className="team-grid">
                    {teamMembers.map((member) => {
                        const memberId = member.id || member._id;
                        const isMe = user && (String(memberId) === String(user.id || user._id));
                        const roleText = (member.role || 'Employee').replace(/_/g, ' ');
                        const dept = member.department || 'General';
                        return (
                            <div key={memberId || Math.random()} className="user-card">
                                
                                {/* Status Indicator */}
                                <div className={`status-indicator status--${member.status || 'available'}`}>
                                    <div className="status-dot"></div>
                                    <span>{formatStatus(member.status || 'available')}</span>
                                </div>

                                {/* Profile Info */}
                                <div className="user-card__profile">
                                    {member.avatar && !member.avatar.includes('default') ? (
                                        <img 
                                            src={member.avatar.startsWith('http') ? member.avatar : `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}${member.avatar}`} 
                                            alt={member.name || 'Member'} 
                                            className="user-card__avatar"
                                            onError={(e) => {
                                                e.target.style.display = 'none';
                                                e.target.nextSibling.style.display = 'flex';
                                            }}
                                        />
                                    ) : null}
                                    <div 
                                        className="user-card__avatar fallback-avatar" 
                                        style={{ 
                                            backgroundColor: getAvatarColor(member.name || '?'),
                                            display: (member.avatar && !member.avatar.includes('default')) ? 'none' : 'flex'
                                        }}
                                    >
                                        {getInitials(member.name || '?')}
                                    </div>
                                    <h3 className="user-card__name">
                                        {member.name || 'Unknown User'}
                                        {isMe && ' (You)'}
                                    </h3>
                                    <p className="user-card__role">{roleText}</p>
                                    <span className="user-card__department">{dept}</span>
                                </div>

                                {/* Progress Bar */}
                                <div className="user-card__progress-container">
                                    <div className="user-card__progress-header">
                                        <span>Sprint Progress</span>
                                        <span className="user-card__progress-val">{member.progress || 0}% Complete</span>
                                    </div>
                                    <div className="user-card__progress-bar">
                                        <div 
                                            className="user-card__progress-fill" 
                                            style={{ width: `${member.progress || 0}%` }}
                                        ></div>
                                    </div>
                                </div>

                                {/* Quick Stats */}
                                <div className="user-card__stats">
                                    <div className="stat-item">
                                        <span className="stat-value">{member.tasksCompleted || 0}</span>
                                        <span className="stat-label">Tasks</span>
                                    </div>
                                    <div className="stat-item">
                                        <span className="stat-value">{member.activeGoals || 0}</span>
                                        <span className="stat-label">Goals</span>
                                    </div>
                                    <div className="stat-item">
                                        <span className="stat-value">{member.pendingReviews || 0}</span>
                                        <span className="stat-label">Reviews</span>
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="user-card__actions">
                                    <button 
                                        className="user-card__btn user-card__btn--primary"
                                        onClick={() => navigate(`/users/${memberId}`)}
                                    >
                                        View Profile
                                    </button>
                                    <button 
                                        className="user-card__btn user-card__btn--secondary"
                                        onClick={() => navigate('/meetings')}
                                    >
                                        Meeting
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

export default MyTeamPage;
