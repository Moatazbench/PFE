import React, { useState, useEffect, useRef } from 'react';
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
        hasFetchedRef.current = false;
        fetchObjectives();
    }, [selectedCycle, activeTab]);

    async function fetchCycles() {
        try {
            var res = await api.get('/api/cycles');
            setCycles(res.data);
            var active = res.data.filter(function (c) { return c.status === 'active'; });
            if (active.length > 0) setSelectedCycle(active[0]._id);
        } catch (err) { console.error(err); }
    }

    async function fetchObjectives() {
        // Only show loading spinner on initial fetch
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
            } else if (activeTab === 'change_requests') {
                var crRes = await api.get('/api/objectives/pending-change-requests');
                var crData = crRes.data.objectives || [];
                indArr = crData; tmArr = [];
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
            toast.success('Goal deleted successfully!');
            if (selectedGoal && selectedGoal._id === deletingObjective) setSelectedGoal(null);
            setDeletingObjective(null); setShowDeleteDialog(false);
            setTimeout(fetchObjectives, 500);
        } catch (err) { toast.error(err.response?.data?.message || 'Failed to delete'); setShowDeleteDialog(false); }
    }
    async function handleDuplicate(id) {
        try { 
            await api.post('/api/objectives/' + id + '/duplicate'); 
            toast.success('Goal duplicated!'); 
            setTimeout(fetchObjectives, 500);
        }
        catch (err) { toast.error(err.response?.data?.message || 'Failed to duplicate'); }
    }
    function openEditModal(obj) { setEditingObjective(obj); setShowEditModal(true); }
    function onGoalUpdated() { toast.success('Goal updated successfully!'); fetchObjectives(); }

    var rejectedCount = validation ? (validation.totalRejected || 0) : 0;

    // Apply filters
    var filteredObjectives = objectives;
    if (searchTerm) {
        var lower = searchTerm.toLowerCase();
        filteredObjectives = filteredObjectives.filter(function(o) {
            return (o.title && o.title.toLowerCase().includes(lower)) ||
                   (o.description && o.description.toLowerCase().includes(lower)) ||
                   (o.owner && o.owner.name && o.owner.name.toLowerCase().includes(lower));
        });
    }

    var unapprovedObjectives = individualObjectives.filter(function(o) { return !['approved', 'validated'].includes(o.status); });
    var isDraftCycle = unapprovedObjectives.length > 0 && unapprovedObjectives.every(function (o) { return o.status === 'draft' || o.status === 'rejected'; });
    var totalWeight = unapprovedObjectives.reduce(function (sum, o) { return sum + (o.weight || 0); }, 0);
    var validCount = unapprovedObjectives.length >= 3 && unapprovedObjectives.length <= 10;
    var canSubmit = validCount && totalWeight === 100 && isDraftCycle;

    async function handleSubmitCycle() {
        try {
            await api.post('/api/objectives/submit', { cycle: selectedCycle });
            toast.success('Goals submitted for approval!'); setShowSubmitDialog(false); fetchObjectives();
        } catch (err) { toast.error(err.response?.data?.message || 'Failed to submit goals.'); setShowSubmitDialog(false); }
    }

    function getGroupedByUser() {
        var groups = {};
        filteredObjectives.forEach(function (obj) {
            var key = obj.owner?._id || 'unknown';
            if (!groups[key]) groups[key] = { name: obj.owner?.name || 'Unknown', goals: [] };
            groups[key].goals.push(obj);
        });
        return Object.values(groups);
    }

    function handleValidate(obj) { setReviewGoal(obj); }
    function handleEvaluate(obj) { setEvaluateGoal(obj); }

    return (
        <div className="goals-page">
            <div className="goals-page__header">
                <div className="goals-page__header-left">
                    <h1>🎯 Goals</h1>
                    <span className="goals-page__count">{filteredObjectives.length} goals</span>
                </div>
                <div className="goals-page__header-right">
                    <ViewSwitcher activeView={activeView} onChange={setActiveView} />
                    {objectives.length < 10 ? (
                        <button className="goals-page__new-btn" onClick={function () { setShowCreateModal(true); }}>+ New Goal</button>
                    ) : (
                        <button className="goals-page__new-btn" disabled style={{ opacity: 0.5, cursor: 'not-allowed' }} title="Maximum 10 goals allowed">Max Goals Reached</button>
                    )}
                </div>
            </div>

            <GoalFilters
                activeTab={activeTab} onTabChange={function(tab) { setActiveTab(tab); }}
                cycles={cycles} selectedCycle={selectedCycle} onCycleChange={setSelectedCycle}
                searchTerm={searchTerm} onSearchChange={setSearchTerm}
            />
            <GoalProgressSummary objectives={objectives} />

            {activeTab === 'my' && selectedCycle && isDraftCycle && (
                <div className="submission-panel" style={{ backgroundColor: '#fff', padding: '15px', borderRadius: '8px', marginBottom: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h3 style={{ margin: '0 0 10px 0', fontSize: '1.2rem', color: '#1e293b' }}>🚀 Goal Submission</h3>
                        <div style={{ display: 'flex', gap: '20px', fontSize: '0.95rem' }}>
                            <div style={{ color: totalWeight === 100 ? '#27ae60' : '#e74c3c' }}><strong>Weight Capacity:</strong> {totalWeight}% / 100%</div>
                            <div style={{ color: validCount ? '#27ae60' : '#e74c3c' }}><strong>Goals Count:</strong> {unapprovedObjectives.length} (Req: 3-10)</div>
                        </div>
                    </div>
                    {canSubmit && (
                        <button onClick={handleSubmitCycle} style={{ backgroundColor: '#3b82f6', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>Submit Goals</button>
                    )}
                </div>
            )}

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
                    </div>
                    {validation.allValidated && (
                        <div className="validation-success" style={{ marginTop: '12px' }}>
                            ✅ All objectives validated! Final Score: <strong>{validation.compositeScore} / 100</strong>
                            <div style={{ fontSize: '12px', color: '#555' }}>= ({validation.individualScore} × 70%) + ({validation.teamScore} × 30%)</div>
                        </div>
                    )}
                </div>
            )}

            {rejectedCount > 0 && (
                <div className="rejected-banner">
                    <span className="rejected-banner-icon">!</span>
                    <div className="rejected-banner-content"><strong>Action Required!</strong><p>You have {rejectedCount} rejected objective(s) that need revision.</p></div>
                </div>
            )}

            {loading ? (
                <div className="goals-page__loading"><div className="dash-loading__spinner"></div><p>Loading goals...</p></div>
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
                            showOwner={activeTab !== 'my'}
                            currentUser={user}
                        />
                    )}
                    {activeView === 'feed' && (
                        <div className="goals-page__feed">
                            {filteredObjectives.length === 0 && <p className="goal-panel__empty">No activity to show.</p>}
                            {filteredObjectives.map(function (obj) {
                                return (
                                    <div key={obj._id} className="goals-feed-card" onClick={function () { setSelectedGoal(obj); }}>
                                        <div className="goals-feed-card__header"><strong>{obj.owner?.name || 'Unknown'}</strong><span>{new Date(obj.updatedAt || obj.createdAt).toLocaleDateString()}</span></div>
                                        <h4>{obj.title}</h4>
                                        <p>{obj.description || 'No description'}</p>
                                        <div className="goals-feed-card__footer">
                                            <span>{(obj.achievementPercent || 0).toFixed(0)}% complete</span>
                                            <span className="goals-feed-card__status" style={{ color: obj.goalStatus === 'on_track' ? '#059669' : obj.goalStatus === 'at_risk' ? '#D97706' : '#9CA3AF' }}>{obj.goalStatus || 'no status'}</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                    {activeView === 'user' && (
                        <div className="goals-page__user-view">
                            {getGroupedByUser().map(function (group, i) {
                                return (
                                    <div key={i} className="goals-user-group">
                                        <h3 className="goals-user-group__name">👤 {group.name} ({group.goals.length})</h3>
                                        <GoalTable objectives={group.goals} onGoalClick={setSelectedGoal} onStatusChange={fetchObjectives} onDelete={openDeleteModal} onDuplicate={handleDuplicate} onEdit={openEditModal} onValidate={handleValidate} showOwner={false} />
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {selectedGoal && <GoalDetailsPanel goal={selectedGoal} onClose={function () { setSelectedGoal(null); }} onRefresh={fetchObjectives} />}

            {showCreateModal && (
                <CreateGoalModal onClose={function () { setShowCreateModal(false); }} onCreated={fetchObjectives} cycles={cycles} selectedCycle={selectedCycle}
                    parentGoals={objectives.filter(function (o) { return !o.parentObjective; })} existingObjectives={[].concat(individualObjectives, teamObjectives)} />
            )}

            {showEditModal && editingObjective && (
                <EditGoalModal goal={editingObjective} onClose={function () { setShowEditModal(false); setEditingObjective(null); }} onUpdated={onGoalUpdated}
                    cycles={cycles} parentGoals={objectives.filter(function (o) { return !o.parentObjective; })} existingObjectives={[].concat(individualObjectives, teamObjectives)} />
            )}

            {reviewGoal && <ManagerReviewModal goal={reviewGoal} onClose={function () { setReviewGoal(null); }} onReviewed={fetchObjectives} />}
            {evaluateGoal && <EvaluateGoalModal goal={evaluateGoal} onClose={function () { setEvaluateGoal(null); }} onEvaluated={fetchObjectives} />}

            <ConfirmDialog open={!!deletingObjective} title="Delete Goal" message="Are you sure you want to delete this goal? This action cannot be undone."
                confirmLabel="Delete" onConfirm={handleDeleteConfirm} onCancel={function () { setDeletingObjective(null); }} danger />

            <ConfirmDialog open={showSubmitDialog} title="Submit Goals" message="Submit these goals? Once submitted, they cannot be structurally edited."
                confirmLabel="Submit" onConfirm={handleSubmitCycle} onCancel={function () { setShowSubmitDialog(false); }} />
        </div>
    );
}

export default GoalsPage;
