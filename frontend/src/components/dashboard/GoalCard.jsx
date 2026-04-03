import React from 'react';
import ProgressDonut from './ProgressDonut';
import UserAvatar from '../UserAvatar';

function GoalCard({ objectives, goalsList, loading }) {
    if (loading) {
        return (
            <div className="dash-card dash-card--goals">
                <div className="dash-card__header">
                    <span className="dash-card__icon">🎯</span>
                    <h3>Active Goals</h3>
                </div>
                <div className="dash-card__body">
                    <p className="dash-card__loading">Loading goals...</p>
                </div>
            </div>
        );
    }

    const goals = objectives || [];
    const annualGoals = goalsList || [];
    const activeGoals = goals;
    const totalProgress = activeGoals.length > 0
        ? Math.round(activeGoals.reduce((sum, o) => sum + (o.achievementPercent || 0), 0) / activeGoals.length)
        : 0;



    function getGoalStatusInfo(status) {
        const map = {
            draft: { label: 'Draft', color: '#64748b', bg: '#f1f5f9' },
            submitted: { label: 'Submitted', color: '#3b82f6', bg: '#eff6ff' },
            under_review: { label: 'Under Review', color: '#eab308', bg: '#fefce8' },
            needs_revision: { label: 'Needs Revision', color: '#f97316', bg: '#fff7ed' },
            approved: { label: 'Approved', color: '#22c55e', bg: '#f0fdf4' },
            rejected: { label: 'Rejected', color: '#ef4444', bg: '#fef2f2' },
            midyear_assessed: { label: 'Mid-Year', color: '#8b5cf6', bg: '#f5f3ff' },
            final_evaluated: { label: 'Evaluated', color: '#6366f1', bg: '#eef2ff' },
            locked: { label: 'Locked', color: '#1e293b', bg: '#f8fafc' }
        };
        return map[status] || map.draft;
    }

    function getPriorityIcon(p) {
        if (p === 'high') return '⚡';
        if (p === 'critical') return '🔥';
        return '🔹';
    }



    return (
        <div className="dash-card dash-card--goals">
            {/* Annual Goals Section (from /api/goals) */}
            <div style={{ borderBottom: annualGoals.length > 0 ? '2px solid var(--border-color, #e2e8f0)' : 'none', paddingBottom: annualGoals.length > 0 ? '1rem' : '0', marginBottom: annualGoals.length > 0 ? '1rem' : '0' }}>
                <div className="dash-card__header" style={{ marginBottom: '0.75rem' }}>
                    <span className="dash-card__icon">📋</span>
                    <h3>My Annual Goals</h3>
                    <span className="dash-card__count">{annualGoals.length}</span>
                </div>
                {annualGoals.length === 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', color: 'var(--text-muted, #94a3b8)' }}>
                        <div style={{ fontSize: '2rem', marginBottom: '8px' }}>📭</div>
                        <p style={{ margin: 0, textAlign: 'center', fontSize: '0.9rem' }}>
                            No annual goals defined yet.
                            <br />
                            <a href="/annual-goals" style={{ color: 'var(--primary, #4F46E5)', textDecoration: 'none', fontWeight: '600' }}>Set your annual goals →</a>
                        </p>
                    </div>
                ) : (
                    <div className="dash-card__list">
                        {annualGoals.slice(0, 4).map(goal => {
                            const si = getGoalStatusInfo(goal.status);
                            return (
                                <div key={goal._id} className="goal-item" style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border-color, #e2e8f0)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: 0 }}>
                                        <span style={{ fontSize: '1rem', flexShrink: 0 }}>{getPriorityIcon(goal.priority)}</span>
                                        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                                            <span style={{ fontWeight: '600', fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{goal.title}</span>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem', color: 'var(--text-muted, #94a3b8)' }}>
                                                <span>📊 {goal.weight || 0}%</span>
                                                {goal.dueDate && <span>📅 {new Date(goal.dueDate).toLocaleDateString()}</span>}
                                                <span style={{
                                                    padding: '2px 8px',
                                                    borderRadius: '10px',
                                                    background: si.bg,
                                                    color: si.color,
                                                    fontWeight: '700',
                                                    fontSize: '0.7rem'
                                                }}>
                                                    {si.label}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                        {annualGoals.length > 4 && (
                            <div style={{ padding: '0.5rem 1rem', textAlign: 'center' }}>
                                <a href="/annual-goals" style={{ color: 'var(--primary, #4F46E5)', textDecoration: 'none', fontSize: '0.85rem', fontWeight: '600' }}>
                                    View all {annualGoals.length} goals →
                                </a>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Active Goals / Objectives Section */}
            <div className="dash-card__header">
                <span className="dash-card__icon">🎯</span>
                <h3>Active Goals</h3>
                <span className="dash-card__count">{activeGoals.length}</span>
            </div>
            <div className="dash-card__body dash-card__body--split">
                <div className="dash-card__list">
                    {activeGoals.length === 0 ? (
                        <p className="dash-card__empty">No goals matching this filter.</p>
                    ) : (
                        activeGoals.slice(0, 6).map(obj => {
                            const commentCount = (obj.comments || []).length;
                            return (
                                <div key={obj._id} className="goal-item" style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1 }}>
                                        <UserAvatar user={obj.owner} size={32} />
                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                            <span style={{ fontWeight: '600', fontSize: '0.9rem' }}>{obj.title}</span>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                                <span>📅 {new Date(obj.deadline || obj.createdAt).toLocaleDateString()}</span>
                                                {commentCount > 0 && <span>💬 {commentCount}</span>}
                                            </div>
                                        </div>
                                    </div>
                                    <div style={{ width: '80px', textAlign: 'right' }}>
                                        <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>{obj.achievementPercent || 0}%</div>
                                        <div className="progress-bar-bg" style={{ height: '4px', background: 'var(--bg-main)', borderRadius: '2px', marginTop: '4px' }}>
                                            <div style={{ height: '100%', width: `${obj.achievementPercent || 0}%`, background: '#3b82f6', borderRadius: '2px' }} />
                                        </div>
                                    </div>
                                </div>
                            );
                        })
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
