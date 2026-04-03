import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { useAuth } from '../AuthContext';

function CreateGoalModal({ onClose, onCreated, cycles, selectedCycle, parentGoals, existingObjectives }) {
    var { user } = useAuth();
    var [form, setForm] = useState({
        title: '',
        description: '',
        successIndicator: '',
        weight: 20,
        deadline: '',
        startDate: '',
        cycle: selectedCycle || '',
        category: 'individual',
        labels: '',
        visibility: 'public',
        parentObjective: '',
        targetUser: '',
        targetTeam: ''
    });
    var [error, setError] = useState('');
    var [loading, setLoading] = useState(false);
    var [availableTeams, setAvailableTeams] = useState([]);
    var [availableUsers, setAvailableUsers] = useState([]);

    useEffect(() => {
        if (user.role === 'TEAM_LEADER' || user.role === 'ADMIN' || user.role === 'HR') {
            const fetchAssignmentData = async () => {
                try {
                    const res = await api.get('/api/teams');
                    const teamsData = res.data;
                    setAvailableTeams(teamsData);
                        
                        let usersMap = new Map();
                        teamsData.forEach(t => {
                            if (t.members) t.members.forEach(m => usersMap.set(m._id, m));
                        });
                        setAvailableUsers(Array.from(usersMap.values()));
                } catch (err) {
                    console.error("Failed to fetch assignment data", err);
                }
            };
            fetchAssignmentData();
        }
    }, [user.role]);

    // Smart weight calculation (Bug 7 fix)
    var currentCycleObjectives = (existingObjectives || []).filter(function(o) {
        var objCycleId = o.cycle?._id || o.cycle;
        return objCycleId === (form.cycle || selectedCycle) && o.category === form.category;
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

    async function handleAIGenerate(e) {
        e.preventDefault();
        setLoading(true);
        try {
            var res = await api.post('/api/ai/generate-goal', {
                department: user.department || 'General',
                context: form.title || ''
            });
            
            var suggestedWeight = Math.min(res.data.weight || 20, remainingWeight);
            setForm(prev => ({
                ...prev,
                title: res.data.title || prev.title,
                description: res.data.description || prev.description,
                successIndicator: res.data.successIndicator || prev.successIndicator,
                weight: suggestedWeight
            }));
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }

    async function handleSubmit(e) {
        e.preventDefault();
        setError('');

        // Validate weight doesn't exceed remaining
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
                successIndicator: form.successIndicator || form.title,
                weight: newWeight,
                deadline: form.deadline || null,
                startDate: form.startDate || null,
                cycle: form.cycle,
                category: form.category,
                labels: form.labels ? form.labels.split(',').map(function (l) { return l.trim(); }).filter(Boolean) : [],
                visibility: form.visibility,
                parentObjective: form.parentObjective || null,
                targetUser: form.targetUser || null,
                targetTeam: form.targetTeam || null
            };
            await api.post('/api/objectives', payload);
            if (onCreated) onCreated();
            onClose();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to create goal');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="goal-modal-overlay" onClick={onClose}>
            <div className="goal-modal" onClick={function (e) { e.stopPropagation(); }}>
                <div className="goal-modal__header">
                    <h2>Create New Goal</h2>
                    <button className="goal-modal__close" onClick={onClose}>✕</button>
                </div>

                {error && <div className="goal-modal__error">{error}</div>}

                <form className="goal-modal__form" onSubmit={handleSubmit}>
                    <div className="goal-modal__split-layout" style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '2rem' }}>
                        
                        {/* LEFT COLUMN: Main Info */}
                        <div className="goal-modal__main-info">
                            <div className="goal-modal__field">
                                <label>Goal Type *</label>
                                <div className="goal-type-selector" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                    <div
                                        className={'goal-type-card' + (form.category === 'individual' ? ' goal-type-card--active' : '')}
                                        onClick={function() { handleChange('category', 'individual'); }}
                                        style={{ padding: '1rem', border: '1px solid var(--border-color)', borderRadius: '12px', cursor: 'pointer', textAlign: 'center' }}
                                    >
                                        <div style={{ fontSize: '1.5rem' }}>🧑</div>
                                        <div style={{ fontWeight: 'bold' }}>Individual</div>
                                    </div>
                                    {(user.role === 'TEAM_LEADER' || user.role === 'ADMIN') && (
                                        <div
                                            className={'goal-type-card' + (form.category === 'team' ? ' goal-type-card--active' : '')}
                                            onClick={function() { handleChange('category', 'team'); }}
                                            style={{ padding: '1rem', border: '1px solid var(--border-color)', borderRadius: '12px', cursor: 'pointer', textAlign: 'center' }}
                                        >
                                            <div style={{ fontSize: '1.5rem' }}>👥</div>
                                            <div style={{ fontWeight: 'bold' }}>Team</div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="goal-modal__field">
                                <label>Goal Title *</label>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <input type="text" value={form.title} onChange={function (e) { handleChange('title', e.target.value); }} placeholder="e.g. Achieve Company Growth" required minLength={5} maxLength={100} style={{ flex: 1 }} />
                                    <button type="button" onClick={handleAIGenerate} disabled={loading} className="btn btn--secondary btn--sm" title="Let AI write a SMART goal for you">
                                        ✨ AI Assist
                                    </button>
                                </div>
                            </div>

                            <div className="goal-modal__field">
                                <label>What does success look like? (Success Indicator)</label>
                                <textarea value={form.successIndicator} onChange={function (e) { handleChange('successIndicator', e.target.value); }} placeholder="SMART criteria..." rows={2} minLength={10}></textarea>
                            </div>

                            <div className="goal-modal__field">
                                <label>Description (Optional)</label>
                                <textarea value={form.description} onChange={function (e) { handleChange('description', e.target.value); }} placeholder="Describe this goal..." rows={4}></textarea>
                            </div>
                        </div>

                        {/* RIGHT COLUMN: Metadata & Settings */}
                        <div className="goal-modal__side-info" style={{ background: 'var(--bg-main)', padding: '1.5rem', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
                            <div className="goal-modal__field">
                                <label>Evaluation Cycle *</label>
                                <select value={form.cycle} onChange={function (e) { handleChange('cycle', e.target.value); }} required>
                                    <option value="">Select Cycle</option>
                                    {cycles.map(function (c) { return <option key={c._id} value={c._id}>{c.name} ({c.year})</option>; })}
                                </select>
                            </div>


                            {(user.role === 'TEAM_LEADER' || user.role === 'ADMIN' || user.role === 'HR') && (
                                <div className="goal-modal__field">
                                    <label>{form.category === 'individual' ? 'Assign To' : 'Target Team'}</label>
                                    {form.category === 'individual' ? (
                                        <select value={form.targetUser} onChange={function (e) { handleChange('targetUser', e.target.value); }}>
                                            <option value="">Myself</option>
                                            {availableUsers.map(function (u) { return <option key={u._id} value={u._id}>{u.name}</option>; })}
                                        </select>
                                    ) : (
                                        <select value={form.targetTeam} onChange={function (e) { handleChange('targetTeam', e.target.value); }} required={form.category === 'team'}>
                                            <option value="">Select Team</option>
                                            {availableTeams.map(function (t) { return <option key={t._id} value={t._id}>{t.name}</option>; })}
                                        </select>
                                    )}
                                </div>
                            )}

                            <div className="goal-modal__row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                                <div className="goal-modal__field">
                                    <label>Start Date</label>
                                    <input type="date" value={form.startDate} onChange={function (e) { handleChange('startDate', e.target.value); }} />
                                </div>
                                <div className="goal-modal__field">
                                    <label>Due Date</label>
                                    <input type="date" value={form.deadline} onChange={function (e) { handleChange('deadline', e.target.value); }} />
                                </div>
                            </div>

                            <div className="goal-modal__field">
                                <label>Weight: {form.weight}%</label>
                                <input type="range" min="1" max={maxWeight || 1} value={form.weight} onChange={function (e) { handleChange('weight', e.target.value); }} style={{ width: '100%' }} />
                                <div style={{ fontSize: '0.75rem', marginTop: '4px', textAlign: 'right', color: 'var(--text-muted)' }}>
                                    Remaining: {remainingWeight}%
                                </div>
                            </div>

                            <div className="goal-modal__field">
                                <label>Priority Labels</label>
                                <input type="text" value={form.labels} onChange={function (e) { handleChange('labels', e.target.value); }} placeholder="e.g. High, Q1" />
                            </div>

                            <div className="goal-modal__field">
                                <label>Visibility</label>
                                <select value={form.visibility} onChange={function (e) { handleChange('visibility', e.target.value); }}>
                                    <option value="public">Public (Shared)</option>
                                    <option value="team">Team Only</option>
                                    <option value="department">Dept Only</option>
                                    <option value="private">Private</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="goal-modal__actions" style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }}>
                        <button type="button" className="btn btn--outline" onClick={onClose}>Cancel</button>
                        <button type="submit" className="btn btn--primary" disabled={loading || parseInt(form.weight) > remainingWeight}>
                            {loading ? 'Creating...' : 'Create Goal'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default CreateGoalModal;
