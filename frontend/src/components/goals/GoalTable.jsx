import React, { useEffect, useRef, useState } from 'react';
import GoalProgressBar from './GoalProgressBar';
import GoalStatusBadge from './GoalStatusBadge';

function GoalTable({ objectives, onGoalClick, onStatusChange, onDelete, onDuplicate, onEdit, onValidate, onSubmit, showOwner, currentUser, validationErrors }) {
    var [expandedRows, setExpandedRows] = useState({});
    var [sortConfig, setSortConfig] = useState({ key: null, direction: null });
    var [openMenuId, setOpenMenuId] = useState(null);
    var tableRef = useRef(null);

    var isTeamLeader = currentUser && currentUser.role === 'TEAM_LEADER';
    var isAdmin = currentUser && currentUser.role === 'ADMIN';

    useEffect(function () {
        function handleDocumentClick(event) {
            if (tableRef.current && !tableRef.current.contains(event.target)) {
                setOpenMenuId(null);
            }
        }

        document.addEventListener('mousedown', handleDocumentClick);
        return function () {
            document.removeEventListener('mousedown', handleDocumentClick);
        };
    }, []);

    function toggleRow(id) {
        setExpandedRows(function (previousState) {
            var nextState = Object.assign({}, previousState);
            nextState[id] = !nextState[id];
            return nextState;
        });
    }

    function handleSort(key) {
        setSortConfig(function (previousState) {
            if (previousState.key !== key) return { key: key, direction: 'asc' };
            if (previousState.direction === 'asc') return { key: key, direction: 'desc' };
            return { key: null, direction: null };
        });
    }

    function getSortIcon(key) {
        if (sortConfig.key !== key) {
            return <span className="goals-table__sort-icon goals-table__sort-icon--muted">&lt;&gt;</span>;
        }

        return (
            <span className="goals-table__sort-icon goals-table__sort-icon--active">
                {sortConfig.direction === 'asc' ? '^' : 'v'}
            </span>
        );
    }

    function getInitials(name) {
        if (!name) return '?';
        return name
            .split(' ')
            .map(function (word) { return word[0]; })
            .join('')
            .toUpperCase()
            .substring(0, 2);
    }

    function getWeightTone(weight) {
        if (weight >= 30) return 'high';
        if (weight >= 20) return 'medium';
        return 'low';
    }

    function getRowTone(status) {
        if (status === 'rejected') return 'rejected';
        if (status === 'approved' || status === 'validated') return 'approved';
        if (status === 'revision_requested') return 'revision';
        if (status === 'pending' || status === 'submitted' || status === 'pending_approval') return 'pending';
        return '';
    }

    function getRevisionClass(status) {
        return status === 'revision_requested' ? ' goals-table__rejection-notice--revision' : '';
    }

    function isGoalOwner(goal) {
        if (!currentUser) return false;
        var ownerId = goal.owner?._id || goal.owner;
        var userId = currentUser._id || currentUser.id;
        return String(ownerId) === String(userId);
    }

    function buildStatusRowClass(goal, level, isExpanded, needsAction) {
        var className = 'goals-table__row-wrapper';
        if (level > 0) className += ' goals-table__row-wrapper--child';
        if (isExpanded) className += ' goals-table__row-wrapper--expanded';
        if (needsAction) className += ' goals-table__row-wrapper--action';

        var tone = getRowTone(goal.status);
        if (tone) className += ' goals-table__row-wrapper--' + tone;

        return className;
    }

    var roots = objectives.map(function (goal) {
        return Object.assign({}, goal, { children: [] });
    });

    if (sortConfig.key && sortConfig.direction) {
        roots = roots.slice().sort(function (left, right) {
            var leftValue = sortConfig.key === 'progress' ? left.achievementPercent || 0 : 0;
            var rightValue = sortConfig.key === 'progress' ? right.achievementPercent || 0 : 0;

            if (leftValue < rightValue) return sortConfig.direction === 'asc' ? -1 : 1;
            if (leftValue > rightValue) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }

    if (objectives.length === 0) {
        return (
            <div className="goals-table-empty">
                <div className="goals-table-empty__icon">Target</div>
                <h3>No objectives found</h3>
                <p>Create your first objective to get started.</p>
            </div>
        );
    }

    function renderRow(goal, level) {
        var expanded = expandedRows[goal._id];
        var isAssigned = goal.source === 'manager_assigned';
        var needsAction = ['pending', 'pending_approval', 'submitted', 'assigned', 'revision_requested'].includes(goal.status);
        var canReview = false;

        if (currentUser && ['pending', 'submitted', 'pending_approval'].includes(goal.status)) {
            if (currentUser.role === 'ADMIN') canReview = true;
            else if (goal.submittedTo && String(goal.submittedTo) === String(currentUser._id || currentUser.id)) canReview = true;
        }

        var ownerOfGoal = isGoalOwner(goal);
        var isAssignedByCurrentUser = goal.assignedBy && String(goal.assignedBy._id || goal.assignedBy) === String(currentUser?._id || currentUser?.id);
        var canManageGoal = ownerOfGoal || isAdmin || (isTeamLeader && isAssignedByCurrentUser);
        var canEditStatus = ['draft', 'revision_requested', 'rejected'].includes(goal.status);
        var canManageGoalMenu = onGoalClick && canManageGoal;
        var canEditGoal = onEdit && canEditStatus && canManageGoal;
        var canEditGoalInMenu = onEdit && canManageGoal;
        var canDeleteGoal = onDelete && canManageGoal;
        var canSubmitGoal = onSubmit && ['revision_requested', 'rejected'].includes(goal.status) && (ownerOfGoal || isAdmin);
        var weightTone = getWeightTone(goal.weight || 0);
        var validationMessages = validationErrors && validationErrors[goal._id] ? validationErrors[goal._id] : null;

        return (
            <React.Fragment key={goal._id}>
                <div
                    className={buildStatusRowClass(goal, level, expanded, needsAction)}
                    style={{ '--goal-level': level }}
                >
                    <div className="goals-table__row" onClick={function () { onGoalClick(goal); }}>
                        <div className="goals-table__col goals-table__col--title">
                            <button type="button" className="goals-table__expand" onClick={function (event) { event.stopPropagation(); toggleRow(goal._id); }}>
                                {expanded ? '-' : '+'}
                            </button>
                            {showOwner !== false ? (
                                <div className="goals-table__avatar" title={goal.owner?.name || 'Unknown'}>
                                    {getInitials(goal.owner?.name)}
                                </div>
                            ) : null}
                            <div className="goals-table__title-text">
                                <span className="goals-table__goal-title">{goal.title}</span>
                                <div className="goals-table__meta-tags">
                                    {goal.category === 'individual' ? <span className="goals-table__team-tag" style={{background: '#eff6ff', color: '#1d4ed8'}}>Individual</span> : null}
                                    {goal.category === 'team' && goal.team ? (
                                        <span className="goals-table__team-tag" style={{background: goal.team.parentTeam ? '#f3e8ff' : '#e0e7ff', color: goal.team.parentTeam ? '#7e22ce' : '#4338ca'}}>
                                            {goal.team.parentTeam ? 'Subteam' : 'Team'} — {goal.team.name}
                                        </span>
                                    ) : goal.category === 'team' ? (
                                        <span className="goals-table__team-tag" style={{background: '#e0e7ff', color: '#4338ca'}}>Team</span>
                                    ) : null}
                                    {isAssigned ? <span className="goals-table__team-tag goals-table__team-tag--assigned">ASSIGNED</span> : null}
                                    {goal.status === 'rejected' || goal.status === 'revision_requested' ? (
                                        <span className="goals-table__team-tag" style={{ background: '#fff7ed', color: '#c2410c' }}>Needs Revision</span>
                                    ) : null}
                                </div>
                            </div>
                        </div>

                        <div className="goals-table__col goals-table__col--weight">
                            <span className={'goals-table__weight-badge goals-table__weight-badge--' + weightTone}>{goal.weight}</span>
                            {/* Team weight is NOT divided per member */}
                        </div>

                        <div className="goals-table__col goals-table__col--status">
                            <GoalStatusBadge status={goal.status} type="workflow" />
                        </div>

                        <div className="goals-table__col goals-table__col--progress">
                            <GoalProgressBar percent={goal.achievementPercent || 0} size="small" />
                        </div>

                        <div className="goals-table__col goals-table__col--actions">
                            <div className="goals-table__action-buttons" onClick={function (event) { event.stopPropagation(); }}>
                                {canEditGoal ? (
                                    <button type="button" className="goals-table__btn goals-table__btn--edit" onClick={function () { onEdit(goal); }} title="Edit">
                                        Edit
                                    </button>
                                ) : null}
                                {canSubmitGoal ? (
                                    <button
                                        type="button"
                                        className="goals-table__btn goals-table__btn--submit"
                                        onClick={function () { onSubmit(goal._id); }}
                                        title="Resubmit"
                                    >
                                        Resubmit
                                    </button>
                                ) : null}
                                {onValidate && canReview ? (
                                    <button type="button" className="goals-table__btn goals-table__btn--review" onClick={function () { onValidate(goal); }} title="Review">
                                        Review
                                    </button>
                                ) : null}
                                {canManageGoalMenu ? (
                                    <div className={'goals-table__action-menu' + (openMenuId === goal._id ? ' goals-table__action-menu--open' : '')}>
                                        <button
                                            type="button"
                                            className="goals-table__action-btn"
                                            onClick={function (event) {
                                                event.stopPropagation();
                                                setOpenMenuId(function (previousId) { return previousId === goal._id ? null : goal._id; });
                                            }}
                                            aria-label="Open objective actions"
                                            aria-haspopup="menu"
                                            aria-expanded={openMenuId === goal._id}
                                        >
                                            ...
                                        </button>
                                        <div className="goals-table__dropdown" onClick={function (event) { event.stopPropagation(); }}>
                                            <button type="button" onClick={function () { setOpenMenuId(null); onGoalClick(goal); }}>View details</button>
                                            {canEditGoalInMenu ? (
                                                canEditGoal ? (
                                                    <button type="button" onClick={function () { setOpenMenuId(null); onEdit(goal); }}>Edit objective</button>
                                                ) : (
                                                    <button type="button" disabled title="Only draft or sent-back objectives can be edited.">Edit locked</button>
                                                )
                                            ) : null}
                                            {canDeleteGoal ? <button type="button" className="goals-table__dropdown--danger" onClick={function () { setOpenMenuId(null); onDelete(goal._id); }}>Delete objective</button> : null}
                                        </div>
                                    </div>
                                ) : null}
                            </div>
                        </div>
                    </div>

                    {expanded ? (
                        <div className="goals-table__expanded">
                            <div className="goals-table__expanded-info">
                                <div><strong>Description:</strong> {goal.description || 'No description'}</div>
                                <div>
                                    <strong>Weight:</strong> {goal.weight}%
                                    {goal.category === 'team' && (
                                        <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '4px' }}>
                                            <em>Note: Each assigned member uses {goal.weight}% of their own 100% budget (weight is not divided).</em>
                                        </div>
                                    )}
                                </div>
                                <div><strong>KPIs:</strong> {goal.kpis?.length || 0}</div>
                                {goal.category === 'team' && goal.team?.leader && (
                                    <div><strong>Leader:</strong> {goal.team.leader.name || 'Unknown'}</div>
                                )}
                                <div><strong>Priority:</strong> <span style={{ textTransform: 'capitalize' }}>{goal.priority || 'medium'}</span></div>
                                {goal.successIndicator ? <div><strong>Success indicator:</strong> {goal.successIndicator}</div> : null}
                                {goal.source === 'manager_assigned' && goal.assignedBy ? <div><strong>Assigned by:</strong> {goal.assignedBy?.name || goal.assignedBy}</div> : null}
                                {goal.evaluationRating ? <div><strong>Evaluation:</strong> {goal.evaluationRating.replace('_', ' ')}</div> : null}
                                {goal.status === 'rejected' && (goal.rejectionReason || goal.managerComments) ? (
                                    <div className="goals-table__rejection-notice">
                                        <strong>Rejection reason:</strong> {goal.rejectionReason || goal.managerComments}
                                    </div>
                                ) : null}
                                {goal.status === 'revision_requested' && (goal.revisionReason || goal.managerComments) ? (
                                    <div className={'goals-table__rejection-notice' + getRevisionClass(goal.status)}>
                                        <strong>Revision required:</strong> {goal.revisionReason || goal.managerComments}
                                    </div>
                                ) : null}
                            </div>
                        </div>
                    ) : null}

                    {validationMessages ? (
                        <div className="goals-table__validation-errors">
                            <span><strong>Missing fields:</strong></span>
                            {validationMessages.map(function (message, index) {
                                return <span key={index} className="goals-table__validation-chip">{message}</span>;
                            })}
                        </div>
                    ) : null}
                </div>

            </React.Fragment>
        );
    }

    return (
        <div className="goals-table" ref={tableRef}>
            <div className="goals-table__header">
                <div className="goals-table__col goals-table__col--title">Objective</div>
                <div className="goals-table__col goals-table__col--weight">Weight</div>
                <div className="goals-table__col goals-table__col--status">Status</div>
                <div className="goals-table__col goals-table__col--progress goals-table__sort" onClick={function () { handleSort('progress'); }} title="Sort by progress">
                    Progress {getSortIcon('progress')}
                </div>
                <div className="goals-table__col goals-table__col--actions"></div>
            </div>
            {roots.map(function (goal) { return renderRow(goal, 0); })}
        </div>
    );
}

export default GoalTable;
