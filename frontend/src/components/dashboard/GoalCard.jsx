import React from 'react';
import ProgressDonut from './ProgressDonut';
import UserAvatar from '../UserAvatar';

function GoalCard({ objectives, loading }) {
    if (loading) {
        return (
            <div className="dash-card dash-card--goals">
                <div className="dash-card__header">
                    <span className="dash-card__icon">🎯</span>
                    <h3>Objectives</h3>
                </div>
                <div className="dash-card__body">
                    <p className="dash-card__loading">Loading objectives...</p>
                </div>
            </div>
        );
    }

    const goals = objectives || [];
    const activeGoals = goals;
    const totalProgress = activeGoals.length > 0
        ? Math.round(activeGoals.reduce((sum, o) => sum + (o.achievementPercent || 0), 0) / activeGoals.length)
        : 0;

    // Status breakdown
    const statusBreakdown = {};
    activeGoals.forEach(function(o) {
        var s = o.status || 'draft';
        statusBreakdown[s] = (statusBreakdown[s] || 0) + 1;
    });

    function getStatusInfo(status) {
        const map = {
            draft: { label: 'Draft', color: '#64748b', bg: '#f1f5f9' },
            pending: { label: 'Pending', color: '#d97706', bg: '#fffbeb' },
            submitted: { label: 'Submitted', color: '#3b82f6', bg: '#eff6ff' },
            approved: { label: 'Approved', color: '#059669', bg: '#ecfdf5' },
            validated: { label: 'Validated', color: '#059669', bg: '#ecfdf5' },
            rejected: { label: 'Rejected', color: '#ef4444', bg: '#fef2f2' },
            revision_requested: { label: 'Revision', color: '#ea580c', bg: '#fff7ed' },
            pending_approval: { label: 'Pending', color: '#d97706', bg: '#fffbeb' },
        };
        return map[status] || map.draft;
    }

    return (
        <div className="dash-card dash-card--goals">
            <div className="dash-card__header">
                <span className="dash-card__icon">🎯</span>
                <h3>Objectives</h3>
                <span className="dash-card__count">{activeGoals.length}</span>
            </div>

            {/* Status breakdown pills */}
            {activeGoals.length > 0 && (
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', padding: '0 1rem 0.75rem', borderBottom: '1px solid var(--border-color, #e2e8f0)' }}>
                    {Object.entries(statusBreakdown).map(function(entry) {
                        var si = getStatusInfo(entry[0]);
                        return (
                            <span key={entry[0]} style={{ padding: '2px 8px', borderRadius: '10px', background: si.bg, color: si.color, fontWeight: 700, fontSize: '0.7rem' }}>
                                {si.label}: {entry[1]}
                            </span>
                        );
                    })}
                </div>
            )}

            <div className="dash-card__body dash-card__body--split">
                <div className="dash-card__list">
                    {activeGoals.length === 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem', color: 'var(--text-muted, #94a3b8)' }}>
                            <div style={{ fontSize: '2rem', marginBottom: '8px' }}>📭</div>
                            <p style={{ margin: 0, textAlign: 'center', fontSize: '0.9rem' }}>
                                No objectives yet.
                                <br />
                                <a href="/goals" style={{ color: 'var(--primary, #4F46E5)', textDecoration: 'none', fontWeight: '600' }}>Create objectives →</a>
                            </p>
                        </div>
                    ) : (
                        activeGoals.slice(0, 6).map(obj => {
                            const commentCount = (obj.comments || []).length;
                            const si = getStatusInfo(obj.status);
                            const lastUpdated = obj.updatedAt || obj.createdAt;
                            return (
                                <div key={obj._id} className="goal-item" style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: 0 }}>
                                        <UserAvatar user={obj.owner} size={28} />
                                        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                                            <span style={{ fontWeight: '600', fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{obj.title}</span>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                                <span style={{ padding: '1px 6px', borderRadius: '8px', background: si.bg, color: si.color, fontWeight: 700 }}>{si.label}</span>
                                                {obj.weight && <span>⚖️ {obj.weight}%</span>}
                                                {commentCount > 0 && <span>💬 {commentCount}</span>}
                                            </div>
                                            <span style={{ marginTop: '3px', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                                Updated {lastUpdated ? new Date(lastUpdated).toLocaleDateString() : 'â€”'}
                                            </span>
                                        </div>
                                    </div>
                                    <div style={{ width: '65px', textAlign: 'right' }}>
                                        <div style={{ fontWeight: 'bold', fontSize: '0.85rem' }}>{obj.achievementPercent || 0}%</div>
                                        <div className="progress-bar-bg" style={{ height: '4px', background: 'var(--bg-main)', borderRadius: '2px', marginTop: '3px' }}>
                                            <div style={{ height: '100%', width: `${obj.achievementPercent || 0}%`, background: (obj.achievementPercent || 0) >= 80 ? '#059669' : '#3b82f6', borderRadius: '2px' }} />
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                    {activeGoals.length > 6 && (
                        <div style={{ padding: '0.5rem 1rem', textAlign: 'center' }}>
                            <a href="/goals" style={{ color: 'var(--primary, #4F46E5)', textDecoration: 'none', fontSize: '0.85rem', fontWeight: '600' }}>
                                View all {activeGoals.length} objectives →
                            </a>
                        </div>
                    )}
                </div>
                {activeGoals.length > 0 && (
                    <div className="dash-card__donut-section">
                        <ProgressDonut percent={totalProgress} size={100} color="#7C3AED" label="Overall" />
                    </div>
                )}
            </div>
        </div>
    );
}

export default GoalCard;
