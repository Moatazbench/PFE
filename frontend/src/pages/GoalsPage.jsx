import React, { useState, useEffect, useMemo, useRef } from 'react';
import api from '../services/api';
import { useAuth } from '../components/AuthContext';
import { useToast } from '../components/common/Toast';
import ConfirmDialog from '../components/common/ConfirmDialog';
import GoalFilters from '../components/goals/GoalFilters';
import GoalProgressSummary from '../components/goals/GoalProgressSummary';
import GoalTable from '../components/goals/GoalTable';
import GoalDetailsPanel from '../components/goals/GoalDetailsPanel';
import CreateGoalModal from '../components/goals/CreateGoalModal';
import EditGoalModal from '../components/goals/EditGoalModal';
import ManagerReviewModal from '../components/goals/ManagerReviewModal';
import EvaluateGoalModal from '../components/goals/EvaluateGoalModal';
import ViewSwitcher from '../components/goals/ViewSwitcher';

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
            var res = await api.get('/api/cycles');
            setCycles(res.data);
            var active = res.data.filter(function (c) { return c.status === 'active' || c.status === 'in_progress'; });
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
                var pendingRes = await api.get('/api/objectives/pending-validation');
                var pendingData = Array.isArray(pendingRes.data) ? pendingRes.data : (pendingRes.data.objectives || []);
                indArr = pendingData; tmArr = [];
                setIndividualObjectives(indArr); setTeamObjectives(tmArr); setValidation(null);
                result = indArr;
            } else if (activeTab === 'awaiting_eval') {
                var evalRes = await api.get('/api/objectives/completed-awaiting-evaluation');
                var evalData = evalRes.data.objectives || [];
                indArr = evalData; tmArr = [];
                setIndividualObjectives(indArr); setTeamObjectives(tmArr); setValidation(null);
                result = indArr;
            } else if (activeTab === 'my') {
                if (selectedCycle) {
                    var structRes = await api.get('/api/objectives/user/' + user._id + '/cycle/' + selectedCycle);
                    indArr = structRes.data.individualObjectives || [];
                    tmArr = structRes.data.teamObjectives || [];
                    setIndividualObjectives(indArr); setTeamObjectives(tmArr);
                    setValidation(structRes.data.validation || null);
                    result = indArr;
                    // Update cycle data
                    var cycleObj = cycles.find(function(c) { return c._id === selectedCycle; });
                    if (cycleObj) setActiveCycleData(cycleObj);
                } else {
                    var res = await api.get('/api/objectives/my');
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
                var res2 = await api.get('/api/objectives', { params: params });
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
            await api.delete('/api/objectives/' + deletingObjective);
            toast.success('Objective deleted successfully!');
            if (selectedGoal && selectedGoal._id === deletingObjective) setSelectedGoal(null);
            setDeletingObjective(null); setShowDeleteDialog(false);
            setTimeout(fetchObjectives, 500);
        } catch (err) { toast.error(err.response?.data?.message || 'Failed to delete'); setShowDeleteDialog(false); }
    }
    async function handleDuplicate(id) {
        try { 
            await api.post('/api/objectives/' + id + '/duplicate'); 
            toast.success('Objective duplicated!'); 
            setTimeout(fetchObjectives, 500);
        }
        catch (err) { toast.error(err.response?.data?.message || 'Failed to duplicate'); }
    }
    function openEditModal(obj) { setEditingObjective(obj); setShowEditModal(true); }
    function onGoalUpdated() { toast.success('Objective updated successfully!'); fetchObjectives(); }

    async function handleSubmitSingle(objId) {
        try {
            await api.post('/api/objectives/submit/' + objId);
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
    var isDraftCycle = unapprovedObjectives.length > 0 && unapprovedObjectives.every(function (o) { return o.status === 'draft' || o.status === 'rejected' || o.status === 'revision_requested'; });
    var totalWeight = unapprovedObjectives.reduce(function (sum, o) { return sum + (o.weight || 0); }, 0);
    var validCount = unapprovedObjectives.length >= 3 && unapprovedObjectives.length <= 10;
    var canSubmit = validCount && totalWeight === 100 && isDraftCycle;

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
        try {
            await api.post('/api/objectives/submit', { cycle: selectedCycle });
            toast.success('All objectives submitted for approval!'); setShowSubmitDialog(false); fetchObjectives();
        } catch (err) { toast.error(err.response?.data?.message || 'Failed to submit objectives.'); setShowSubmitDialog(false); }
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
                <div style={{
                    background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
                    padding: '1rem 1.5rem', borderRadius: '12px', color: '#fff',
                    marginBottom: '1rem', display: 'flex', justifyContent: 'space-between',
                    alignItems: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                }}>
                    <div>
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px' }}>Current Phase</div>
                        <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>{phaseLabel}</div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.85rem' }}>
                        {Object.entries(statusCounts).map(function(entry) {
                            var badge = getStatusBadgeStyle(entry[0]);
                            return (
                                <span key={entry[0]} style={{ background: 'rgba(255,255,255,0.15)', padding: '4px 10px', borderRadius: '20px', color: '#fff', fontWeight: 600 }}>
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
            <GoalProgressSummary objectives={objectives} />

            {/* Submission Panel — only shows when conditions allow */}
            {activeTab === 'my' && selectedCycle && unapprovedObjectives.length > 0 && (
                <div style={{
                    background: canSubmit ? 'linear-gradient(135deg, #ecfdf5, #d1fae5)' : '#fff',
                    border: canSubmit ? '2px solid #34d399' : '1px solid #e2e8f0',
                    padding: '1.25rem 1.5rem', borderRadius: '12px', marginBottom: '1.25rem',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
                            </div>
                        </div>
                        {canSubmit && (
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
                        )}
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
                <div style={{
                    display: 'flex', gap: '1rem', padding: '0.75rem 1rem', marginBottom: '1rem',
                    background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0',
                    fontSize: '0.85rem', flexWrap: 'wrap', alignItems: 'center'
                }}>
                    <strong>Review Statuses:</strong>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#d97706', display: 'inline-block' }}></span> Pending</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#059669', display: 'inline-block' }}></span> Approved</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#dc2626', display: 'inline-block' }}></span> Rejected</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ea580c', display: 'inline-block' }}></span> Revision Requested</span>
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

            {selectedGoal && <GoalDetailsPanel goal={selectedGoal} onClose={function () { setSelectedGoal(null); }} onRefresh={fetchObjectives} />}

            {canCreateObjectives && showCreateModal && (
                <CreateGoalModal onClose={function () { setShowCreateModal(false); }} onCreated={fetchObjectives} cycles={cycles} selectedCycle={selectedCycle}
                    parentGoals={objectives.filter(function (o) { return !o.parentObjective; })} existingObjectives={[].concat(individualObjectives, teamObjectives)} />
            )}

            {showEditModal && editingObjective && (
                <EditGoalModal goal={editingObjective} onClose={function () { setShowEditModal(false); setEditingObjective(null); }} onUpdated={onGoalUpdated}
                    cycles={cycles} parentGoals={objectives.filter(function (o) { return !o.parentObjective; })} existingObjectives={[].concat(individualObjectives, teamObjectives)} />
            )}

            {reviewGoal && <ManagerReviewModal goal={reviewGoal} onClose={function () { setReviewGoal(null); }} onReviewed={fetchObjectives} />}
            {evaluateGoal && <EvaluateGoalModal goal={evaluateGoal} onClose={function () { setEvaluateGoal(null); }} onEvaluated={fetchObjectives} />}

            <ConfirmDialog open={!!deletingObjective} title="Delete Objective" message="Are you sure you want to delete this objective? This action cannot be undone."
                confirmLabel="Delete" onConfirm={handleDeleteConfirm} onCancel={function () { setDeletingObjective(null); }} danger />

            <ConfirmDialog open={showSubmitDialog} title="Submit All Objectives" message="Submit all objectives for this cycle? Once submitted, they cannot be structurally edited until reviewed."
                confirmLabel="Submit All" onConfirm={handleSubmitCycle} onCancel={function () { setShowSubmitDialog(false); }} />
        </div>
    );
}

export default GoalsPage;
