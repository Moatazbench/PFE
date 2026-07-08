import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { aiAPI } from '../../api/ai';
import UserAvatar from '../UserAvatar';
import './AIPredictionSimulator.css';

function formatRole(role) {
    return String(role || '').replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

const AIPredictionSimulator = ({ cycleId }) => {
    const navigate = useNavigate();
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        let cancelled = false;
        if (!cycleId) return undefined;
        aiAPI.getPerformanceUsers(cycleId)
            .then((response) => {
                if (!cancelled) setUsers(response.users || []);
            })
            .catch((err) => {
                if (!cancelled) setError(err.message || 'Failed to load employees.');
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => { cancelled = true; };
    }, [cycleId]);

    if (loading) {
        return <div className="predictor-state"><div className="spinner"></div><p>Loading authorized employee metrics…</p></div>;
    }

    if (error) {
        return (
            <div className="ent-empty-state" style={{ margin: '24px auto', maxWidth: '600px', backgroundColor: 'var(--shell-bg-card)', border: '1px solid var(--shell-warning)' }}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--shell-warning)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 16 }}>
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                  <line x1="12" y1="9" x2="12" y2="13"></line>
                  <line x1="12" y1="17" x2="12.01" y2="17"></line>
                </svg>
                <h3 style={{ color: 'var(--shell-text)', fontSize: '1.25rem', fontWeight: 600, marginBottom: '8px' }}>Predictor Unavailable</h3>
                <p style={{ color: 'var(--shell-text-secondary)', marginBottom: '12px' }}>{error}</p>
                <p style={{ color: 'var(--shell-text-tertiary)', fontSize: '0.9rem', maxWidth: '400px' }}>
                    Not enough data for a reliable AI prediction yet. Prediction will improve after more objectives, tasks, and evaluations are available.
                </p>
            </div>
        );
    }

    return (
        <section className="predictor-shell">
            <div className="predictor-heading">
                <div>
                    <span className="predictor-eyebrow" style={{ color: 'var(--shell-purple)', fontWeight: 600, fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>✨ AI Performance Predictor</span>
                    <h2>Choose an employee</h2>
                    <p>Predictions use project metrics already recorded for the selected cycle.</p>
                </div>
                <span className="predictor-count">{users.length} visible</span>
            </div>

            {users.length === 0 ? (
                <div className="ent-empty-state">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="8" x2="12" y2="12"></line>
                        <line x1="12" y1="16" x2="12.01" y2="16"></line>
                    </svg>
                    <h3>No employees found</h3>
                    <p>No employees with accessible prediction data are available in this cycle.</p>
                </div>
            ) : (
                <div className="predictor-grid">
                    {users.map((item, index) => {
                        const employee = item.employee;
                        return (
                            <article className="predictor-card" key={employee._id} style={{ '--delay': `${Math.min(index * 45, 360)}ms` }}>
                                <div className="predictor-person">
                                    <UserAvatar user={employee} size={54} />
                                    <div>
                                        <h3>{employee.name}</h3>
                                        <p>{formatRole(employee.role)}</p>
                                    </div>
                                    <span className={`predictor-status predictor-status--${item.prediction_status}`}>
                                        {item.prediction_status === 'ready' ? 'Ready' : 'More data needed'}
                                    </span>
                                </div>
                                <div className="predictor-meta">
                                    <span><small>Team</small>{employee.team?.name || 'Not assigned'}</span>
                                    <span><small>Current score</small>{item.current_score == null ? '—' : `${item.current_score}%`}</span>
                                    <span><small>Objectives</small>{item.objective_completion_percent == null ? '—' : `${item.objective_completion_percent}%`}</span>
                                </div>
                                <button
                                    className="btn btn--primary predictor-action"
                                    onClick={() => navigate(`/performance/predictor/${employee._id}?cycleId=${encodeURIComponent(cycleId)}`)}
                                >
                                    Predict Performance
                                </button>
                            </article>
                        );
                    })}
                </div>
            )}
        </section>
    );
};

export default AIPredictionSimulator;
