import React, { useState } from 'react';
import api from '../../services/api';
import { useAuth } from '../AuthContext';

function EditGoalModal({ goal, onClose, onUpdated, cycles, parentGoals, existingObjectives }) {
    var { user } = useAuth();
    var [form, setForm] = useState({
        title: goal.title || '',
        description: goal.description || '',
        successIndicator: goal.successIndicator || '',
        weight: goal.weight || 20,
        deadline: goal.deadline ? goal.deadline.substring(0, 10) : '',
        startDate: goal.startDate ? goal.startDate.substring(0, 10) : '',
        cycle: goal.cycle?._id || goal.cycle || '',
        category: goal.category || 'individual',
        labels: (goal.labels || []).join(', '),
        visibility: goal.visibility || 'public',
        parentObjective: goal.parentObjective?._id || goal.parentObjective || '',
    });
    var [error, setError] = useState('');
    var [loading, setLoading] = useState(false);

    // Smart weight calculation (Bug 7 fix) — exclude current goal from used weight
    var currentCycleObjectives = (existingObjectives || []).filter(function(o) {
        var objCycleId = o.cycle?._id || o.cycle;
        return objCycleId === form.cycle && o.category === form.category && o._id !== goal._id;
    });
    var usedWeight = currentCycleObjectives.reduce(function(sum, o) { return sum + (o.weight || 0); }, 0);
    var remainingWeight = Math.max(0, 100 - usedWeight);
    var maxWeight = Math.min(100, remainingWeight);

    function handleChange(field, value) {
        setForm(function (prev) {
            var next = Object.assign({}, prev);
            next[field] = value;
            return next;
        });
    }

    async function handleSubmit(e) {
        e.preventDefault();
        setError('');
        
        var newWeight = parseInt(form.weight);
        if (newWeight > remainingWeight) {
            setError('Weight (' + newWeight + '%) exceeds remaining capacity (' + remainingWeight + '%). Adjust your weight.');
            return;
        }

        setLoading(true);
        try {
            var payload = {
                title: form.title,
                description: form.description,
                successIndicator: form.successIndicator,
                weight: newWeight,
                deadline: form.deadline || null,
                startDate: form.startDate || null,
                cycle: form.cycle,
                category: form.category,
                labels: form.labels ? form.labels.split(',').map(function (l) { return l.trim(); }).filter(Boolean) : [],
                visibility: form.visibility,
                parentObjective: form.parentObjective || null,
            };
            await api.put('/api/objectives/' + goal._id, payload);
            if (onUpdated) onUpdated();
            onClose();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to update goal');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="goal-modal-overlay" onClick={onClose}>
            <div className="goal-modal" onClick={function (e) { e.stopPropagation(); }}>
                <div className="goal-modal__header">
                    <h2>✏️ Edit Goal</h2>
                    <button className="goal-modal__close" onClick={onClose}>✕</button>
                </div>

                {error && <div className="goal-modal__error">{error}</div>}

                {goal.status === 'rejected' && goal.managerComments && (
                    <div className="rejected-edit-notice">
                        <h4>⚠️ This goal was rejected by your manager</h4>
                        <p>{goal.managerComments}</p>
                    </div>
                )}

                <form className="goal-modal__form" onSubmit={handleSubmit}>
                    {/* Goal Type indicator */}
                    <div className="goal-modal__field">
                        <label>Goal Type</label>
                        <div className="goal-type-selector">
                            <div className={'goal-type-card goal-type-card--small' + (form.category === 'individual' ? ' goal-type-card--active' : '')} onClick={function() { handleChange('category', 'individual'); }}>
                                <div className="goal-type-card__icon">🧑</div>
                                <div className="goal-type-card__label">Individual</div>
                            </div>
                            {(user.role === 'TEAM_LEADER' || user.role === 'ADMIN') && (
                                <div className={'goal-type-card goal-type-card--small' + (form.category === 'team' ? ' goal-type-card--active' : '')} onClick={function() { handleChange('category', 'team'); }}>
                                    <div className="goal-type-card__icon">👥</div>
                                    <div className="goal-type-card__label">Team</div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="goal-modal__field">
                        <label>Goal Title *</label>
                        <input type="text" value={form.title} onChange={function (e) { handleChange('title', e.target.value); }} required minLength={5} maxLength={100} />
                    </div>

                    <div className="goal-modal__field">
                        <label>Description</label>
                        <textarea value={form.description} onChange={function (e) { handleChange('description', e.target.value); }} rows={2}></textarea>
                    </div>

                    <div className="goal-modal__field">
                        <label>Success Indicator (SMART)</label>
                        <textarea value={form.successIndicator} onChange={function (e) { handleChange('successIndicator', e.target.value); }} rows={2}></textarea>
                    </div>

                    <div className="goal-modal__field">
                        <label>Cycle *</label>
                        <select value={form.cycle} onChange={function (e) { handleChange('cycle', e.target.value); }} required>
                            <option value="">Select Cycle</option>
                            {cycles && cycles.map(function (c) { return <option key={c._id} value={c._id}>{c.name} ({c.year})</option>; })}
                        </select>
                    </div>

                    <div className="goal-modal__row">
                        <div className="goal-modal__field">
                            <label>Start Date</label>
                            <input type="date" value={form.startDate} onChange={function (e) { handleChange('startDate', e.target.value); }} />
                        </div>
                        <div className="goal-modal__field">
                            <label>End Date</label>
                            <input type="date" value={form.deadline} onChange={function (e) { handleChange('deadline', e.target.value); }} />
                        </div>
                    </div>

                    {/* Smart weight system */}
                    <div className="goal-modal__field">
                        <label>Weight: {form.weight}%</label>
                        <input type="range" min="1" max={maxWeight || 1} value={Math.min(form.weight, maxWeight)} onChange={function (e) { handleChange('weight', e.target.value); }} />
                        <div className="weight-capacity-bar">
                            <div className="weight-capacity-bar__track">
                                <div className="weight-capacity-bar__used" style={{ width: usedWeight + '%' }}></div>
                                <div className="weight-capacity-bar__new" style={{ width: Math.min(form.weight, remainingWeight) + '%', left: usedWeight + '%' }}></div>
                            </div>
                            <div className="weight-capacity-bar__labels">
                                <span>Used: {usedWeight}%</span>
                                <span>This goal: {form.weight}%</span>
                                <span>Remaining: {Math.max(0, remainingWeight - form.weight)}%</span>
                            </div>
                        </div>
                        {parseInt(form.weight) > remainingWeight && (
                            <div className="weight-warning">⚠️ Weight exceeds remaining capacity ({remainingWeight}% available)</div>
                        )}
                    </div>

                    <div className="goal-modal__row">
                        <div className="goal-modal__field">
                            <label>Labels (comma-separated)</label>
                            <input type="text" value={form.labels} onChange={function (e) { handleChange('labels', e.target.value); }} />
                        </div>
                        <div className="goal-modal__field">
                            <label>Visibility</label>
                            <select value={form.visibility} onChange={function (e) { handleChange('visibility', e.target.value); }}>
                                <option value="public">Public</option>
                                <option value="team">Team</option>
                                <option value="department">Department</option>
                                <option value="private">Private</option>
                            </select>
                        </div>
                    </div>

                    {parentGoals && parentGoals.length > 0 && (
                        <div className="goal-modal__field">
                            <label>Parent Goal</label>
                            <select value={form.parentObjective} onChange={function (e) { handleChange('parentObjective', e.target.value); }}>
                                <option value="">None (Top-Level Goal)</option>
                                {parentGoals.filter(function (p) { return p._id !== goal._id; }).map(function (p) { return <option key={p._id} value={p._id}>{p.title}</option>; })}
                            </select>
                        </div>
                    )}

                    <div className="goal-modal__actions">
                        <button type="submit" className="goal-modal__submit" disabled={loading || parseInt(form.weight) > remainingWeight}>{loading ? 'Saving...' : 'Save Changes'}</button>
                        <button type="button" className="goal-modal__cancel" onClick={onClose}>Cancel</button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default EditGoalModal;
