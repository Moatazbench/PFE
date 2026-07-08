import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { useAuth } from '../components/AuthContext';
import { useNavigate, useParams } from 'react-router-dom';
import './MyTeamPage.css';
import { formatRoleLabel } from '../utils/roles';
import UserAvatar from '../components/UserAvatar';

function MyTeamPage() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { id } = useParams();
    const [teamMembers, setTeamMembers] = useState([]);
    const [teamHierarchy, setTeamHierarchy] = useState({ team: null, subTeams: [] });
    const [subteamSummaries, setSubteamSummaries] = useState({});
    const [selectedSubteamId, setSelectedSubteamId] = useState('all');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        fetchTeamMembers();
    }, [id]);

    const fetchTeamMembers = async () => {
        setLoading(true);
        setError('');
        try {
            if (id) {
                const teamRes = await api.get(`/teams/${id}`);
                const data = teamRes.data;
                setTeamHierarchy({
                    team: data,
                    subTeams: data.subTeams || []
                });
                await loadSubteamSummaries(data.subTeams || []);
                
                const allMembers = [];
                if (data.leader) allMembers.push({ ...data.leader, role: 'TEAM_LEADER' });
                if (Array.isArray(data.members)) {
                    data.members.forEach(m => {
                        if (m && m._id && String(m._id) !== String(data.leader?._id)) {
                            allMembers.push(m);
                        }
                    });
                }
                setTeamMembers(allMembers);
            } else {
                const [res, hierarchyRes] = await Promise.all([
                    api.get('/team-members'),
                    api.get('/teams/my-team')
                ]);

                if (Array.isArray(res.data)) {
                    setTeamMembers(res.data);
                } else if (res.data && res.data.members && Array.isArray(res.data.members)) {
                    setTeamMembers(res.data.members);
                } else {
                    setTeamMembers([]);
                }

                setTeamHierarchy({
                    team: hierarchyRes.data?.team || null,
                    subTeams: Array.isArray(hierarchyRes.data?.subTeams) ? hierarchyRes.data.subTeams : []
                });
                await loadSubteamSummaries(Array.isArray(hierarchyRes.data?.subTeams) ? hierarchyRes.data.subTeams : []);
            }
        } catch (err) {
            console.error('Failed to load team dashboard:', err);
            setError('Failed to load team information.');
        } finally {
            setLoading(false);
        }
    };

    const loadSubteamSummaries = async (subTeams) => {
        const results = await Promise.allSettled((subTeams || []).map((team) => api.get(`/teams/${team._id}/summary`)));
        const next = {};
        results.forEach((result) => {
            if (result.status === 'fulfilled' && result.value.data?.summary) {
                next[result.value.data.summary.teamId] = result.value.data.summary;
            }
        });
        setSubteamSummaries(next);
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
        switch (status) {
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
                    <h1 className="team-dashboard__title">Team Dashboard</h1>
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
                    <h1 className="team-dashboard__title">Team Dashboard</h1>
                    <p className="team-dashboard__subtitle">Overview of your team members, their ongoing tasks, and goals.</p>
                </div>
                <div className="team-dashboard__stats">
                    <span style={{ fontWeight: '600', color: 'var(--apple-text-secondary)' }}>
                        {teamMembers.length} Members
                    </span>
                </div>
            </div>

            {teamHierarchy.team && (
                <div className="my-team-page__section">
                    <h2 className="my-team-page__section-title">Team Structure</h2>
                    <div className="my-team-page__leader-card">
                        <div className="my-team-page__person-info">
                            <div className="my-team-page__person-name">{teamHierarchy.team.name}</div>
                            <div className="my-team-page__person-email">
                                {teamHierarchy.team.leader ? `Leader: ${teamHierarchy.team.leader.name}` : 'No leader assigned'}
                            </div>
                            <div className="my-team-page__person-role">
                                {teamHierarchy.subTeams.length} sub-team{teamHierarchy.subTeams.length === 1 ? '' : 's'}
                            </div>
                        </div>
                    </div>

                    {teamHierarchy.subTeams.length > 0 && (
                        <>
                        <div style={{ marginBottom: '1rem' }}>
                            <label style={{ fontWeight: 700, marginRight: '0.6rem' }}>Filter members by subteam</label>
                            <select className="form-select" value={selectedSubteamId} onChange={(event) => setSelectedSubteamId(event.target.value)} style={{ display: 'inline-block', width: 'auto' }}>
                                <option value="all">All subteams</option>
                                {teamHierarchy.subTeams.map((subTeam) => <option key={subTeam._id} value={subTeam._id}>{subTeam.name}</option>)}
                            </select>
                        </div>
                        <div className="my-team-page__members-grid">
                            {teamHierarchy.subTeams.map((subTeam) => {
                                const summary = subteamSummaries[subTeam._id] || {};
                                return (
                                <div key={subTeam._id} className={`subteam-summary-card${selectedSubteamId === subTeam._id ? ' subteam-summary-card--selected' : ''}`} onClick={() => setSelectedSubteamId(subTeam._id)}>
                                    <div className="subteam-summary-card__header">
                                        <div className="subteam-summary-card__title">{subTeam.name}</div>
                                        <button className="btn btn--outline btn--sm subteam-summary-card__button" onClick={(event) => { event.stopPropagation(); navigate(`/teams/${subTeam._id}`); }}>
                                            Open Subteam
                                        </button>
                                    </div>
                                    <div className="subteam-summary-card__leader">
                                        <UserAvatar user={subTeam.leader || { name: 'Unassigned' }} size={36} />
                                        <div>
                                            <span>Leader</span>
                                            <strong>{subTeam.leader?.name || 'No leader assigned'}</strong>
                                        </div>
                                    </div>
                                    <div className="subteam-summary-card__metrics">
                                        <div><span>Members</span><strong>{summary.memberCount ?? subTeam.members?.length ?? 0}</strong></div>
                                        <div><span>Objectives</span><strong>{summary.objectiveProgress == null ? '—' : `${summary.objectiveProgress}%`}</strong></div>
                                        <div><span>Tasks</span><strong>{summary.taskCompletion == null ? '—' : `${summary.taskCompletion}%`}</strong></div>
                                        <div><span>Avg Score</span><strong>{summary.averagePerformanceScore == null ? '—' : `${summary.averagePerformanceScore}%`}</strong></div>
                                    </div>
                                    {summary.weightHealth && (
                                        <div style={{ padding: '10px 16px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
                                            <span style={{color: '#64748b', fontWeight: 500}}>Weight Health</span>
                                            <div style={{display: 'flex', gap: '8px'}}>
                                                {summary.weightHealth.ok > 0 && <span style={{color: '#059669', fontWeight: 600}} title="<= 80%">{summary.weightHealth.ok} OK</span>}
                                                {summary.weightHealth.nearLimit > 0 && <span style={{color: '#d97706', fontWeight: 600}} title="80% - 100%">{summary.weightHealth.nearLimit} Near</span>}
                                                {summary.weightHealth.overloaded > 0 && <span style={{color: '#dc2626', fontWeight: 600}} title="> 100%">{summary.weightHealth.overloaded} Over</span>}
                                                {summary.weightHealth.average > 0 && <span style={{marginLeft: '4px', color: '#0f172a', fontWeight: 700}}>~{summary.weightHealth.average}% avg</span>}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );})}
                        </div>
                        </>
                    )}
                </div>
            )}

            {teamMembers.length === 0 ? (
                <div className="my-team-page__empty" style={{ textAlign: 'center', padding: '60px 20px' }}>
                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>Team</div>
                    <h2 style={{ color: 'var(--apple-text-primary)' }}>No Team Members Found</h2>
                    <p style={{ color: 'var(--apple-text-secondary)' }}>You aren't assigned to any team or no members were found.</p>
                </div>
            ) : (
                <div className="team-grid">
                    {teamMembers.filter((member) => {
                        if (selectedSubteamId === 'all') return true;
                        const selected = teamHierarchy.subTeams.find((subTeam) => String(subTeam._id) === String(selectedSubteamId));
                        const allowed = [selected?.leader?._id, ...(selected?.members || []).map((item) => item._id || item)].filter(Boolean).map(String);
                        return allowed.includes(String(member.id || member._id));
                    }).map((member) => {
                        const memberId = member.id || member._id;
                        const isMe = user && (String(memberId) === String(user.id || user._id));
                        const roleText = formatRoleLabel(member.role || 'Employee');
                        const dept = member.department || 'General';
                        return (
                            <div key={memberId || Math.random()} className="user-card">
                                <div className={`status-indicator status--${member.status || 'available'}`}>
                                    <div className="status-dot"></div>
                                    <span>{formatStatus(member.status || 'available')}</span>
                                </div>

                                <div className="user-card__profile">
                                    {member.avatar && !member.avatar.includes('default') ? (
                                        <img
                                            src={member.avatar.startsWith('http') ? member.avatar : member.avatar}
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

                                <div className="user-card__actions">
                                    <button
                                        className="user-card__btn user-card__btn--primary"
                                        onClick={() => navigate(`/users/${memberId}`)}
                                    >
                                        View Profile
                                    </button>
                                    <button
                                        className="user-card__btn user-card__btn--secondary"
                                        onClick={() => navigate('/meetings', { state: {
                                            createMeeting: true,
                                            title: 'Meeting with ' + (member.name || 'Team Member'),
                                            type: 'one_on_one',
                                            meeting_type: 'general',
                                            employee_id: String(memberId),
                                            participants: [String(memberId)]
                                        }})}
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
