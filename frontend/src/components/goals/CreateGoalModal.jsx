import React, { useState, useEffect, useMemo } from 'react';
import api from '../../services/api';
import { useAuth } from '../AuthContext';
import { normalizeWeight, sumObjectiveWeights, validateObjectiveForm } from '../../utils/objectiveRules';

function CreateGoalModal({ onClose, onCreated, cycles, selectedCycle, parentGoals, existingObjectives }) {
    var { user } = useAuth();
    var [form, setForm] = useState({
        title: '',
        description: '',
        successIndicator: '',
        weight: 20,
        cycle: selectedCycle || '',
        category: 'individual',
        labels: '',
        visibility: 'team',
        parentObjective: '',
        targetUser: '',
        targetTeam: ''
    });
    var [error, setError] = useState('');
    var [loading, setLoading] = useState(false);
    var [availableTeams, setAvailableTeams] = useState([]);
    var [availableUsers, setAvailableUsers] = useState([]);
    var [aiLoading, setAiLoading] = useState('');
    var [aiError, setAiError] = useState('');
    var [analysisResult, setAnalysisResult] = useState(null);
    var [refinementResult, setRefinementResult] = useState(null);
    var [fieldErrors, setFieldErrors] = useState({});
    var [capacityInfo, setCapacityInfo] = useState({ remainingWeight: null, message: '' });
    var [aiSuggestions, setAiSuggestions] = useState(null);
    var [aiSuggestionsLoading, setAiSuggestionsLoading] = useState(false);

    useEffect(() => {
        if (user.role === 'TEAM_LEADER' || user.role === 'ADMIN' || user.role === 'HR') {
            const fetchAssignmentData = async () => {
                try {
                    const res = await api.get('/api/teams');
                    const teamsData = Array.isArray(res.data) ? res.data : (res.data?.teams || []);
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

    useEffect(function () {
        var activeCycle = form.cycle || selectedCycle;
        if (!activeCycle) {
            setCapacityInfo({ remainingWeight: null, message: '' });
            return;
        }

        async function updateCapacity() {
            try {
                if (form.category === 'team' && form.targetTeam) {
                    var res = await api.get('/api/objectives', { params: { cycle: activeCycle, scope: 'team' } });
                    var objectivesData = Array.isArray(res.data.objectives) ? res.data.objectives : [].concat(res.data.individualObjectives || [], res.data.teamObjectives || []);
                    var selectedTeam = availableTeams.find(function (team) { return team._id === form.targetTeam; });
                    if (!selectedTeam) {
                        setCapacityInfo({ remainingWeight: null, message: '' });
                        return;
                    }
                    var memberIds = (selectedTeam.members || []).map(function (member) { return String(member._id || member); });
                    var memberWeights = {};
                    objectivesData.filter(function (objective) {
                        return objective.category === 'team' && memberIds.indexOf(String(objective.owner)) !== -1;
                    }).forEach(function (objective) {
                        var ownerId = String(objective.owner);
                        memberWeights[ownerId] = (memberWeights[ownerId] || 0) + normalizeWeight(objective.weight);
                    });
                    var remainingByMember = memberIds.map(function (id) { return Math.max(0, 100 - (memberWeights[id] || 0)); });
                    var minimumRemaining = remainingByMember.length > 0 ? Math.min.apply(null, remainingByMember) : 100;
                    setCapacityInfo({ remainingWeight: minimumRemaining, message: `Team capacity sets the max new objective weight to ${minimumRemaining}%.` });
                    return;
                }

                if (form.category === 'individual' && form.targetUser && form.targetUser !== user.id) {
                    var res = await api.get('/api/objectives/user/' + form.targetUser + '/cycle/' + activeCycle);
                    var userObjectives = Array.isArray(res.data.individualObjectives) ? res.data.individualObjectives : [];
                    var usedWeightForUser = sumObjectiveWeights(userObjectives);
                    var remaining = Math.max(0, 100 - usedWeightForUser);
                    setCapacityInfo({ remainingWeight: remaining, message: `Assigned employee has ${remaining}% remaining capacity for individual objectives.` });
                    return;
                }

                setCapacityInfo({ remainingWeight: null, message: '' });
            } catch (err) {
                console.error('Failed to fetch capacity info', err);
                setCapacityInfo({ remainingWeight: null, message: '' });
            }
        }

        updateCapacity();
    }, [form.category, form.targetTeam, form.targetUser, form.cycle, selectedCycle, availableTeams, user.id]);

    // Smart weight calculation (Bug 7 fix)
    var currentCycleObjectives = (existingObjectives || []).filter(function(o) {
        var objCycleId = o.cycle?._id || o.cycle;
        return objCycleId === (form.cycle || selectedCycle) && o.category === form.category;
    });
    var usedWeight = sumObjectiveWeights(currentCycleObjectives);
    var localRemainingWeight = Math.max(0, 100 - usedWeight);
    var effectiveRemainingWeight = typeof capacityInfo.remainingWeight === 'number' ? capacityInfo.remainingWeight : localRemainingWeight;
    var remainingWeight = Math.max(0, effectiveRemainingWeight);
    var maxWeight = Math.min(100, Math.max(1, remainingWeight));
    var selectedCycleData = (cycles || []).find(function (cycle) { return cycle._id === (form.cycle || selectedCycle); });
    var currentPhase = selectedCycleData?.currentPhase || 'phase1';
    var cycleStatus = selectedCycleData?.status || 'draft';
    var isCreateLocked = cycleStatus !== 'draft' && currentPhase !== 'phase1' && user.role !== 'ADMIN';

    function handleChange(field, value) {
        setForm(function (prev) {
            var next = Object.assign({}, prev);
            next[field] = value;
            return next;
        });
        setFieldErrors(function (prev) {
            if (!prev[field]) return prev;
            var next = Object.assign({}, prev);
            delete next[field];
            return next;
        });
        setError('');
    }

    var validation = useMemo(function () {
        return validateObjectiveForm(form, {
            remainingWeight: remainingWeight,
            requireTargetTeam: user.role === 'TEAM_LEADER' || user.role === 'ADMIN' || user.role === 'HR'
        });
    }, [form, remainingWeight, user.role]);

    function getObjectivePayload() {
        return {
            title: form.title,
            description: form.description,
            successIndicator: form.successIndicator
        };
    }

    async function handleAnalyzeObjective() {
        setAiLoading('analyze');
        setAiError('');
        try {
            var res = await api.post('/api/ai/analyze-objective-quality', getObjectivePayload());
            setAnalysisResult(res.data);
        } catch (err) {
            setAiError(err.response?.data?.message || 'Failed to analyze objective.');
        } finally {
            setAiLoading('');
        }
    }

    async function handleRefineObjective() {
        setAiLoading('refine');
        setAiError('');
        try {
            var res = await api.post('/api/ai/refine-objective', Object.assign({}, getObjectivePayload(), {
                context: { department: user.department || 'General' }
            }));
            setRefinementResult(res.data);
        } catch (err) {
            setAiError(err.response?.data?.message || 'Failed to refine objective.');
        } finally {
            setAiLoading('');
        }
    }

    async function handleAISuggest(e) {
        e.preventDefault();
        setAiSuggestionsLoading(true);
        setAiSuggestions(null);
        setAiError('');
        try {
            var res = await api.post('/api/ai/goal-suggestions', {
                context: form.title || ''
            });
            setAiSuggestions(res.data.suggestions || []);
        } catch (err) {
            setAiError(err.response?.data?.message || 'AI goal suggestions failed.');
        } finally {
            setAiSuggestionsLoading(false);
        }
    }

    function handleUseSuggestion(suggestion) {
        setForm(prev => ({
            ...prev,
            title: suggestion.title || prev.title,
            description: suggestion.description || prev.description,
            successIndicator: suggestion.successIndicator || prev.successIndicator,
        }));
        setAiSuggestions(null);
    }

    async function handleSubmit(e) {
        e.preventDefault();
        setError('');
        setFieldErrors(validation.errors);

        if (!validation.isValid) {
            setError(Object.values(validation.errors)[0] || 'Please fix the highlighted fields.');
            return;
        }

        setLoading(true);
        try {
            var payload = {
                title: validation.sanitized.title,
                description: validation.sanitized.description,
                successIndicator: validation.sanitized.successIndicator,
                weight: validation.sanitized.weight,
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
            var details = err.response?.data?.details || [];
            if (details.length > 0) {
                var nextFieldErrors = {};
                details.forEach(function (detail) { nextFieldErrors[detail.field] = detail.message; });
                setFieldErrors(nextFieldErrors);
            }
            setError(err.response?.data?.message || 'Failed to create objective');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="goal-modal-overlay" onClick={onClose}>
            <div className="goal-modal" onClick={function (e) { e.stopPropagation(); }}>
                <div className="goal-modal__header">
                    <h2>Create New Objective</h2>
                    <button className="goal-modal__close" onClick={onClose}>✕</button>
                </div>

                {error && <div className="goal-modal__error">{error}</div>}
                {aiError && <div className="goal-modal__error">{aiError}</div>}
                <div style={{ marginBottom: '1rem', padding: '0.85rem 1rem', borderRadius: '12px', border: '1px solid ' + (isCreateLocked ? '#fecaca' : '#cbd5e1'), background: isCreateLocked ? '#fef2f2' : '#f8fafc' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                        <strong style={{ color: '#0f172a' }}>Phase status</strong>
                        <span style={{ padding: '3px 10px', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 700, background: isCreateLocked ? '#fee2e2' : '#dbeafe', color: isCreateLocked ? '#b91c1c' : '#1d4ed8' }}>
                            {currentPhase === 'phase1' ? 'Phase 1' : currentPhase === 'phase2' ? 'Phase 2' : currentPhase === 'phase3' ? 'Phase 3' : 'Closed'}
                        </span>
                    </div>
                    <div style={{ marginTop: '0.45rem', fontSize: '0.85rem', color: '#475569' }}>
                        {isCreateLocked ? 'Objective creation is locked outside Phase 1 for this cycle.' : 'Objective creation is available for this cycle.'}
                    </div>
                </div>

                <form className="goal-modal__form" onSubmit={handleSubmit}>
                    <div className="goal-modal__split-layout" style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '2rem' }}>
                        
                        {/* LEFT COLUMN: Main Info */}
                        <div className="goal-modal__main-info">
                            <div className="goal-modal__field">
                                <label>Objective Type *</label>
                                <div className="goal-type-selector" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                    <div
                                        className={'goal-type-card' + (form.category === 'individual' ? ' goal-type-card--active' : '')}
                                        onClick={function() { handleChange('category', 'individual'); }}
                                        style={{ padding: '1rem', border: '1px solid var(--border-color)', borderRadius: '12px', cursor: isCreateLocked ? 'not-allowed' : 'pointer', textAlign: 'center', opacity: isCreateLocked ? 0.55 : 1, pointerEvents: isCreateLocked ? 'none' : 'auto' }}
                                    >
                                        <div style={{ fontSize: '1.5rem' }}>🧑</div>
                                        <div style={{ fontWeight: 'bold' }}>Individual</div>
                                    </div>
                                    {(user.role === 'TEAM_LEADER' || user.role === 'ADMIN') && (
                                        <div
                                            className={'goal-type-card' + (form.category === 'team' ? ' goal-type-card--active' : '')}
                                            onClick={function() { handleChange('category', 'team'); }}
                                            style={{ padding: '1rem', border: '1px solid var(--border-color)', borderRadius: '12px', cursor: isCreateLocked ? 'not-allowed' : 'pointer', textAlign: 'center', opacity: isCreateLocked ? 0.55 : 1, pointerEvents: isCreateLocked ? 'none' : 'auto' }}
                                        >
                                            <div style={{ fontSize: '1.5rem' }}>👥</div>
                                            <div style={{ fontWeight: 'bold' }}>Team</div>
                                        </div>
                                    )}
                                </div>
                                {fieldErrors.title && <div className="goal-modal__error" style={{ margin: 0 }}>{fieldErrors.title}</div>}
                            </div>

                            <div className="goal-modal__field">
                                <label>Objective Title *</label>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <input type="text" value={form.title} onChange={function (e) { handleChange('title', e.target.value); }} placeholder="e.g. Achieve Company Growth" required minLength={5} maxLength={100} style={{ flex: 1, borderColor: fieldErrors.title ? '#dc2626' : undefined }} disabled={isCreateLocked} />
                                    <button type="button" onClick={handleAISuggest} disabled={aiSuggestionsLoading || isCreateLocked} className="btn btn--secondary btn--sm" title="Get AI-powered goal suggestions based on your performance data" style={{ whiteSpace: 'nowrap' }}>
                                        {aiSuggestionsLoading ? '⏳ Thinking...' : '🎯 AI Suggest Goals'}
                                    </button>
                                </div>
                            </div>

                            {aiSuggestions && aiSuggestions.length > 0 && (
                                <div style={{ marginTop: '0.5rem', padding: '1rem', borderRadius: '12px', border: '2px solid #6366f1', background: 'linear-gradient(135deg, #f5f3ff 0%, #eef2ff 100%)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                                        <strong style={{ color: '#4338ca', fontSize: '0.95rem' }}>🎯 AI Goal Suggestions</strong>
                                        <button type="button" onClick={function () { setAiSuggestions(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', color: '#64748b' }}>✕</button>
                                    </div>
                                    <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0 0 0.75rem 0' }}>Click a suggestion to use it as your objective:</p>
                                    <div style={{ display: 'grid', gap: '0.65rem' }}>
                                        {aiSuggestions.map(function (suggestion, idx) {
                                            return (
                                                <div
                                                    key={idx}
                                                    onClick={function () { handleUseSuggestion(suggestion); }}
                                                    style={{
                                                        padding: '0.85rem 1rem',
                                                        borderRadius: '10px',
                                                        border: '1px solid #c7d2fe',
                                                        background: '#fff',
                                                        cursor: 'pointer',
                                                        transition: 'all 0.15s ease',
                                                    }}
                                                    onMouseEnter={function (e) { e.currentTarget.style.borderColor = '#6366f1'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(99,102,241,0.15)'; }}
                                                    onMouseLeave={function (e) { e.currentTarget.style.borderColor = '#c7d2fe'; e.currentTarget.style.boxShadow = 'none'; }}
                                                >
                                                    <div style={{ fontWeight: 700, color: '#1e1b4b', marginBottom: '0.3rem', fontSize: '0.9rem' }}>{suggestion.title}</div>
                                                    <div style={{ fontSize: '0.82rem', color: '#475569', lineHeight: 1.5 }}>{suggestion.description}</div>
                                                    {suggestion.successIndicator && (
                                                        <div style={{ fontSize: '0.78rem', color: '#6366f1', marginTop: '0.3rem', fontStyle: 'italic' }}>📏 {suggestion.successIndicator}</div>
                                                    )}
                                                    {suggestion._fallback && (
                                                        <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.2rem' }}>Rule-based suggestion</div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            <div className="goal-modal__field">
                                <label>What does success look like? (Success Indicator)</label>
                                <textarea value={form.successIndicator} onChange={function (e) { handleChange('successIndicator', e.target.value); }} placeholder="SMART criteria..." rows={2} minLength={10} disabled={isCreateLocked} style={{ borderColor: fieldErrors.successIndicator ? '#dc2626' : undefined }}></textarea>
                                {fieldErrors.successIndicator && <div className="goal-modal__error" style={{ margin: 0 }}>{fieldErrors.successIndicator}</div>}
                            </div>

                            <div className="goal-modal__field">
                                <label>Description (Optional)</label>
                                <textarea value={form.description} onChange={function (e) { handleChange('description', e.target.value); }} placeholder="Describe this goal..." rows={4} disabled={isCreateLocked} style={{ borderColor: fieldErrors.description ? '#dc2626' : undefined }}></textarea>
                                {fieldErrors.description && <div className="goal-modal__error" style={{ margin: 0 }}>{fieldErrors.description}</div>}
                            </div>
                            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
                                <button type="button" className="btn btn--secondary btn--sm" onClick={handleAnalyzeObjective} disabled={aiLoading === 'analyze'}>
                                    {aiLoading === 'analyze' ? 'Analyzing...' : 'Analyze Objective'}
                                </button>
                                <button type="button" className="btn btn--secondary btn--sm" onClick={handleRefineObjective} disabled={aiLoading === 'refine'}>
                                    {aiLoading === 'refine' ? 'Refining...' : 'Refine Objective'}
                                </button>
                            </div>
                            {analysisResult && (
                                <div style={{ marginTop: '1rem', padding: '1rem', borderRadius: '12px', border: '1px solid #cbd5e1', background: '#f8fafc' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                                        <strong>AI objective analysis</strong>
                                        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: analysisResult.quality === 'good' ? '#047857' : '#b45309' }}>
                                            {analysisResult.quality === 'good' ? 'Good quality' : 'Needs improvement'}
                                        </span>
                                    </div>
                                    {(analysisResult.strengths || []).length > 0 && <div style={{ marginBottom: '0.5rem', fontSize: '0.85rem', color: '#065f46' }}>Strengths: {(analysisResult.strengths || []).join(' • ')}</div>}
                                    {(analysisResult.issues || []).length > 0 ? (analysisResult.issues || []).map(function (issue, index) {
                                        return <div key={index} style={{ fontSize: '0.85rem', color: '#7c2d12', marginTop: index === 0 ? 0 : '0.35rem' }}>{issue.message}</div>;
                                    }) : <div style={{ fontSize: '0.85rem', color: '#475569' }}>No major issues detected.</div>}
                                </div>
                            )}
                            {refinementResult && (
                                <div style={{ marginTop: '1rem', padding: '1rem', borderRadius: '12px', border: '1px solid #cbd5e1', background: '#fff' }}>
                                    <strong>AI refinement suggestions</strong>
                                    <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: '#475569' }}>{refinementResult.recommendedFormat}</div>
                                    {(refinementResult.suggestions || []).slice(0, 3).map(function (suggestion, index) {
                                        return (
                                            <div key={index} style={{ marginTop: '0.65rem', paddingTop: '0.65rem', borderTop: index === 0 ? 'none' : '1px solid #e2e8f0' }}>
                                                <div style={{ fontSize: '0.85rem', color: '#0f172a' }}>{suggestion.suggestion}</div>
                                                {suggestion.example && <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.2rem' }}>Example: {suggestion.example}</div>}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* RIGHT COLUMN: Metadata & Settings */}
                        <div className="goal-modal__side-info" style={{ background: 'var(--bg-main)', padding: '1.5rem', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
                            <div className="goal-modal__field">
                                <label>Evaluation Cycle *</label>
                                <select value={form.cycle} onChange={function (e) { handleChange('cycle', e.target.value); }} required disabled={isCreateLocked}>
                                    <option value="">Select Cycle</option>
                                    {cycles.map(function (c) { return <option key={c._id} value={c._id}>{c.name} ({c.year})</option>; })}
                                </select>
                                {fieldErrors.cycle && <div className="goal-modal__error" style={{ margin: 0 }}>{fieldErrors.cycle}</div>}
                            </div>


                            {(user.role === 'TEAM_LEADER' || user.role === 'ADMIN' || user.role === 'HR') && (
                                <div className="goal-modal__field">
                                    <label>{form.category === 'individual' ? 'Assign To' : 'Target Team'}</label>
                                    {form.category === 'individual' ? (
                                        <select value={form.targetUser} onChange={function (e) { handleChange('targetUser', e.target.value); }} disabled={isCreateLocked}>
                                            <option value="">Myself</option>
                                            {availableUsers.map(function (u) { return <option key={u._id} value={u._id}>{u.name}</option>; })}
                                        </select>
                                    ) : (
                                        <select value={form.targetTeam} onChange={function (e) { handleChange('targetTeam', e.target.value); }} required={form.category === 'team'} disabled={isCreateLocked}>
                                            <option value="">Select Team</option>
                                            {availableTeams.map(function (t) { return <option key={t._id} value={t._id}>{t.name}</option>; })}
                                        </select>
                                    )}
                                    {fieldErrors.targetTeam && <div className="goal-modal__error" style={{ margin: 0 }}>{fieldErrors.targetTeam}</div>}
                                </div>
                            )}


                            <div className="goal-modal__field">
                                <label>Weight: {form.weight}%</label>
                                <input type="range" min="1" max={maxWeight || 1} value={Math.min(normalizeWeight(form.weight), maxWeight || 1)} onChange={function (e) { handleChange('weight', e.target.value); }} style={{ width: '100%' }} disabled={isCreateLocked} />
                                <div style={{ fontSize: '0.75rem', marginTop: '4px', textAlign: 'right', color: 'var(--text-muted)' }}>
                                    Remaining: {remainingWeight}%
                                </div>
                                {capacityInfo.message && <div style={{ fontSize: '0.75rem', marginTop: '4px', color: '#475569' }}>{capacityInfo.message}</div>}
                                {form.category === 'team' && !form.targetTeam && (
                                    <div style={{ fontSize: '0.75rem', marginTop: '4px', color: '#b45309' }}>Select a team to calculate available team weight capacity.</div>
                                )}
                                {fieldErrors.weight && <div className="goal-modal__error" style={{ margin: 0 }}>{fieldErrors.weight}</div>}
                            </div>

                            <div className="goal-modal__field">
                                <label>Priority Labels</label>
                                <input type="text" value={form.labels} onChange={function (e) { handleChange('labels', e.target.value); }} placeholder="e.g. High, Q1" disabled={isCreateLocked} />
                            </div>

                            <div className="goal-modal__field">
                                <label>Visibility</label>
                                <select value={form.visibility} onChange={function (e) { handleChange('visibility', e.target.value); }} disabled={isCreateLocked}>
                                    <option value="team">Team Only</option>
                                    <option value="private">Private</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="goal-modal__actions" style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }}>
                        <button type="button" className="btn btn--outline" onClick={onClose}>Cancel</button>
                        <button type="submit" className="btn btn--primary" disabled={loading || !validation.isValid || isCreateLocked}>
                            {loading ? 'Creating...' : 'Create Objective'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default CreateGoalModal;
