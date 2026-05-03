import React, { useState, useEffect, useRef } from 'react';
import api from '../../services/api';
import { useToast } from '../common/Toast';
import GoalProgressBar from './GoalProgressBar';
import GoalStatusBadge from './GoalStatusBadge';
import CheckInModal from './CheckInModal';
import GoalAlignmentTree from './GoalAlignmentTree';

import EvaluateGoalModal from './EvaluateGoalModal';
import ManagerReviewModal from './ManagerReviewModal';
import { useAuth } from '../AuthContext';

function GoalDetailsPanel({ goal, onClose, onRefresh }) {
    var { user } = useAuth();
    var toast = useToast();
    var [activeTab, setActiveTab] = useState('details');
    var [detail, setDetail] = useState(goal);
    var [kpiForm, setKpiForm] = useState({ title: '', metricType: 'percent', initialValue: 0, targetValue: 100, currentValue: 0, unit: '' });
    var [showKpiForm, setShowKpiForm] = useState(false);
    var [children, setChildren] = useState([]);
    var [showCheckInModal, setShowCheckInModal] = useState(false);

    var [showEvaluateModal, setShowEvaluateModal] = useState(false);
    var [showReviewModal, setShowReviewModal] = useState(false);
    var [kpiLocalValues, setKpiLocalValues] = useState({});
    var debounceTimers = useRef({});
    var [showSubGoalForm, setShowSubGoalForm] = useState(false);
    var [allGoals, setAllGoals] = useState([]);
    var [subGoalForm, setSubGoalForm] = useState({ title: '', weight: 10 });

    var isAdmin = user.role === 'ADMIN';
    var isOwner = (detail.owner && (String(detail.owner._id || detail.owner) === String(user._id || user.id))) || isAdmin;
    var isManager = user.role === 'TEAM_LEADER' || isAdmin;
    var isActive = ['approved', 'validated'].includes(detail.status);
    var isPendingApproval = ['pending', 'submitted', 'pending_approval'].includes(detail.status);
    
    // Authorization: Only the specific team leader who received the goal (or ADMIN) can review it
    var canReview = false;
    if (isPendingApproval) {
        if (user.role === 'ADMIN') canReview = true;
        else if (isManager && detail.submittedTo && String(detail.submittedTo) === String(user._id || user.id)) canReview = true;
    }

    var isAssigned = detail.status === 'assigned';
    var isCompleted = detail.achievementPercent >= 100;
    var currentPhase = detail.cycle?.currentPhase || 'phase1';
    var isPhaseThreeLocked = currentPhase === 'phase3' && !isAdmin;
    var isPhaseTwoStructuralLock = currentPhase === 'phase2' && !isAdmin;
    var structuralLockLabel = isPhaseThreeLocked ? 'Read-only in Phase 3' : isPhaseTwoStructuralLock ? 'Structural edits locked — Mid-Year Execution' : 'Editable in Phase 1';

    useEffect(function () { fetchDetail(); fetchChildren(); }, [goal._id]);
    useEffect(function () {
        if (detail && detail.kpis) {
            var vals = {};
            detail.kpis.forEach(function (kpi) { vals[kpi._id] = kpiLocalValues[kpi._id] !== undefined ? kpiLocalValues[kpi._id] : kpi.currentValue; });
            setKpiLocalValues(vals);
        }
    }, [detail]);

    async function fetchDetail() {
        try { var res = await api.get('/api/objectives/' + goal._id); setDetail(res.data.objective || res.data); } catch (err) { console.error(err); }
    }
    async function fetchChildren() {
        try { var res = await api.get('/api/objectives/' + goal._id + '/children'); setChildren(res.data.objectives || []); } catch (err) { console.error(err); }
    }

    // === WORKFLOW ACTIONS ===
    async function handleSubmitForApproval() {
        try {
            await api.post('/api/objectives/submit/' + goal._id);
            toast.success('Objective submitted for approval!');
            fetchDetail(); if (onRefresh) onRefresh();
        } catch (err) { toast.error(err.response?.data?.message || 'Failed to submit'); }
    }

    async function handleAcknowledge(accepted, message) {
        try {
            await api.post('/api/objectives/' + goal._id + '/acknowledge', { accepted, clarificationMessage: message });
            toast.success(accepted ? 'Objective accepted!' : 'Clarification requested.');
            fetchDetail(); if (onRefresh) onRefresh();
        } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    }

    async function handleMarkCompleted() {
        try {
            await api.post('/api/objectives/' + goal._id + '/mark-completed', { selfAssessment: '' });
            toast.success('Objective marked as completed!');
            fetchDetail(); if (onRefresh) onRefresh();
        } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    }


    async function handleAddKpi(e) {
        e.preventDefault();
        try {
            await api.post('/api/objectives/' + goal._id + '/kpis', kpiForm);
            setKpiForm({ title: '', metricType: 'percent', initialValue: 0, targetValue: 100, currentValue: 0, unit: '' });
            setShowKpiForm(false); fetchDetail(); if (onRefresh) onRefresh(); toast.success('KPI added');
        } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    }

    function handleKpiLocalChange(kpiId, value) {
        setKpiLocalValues(function (prev) { var next = Object.assign({}, prev); next[kpiId] = value; return next; });
        if (debounceTimers.current[kpiId]) clearTimeout(debounceTimers.current[kpiId]);
        debounceTimers.current[kpiId] = setTimeout(function () { handleUpdateKpiDebounced(kpiId, value); }, 800);
    }
    async function handleUpdateKpiDebounced(kpiId, currentValue) {
        try { await api.put('/api/objectives/' + goal._id + '/kpis/' + kpiId, { currentValue: parseFloat(currentValue) }); fetchDetail(); if (onRefresh) onRefresh(); } catch (err) { toast.error('Failed to update KPI'); }
    }
    async function handleDeleteKpi(kpiId) {
        try { await api.delete('/api/objectives/' + goal._id + '/kpis/' + kpiId); fetchDetail(); if (onRefresh) onRefresh(); toast.success('KPI deleted'); } catch (err) { toast.error('Failed'); }
    }

    // Comment handling with inner component
    async function handleAddComment(text, setter) {
        if (!text.trim()) return;
        var tempComment = { _id: 'temp_' + Date.now(), user: { _id: user._id || user.id, name: user.name, email: user.email }, text, createdAt: new Date().toISOString() };
        setDetail(function (prev) { return Object.assign({}, prev, { comments: [...(prev.comments || []), tempComment] }); });
        setter('');
        try {
            var res = await api.post('/api/objectives/' + goal._id + '/comments', { text }); setDetail(res.data.objective || res.data); toast.success('Comment added');
        } catch (err) { setDetail(function (prev) { return Object.assign({}, prev, { comments: (prev.comments || []).filter(function (c) { return c._id !== tempComment._id; }) }); }); setter(text); toast.error('Failed'); }
    }
    async function handleDeleteComment(cid) {
        try { await api.delete('/api/objectives/' + goal._id + '/comments/' + cid); setDetail(function (prev) { return Object.assign({}, prev, { comments: (prev.comments || []).filter(function (c) { return c._id !== cid; }) }); }); toast.success('Deleted'); } catch (err) { toast.error('Failed'); }
    }

    async function handleCreateSubGoal(e) {
        e.preventDefault();
        try {
            await api.post('/api/objectives', { title: subGoalForm.title, weight: parseInt(subGoalForm.weight) || 10, cycle: detail.cycle?._id || detail.cycle, category: detail.category || 'individual', successIndicator: subGoalForm.title, parentObjective: goal._id });
            setSubGoalForm({ title: '', weight: 10 }); setShowSubGoalForm(false); toast.success('Sub-objective created!'); fetchChildren(); if (onRefresh) onRefresh();
        } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    }

    async function handleResolveChangeRequest(crId, status, note) {
        try {
            await api.put('/api/objectives/' + goal._id + '/change-requests/' + crId, { status, resolutionNote: note || '' });
            toast.success('Change request ' + status + '!'); fetchDetail(); if (onRefresh) onRefresh();
        } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    }

    function getKpiProgress(kpi) {
        if (kpi.metricType === 'boolean') return kpi.currentValue >= 1 ? 100 : 0;
        var range = kpi.targetValue - kpi.initialValue;
        if (range <= 0) return 100;
        return Math.min(100, Math.max(0, ((kpi.currentValue - kpi.initialValue) / range) * 100));
    }
    function formatDate(d) { return d ? new Date(d).toLocaleDateString() : '—'; }
    function formatDateTime(d) { return d ? new Date(d).toLocaleString() : '—'; }

    var tabs = ['details', 'kpis', 'alignment', 'updates', 'comments', 'activity'];

    var ratingLabels = { exceeded: '🌟 Exceeded Expectations', met: '✅ Met Expectations', partially_met: '⚡ Partially Met', not_met: '❌ Did Not Meet' };

    function CommentSection() {
        var [localComment, setLocalComment] = useState('');
        return (
            <div className="goal-panel__comments"><h3>Comments</h3>
                <div className="goal-panel__add-comment">
                    <textarea placeholder="Write a comment..." value={localComment} onChange={function (e) { setLocalComment(e.target.value); }} rows={2}></textarea>
                    <button onClick={function () { handleAddComment(localComment, setLocalComment); }} disabled={!localComment.trim()}>Add Comment</button>
                </div>
                {(detail.comments || []).length === 0 ? <p className="goal-panel__empty">No comments.</p> :
                    (detail.comments || []).slice().reverse().map(function (c) {
                        return (<div key={c._id} className="goal-panel__comment-item"><div className="goal-panel__comment-header"><strong>{c.user?.name || 'Unknown'}</strong><span>{formatDateTime(c.createdAt)}</span>{(c.user?._id === user._id || c.user?._id === user.id) && <button className="goal-panel__comment-delete" onClick={function () { handleDeleteComment(c._id); }}>✕</button>}</div><p>{c.text}</p></div>);
                    })}
            </div>
        );
    }

    return (
        <div className="goal-panel-overlay" onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(2px)', zIndex: 1000, display: 'flex', justifyContent: 'flex-end' }}>
            <div className="goal-panel" onClick={function (e) { e.stopPropagation(); }} style={{ width: 'min(72vw, 1100px)', height: '100vh', overflowY: 'auto', background: 'var(--bg-surface, #fff)', boxShadow: '-8px 0 40px rgba(0,0,0,0.18)', display: 'flex', flexDirection: 'column', borderRadius: '16px 0 0 16px' }}>
                {/* Header */}
                <div className="goal-panel__header" style={{ padding: '2rem 2.5rem 1.5rem', borderBottom: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', marginBottom: '0.75rem' }}>
                        <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, flex: 1 }}>{detail.title}</h2>
                        <button className="goal-panel__close" onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.4rem', cursor: 'pointer', color: '#64748b' }}>✕</button>
                    </div>
                    <p style={{ color: '#64748b', margin: '0 0 1rem 0' }}>{detail.description || 'No description'}</p>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                        <span style={{ padding: '4px 10px', borderRadius: '999px', background: '#e2e8f0', color: '#334155', fontSize: '0.75rem', fontWeight: 700 }}>
                            {currentPhase === 'phase1' ? 'Phase 1' : currentPhase === 'phase2' ? 'Phase 2' : currentPhase === 'phase3' ? 'Phase 3' : 'Closed'}
                        </span>
                        <span style={{ padding: '4px 10px', borderRadius: '999px', background: isPhaseThreeLocked || isPhaseTwoStructuralLock ? '#fee2e2' : '#dcfce7', color: isPhaseThreeLocked || isPhaseTwoStructuralLock ? '#b91c1c' : '#166534', fontSize: '0.75rem', fontWeight: 700 }}>
                            {structuralLockLabel}
                        </span>
                    </div>

                    {/* Workflow action buttons */}
                    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                        {/* Employee: Submit draft to team leader */}
                        {isOwner && detail.status === 'draft' && (
                            <button onClick={async function() { try { await api.post('/api/objectives/submit/' + goal._id); toast.success('Objective submitted to Team Leader!'); fetchDetail(); if (onRefresh) onRefresh(); } catch (err) { toast.error(err.response?.data?.message || 'Failed to submit'); } }} style={{ background: 'linear-gradient(135deg,#3b82f6,#60a5fa)', color: '#fff', border: 'none', borderRadius: '8px', padding: '8px 16px', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}>📤 Submit to Team Leader</button>
                        )}
                        {/* Employee: Resubmit after revision/rejection */}
                        {isOwner && ['revision_requested', 'rejected'].includes(detail.status) && (
                            <button onClick={handleSubmitForApproval} style={{ background: 'linear-gradient(135deg,#3b82f6,#60a5fa)', color: '#fff', border: 'none', borderRadius: '8px', padding: '8px 16px', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}>🚀 Resubmit for Approval</button>
                        )}
                        {/* Employee: Acknowledge assigned goal */}
                        {isOwner && isAssigned && (
                            <>
                                <button onClick={function () { handleAcknowledge(true); }} style={{ background: 'linear-gradient(135deg,#27ae60,#2ecc71)', color: '#fff', border: 'none', borderRadius: '8px', padding: '8px 16px', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}>✅ Accept Objective</button>
                                <button onClick={function () { var msg = prompt('What clarification do you need?'); if (msg) handleAcknowledge(false, msg); }} style={{ background: 'linear-gradient(135deg,#f59e0b,#fbbf24)', color: '#fff', border: 'none', borderRadius: '8px', padding: '8px 16px', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}>❓ Request Clarification</button>
                            </>
                        )}
                        {/* Manager: Review pending goal */}
                        {canReview && (
                            <button onClick={function () { setShowReviewModal(true); }} style={{ background: 'linear-gradient(135deg,#f59e0b,#fbbf24)', color: '#fff', border: 'none', borderRadius: '8px', padding: '8px 16px', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}>⚡ Review & Approve</button>
                        )}
                        {/* Employee: Mark completed */}
                        {isOwner && isActive && !isCompleted && (
                            <button onClick={handleMarkCompleted} style={{ background: 'linear-gradient(135deg,#7c3aed,#a78bfa)', color: '#fff', border: 'none', borderRadius: '8px', padding: '8px 16px', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}>🏆 Mark Completed</button>
                        )}

                        {/* Manager: Evaluate completed */}
                        {isManager && isActive && isCompleted && !detail.evaluationRating && (!isOwner || isAdmin) && (
                            <button onClick={function () { setShowEvaluateModal(true); }} style={{ background: 'linear-gradient(135deg,#7c3aed,#a78bfa)', color: '#fff', border: 'none', borderRadius: '8px', padding: '8px 16px', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}>📊 Evaluate</button>
                        )}
                        {/* Sub-goal + Check-in */}
                        {isActive && <button onClick={function () { setShowSubGoalForm(!showSubGoalForm); }} style={{ background: 'linear-gradient(135deg,#0ea5e9,#38bdf8)', color: '#fff', border: 'none', borderRadius: '8px', padding: '8px 16px', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}>🔗 Add Sub-objective</button>}
                        {isActive && <button className="btn btn--primary" onClick={function () { setShowCheckInModal(true); }} style={{ marginLeft: 'auto' }}>Check-in</button>}
                    </div>

                    {/* Rejection / Revision notice */}
                    {detail.status === 'rejected' && (detail.rejectionReason || detail.managerComments) && (
                        <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '10px', padding: '12px', marginBottom: '1rem' }}>
                            <strong style={{ color: '#dc2626' }}>❌ Rejected:</strong> <span>{detail.rejectionReason || detail.managerComments}</span>
                        </div>
                    )}
                    {detail.status === 'revision_requested' && (detail.revisionReason || detail.managerComments) && (
                        <div style={{ background: '#fff7ed', border: '1px solid #fdba74', borderRadius: '10px', padding: '12px', marginBottom: '1rem' }}>
                            <strong style={{ color: '#e67e22' }}>↩ Revision Requested:</strong> <span>{detail.revisionReason || detail.managerComments}</span>
                        </div>
                    )}
                    {detail.evaluationRating && (
                        <div style={{ background: '#f5f3ff', border: '1px solid #c4b5fd', borderRadius: '10px', padding: '12px', marginBottom: '1rem' }}>
                            <strong style={{ color: '#7c3aed' }}>📊 Evaluation:</strong> <span>{ratingLabels[detail.evaluationRating] || detail.evaluationRating}</span>
                            {detail.evaluationComment && <p style={{ margin: '4px 0 0', fontSize: '0.9rem', color: '#64748b' }}>{detail.evaluationComment}</p>}
                        </div>
                    )}

                    {/* Sub-goal form */}
                    {showSubGoalForm && (
                        <form onSubmit={handleCreateSubGoal} style={{ background: 'var(--bg-main,#f8fafc)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '1.25rem', marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            <strong>🔗 Create Sub-goal</strong>
                            <input type="text" placeholder="Sub-objective title *" value={subGoalForm.title} onChange={function(e) { setSubGoalForm(function(p) { return {...p, title: e.target.value}; }); }} required style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '0.9rem' }} />
                            <div style={{ display: 'flex', gap: '0.75rem' }}>
                                <input type="number" placeholder="Weight %" value={subGoalForm.weight} min={1} max={100} onChange={function(e) { setSubGoalForm(function(p) { return {...p, weight: e.target.value}; }); }} style={{ flex: 1, padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)' }} />
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button type="submit" style={{ background: '#6366f1', color: '#fff', border: 'none', borderRadius: '6px', padding: '8px 18px', cursor: 'pointer', fontWeight: 600 }}>Create</button>
                                <button type="button" onClick={function() { setShowSubGoalForm(false); }} style={{ background: 'none', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '8px 14px', cursor: 'pointer' }}>Cancel</button>
                            </div>
                        </form>
                    )}

                    {/* Progress row */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', background: 'var(--bg-main,#f8fafc)', padding: '1rem 1.25rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                        <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontWeight: 'bold' }}><span>Progress</span><span>{detail.achievementPercent || 0}%</span></div>
                            <GoalProgressBar percent={detail.achievementPercent || 0} />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-end' }}>
                            <GoalStatusBadge status={detail.status} type="workflow" />
                            <span style={{ fontSize: '0.78rem', color: '#64748b' }}>Updated {formatDate(detail.updatedAt || detail.createdAt)}</span>
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <div style={{ display: 'flex', gap: '0.25rem', padding: '0.75rem 2.5rem', borderBottom: '1px solid var(--border-color)', overflowX: 'auto' }}>
                    {tabs.map(function (tab) {
                        return (<button key={tab} className={'goal-panel__tab' + (activeTab === tab ? ' goal-panel__tab--active' : '')} onClick={function () { setActiveTab(tab); }} style={{ whiteSpace: 'nowrap' }}>
                            {tab === 'kpis' ? 'KPIs' : tab === 'changes' ? 'Changes (' + (detail.changeRequests || []).filter(function(cr) { return cr.status === 'pending'; }).length + ')' : tab.charAt(0).toUpperCase() + tab.slice(1)}
                        </button>);
                    })}
                </div>

                {/* Tab content */}
                <div className="goal-panel__content" style={{ flex: 1, padding: '2rem 2.5rem', overflowY: 'auto' }}>
                    {activeTab === 'details' && (
                        <div className="goal-panel__details">
                            <div className="goal-panel__detail-row"><span>Owner:</span><span>{detail.owner?.name || 'Unknown'}</span></div>
                            <div className="goal-panel__detail-row"><span>Source:</span><span>{detail.source === 'manager_assigned' ? '📌 Manager Assigned' : '✎ Self Created'}</span></div>
                            {detail.assignedBy && <div className="goal-panel__detail-row"><span>Assigned By:</span><span>{detail.assignedBy?.name || detail.assignedBy}</span></div>}
                            <div className="goal-panel__detail-row"><span>Category:</span><span>{detail.category || 'individual'}</span></div>
                            <div className="goal-panel__detail-row"><span>Weight:</span><span>{detail.weight}%</span></div>
                            <div className="goal-panel__detail-row"><span>Visibility:</span><span>{detail.visibility || 'public'}</span></div>
                            <div className="goal-panel__detail-row"><span>Labels:</span><span>{(detail.labels || []).join(', ') || 'None'}</span></div>
                            {detail.successIndicator && <div className="goal-panel__detail-row"><span>Success Indicator:</span><span>{detail.successIndicator}</span></div>}
                            {children.length > 0 && (<div style={{ marginTop: '1.5rem' }}><strong>Sub-goals ({children.length}):</strong><ul style={{ marginTop: '0.5rem', paddingLeft: '1.25rem' }}>{children.map(function(c) { return <li key={c._id} style={{ marginBottom: '4px' }}>{c.title} <span style={{ fontSize: '0.8rem', color: '#64748b' }}>({c.achievementPercent || 0}%)</span></li>; })}</ul></div>)}
                        </div>
                    )}

                    {activeTab === 'kpis' && (
                        <div className="goal-panel__kpis">
                            <div className="goal-panel__kpi-header"><h3>Key Results / KPIs ({(detail.kpis || []).length})</h3>{(isOwner || isAdmin) && <button className="goal-panel__add-btn" onClick={function () { setShowKpiForm(!showKpiForm); }} disabled={isPhaseThreeLocked} style={isPhaseThreeLocked ? { opacity: 0.55, cursor: 'not-allowed' } : {}}>+ Add KPI</button>}</div>
                            {showKpiForm && (<form className="goal-panel__kpi-form" onSubmit={handleAddKpi}><input type="text" placeholder="KPI Title" value={kpiForm.title} onChange={function (e) { setKpiForm(Object.assign({}, kpiForm, { title: e.target.value })); }} required /><select value={kpiForm.metricType} onChange={function (e) { setKpiForm(Object.assign({}, kpiForm, { metricType: e.target.value })); }}><option value="percent">Percent</option><option value="number">Number</option><option value="currency">Currency</option><option value="boolean">Boolean</option><option value="milestone">Milestone</option></select><div className="goal-panel__kpi-form-row"><input type="number" placeholder="Initial" value={kpiForm.initialValue} onChange={function (e) { setKpiForm(Object.assign({}, kpiForm, { initialValue: parseFloat(e.target.value) })); }} /><input type="number" placeholder="Target" value={kpiForm.targetValue} onChange={function (e) { setKpiForm(Object.assign({}, kpiForm, { targetValue: parseFloat(e.target.value) })); }} /><input type="text" placeholder="Unit" value={kpiForm.unit} onChange={function (e) { setKpiForm(Object.assign({}, kpiForm, { unit: e.target.value })); }} /></div><div className="goal-panel__kpi-form-actions"><button type="submit">Add</button><button type="button" onClick={function () { setShowKpiForm(false); }}>Cancel</button></div></form>)}
                            <div className="goal-panel__kpi-list">
                                {(detail.kpis || []).length === 0 ? <p className="goal-panel__empty">No KPIs defined.</p> :
                                    (detail.kpis || []).map(function (kpi) {
                                        var progress = getKpiProgress(kpi);
                                        var localVal = kpiLocalValues[kpi._id] !== undefined ? kpiLocalValues[kpi._id] : kpi.currentValue;
                                        return (<div key={kpi._id} className="goal-panel__kpi-item"><div className="goal-panel__kpi-top"><span className="goal-panel__kpi-title">{kpi.title}</span><span className="goal-panel__kpi-type">{kpi.metricType}</span><button className="goal-panel__kpi-delete" onClick={function () { handleDeleteKpi(kpi._id); }}>✕</button></div><GoalProgressBar percent={progress} size="small" /><div className="goal-panel__kpi-values"><span>Current: <input type="number" className="goal-panel__kpi-input" value={localVal} onChange={function (e) { handleKpiLocalChange(kpi._id, e.target.value); }} /></span><span>Target: {kpi.targetValue} {kpi.unit}</span></div></div>);
                                    })}
                            </div>
                        </div>
                    )}

                    {activeTab === 'alignment' && (<div className="goal-panel__alignment"><h3>Objective Alignment</h3><GoalAlignmentTree rootGoal={detail} /></div>)}

                    {activeTab === 'updates' && (
                        <div className="goal-panel__updates">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}><h3 style={{ margin: 0 }}>Progress Updates</h3>{isActive && <button className="submit-btn" style={{ padding: '6px 14px', fontSize: '0.85rem' }} onClick={function() { setShowCheckInModal(true); }}>+ Check-in</button>}</div>
                            {(detail.progressUpdates || []).length === 0 ? <p className="goal-panel__empty">No updates yet.</p> :
                                (detail.progressUpdates || []).slice().reverse().map(function (upd, i) {
                                    return (<div key={upd._id || i} className="goal-panel__update-item"><div className="goal-panel__update-header"><strong>{upd.user?.name || 'Unknown'}</strong><span>{formatDateTime(upd.createdAt)}</span></div><p>{upd.message}</p></div>);
                                })}
                        </div>
                    )}

                    {activeTab === 'comments' && <CommentSection />}

                    {activeTab === 'changes' && (
                        <div>
                            <h3>Change Requests</h3>
                            {(detail.changeRequests || []).length === 0 ? <p className="goal-panel__empty">No change requests.</p> :
                                (detail.changeRequests || []).slice().reverse().map(function (cr) {
                                    var typeLabels = { due_date_extension: '📅 Due Date Extension', scope_change: '📝 Scope Change', pause: '⏸️ Pause', cancellation: '⊘ Cancellation' };
                                    return (
                                        <div key={cr._id} style={{ background: 'var(--bg-main,#f8fafc)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '1rem', marginBottom: '0.75rem' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                                <strong>{typeLabels[cr.requestType] || cr.requestType}</strong>
                                            </div>
                                            <p style={{ margin: '4px 0', fontSize: '0.9rem' }}>{cr.reason}</p>
                                            {cr.resolutionNote && <p style={{ margin: '4px 0', fontSize: '0.85rem', color: '#64748b' }}>Resolution: {cr.resolutionNote}</p>}
                                            <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>By {cr.requestedBy?.name || 'Unknown'} • {formatDateTime(cr.createdAt)}</div>
                                            {isManager && cr.status === 'pending' && (
                                                <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                                                    <button onClick={function () { handleResolveChangeRequest(cr._id, 'approved', ''); }} style={{ background: '#27ae60', color: '#fff', border: 'none', borderRadius: '6px', padding: '6px 14px', cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem' }}>Approve</button>
                                                    <button onClick={function () { var note = prompt('Reason for rejection?'); handleResolveChangeRequest(cr._id, 'rejected', note || ''); }} style={{ background: '#e74c3c', color: '#fff', border: 'none', borderRadius: '6px', padding: '6px 14px', cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem' }}>Reject</button>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                        </div>
                    )}

                    {activeTab === 'activity' && (
                        <div>
                            <h3>Activity Log</h3>
                            {(detail.activityLog || []).length === 0 ? <p className="goal-panel__empty">No activity recorded.</p> :
                                (detail.activityLog || []).slice().reverse().map(function (log, i) {
                                    return (
                                        <div key={log._id || i} style={{ display: 'flex', gap: '12px', padding: '10px 0', borderBottom: '1px solid var(--border-color, #e5e7eb)' }}>
                                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#6366f1', marginTop: '6px', flexShrink: 0 }}></div>
                                            <div>
                                                <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{log.action.replace(/_/g, ' ').replace(/\b\w/g, function(c) { return c.toUpperCase(); })}</div>
                                                {log.details && <p style={{ margin: '2px 0', fontSize: '0.85rem', color: '#64748b' }}>{log.details}</p>}
                                                <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{log.user?.name || 'System'} • {formatDateTime(log.createdAt)}</div>
                                            </div>
                                        </div>
                                    );
                                })}
                        </div>
                    )}

                </div>
            </div>

            {showCheckInModal && <CheckInModal goal={detail} onClose={function() { setShowCheckInModal(false); }} onCheckInComplete={function() { setShowCheckInModal(false); fetchDetail(); if (onRefresh) onRefresh(); }} />}

            {showEvaluateModal && <EvaluateGoalModal goal={detail} onClose={function() { setShowEvaluateModal(false); }} onEvaluated={function() { fetchDetail(); if (onRefresh) onRefresh(); }} />}
            {showReviewModal && <ManagerReviewModal goal={detail} onClose={function() { setShowReviewModal(false); }} onReviewed={function() { fetchDetail(); if (onRefresh) onRefresh(); }} />}
        </div>
    );
}

export default GoalDetailsPanel;
