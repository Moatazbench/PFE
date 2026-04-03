import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import ProgressDonut from './ProgressDonut';

function TaskCard() {
    var [tasks, setTasks] = useState([]);
    var [loading, setLoading] = useState(true);
    var [stats, setStats] = useState({ done: 0, total: 0 });

    useEffect(function () {
        async function fetch() {
            try {
                var [resTasks, resStats] = await Promise.all([
                    api.get('/api/tasks/my', { params: { status: 'todo' } }),
                    api.get('/api/tasks/stats')
                ]);
                setTasks((resTasks.data.tasks || []).slice(0, 3));
                if (resStats.data.stats) {
                    setStats({
                        done: resStats.data.stats.done || 0,
                        total: resStats.data.stats.total || 0,
                        completionRate: resStats.data.stats.completionRate || 0
                    });
                }
            } catch (err) { console.error(err); }
            finally { setLoading(false); }
        }
        fetch();
    }, []);

    function getPriorityColor(p) {
        return { high: '#EF4444', medium: '#F59E0B', low: '#10B981' }[p] || '#6B7280';
    }

    return (
        <div className="dash-card dash-card--tasks">
            <div className="dash-card__header">
                <span className="dash-card__icon">✅</span>
                <h3>Pending Tasks</h3>
            </div>
            <div className="dash-card__body dash-card__body--split">
                <div className="dash-card__list">
                    {loading ? (
                        <p className="dash-card__loading">Loading...</p>
                    ) : tasks.length === 0 ? (
                        <div className="dash-card__empty-state">
                            <p>No pending tasks</p>
                            <Link to="/tasks" className="dash-card__link">Create a task →</Link>
                        </div>
                    ) : (
                        <div>
                            {tasks.map(function(t) {
                                return (
                                    <div key={t._id} style={{ marginBottom: '12px', borderBottom: '1px solid #f3f4f6', paddingBottom: '8px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: getPriorityColor(t.priority) }}></div>
                                            <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#111827' }}>{t.title}</span>
                                        </div>
                                        {t.dueDate && <div style={{ fontSize: '0.75rem', color: '#6B7280', paddingLeft: '16px' }}>Due: {new Date(t.dueDate).toLocaleDateString()}</div>}
                                    </div>
                                );
                            })}
                            <Link to="/tasks" className="dash-card__link" style={{ display: 'block', textAlign: 'center', marginTop: '8px', fontSize: '13px' }}>View all tasks →</Link>
                        </div>
                    )}
                </div>
                <div className="dash-card__donut-section">
                    <ProgressDonut percent={stats.completionRate || 0} size={80} color="#3B82F6" label="Done" />
                </div>
            </div>
        </div>
    );
}

export default TaskCard;
