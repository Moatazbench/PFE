import React, { Suspense, lazy, useState, useEffect, useMemo } from 'react';
import api from '../services/api';
import { useAuth } from '../components/AuthContext';
import { useToast } from '../components/common/Toast';
import ConfirmDialog from '../components/common/ConfirmDialog';
import GoalFilters from '../components/goals/GoalFilters';
import GoalTable from '../components/goals/GoalTable';
import LoadingSkeleton from '../components/common/LoadingSkeleton';

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
    var activeView = 'list';
    var [searchTerm, setSearchTerm] = useState('');
    var [statusFilter, setStatusFilter] = useState('ALL');
    var [currentPage, setCurrentPage] = useState(1);
    var ITEMS_PER_PAGE = 10;
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

    useEffect(function () {
        setCurrentPage(1);
    }, [searchTerm, statusFilter, activeTab, selectedCycle]);

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
                    var userId = user?._id || user?.id;
                    var structRes = await api.get('/objectives/user/' + userId + '/cycle/' + selectedCycle);
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
        return objectives.filter(function(o) {
            var matchesSearch = true;
            if (searchTerm) {
                var lower = searchTerm.trim().toLowerCase();
                matchesSearch = [
                    o.title,
                    o.description,
                    o.successIndicator,
                    o.owner?.name,
                    o.owner?.email,
                    o.status,
                    o.category,
                    o.priority,
                ].some(function (value) { return String(value || '').toLowerCase().includes(lower); });
            }
            var matchesStatus = statusFilter === 'ALL' || o.status === statusFilter;
            return matchesSearch && matchesStatus;
        });
    }, [objectives, searchTerm, statusFilter]);

    var totalPages = Math.ceil(filteredObjectives.length / ITEMS_PER_PAGE) || 1;
    var paginatedObjectives = filteredObjectives.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

    // Submission logic: the plan count/weight includes rejected objectives until they are deleted or replaced.
    var planningObjectives = useMemo(function () {
        return individualObjectives.filter(function(o) {
            return o.category === 'individual' && o.source !== 'manager_assigned' && !['cancelled', 'archived'].includes(o.status);
        });
    }, [individualObjectives]);
    var firstTimeDraftObjectives = useMemo(function () {
        return planningObjectives.filter(function(o) { return o.status === 'draft'; });
    }, [planningObjectives]);
    var correctionObjectives = useMemo(function () {
        return planningObjectives.filter(function(o) { return ['rejected', 'revision_requested'].includes(o.status); });
    }, [planningObjectives]);
    var alreadySubmittedObjectives = useMemo(function () {
        return planningObjectives.filter(function(o) { return ['pending', 'submitted', 'pending_approval', 'approved', 'validated', 'evaluated'].includes(o.status); });
    }, [planningObjectives]);
    
    // Validate all fields for submission
    var objectiveValidationErrors = useMemo(function() {
        var errors = {};
        planningObjectives.forEach(function(obj) {
            var objErrors = [];
            var title = (obj.title || '').trim();
            var successIndicator = (obj.successIndicator || '').trim();
            var weight = Number(obj.weight || 0);
            if (title.length < 5) objErrors.push('Title must be at least 5 characters');
            if (weight < 1 || weight > 100) objErrors.push('Weight must be between 1% and 100%');
            if (successIndicator.length < 10) objErrors.push('Success indicator must be at least 10 characters');
            if (objErrors.length > 0) {
                errors[obj._id] = objErrors;
            }
        });
        return errors;
    }, [planningObjectives]);
    
    var hasAnyFieldErrors = Object.keys(objectiveValidationErrors).length > 0;
    
    var hasPlanObjectives = planningObjectives.length > 0;
    var hasFirstTimeDrafts = firstTimeDraftObjectives.length > 0;
    var draftIndividualWeight = firstTimeDraftObjectives.reduce(function (sum, o) { return sum + Number(o.weight || 0); }, 0);
    var planIndividualWeight = planningObjectives.reduce(function (sum, o) { return sum + Number(o.weight || 0); }, 0);
    var individualWeight = validation ? Number(validation.individualWeight || 0) : planIndividualWeight;
    var teamWeight = validation ? Number(validation.teamWeight || 0) : teamObjectives.reduce(function (sum, o) { return sum + (o.weight || 0); }, 0);
    var subteamWeight = validation ? Number(validation.subteamWeight || 0) : 0;
    var totalWeight = individualWeight;
    var remainingWeight = validation ? Number(validation.individualRemainingWeight ?? validation.remainingWeight ?? 0) : Math.max(0, 100 - individualWeight);
    var validCount = planningObjectives.length >= 3 && planningObjectives.length <= 10;
    var submitPhase = activeCycleData?.currentPhase || 'phase1';
    var cycleStatus = activeCycleData?.status || '';
    var cycleIsOpen = ['open', 'active', 'in_progress'].includes(cycleStatus);
    var canSubmitRole = ['ADMIN', 'TEAM_LEADER', 'COLLABORATOR'].includes(user?.role);
    var submitBlockers = [];
    if (!selectedCycle || !activeCycleData) submitBlockers.push('Cannot submit because no cycle is selected.');
    else if (!cycleIsOpen) submitBlockers.push('Cannot submit because the selected cycle is not active.');
    if (submitPhase !== 'phase1') submitBlockers.push('Cannot submit because the cycle is not in Phase 1.');
    if (!hasPlanObjectives) submitBlockers.push('Cannot submit because there are no individual objectives in this cycle.');
    if (!validCount) submitBlockers.push('Cannot submit because you need between 3 and 10 individual objectives.');
    if (correctionObjectives.length > 0) submitBlockers.push('Cannot submit because ' + correctionObjectives.length + ' objective' + (correctionObjectives.length === 1 ? ' needs' : 's need') + ' revision. Edit and resubmit ' + (correctionObjectives.length === 1 ? 'it' : 'them') + ' individually.');
    if (alreadySubmittedObjectives.length > 0) submitBlockers.push('Cannot submit because ' + alreadySubmittedObjectives.length + ' objective' + (alreadySubmittedObjectives.length === 1 ? ' is' : 's are') + ' already submitted or finalized.');
    if (totalWeight !== 100) submitBlockers.push('Cannot submit because individual objective weight is ' + totalWeight + '%. It must equal 100%.');
    if (hasAnyFieldErrors) submitBlockers.push('Cannot submit because one or more individual objectives are missing required fields.');
    if (!hasFirstTimeDrafts) submitBlockers.push('Cannot submit because there are no draft objectives ready for first-time submission.');
    if (!canSubmitRole) submitBlockers.push('Cannot submit because your role is not allowed to submit objectives.');
    var submitBlockReason = submitBlockers[0] || '';
    var canSubmit = submitBlockers.length === 0;

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
            var response = await api.post('/objectives/submit', { cycle: selectedCycle });
            toast.success(response.data?.message || 'All objectives submitted for approval!');
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
            pending: { color: '#3b82f6', bg: '#eff6ff', label: 'Submitted' },
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
                    <h1 className="ds-page-header__title">
                        <span className="ds-icon-circle ds-icon-circle--primary ds-icon-circle--sm">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '20px', height: '20px' }}>
                                <circle cx="12" cy="12" r="10"></circle>
                                <circle cx="12" cy="12" r="6"></circle>
                                <circle cx="12" cy="12" r="2"></circle>
                            </svg>
                        </span>
                        Objectives
                    </h1>
                    <p className="ds-page-header__subtitle">{filteredObjectives.length} objectives · {phaseLabel}</p>
                </div>
                <div className="ds-page-header__actions">
                    {canCreateObjectives && planningObjectives.length < 10 ? (
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
                statusFilter={statusFilter} onStatusChange={setStatusFilter}
            />

            {/* Submission Panel — visible for first-time drafts; disabled state explains the blocker. */}
            {activeTab === 'my' && selectedCycle && hasPlanObjectives && (
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
                                    <span style={{ color: totalWeight === 100 ? '#059669' : '#dc2626' }}>Individual weight: <strong>{totalWeight}%</strong> / 100%</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: validCount ? '#059669' : '#dc2626', display: 'inline-block' }}></span>
                                    <span style={{ color: validCount ? '#059669' : '#dc2626' }}>Individual count: <strong>{planningObjectives.length}</strong> (need 3-10)</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: submitPhase === 'phase1' ? '#059669' : '#dc2626', display: 'inline-block' }}></span>
                                    <span style={{ color: submitPhase === 'phase1' ? '#059669' : '#dc2626' }}>Phase: <strong>{submitPhase === 'phase1' ? 'Planning' : 'Locked'}</strong></span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: !hasAnyFieldErrors ? '#059669' : '#dc2626', display: 'inline-block' }}></span>
                                    <span style={{ color: !hasAnyFieldErrors ? '#059669' : '#dc2626' }}>Fields: <strong>{hasAnyFieldErrors ? Object.keys(objectiveValidationErrors).length + ' incomplete' : 'All complete'}</strong></span>
                                </div>
                            </div>
                            <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', fontSize: '0.82rem', color: '#475569' }}>
                                <span>All individual objectives: <strong>{individualWeight}%</strong></span>
                                <span>Draft objectives: <strong>{firstTimeDraftObjectives.length}</strong> / {draftIndividualWeight}%</span>
                                <span>Needs revision: <strong>{correctionObjectives.length}</strong></span>
                                <span>Team objectives: <strong>{teamWeight}%</strong></span>
                                <span>Subteam objectives: <strong>{subteamWeight}%</strong></span>
                                <span>Individual remaining: <strong>{remainingWeight}%</strong></span>
                            </div>
                            {!canSubmit && submitBlockReason && (
                                <div style={{ marginTop: '0.75rem', padding: '0.65rem 0.8rem', background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '8px', fontSize: '0.86rem', color: '#9a3412' }}>
                                    <strong>Submit blocked:</strong> {submitBlockReason}
                                </div>
                            )}
                            {hasAnyFieldErrors && (
                                <div style={{ marginTop: '0.75rem', padding: '0.5rem 0.75rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', fontSize: '0.85rem', color: '#991b1b' }}>
                                    <strong>⚠ Incomplete objectives:</strong>
                                    <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                                        {Object.entries(objectiveValidationErrors).map(function(entry) {
                                            var objId = entry[0];
                                            var errs = entry[1];
                                            var obj = planningObjectives.find(function(o) { return o._id === objId; });
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
                            ) : hasPlanObjectives ? (
                                <button disabled title={submitBlockReason || 'Cannot submit yet'} style={{
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
                    <h3>Score Summary</h3>
                    <div className="validation-panel__formula"><strong>Weight rule:</strong> individual, team, and subteam objectives are separate 100% buckets.</div>
                    <div className="validation-panel__grid">
                        <div className="validation-panel__box">
                            <h4>Individual Objectives</h4>
                            <div className="validation-stats">
                                <div className="validation-stat"><span className="stat-label">Count:</span><span className={'stat-value ' + (validation.isValidIndividualCount ? 'valid' : 'invalid')}>{validation.individualCount} (min {validation.minIndividualObjectives})</span></div>
                                <div className="validation-stat"><span className="stat-label">Weight:</span><span className="stat-value">{validation.individualWeight}% / 100%</span></div>
                                <div className="validation-stat"><span className="stat-label">Remaining:</span><span className="stat-value">{validation.individualRemainingWeight ?? validation.remainingWeight ?? 0}%</span></div>
                                <div className="validation-stat"><span className="stat-label">Validated:</span><span className="stat-value">{validation.individualValidatedCount} / {validation.individualCount}</span></div>
                                {validation.individualRejectedCount > 0 && (<div className="validation-stat rejected"><span className="stat-label">Needs revision:</span><span className="stat-value">{validation.individualRejectedCount}</span></div>)}
                                <div className="validation-stat"><span className="stat-label">Score:</span><span className="stat-value">{validation.individualScore} / 100</span></div>
                            </div>
                        </div>
                        <div className="validation-panel__box">
                            <h4>Team Objectives</h4>
                            <div className="validation-stats">
                                <div className="validation-stat"><span className="stat-label">Count:</span><span className="stat-value">{validation.teamCount}</span></div>
                                <div className="validation-stat"><span className="stat-label">Team weight:</span><span className="stat-value">{validation.teamWeight}% / 100%</span></div>
                                <div className="validation-stat"><span className="stat-label">Team remaining:</span><span className="stat-value">{validation.teamRemainingWeight ?? 0}%</span></div>
                                <div className="validation-stat"><span className="stat-label">Subteam weight:</span><span className="stat-value">{validation.subteamWeight || 0}% / 100%</span></div>
                                <div className="validation-stat"><span className="stat-label">Subteam remaining:</span><span className="stat-value">{validation.subteamRemainingWeight ?? 0}%</span></div>
                                <div className="validation-stat"><span className="stat-label">Validated:</span><span className="stat-value">{validation.teamValidatedCount} / {validation.teamCount}</span></div>
                                <div className="validation-stat"><span className="stat-label">Score:</span><span className="stat-value">{validation.teamScore} / 100</span></div>
                            </div>
                        </div>
                    </div>
                    <div className="validation-panel__formula" style={{ marginTop: '12px' }}>
                        <strong>Individual remaining:</strong> {validation.individualRemainingWeight ?? validation.remainingWeight ?? 0}% | Team remaining: {validation.teamRemainingWeight ?? 0}% | Subteam remaining: {validation.subteamRemainingWeight ?? 0}%
                    </div>
                    {validation.isOverAllocated && (
                        <div className="validation-warning" style={{ marginTop: '12px' }}>
                            <strong>Fix required:</strong> One objective bucket is over 100%. Reduce the affected individual, team, or subteam weights.
                        </div>
                    )}
                    {validation.allValidated && (
                        <div className="validation-success" style={{ marginTop: '12px' }}>
                            All objectives validated. Final Score: <strong>{validation.compositeScore} / 100</strong>
                            <div style={{ fontSize: '12px', color: '#555' }}>Individual and team scores are shown by separate weight buckets above.</div>
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
                    {activeTab === 'pending' && !loading && filteredObjectives.length === 0 && (
                        <div className="goals-page__empty" style={{ padding: '1.5rem', borderRadius: '12px', background: '#f8fafc', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                            <h3 style={{ margin: '0 0 0.5rem', color: '#0f172a' }}>No submitted individual objectives awaiting review.</h3>
                            <p style={{ margin: 0, color: '#64748b' }}>There are currently no objectives ready for your review.</p>
                        </div>
                    )}
                    {activeView === 'list' && (
                        <GoalTable
                            objectives={paginatedObjectives}
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
                            {paginatedObjectives.length === 0 && <p className="goal-panel__empty">No activity to show.</p>}
                            {paginatedObjectives.map(function (obj) {
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

                    {totalPages > 1 && (
                        <div className="pagination" style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '1rem' }}>
                            <button 
                                disabled={currentPage === 1} 
                                onClick={() => setCurrentPage(p => p - 1)}
                                style={{ padding: '0.5rem 1rem' }}
                                className="ds-btn ds-btn--secondary"
                            >
                                Previous
                            </button>
                            <span style={{ padding: '0.5rem' }}>Page {currentPage} of {totalPages}</span>
                            <button 
                                disabled={currentPage === totalPages} 
                                onClick={() => setCurrentPage(p => p + 1)}
                                style={{ padding: '0.5rem 1rem' }}
                                className="ds-btn ds-btn--secondary"
                            >
                                Next
                            </button>
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
                        existingObjectives={[].concat(individualObjectives, teamObjectives)} />
                </Suspense>
            )}

            {showEditModal && editingObjective && (
                <Suspense fallback={null}>
                    <EditGoalModal goal={editingObjective} onClose={function () { setShowEditModal(false); setEditingObjective(null); }} onUpdated={onGoalUpdated}
                        cycles={cycles} existingObjectives={[].concat(individualObjectives, teamObjectives)} />
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
