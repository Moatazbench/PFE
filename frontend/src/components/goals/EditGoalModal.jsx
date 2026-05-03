import React, { useMemo, useState } from 'react';
import api from '../../services/api';
import { useAuth } from '../AuthContext';
import { normalizeWeight, sumObjectiveWeights, validateObjectiveForm } from '../../utils/objectiveRules';

function EditGoalModal({ goal, onClose, onUpdated, cycles, parentGoals, existingObjectives }) {
    var { user } = useAuth();
    var [form, setForm] = useState({
        title: goal.title || '',
        description: goal.description || '',
        successIndicator: goal.successIndicator || '',
        weight: goal.weight || 20,
        cycle: goal.cycle?._id || goal.cycle || '',
        category: goal.category || 'individual',
        labels: (goal.labels || []).join(', '),
        visibility: goal.visibility || 'public',
        parentObjective: goal.parentObjective?._id || goal.parentObjective || '',
    });
    var [error, setError] = useState('');
    var [loading, setLoading] = useState(false);
    var [aiLoading, setAiLoading] = useState('');
    var [aiError, setAiError] = useState('');
    var [analysisResult, setAnalysisResult] = useState(null);
    var [refinementResult, setRefinementResult] = useState(null);
    var [fieldErrors, setFieldErrors] = useState({});
    var [correctionReason, setCorrectionReason] = useState('');
    var [showCorrectionInput, setShowCorrectionInput] = useState(false);
    var [serverFieldErrors, setServerFieldErrors] = useState({});

    var currentCycleObjectives = (existingObjectives || []).filter(function (objective) {
        var objectiveCycleId = objective.cycle?._id || objective.cycle;
        return objectiveCycleId === form.cycle && objective.category === form.category && objective._id !== goal._id;
    });
    var usedWeight = sumObjectiveWeights(currentCycleObjectives);
    var remainingWeight = Math.max(0, 100 - usedWeight);
    var maxWeight = Math.min(100, remainingWeight);
    var cycleData = (cycles || []).find(function (cycle) { return cycle._id === form.cycle; }) || goal.cycle || {};
    var currentPhase = cycleData?.currentPhase || 'phase1';
    var isAdmin = user.role === 'ADMIN';
    var isPhaseThreeLocked = currentPhase === 'phase3' && !isAdmin;
    var isStructuralLocked = (currentPhase === 'phase2' || currentPhase === 'phase3') && !isAdmin;
    var isPhase2Locked = currentPhase === 'phase2' && !isAdmin;

    // Track soft field modifications
    var descriptionChanged = form.description !== (goal.description || '');
    var successIndicatorChanged = form.successIndicator !== (goal.successIndicator || '');
    var anySoftFieldChanged = descriptionChanged || successIndicatorChanged;
    var needsCorrectionReason = isPhase2Locked && anySoftFieldChanged;
    var correctionReasonValid = !needsCorrectionReason || (correctionReason.trim().length > 0);
    var showPhase2SaveButton = isPhase2Locked && anySoftFieldChanged;

    // Resolve parent objective title for read-only display
    var parentTitle = '';
    if (form.parentObjective && parentGoals) {
        var found = parentGoals.find(function(pg) { return pg._id === form.parentObjective; });
        parentTitle = found ? found.title : 'Linked objective';
    }

    function handleChange(field, value) {
        setForm(function (prev) { return Object.assign({}, prev, { [field]: value }); });
        setFieldErrors(function (prev) {
            if (!prev[field]) return prev;
            var next = Object.assign({}, prev); delete next[field]; return next;
        });
        setServerFieldErrors({});
        setError('');
    }

    var validation = useMemo(function () {
        return validateObjectiveForm(form, { remainingWeight: remainingWeight });
    }, [form, remainingWeight]);

    function getObjectivePayload() {
        return { title: form.title, description: form.description, successIndicator: form.successIndicator };
    }

    async function handleAnalyzeObjective() {
        setAiLoading('analyze'); setAiError('');
        try { var response = await api.post('/api/ai/analyze-objective-quality', getObjectivePayload()); setAnalysisResult(response.data); }
        catch (err) { setAiError(err.response?.data?.message || 'Failed to analyze objective.'); }
        finally { setAiLoading(''); }
    }

    async function handleRefineObjective() {
        setAiLoading('refine'); setAiError('');
        try { var response = await api.post('/api/ai/refine-objective', getObjectivePayload()); setRefinementResult(response.data); }
        catch (err) { setAiError(err.response?.data?.message || 'Failed to refine objective.'); }
        finally { setAiLoading(''); }
    }

    async function handleSubmit(e) {
        e.preventDefault();
        setError(''); setServerFieldErrors({});

        if (!isPhase2Locked) {
            setFieldErrors(validation.errors);
            if (!validation.isValid) { setError(Object.values(validation.errors)[0] || 'Please fix the highlighted fields.'); return; }
        }
        if (needsCorrectionReason && !correctionReasonValid) {
            setError('Please provide a correction reason for the modified field(s).'); return;
        }

        setLoading(true);
        try {
            var payload;
            if (isPhase2Locked) {
                payload = {
                    labels: form.labels ? form.labels.split(',').map(function (l) { return l.trim(); }).filter(Boolean) : [],
                    visibility: form.visibility,
                };
                if (descriptionChanged) payload.description = form.description;
                if (successIndicatorChanged) payload.successIndicator = form.successIndicator;
                if (anySoftFieldChanged) payload.correctionReason = correctionReason.trim();
            } else {
                payload = {
                    title: validation.sanitized.title,
                    description: validation.sanitized.description,
                    successIndicator: validation.sanitized.successIndicator,
                    weight: validation.sanitized.weight,
                    cycle: form.cycle, category: form.category,
                    labels: form.labels ? form.labels.split(',').map(function (l) { return l.trim(); }).filter(Boolean) : [],
                    visibility: form.visibility,
                    parentObjective: form.parentObjective || null,
                };
            }
            await api.put('/api/objectives/' + goal._id, payload);
            if (onUpdated) onUpdated();
            onClose();
        } catch (err) {
            var status = err.response?.status;
            var message = err.response?.data?.message || 'Failed to update objective';
            if (status === 403) {
                var lockedFieldErrors = {};
                if (descriptionChanged) lockedFieldErrors.description = message;
                if (successIndicatorChanged) lockedFieldErrors.successIndicator = message;
                if (!descriptionChanged && !successIndicatorChanged) lockedFieldErrors.description = message;
                setServerFieldErrors(lockedFieldErrors);
            } else if (status === 422) {
                setServerFieldErrors({ correctionReason: message });
            } else {
                var details = err.response?.data?.details || [];
                if (details.length > 0) {
                    var nextFieldErrors = {};
                    details.forEach(function (d) { nextFieldErrors[d.field] = d.message; });
                    setFieldErrors(nextFieldErrors);
                }
                setError(message);
            }
        } finally { setLoading(false); }
    }

    var lockIconSvg = (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#b91c1c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
        </svg>
    );

    var lockedFieldStyle = {
        padding: '0.6rem 0.75rem', background: '#f8fafc', border: '1px solid #e2e8f0',
        borderRadius: '8px', color: '#334155', fontSize: '0.95rem',
        display: 'flex', alignItems: 'center', gap: '8px', minHeight: '40px',
    };
    var lockTooltipStyle = {
        marginLeft: 'auto', fontSize: '0.7rem', color: '#94a3b8', fontStyle: 'italic', whiteSpace: 'nowrap',
    };
    var softWarningStyle = {
        marginBottom: '0.5rem', padding: '0.5rem 0.75rem', borderRadius: '6px',
        background: '#fffbeb', border: '1px solid #fef3c7', color: '#92400e', fontSize: '0.8rem',
    };
    var inlineErrorStyle = {
        margin: '0.5rem 0 0 0', padding: '0.5rem 0.75rem', borderRadius: '6px',
        background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', fontSize: '0.83rem',
        display: 'flex', alignItems: 'center', gap: '6px',
    };

    return (
        <div className="goal-modal-overlay" onClick={onClose}>
            <div className="goal-modal" onClick={function (e) { e.stopPropagation(); }}>
                <div className="goal-modal__header">
                    <h2>Edit Objective</h2>
                    <button className="goal-modal__close" onClick={onClose}>x</button>
                </div>

                {error && <div className="goal-modal__error">{error}</div>}
                {aiError && <div className="goal-modal__error">{aiError}</div>}

                {/* Lock Status Banner */}
                <div style={{ marginBottom: '1rem', padding: '0.85rem 1rem', borderRadius: '12px', border: '1px solid ' + (isStructuralLocked ? '#fecaca' : '#cbd5e1'), background: isStructuralLocked ? '#fef2f2' : '#f8fafc' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                        <strong style={{ color: '#0f172a' }}>Lock status</strong>
                        <span style={{ padding: '3px 10px', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 700, background: isStructuralLocked ? '#fee2e2' : '#dbeafe', color: isStructuralLocked ? '#b91c1c' : '#1d4ed8' }}>
                            {currentPhase === 'phase1' ? 'Editable' : currentPhase === 'phase2' ? 'Mid-Year Execution' : currentPhase === 'phase3' ? 'Read only' : 'Locked'}
                        </span>
                    </div>
                    <div style={{ marginTop: '0.45rem', fontSize: '0.85rem', color: '#475569' }}>
                        {isPhaseThreeLocked ? 'All objective fields are read-only during Phase 3.' : isPhase2Locked ? 'Structural fields (title, weight, alignment) are locked. Description and success indicator can be edited with a correction reason.' : 'Objective fields are editable in Phase 1.'}
                    </div>
                </div>
                {goal.status === 'rejected' && goal.managerComments && (
                    <div className="rejected-edit-notice">
                        <h4>This goal was rejected by your manager</h4>
                        <p>{goal.managerComments}</p>
                    </div>
                )}

                <form className="goal-modal__form" onSubmit={handleSubmit}>
                    {/* Objective Type */}
                    <div className="goal-modal__field">
                        <label>Objective Type</label>
                        <div className="goal-type-selector">
                            <div className={'goal-type-card goal-type-card--small' + (form.category === 'individual' ? ' goal-type-card--active' : '')}
                                onClick={isStructuralLocked ? undefined : function () { handleChange('category', 'individual'); }}
                                style={{ opacity: isStructuralLocked ? 0.55 : 1, cursor: isStructuralLocked ? 'not-allowed' : 'pointer' }}>
                                <div className="goal-type-card__icon">I</div>
                                <div className="goal-type-card__label">Individual</div>
                            </div>
                            {(user.role === 'TEAM_LEADER' || user.role === 'ADMIN') && (
                                <div className={'goal-type-card goal-type-card--small' + (form.category === 'team' ? ' goal-type-card--active' : '')}
                                    onClick={isStructuralLocked ? undefined : function () { handleChange('category', 'team'); }}
                                    style={{ opacity: isStructuralLocked ? 0.55 : 1, cursor: isStructuralLocked ? 'not-allowed' : 'pointer' }}>
                                    <div className="goal-type-card__icon">T</div>
                                    <div className="goal-type-card__label">Team</div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ─── TITLE — Hard-locked in Phase 2 ─── */}
                    <div className="goal-modal__field">
                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            Objective Title *
                            {isPhase2Locked && <span title="Locked during Mid-Year Execution" style={{ display: 'inline-flex', cursor: 'help' }}>{lockIconSvg}</span>}
                        </label>
                        {isPhase2Locked ? (
                            <div style={lockedFieldStyle}>
                                <span>{form.title}</span>
                                <span style={lockTooltipStyle}>Locked during Mid-Year Execution</span>
                            </div>
                        ) : (
                            <>
                                <input type="text" value={form.title} onChange={function (e) { handleChange('title', e.target.value); }} required minLength={5} maxLength={100} disabled={isPhaseThreeLocked} style={{ borderColor: fieldErrors.title ? '#dc2626' : undefined }} />
                                {fieldErrors.title && <div className="goal-modal__error" style={{ margin: 0 }}>{fieldErrors.title}</div>}
                            </>
                        )}
                    </div>

                    {/* ─── DESCRIPTION — Soft-locked in Phase 2 ─── */}
                    <div className="goal-modal__field">
                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            Description
                            {isPhase2Locked && <span style={{ fontSize: '0.75rem', color: '#d97706', fontWeight: 600 }}>⚠ Editing requires a reason</span>}
                        </label>
                        {isPhase2Locked && <div style={softWarningStyle}>Editing this field requires a reason</div>}
                        <textarea value={form.description} onChange={function (e) { handleChange('description', e.target.value); }} rows={2} disabled={isPhaseThreeLocked}
                            onFocus={isPhase2Locked ? function() { setShowCorrectionInput(true); } : undefined}
                            style={{ borderColor: fieldErrors.description ? '#dc2626' : (descriptionChanged && isPhase2Locked ? '#d97706' : undefined) }} />
                        {fieldErrors.description && <div className="goal-modal__error" style={{ margin: 0 }}>{fieldErrors.description}</div>}
                        {serverFieldErrors.description && <div style={inlineErrorStyle}>{lockIconSvg}<span>{serverFieldErrors.description}</span></div>}
                    </div>

                    {/* ─── SUCCESS INDICATOR — Soft-locked in Phase 2 ─── */}
                    <div className="goal-modal__field">
                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            Success Indicator (SMART)
                            {isPhase2Locked && <span style={{ fontSize: '0.75rem', color: '#d97706', fontWeight: 600 }}>⚠ Editing requires a reason</span>}
                        </label>
                        {isPhase2Locked && <div style={softWarningStyle}>Editing this field requires a reason</div>}
                        <textarea value={form.successIndicator} onChange={function (e) { handleChange('successIndicator', e.target.value); }} rows={2} disabled={isPhaseThreeLocked}
                            onFocus={isPhase2Locked ? function() { setShowCorrectionInput(true); } : undefined}
                            style={{ borderColor: fieldErrors.successIndicator ? '#dc2626' : (successIndicatorChanged && isPhase2Locked ? '#d97706' : undefined) }} />
                        {fieldErrors.successIndicator && <div className="goal-modal__error" style={{ margin: 0 }}>{fieldErrors.successIndicator}</div>}
                        {serverFieldErrors.successIndicator && <div style={inlineErrorStyle}>{lockIconSvg}<span>{serverFieldErrors.successIndicator}</span></div>}
                    </div>

                    {/* ─── CORRECTION REASON — shown when soft fields focused/modified in Phase 2 ─── */}
                    {isPhase2Locked && (showCorrectionInput || anySoftFieldChanged) && (
                        <div style={{ marginBottom: '1rem', padding: '1rem', borderRadius: '10px', border: '1px solid ' + (correctionReasonValid ? '#fef3c7' : '#fecaca'), background: correctionReasonValid ? '#fffbeb' : '#fef2f2' }}>
                            <label style={{ display: 'block', fontWeight: 700, marginBottom: '0.5rem', fontSize: '0.9rem', color: '#92400e' }}>
                                Correction Reason {anySoftFieldChanged && <span style={{ color: '#dc2626' }}>*</span>}
                            </label>
                            <textarea value={correctionReason} onChange={function(e) { setCorrectionReason(e.target.value); setServerFieldErrors({}); }} rows={2}
                                placeholder="Explain why this correction is needed during Mid-Year Execution..."
                                style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid ' + (correctionReasonValid ? '#fde68a' : '#fca5a5'), fontSize: '0.9rem', resize: 'vertical' }} />
                            {serverFieldErrors.correctionReason && (
                                <div style={{ marginTop: '0.5rem', color: '#991b1b', fontSize: '0.83rem' }}>{serverFieldErrors.correctionReason}</div>
                            )}
                        </div>
                    )}

                    {/* AI Buttons */}
                    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '-0.25rem', marginBottom: '0.5rem' }}>
                        <button type="button" className="btn btn--secondary btn--sm" onClick={handleAnalyzeObjective} disabled={aiLoading === 'analyze'}>
                            {aiLoading === 'analyze' ? 'Analyzing...' : 'Analyze Objective'}
                        </button>
                        <button type="button" className="btn btn--secondary btn--sm" onClick={handleRefineObjective} disabled={aiLoading === 'refine'}>
                            {aiLoading === 'refine' ? 'Refining...' : 'Refine Objective'}
                        </button>
                    </div>

                    {analysisResult && (
                        <div style={{ marginBottom: '1rem', padding: '1rem', borderRadius: '12px', border: '1px solid #cbd5e1', background: '#f8fafc' }}>
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
                        <div style={{ marginBottom: '1rem', padding: '1rem', borderRadius: '12px', border: '1px solid #cbd5e1', background: '#fff' }}>
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

                    {/* Cycle */}
                    <div className="goal-modal__field">
                        <label>Cycle *</label>
                        <select value={form.cycle} onChange={function (e) { handleChange('cycle', e.target.value); }} required disabled={isStructuralLocked}>
                            <option value="">Select Cycle</option>
                            {cycles && cycles.map(function (cycle) { return <option key={cycle._id} value={cycle._id}>{cycle.name} ({cycle.year})</option>; })}
                        </select>
                        {fieldErrors.cycle && <div className="goal-modal__error" style={{ margin: 0 }}>{fieldErrors.cycle}</div>}
                    </div>

                    {/* ─── WEIGHT — Hard-locked in Phase 2 ─── */}
                    <div className="goal-modal__field">
                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            Weight: {normalizeWeight(form.weight)}%
                            {isPhase2Locked && <span title="Locked during Mid-Year Execution" style={{ display: 'inline-flex', cursor: 'help' }}>{lockIconSvg}</span>}
                        </label>
                        {isPhase2Locked ? (
                            <div style={lockedFieldStyle}>
                                <span style={{ fontWeight: 700, fontSize: '1.05rem' }}>{normalizeWeight(form.weight)}%</span>
                                <span style={lockTooltipStyle}>Locked during Mid-Year Execution</span>
                            </div>
                        ) : (
                            <>
                                <input type="range" min="1" max={maxWeight || 1} value={Math.min(normalizeWeight(form.weight), maxWeight || 1)} onChange={function (e) { handleChange('weight', e.target.value); }} disabled={isPhaseThreeLocked} />
                                <div className="weight-capacity-bar">
                                    <div className="weight-capacity-bar__track">
                                        <div className="weight-capacity-bar__used" style={{ width: usedWeight + '%' }}></div>
                                        <div className="weight-capacity-bar__new" style={{ width: Math.min(normalizeWeight(form.weight), remainingWeight) + '%', left: usedWeight + '%' }}></div>
                                    </div>
                                    <div className="weight-capacity-bar__labels">
                                        <span>Used: {usedWeight}%</span>
                                        <span>This goal: {normalizeWeight(form.weight)}%</span>
                                        <span>Remaining: {Math.max(0, remainingWeight - normalizeWeight(form.weight))}%</span>
                                    </div>
                                </div>
                                {fieldErrors.weight && <div className="goal-modal__error" style={{ margin: 0 }}>{fieldErrors.weight}</div>}
                            </>
                        )}
                    </div>

                    {/* Labels & Visibility */}
                    <div className="goal-modal__row">
                        <div className="goal-modal__field">
                            <label>Labels (comma-separated)</label>
                            <input type="text" value={form.labels} onChange={function (e) { handleChange('labels', e.target.value); }} disabled={isPhaseThreeLocked} />
                        </div>
                        <div className="goal-modal__field">
                            <label>Visibility</label>
                            <select value={form.visibility} onChange={function (e) { handleChange('visibility', e.target.value); }} disabled={isPhaseThreeLocked}>
                                <option value="public">Public</option>
                                <option value="team">Team</option>
                                <option value="department">Department</option>
                                <option value="private">Private</option>
                            </select>
                        </div>
                    </div>

                    {/* ─── PARENT OBJECTIVE — Hard-locked in Phase 2 ─── */}
                    {parentGoals && parentGoals.length > 0 && (
                        <div className="goal-modal__field">
                            <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                Parent Objective
                                {isPhase2Locked && <span title="Locked during Mid-Year Execution" style={{ display: 'inline-flex', cursor: 'help' }}>{lockIconSvg}</span>}
                            </label>
                            {isPhase2Locked ? (
                                <div style={lockedFieldStyle}>
                                    <span>{parentTitle || 'None (Top-Level Objective)'}</span>
                                    <span style={lockTooltipStyle}>Locked during Mid-Year Execution</span>
                                </div>
                            ) : (
                                <select value={form.parentObjective} onChange={function (e) { handleChange('parentObjective', e.target.value); }} disabled={isPhaseThreeLocked}>
                                    <option value="">None (Top-Level Objective)</option>
                                    {parentGoals.filter(function (pg) { return pg._id !== goal._id; }).map(function (pg) { return <option key={pg._id} value={pg._id}>{pg.title}</option>; })}
                                </select>
                            )}
                        </div>
                    )}

                    {/* Actions — hide save for phase2 if only hard-locked fields visible and nothing changed */}
                    <div className="goal-modal__actions">
                        {!isPhase2Locked && (
                            <button type="submit" className="goal-modal__submit" disabled={loading || !validation.isValid || isPhaseThreeLocked}>
                                {loading ? 'Saving...' : 'Save Changes'}
                            </button>
                        )}
                        {showPhase2SaveButton && (
                            <button type="submit" className="goal-modal__submit" disabled={loading || (needsCorrectionReason && !correctionReasonValid)}>
                                {loading ? 'Saving...' : 'Save Changes'}
                            </button>
                        )}
                        <button type="button" className="goal-modal__cancel" onClick={onClose}>Cancel</button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default EditGoalModal;
