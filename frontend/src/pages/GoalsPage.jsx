import React, { Suspense, lazy, useState, useEffect, useMemo } from 'react';
import api from '../services/api';
import { useAuth } from '../components/AuthContext';
import { useToast } from '../components/common/Toast';
import ConfirmDialog from '../components/common/ConfirmDialog';
import GoalFilters from '../components/goals/GoalFilters';
import GoalTable from '../components/goals/GoalTable';
import LoadingSkeleton from '../components/common/LoadingSkeleton';
import ViewSwitcher from '../components/goals/ViewSwitcher';

const GoalDetailsPanel = lazy(() => import('../components/goals/GoalDetailsPanel'));
const CreateGoalModal = lazy(() => import('../components/goals/CreateGoalModal'));
const EditGoalModal = lazy(() => import('../components/goals/EditGoalModal'));
const ManagerReviewModal = lazy(() => import('../components/goals/ManagerReviewModal'));
const EvaluateGoalModal = lazy(() => import('../components/goals/EvaluateGoalModal'));

function GoalsPage() {
    var { user } = useAuth();
    var [objectives, setObjectives] = useState([]);
    var [individualObjectives, setIndividualObjectives] = useState([]);
    var [teamObjectives, setTeamObjectives] = useState([]);
    var [validation, setValidation] = useState(null);
    var [cycles, setCycles] = useState([]);
    var [selectedCycle, setSelectedCycle] = useState('');
    var [activeCycleData, setActiveCycleData] = useState(null);
    var [activeTab, setActiveTab] = useState('my');
    var [activeView, setActiveView] = useState('list');
    var [searchTerm, setSearchTerm] = useState('');
    var [selectedGoal, setSelectedGoal] = useState(null);
    var [showCreateModal, setShowCreateModal] = useState(false);
    var [loading, setLoading] = useState(true);
    var [showEditModal, setShowEditModal] = useState(false);
    var [editingObjective, setEditingObjective] = useState(null);
    var [showDeleteDialog, setShowDeleteDialog] = useState(false);
    var [deletingObjective, setDeletingObjective] = useState(null);
    var [reviewGoal, setReviewGoal] = useState(null);
    var [evaluateGoal, setEvaluateGoal] = useState(null);
    var [showSubmitDialog, setShowSubmitDialog] = useState(false);
    var [submittingAll, setSubmittingAll] = useState(false);
    var [bulkComment, setBulkComment] = useState('');
    var [bulkProcessing, setBulkProcessing] = useState(false);

    var toast = useToast();

    var hasFetchedRef = React.useRef(false);

    useEffect(function () { fetchCycles(); }, []);
    useEffect(function () {
        if (!selectedCycle && cycles.length === 0) {
            return;
        }
        hasFetchedRef.current = false;
        fetchObjectives();
    }, [selectedCycle, activeTab, cycles.length]);

    async function fetchCycles() {
        try {
            var res = await api.getCached('/cycles', undefined, { ttl: 60000, cacheKey: 'cycles:goals-list' });
            setCycles(res.data);
            var active = res.data.filter(function (c) { return c.status === 'open' || c.status === 'active' || c.status === 'in_progress'; });
            if (active.length > 0) {
                setSelectedCycle(active[0]._id);
                setActiveCycleData(active[0]);
            } else if (res.data.length > 0) {
                setSelectedCycle(res.data[0]._id);
                setActiveCycleData(res.data[0]);
            }
        } catch (err) { console.error(err); }
    }

    async function fetchObjectives() {
        if (!hasFetchedRef.current) setLoading(true);
        try {
            var result = [];
            var indArr = [];
            var tmArr = [];
            if (activeTab === 'pending') {
                var pendingRes = await api.get('/objectives/pending-validation');
                var pendingData = Array.isArray(pendingRes.data) ? pendingRes.data : (pendingRes.data.objectives || []);
                indArr = pendingData; tmArr = [];
                setIndividualObjectives(indArr); setTeamObjectives(tmArr); setValidation(null);
                result = indArr;
            } else if (activeTab === 'awaiting_eval') {
                var evalRes = await api.get('/objectives/completed-awaiting-evaluation');
                var evalData = evalRes.data.objectives || [];
                indArr = evalData; tmArr = [];
                setIndividualObjectives(indArr); setTeamObjectives(tmArr); setValidation(null);
                result = indArr;
            } else if (activeTab === 'my') {
                if (selectedCycle) {
                    var structRes = await api.get('/objectives/user/' + user._id + '/cycle/' + selectedCycle);
                    indArr = structRes.data.individualObjectives || [];
                    tmArr = structRes.data.teamObjectives || [];
                    setIndividualObjectives(indArr); setTeamObjectives(tmArr);
                    setValidation(structRes.data.validation || null);
                    result = indArr;
                    // Update cycle data
                    var cycleObj = cycles.find(function(c) { return c._id === selectedCycle; });
                    if (cycleObj) setActiveCycleData(cycleObj);
                } else {
                    var res = await api.get('/objectives/my');
                    var data = res.data;
                    var allData = Array.isArray(data) ? data : (data.objectives || []);
                    indArr = allData.filter(function (o) { return o.category !== 'team'; });
                    tmArr = allData.filter(function (o) { return o.category === 'team'; });
                    setIndividualObjectives(indArr); setTeamObjectives(tmArr); setValidation(null);
                    result = indArr;
                }
            } else {
                var params = {};
                if (selectedCycle) params.cycle = selectedCycle;
                if (activeTab === 'team') params.scope = 'team';
                var res2 = await api.get('/objectives', { params: params });
                var data2 = res2.data;
                var allData2 = [];
                if (data2.objectives) { allData2 = data2.objectives; }
                else if (data2.individualObjectives || data2.teamObjectives) { allData2 = [].concat(data2.individualObjectives || [], data2.teamObjectives || []); }
                else if (Array.isArray(data2)) { allData2 = data2; }
                indArr = allData2.filter(function (o) { return o.category !== 'team'; });
                tmArr = allData2.filter(function (o) { return o.category === 'team'; });
                setIndividualObjectives(indArr); setTeamObjectives(tmArr); setValidation(null);
                result = activeTab === 'team' ? tmArr : allData2;
            }
            setObjectives(result);
            hasFetchedRef.current = true;
        } catch (err) {
            console.error(err);
            setObjectives([]); setIndividualObjectives([]); setTeamObjectives([]); setValidation(null);
        } finally { setLoading(false); }
    }

    function openDeleteModal(id) { setDeletingObjective(id); setShowDeleteDialog(true); }
    async function handleDeleteConfirm() {
        if (!deletingObjective) return;
        try {
            await api.delete('/objectives/' + deletingObjective);
            toast.success('Objective deleted successfully!');
            if (selectedGoal && selectedGoal._id === deletingObjective) setSelectedGoal(null);
            setDeletingObjective(null); setShowDeleteDialog(false);
            setTimeout(fetchObjectives, 500);
        } catch (err) { toast.error(err.response?.data?.message || 'Failed to delete'); setShowDeleteDialog(false); }
    }
    async function handleDuplicate(id) {
        try { 
            await api.post('/objectives/' + id + '/duplicate'); 
            toast.success('Objective duplicated!'); 
            setTimeout(fetchObjectives, 500);
        }
        catch (err) { toast.error(err.response?.data?.message || 'Failed to duplicate'); }
    }
    function openEditModal(obj) { setEditingObjective(obj); setShowEditModal(true); }
    function onGoalUpdated() { toast.success('Objective updated successfully!'); fetchObjectives(); }

    async function handleSubmitSingle(objId) {
        try {
            await api.post('/objectives/submit/' + objId);
            toast.success('Objective submitted for approval!');
            setTimeout(fetchObjectives, 500);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to submit objective.');
        }
    }

    var rejectedCount = validation ? (validation.totalRejected || 0) : 0;

    // Apply filters
    var filteredObjectives = useMemo(function () {
        if (!searchTerm) {
            return objectives;
        }
        var lower = searchTerm.toLowerCase();
        return objectives.filter(function(o) {
            return (o.title && o.title.toLowerCase().includes(lower)) ||
                   (o.description && o.description.toLowerCase().includes(lower)) ||
                   (o.owner && o.owner.name && o.owner.name.toLowerCase().includes(lower));
        });
    }, [objectives, searchTerm]);

    // Submission logic — only for unapproved objectives
    var unapprovedObjectives = useMemo(function () {
        return individualObjectives.filter(function(o) { return !['approved', 'validated'].includes(o.status); });
    }, [individualObjectives]);
    
    // Validate all fields for submission
    var objectiveValidationErrors = useMemo(function() {
        var errors = {};
        unapprovedObjectives.forEach(function(obj) {
            var objErrors = [];
            if (!obj.title || obj.title.trim() === '') objErrors.push('Missing title');
            if (!obj.weight || obj.weight <= 0) objErrors.push('Missing or invalid weight');
            if (!obj.successIndicator || obj.successIndicator.trim() === '') objErrors.push('Missing success indicator');
            if (objErrors.length > 0) {
                errors[obj._id] = objErrors;
            }
        });
        return errors;
    }, [unapprovedObjectives]);
    
    var hasAnyFieldErrors = Object.keys(objectiveValidationErrors).length > 0;
    
    var isDraftCycle = unapprovedObjectives.length > 0 && unapprovedObjectives.every(function (o) { return o.status === 'draft' || o.status === 'rejected' || o.status === 'revision_requested'; });
    var totalWeight = unapprovedObjectives.reduce(function (sum, o) { return sum + (o.weight || 0); }, 0);
    var validCount = unapprovedObjectives.length >= 3 && unapprovedObjectives.length <= 10;
    var canSubmit = validCount && totalWeight === 100 && isDraftCycle && !hasAnyFieldErrors;

    // Status counts for summary
    var statusCounts = useMemo(function () {
        var next = {};
        var allObjs = [].concat(individualObjectives, teamObjectives);
        allObjs.forEach(function(o) {
            var s = o.status || 'draft';
            next[s] = (next[s] || 0) + 1;
        });
        return next;
    }, [individualObjectives, teamObjectives]);

    async function handleSubmitCycle() {
        setSubmittingAll(true);
        try {
            await api.post('/objectives/submit', { cycle: selectedCycle });
            toast.success('All objectives submitted for approval!');
            setShowSubmitDialog(false);
            fetchObjectives();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to submit objectives.');
            setShowSubmitDialog(false);
        } finally {
            setSubmittingAll(false);
        }
    }

    async function handleBulkValidate(action) {
        if (!bulkComment.trim()) { toast.error('Please provide a comment for all objectives.'); return; }
        setBulkProcessing(true);
        try {
            var res = await api.post('/objectives/validate-all', { status: action, managerComments: bulkComment.trim() });
            toast.success((res.data.count || 0) + ' objectives ' + action + ' successfully!');
            setBulkComment('');
            fetchObjectives();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Bulk action failed.');
        } finally { setBulkProcessing(false); }
    }

    var groupedByUser = useMemo(function () {
        var groups = {};
        filteredObjectives.forEach(function (obj) {
            var key = obj.owner?._id || 'unknown';
            if (!groups[key]) groups[key] = { name: obj.owner?.name || 'Unknown', goals: [] };
            groups[key].goals.push(obj);
        });
        return Object.values(groups);
    }, [filteredObjectives]);

    function handleValidate(obj) { setReviewGoal(obj); }
    function handleEvaluate(obj) { setEvaluateGoal(obj); }

    function getStatusBadgeStyle(status) {
        var map = {
            draft: { color: '#64748b', bg: '#f1f5f9', label: 'Draft' },
            pending: { color: '#d97706', bg: '#fffbeb', label: 'Pending' },
            submitted: { color: '#3b82f6', bg: '#eff6ff', label: 'Submitted' },
            approved: { color: '#059669', bg: '#ecfdf5', label: 'Approved' },
            validated: { color: '#059669', bg: '#ecfdf5', label: 'Validated' },
            rejected: { color: '#dc2626', bg: '#fef2f2', label: 'Rejected' },
            revision_requested: { color: '#ea580c', bg: '#fff7ed', label: 'Revision Needed' },
            pending_approval: { color: '#d97706', bg: '#fffbeb', label: 'Pending Approval' },
        };
        return map[status] || map.draft;
    }

    // Current phase info
    var currentPhase = activeCycleData?.currentPhase || 'phase1';
    var canCreateObjectives = currentPhase === 'phase1';
    var phaseLabel = currentPhase === 'phase1' ? 'Phase 1 — Objective Setting' :
                     currentPhase === 'phase2' ? 'Phase 2 — Mid-Year Execution' :
                     currentPhase === 'phase3' ? 'Phase 3 — Final Evaluation' :
                     'Cycle Closed';

    useEffect(function () {
        if (!canCreateObjectives && showCreateModal) {
            setShowCreateModal(false);
        }
    }, [canCreateObjectives, showCreateModal]);

    return (
        <div className="ds-main__inner">
            <div className="ds-page-header">
                <div className="ds-page-header__left">
                    <h1 className="ds-page-header__title">Objectives</h1>
                    <p className="ds-page-header__subtitle">{filteredObjectives.length} objectives · {phaseLabel}</p>
                </div>
                <div className="ds-page-header__actions">
                    <ViewSwitcher activeView={activeView} onChange={setActiveView} />
                    {canCreateObjectives && objectives.length < 10 ? (
                        <button className="ds-btn ds-btn--primary" onClick={function () { setShowCreateModal(true); }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                            New Objective
                        </button>
                    ) : canCreateObjectives ? (
                        <button className="ds-btn ds-btn--secondary" disabled title="Maximum 10 objectives allowed">Max Reached</button>
                    ) : null}
                </div>
            </div>

            {/* Phase Banner */}
            {activeTab === 'my' && activeCycleData && (
                <div className="goals-phase-banner">
                    <div>
                        <div className="goals-phase-banner__eyebrow">Current phase</div>
                        <div className="goals-phase-banner__title">{phaseLabel}</div>
                    </div>
                    <div className="goals-phase-banner__stats">
                        {Object.entries(statusCounts).map(function(entry) {
                            var badge = getStatusBadgeStyle(entry[0]);
                            return (
                                <span key={entry[0]} className="goals-phase-banner__stat">
                                    {badge.label}: {entry[1]}
                                </span>
                            );
                        })}
                    </div>
                </div>
            )}

            <GoalFilters
                activeTab={activeTab} onTabChange={function(tab) { setActiveTab(tab); }}
                cycles={cycles} selectedCycle={selectedCycle} onCycleChange={function(c) { setSelectedCycle(c); var cObj = cycles.find(function(cy) { return cy._id === c; }); if (cObj) setActiveCycleData(cObj); }}
                searchTerm={searchTerm} onSearchChange={setSearchTerm}
            />

            {/* Submission Panel — only shows when conditions allow */}
            {activeTab === 'my' && selectedCycle && unapprovedObjectives.length > 0 && (
                <div className={'goals-submit-panel' + (canSubmit ? ' goals-submit-panel--ready' : '')}>
                    <div className="goals-submit-panel__header">
                        <div>
                            <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                🚀 Submit All Objectives
                                {canSubmit && <span style={{ fontSize: '0.75rem', background: '#059669', color: '#fff', padding: '2px 8px', borderRadius: '12px' }}>Ready</span>}
                            </h3>
                            <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.9rem', flexWrap: 'wrap' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: totalWeight === 100 ? '#059669' : '#dc2626', display: 'inline-block' }}></span>
                                    <span style={{ color: totalWeight === 100 ? '#059669' : '#dc2626' }}>Weight: <strong>{totalWeight}%</strong> / 100%</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: validCount ? '#059669' : '#dc2626', display: 'inline-block' }}></span>
                                    <span style={{ color: validCount ? '#059669' : '#dc2626' }}>Count: <strong>{unapprovedObjectives.length}</strong> (need 3-10)</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: isDraftCycle ? '#059669' : '#dc2626', display: 'inline-block' }}></span>
                                    <span style={{ color: isDraftCycle ? '#059669' : '#dc2626' }}>Status: <strong>{isDraftCycle ? 'Ready to Submit' : 'Some Already Submitted'}</strong></span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: !hasAnyFieldErrors ? '#059669' : '#dc2626', display: 'inline-block' }}></span>
                                    <span style={{ color: !hasAnyFieldErrors ? '#059669' : '#dc2626' }}>Fields: <strong>{hasAnyFieldErrors ? Object.keys(objectiveValidationErrors).length + ' incomplete' : 'All complete'}</strong></span>
                                </div>
                            </div>
                            {hasAnyFieldErrors && (
                                <div style={{ marginTop: '0.75rem', padding: '0.5rem 0.75rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', fontSize: '0.85rem', color: '#991b1b' }}>
                                    <strong>⚠ Incomplete objectives:</strong>
                                    <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                                        {Object.entries(objectiveValidationErrors).map(function(entry) {
                                            var objId = entry[0];
                                            var errs = entry[1];
                                            var obj = unapprovedObjectives.find(function(o) { return o._id === objId; });
                                            return (
                                                <li key={objId} style={{ marginBottom: '2px' }}>
                                                    <strong>{obj ? obj.title || 'Untitled' : 'Objective'}</strong>: {errs.join(', ')}
                                                </li>
                                            );
                                        })}
                                    </ul>
                                </div>
                            )}
                        </div>
                        <div style={{ position: 'relative', flexShrink: 0 }}>
                            {canSubmit ? (
                                <button onClick={function() { setShowSubmitDialog(true); }} style={{
                                    background: 'linear-gradient(135deg, #059669, #10b981)', color: '#fff',
                                    border: 'none', padding: '12px 28px', borderRadius: '10px',
                                    cursor: 'pointer', fontWeight: 700, fontSize: '0.95rem',
                                    boxShadow: '0 4px 14px rgba(5,150,105,0.35)',
                                    transition: 'transform 0.15s, box-shadow 0.15s',
                                    whiteSpace: 'nowrap'
                                }}
                                onMouseOver={function(e) { e.target.style.transform = 'translateY(-1px)'; }}
                                onMouseOut={function(e) { e.target.style.transform = 'translateY(0)'; }}
                                >
                                    ✅ Submit All Objectives
                                </button>
                            ) : isDraftCycle && unapprovedObjectives.length > 0 ? (
                                <button disabled title={
                                    hasAnyFieldErrors ? 'Complete all required fields before submitting' :
                                    !validCount ? 'You need between 3 and 10 objectives' :
                                    totalWeight !== 100 ? 'Total weight must equal 100%' :
                                    'Cannot submit yet'
                                } style={{
                                    background: '#94a3b8', color: '#fff',
                                    border: 'none', padding: '12px 28px', borderRadius: '10px',
                                    cursor: 'not-allowed', fontWeight: 700, fontSize: '0.95rem',
                                    opacity: 0.7, whiteSpace: 'nowrap'
                                }}>
                                    🔒 Submit All Objectives
                                </button>
                            ) : null}
                        </div>
                    </div>
                </div>
            )}

            {/* Validation Score Summary */}
            {activeTab === 'my' && validation && (
                <div className="validation-panel">
                    <h3>📊 Score Summary</h3>
                    <div className="validation-panel__formula"><strong>Formula:</strong> Final Score = (Individual Score × 70%) + (Team Score × 30%) = max 100</div>
                    <div className="validation-panel__grid">
                        <div className="validation-panel__box">
                            <h4>Individual (70%)</h4>
                            <div className="validation-stats">
                                <div className="validation-stat"><span className="stat-label">Count:</span><span className={'stat-value ' + (validation.isValidIndividualCount ? 'valid' : 'invalid')}>{validation.individualCount} (min {validation.minIndividualObjectives})</span></div>
                                <div className="validation-stat"><span className="stat-label">Weight:</span><span className={'stat-value ' + (validation.isValidIndividualWeight ? 'valid' : 'invalid')}>{validation.individualWeight} / {validation.requiredCategoryTotal}</span></div>
                                <div className="validation-stat"><span className="stat-label">Validated:</span><span className="stat-value">{validation.individualValidatedCount} / {validation.individualCount}</span></div>
                                {validation.individualRejectedCount > 0 && (<div className="validation-stat rejected"><span className="stat-label">Rejected:</span><span className="stat-value">{validation.individualRejectedCount}</span></div>)}
                                <div className="validation-stat"><span className="stat-label">Score:</span><span className="stat-value">{validation.individualScore} / 100</span></div>
                            </div>
                        </div>
                        <div className="validation-panel__box">
                            <h4>Team (30%)</h4>
                            <div className="validation-stats">
                                <div className="validation-stat"><span className="stat-label">Count:</span><span className="stat-value">{validation.teamCount}</span></div>
                                <div className="validation-stat"><span className="stat-label">Weight:</span><span className={'stat-value ' + (validation.isValidTeamWeight ? 'valid' : 'invalid')}>{validation.teamWeight} / {validation.requiredCategoryTotal}</span></div>
                                <div className="validation-stat"><span className="stat-label">Validated:</span><span className="stat-value">{validation.teamValidatedCount} / {validation.teamCount}</span></div>
                                <div className="validation-stat"><span className="stat-label">Score:</span><span className="stat-value">{validation.teamScore} / 100</span></div>
                            </div>
                        </div>
                        <div className="validation-panel__box">
                            <h4>Overall</h4>
                            <div className="validation-stats">
                                <div className="validation-stat"><span className="stat-label">Combined Weight</span><span className={'stat-value ' + ((validation.individualWeight === 100 && validation.teamWeight === 100) ? 'valid' : 'invalid')}>{validation.totalWeight} / 200</span></div>
                                <div className="validation-stat"><span className="stat-label">Status</span><span className={'stat-value ' + (validation.isValidTotalWeight ? 'valid' : 'invalid')}>{validation.isValidTotalWeight ? 'Balanced' : 'Needs attention'}</span></div>
                                <div className="validation-stat"><span className="stat-label">Final Score</span><span className="stat-value">{validation.compositeScore} / 100</span></div>
                                <div className="validation-stat"><span className="stat-label">Team + Individual</span><span className="stat-value">{validation.individualScore} + {validation.teamScore}</span></div>
                            </div>
                        </div>
                    </div>
                    {(!validation.isValidIndividualWeight || !validation.isValidTeamWeight) && (
                        <div className="validation-warning" style={{ marginTop: '12px' }}>
                            <strong>Fix required:</strong>
                            {validation.individualWeight !== 100 && ' Individual objective weights must total 100%.'}
                            {validation.teamWeight !== 100 && ' Team objective weights must total 100%.'}
                        </div>
                    )}
                    {validation.allValidated && (
                        <div className="validation-success" style={{ marginTop: '12px' }}>
                            ✅ All objectives validated! Final Score: <strong>{validation.compositeScore} / 100</strong>
                            <div style={{ fontSize: '12px', color: '#555' }}>= ({validation.individualScore} × 70%) + ({validation.teamScore} × 30%)</div>
                        </div>
                    )}
                </div>
            )}

            {/* Rejected Banner */}
            {rejectedCount > 0 && (
                <div className="rejected-banner">
                    <span className="rejected-banner-icon">!</span>
                    <div className="rejected-banner-content"><strong>Action Required!</strong><p>You have {rejectedCount} rejected objective(s) that need revision.</p></div>
                </div>
            )}

            {/* Review Status Legend */}
            {activeTab === 'pending' && (
                <div className="goals-review-legend">
                    <strong>Review Statuses:</strong>
                    <span className="goals-review-legend__item"><span className="goals-review-legend__dot" style={{ background: '#d97706' }}></span> Pending</span>
                    <span className="goals-review-legend__item"><span className="goals-review-legend__dot" style={{ background: '#059669' }}></span> Approved</span>
                    <span className="goals-review-legend__item"><span className="goals-review-legend__dot" style={{ background: '#dc2626' }}></span> Rejected</span>
                    <span className="goals-review-legend__item"><span className="goals-review-legend__dot" style={{ background: '#ea580c' }}></span> Revision Requested</span>
                </div>
            )}

            {/* Bulk Approve / Reject Panel */}
            {activeTab === 'pending' && filteredObjectives.length > 0 && (
                <div className="goals-bulk-review">
                    <h3 className="goals-bulk-review__title">
                        ⚡ Bulk Review — {filteredObjectives.length} objective{filteredObjectives.length !== 1 ? 's' : ''}
                    </h3>
                    <div>
                        <textarea
                            value={bulkComment}
                            onChange={function (e) { setBulkComment(e.target.value); }}
                            placeholder="Comment for all objectives (required)..."
                            rows={2}
                            style={{
                                width: '100%', padding: '10px 12px', borderRadius: '8px',
                                border: '1.5px solid #bae6fd', fontSize: '0.9rem',
                                fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box'
                            }}
                        ></textarea>
                    </div>
                    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                        <button
                            onClick={function () { handleBulkValidate('approved'); }}
                            disabled={bulkProcessing || !bulkComment.trim()}
                            style={{
                                background: bulkComment.trim() ? 'linear-gradient(135deg, #059669, #10b981)' : '#94a3b8',
                                color: '#fff', border: 'none', padding: '10px 24px',
                                borderRadius: '8px', cursor: bulkComment.trim() && !bulkProcessing ? 'pointer' : 'not-allowed',
                                fontWeight: 700, fontSize: '0.9rem',
                                boxShadow: bulkComment.trim() ? '0 3px 10px rgba(5,150,105,0.3)' : 'none',
                                transition: 'all 0.15s ease', opacity: bulkProcessing ? 0.7 : 1
                            }}
                        >
                            {bulkProcessing ? '⏳ Processing...' : '✅ Approve All'}
                        </button>
                        <button
                            onClick={function () { handleBulkValidate('rejected'); }}
                            disabled={bulkProcessing || !bulkComment.trim()}
                            style={{
                                background: bulkComment.trim() ? 'linear-gradient(135deg, #dc2626, #ef4444)' : '#94a3b8',
                                color: '#fff', border: 'none', padding: '10px 24px',
                                borderRadius: '8px', cursor: bulkComment.trim() && !bulkProcessing ? 'pointer' : 'not-allowed',
                                fontWeight: 700, fontSize: '0.9rem',
                                boxShadow: bulkComment.trim() ? '0 3px 10px rgba(220,38,38,0.3)' : 'none',
                                transition: 'all 0.15s ease', opacity: bulkProcessing ? 0.7 : 1
                            }}
                        >
                            {bulkProcessing ? '⏳ Processing...' : '❌ Reject All'}
                        </button>
                    </div>
                </div>
            )}

            {loading ? (
                <div className="goals-page__loading"><div className="dash-loading__spinner"></div><p>Loading objectives...</p></div>
            ) : (
                <div className="goals-page__content">
                    {activeView === 'list' && (
                        <GoalTable
                            objectives={filteredObjectives}
                            onGoalClick={setSelectedGoal}
                            onStatusChange={fetchObjectives}
                            onDelete={openDeleteModal}
                            onDuplicate={handleDuplicate}
                            onEdit={openEditModal}
                            onValidate={handleValidate}
                            onSubmit={handleSubmitSingle}
                            showOwner={activeTab !== 'my'}
                            currentUser={user}
                            validationErrors={activeTab === 'my' ? objectiveValidationErrors : {}}
                        />
                    )}
                    {activeView === 'feed' && (
                        <div className="goals-page__feed">
                            {filteredObjectives.length === 0 && <p className="goal-panel__empty">No activity to show.</p>}
                            {filteredObjectives.map(function (obj) {
                                var badge = getStatusBadgeStyle(obj.status);
                                return (
                                    <div key={obj._id} className="goals-feed-card" onClick={function () { setSelectedGoal(obj); }}>
                                        <div className="goals-feed-card__header"><strong>{obj.owner?.name || 'Unknown'}</strong><span>{new Date(obj.updatedAt || obj.createdAt).toLocaleDateString()}</span></div>
                                        <h4>{obj.title}</h4>
                                        <p>{obj.description || 'No description'}</p>
                                        <div className="goals-feed-card__footer">
                                            <span>{(obj.achievementPercent || 0).toFixed(0)}% complete</span>
                                            <span style={{ padding: '2px 10px', borderRadius: '12px', background: badge.bg, color: badge.color, fontWeight: 600, fontSize: '0.8rem' }}>{badge.label}</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                    {activeView === 'user' && (
                        <div className="goals-page__user-view">
                            {groupedByUser.map(function (group, i) {
                                return (
                                    <div key={i} className="goals-user-group">
                                        <h3 className="goals-user-group__name">👤 {group.name} ({group.goals.length})</h3>
                                        <GoalTable objectives={group.goals} onGoalClick={setSelectedGoal} onStatusChange={fetchObjectives} onDelete={openDeleteModal} onDuplicate={handleDuplicate} onEdit={openEditModal} onValidate={handleValidate} onSubmit={handleSubmitSingle} showOwner={false} />
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {selectedGoal && (
                <Suspense fallback={<div className="goal-panel-overlay"><div className="goal-panel"><LoadingSkeleton rows={4} height={96} /></div></div>}>
                    <GoalDetailsPanel goal={selectedGoal} onClose={function () { setSelectedGoal(null); }} onRefresh={fetchObjectives} />
                </Suspense>
            )}

            {canCreateObjectives && showCreateModal && (
                <Suspense fallback={null}>
                    <CreateGoalModal onClose={function () { setShowCreateModal(false); }} onCreated={fetchObjectives} cycles={cycles} selectedCycle={selectedCycle}
                        parentGoals={objectives.filter(function (o) { return !o.parentObjective; })} existingObjectives={[].concat(individualObjectives, teamObjectives)} />
                </Suspense>
            )}

            {showEditModal && editingObjective && (
                <Suspense fallback={null}>
                    <EditGoalModal goal={editingObjective} onClose={function () { setShowEditModal(false); setEditingObjective(null); }} onUpdated={onGoalUpdated}
                        cycles={cycles} parentGoals={objectives.filter(function (o) { return !o.parentObjective; })} existingObjectives={[].concat(individualObjectives, teamObjectives)} />
                </Suspense>
            )}

            {reviewGoal && (
                <Suspense fallback={null}>
                    <ManagerReviewModal goal={reviewGoal} onClose={function () { setReviewGoal(null); }} onReviewed={fetchObjectives} />
                </Suspense>
            )}
            {evaluateGoal && (
                <Suspense fallback={null}>
                    <EvaluateGoalModal goal={evaluateGoal} onClose={function () { setEvaluateGoal(null); }} onEvaluated={fetchObjectives} />
                </Suspense>
            )}

            <ConfirmDialog open={!!deletingObjective} title="Delete Objective" message="Are you sure you want to delete this objective? This action cannot be undone."
                confirmLabel="Delete" onConfirm={handleDeleteConfirm} onCancel={function () { setDeletingObjective(null); }} danger />

            <ConfirmDialog open={showSubmitDialog} title={submittingAll ? 'Submitting...' : 'Submit All Objectives'} message={submittingAll ? 'Please wait while your objectives are being submitted...' : 'Submit all objectives for this cycle? Once submitted, they cannot be structurally edited until reviewed.'}
                confirmLabel={submittingAll ? 'Submitting...' : 'Submit All'} onConfirm={submittingAll ? function(){} : handleSubmitCycle} onCancel={submittingAll ? function(){} : function () { setShowSubmitDialog(false); }} />
        </div>
    );
}

export default GoalsPage;
