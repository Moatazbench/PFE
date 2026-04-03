import React, { useState } from 'react';
import GoalProgressBar from './GoalProgressBar';
import GoalStatusBadge from './GoalStatusBadge';


function GoalTable({ objectives, onGoalClick, onStatusChange, onDelete, onDuplicate, onEdit, onValidate, showOwner, currentUser }) {
    var [expandedRows, setExpandedRows] = useState({});
    var [sortConfig, setSortConfig] = useState({ key: null, direction: null });

    function toggleRow(id) { setExpandedRows(function (prev) { var next = Object.assign({}, prev); next[id] = !next[id]; return next; }); }
    function handleSort(key) { setSortConfig(function (prev) { if (prev.key !== key) return { key, direction: 'asc' }; if (prev.direction === 'asc') return { key, direction: 'desc' }; return { key: null, direction: null }; }); }
    function getSortIcon(key) { if (sortConfig.key !== key) return <span style={{ opacity: 0.35, marginLeft: '4px', fontSize: '0.7rem' }}>⇅</span>; return <span style={{ marginLeft: '4px', fontSize: '0.7rem', color: 'var(--primary)' }}>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>; }
    function formatDate(d) { if (!d) return '—'; return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
    function getInitials(name) { if (!name) return '?'; return name.split(' ').map(function (w) { return w[0]; }).join('').toUpperCase().substring(0, 2); }
    function getWeightColor(w) { if (w >= 30) return '#e74c3c'; if (w >= 20) return '#f39c12'; return '#27ae60'; }
    function isOverdue(obj) { if (!obj.deadline) return false; return new Date(obj.deadline) < new Date() && obj.achievementPercent < 100; }

    // Build tree
    var map = {};
    objectives.forEach(function (o) { map[o._id] = { ...o, children: [] }; });
    var roots = [];
    objectives.forEach(function (o) {
        var parentId = o.parentObjective?._id || o.parentObjective;
        if (parentId && map[parentId]) { map[parentId].children.push(map[o._id]); }
        else { roots.push(map[o._id]); }
    });

    if (sortConfig.key && sortConfig.direction) {
        roots = [...roots].sort(function (a, b) {
            var valA, valB;
            if (sortConfig.key === 'progress') { valA = a.achievementPercent || 0; valB = b.achievementPercent || 0; }
            else if (sortConfig.key === 'deadline') { valA = a.deadline ? new Date(a.deadline).getTime() : Infinity; valB = b.deadline ? new Date(b.deadline).getTime() : Infinity; }
            else { return 0; }
            if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
            if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }

    if (objectives.length === 0) {
        return (<div className="goals-table-empty"><div className="goals-table-empty__icon">🎯</div><h3>No goals found</h3><p>Create your first goal to get started</p></div>);
    }

    function renderRow(obj, level) {
        var expanded = expandedRows[obj._id];
        var isAssigned = obj.source === 'manager_assigned';
        var needsAction = ['pending', 'pending_approval', 'submitted', 'assigned', 'revision_requested'].includes(obj.status);
        var canReview = false;
        if (currentUser && ['pending', 'submitted', 'pending_approval'].includes(obj.status)) {
            if (currentUser.role === 'ADMIN') canReview = true;
            else if (obj.submittedTo && String(obj.submittedTo) === String(currentUser._id || currentUser.id)) canReview = true;
        }

        return (
            <React.Fragment key={obj._id}>
                <div className={'goals-table__row-wrapper' + (expanded ? ' goals-table__row-wrapper--expanded' : '') + (obj.status === 'rejected' ? ' goals-table__row-wrapper--rejected' : '') + (needsAction ? ' goals-table__row-wrapper--action' : '')} style={{ marginLeft: (level * 20) + 'px', borderLeft: level > 0 ? '2px solid #e2e8f0' : 'none' }}>
                    <div className="goals-table__row" onClick={function () { onGoalClick(obj); }}>
                        <div className="goals-table__col goals-table__col--title">
                            <button className="goals-table__expand" onClick={function (e) { e.stopPropagation(); toggleRow(obj._id); }}>
                                {obj.children && obj.children.length > 0 ? (expanded ? '▾' : '▸') : <span style={{display:'inline-block', width:'12px'}}></span>}
                            </button>
                            {showOwner !== false && (
                                <div className="goals-table__avatar" title={obj.owner?.name || 'Unknown'}>
                                    {getInitials(obj.owner?.name)}
                                </div>
                            )}
                            <div className="goals-table__title-text">
                                <span className="goals-table__goal-title">{obj.title}</span>
                                <div style={{ display: 'flex', gap: '4px', marginTop: '2px', flexWrap: 'wrap' }}>
                                    {obj.category === 'team' && <span className="goals-table__team-tag">TEAM</span>}
                                    {isAssigned && <span className="goals-table__team-tag" style={{ background: '#6366f1', color: '#fff' }}>ASSIGNED</span>}

                                </div>
                            </div>
                        </div>

                        <div className="goals-table__col goals-table__col--weight">
                            <span className="goals-table__weight-badge" style={{ backgroundColor: getWeightColor(obj.weight) }}>{obj.weight}</span>
                        </div>

                        <div className="goals-table__col goals-table__col--progress">
                            <GoalProgressBar percent={obj.achievementPercent || 0} size="small" />
                        </div>



                        <div className="goals-table__col goals-table__col--date">
                            <span className={isOverdue(obj) ? 'goals-table__date--overdue' : ''}>
                                {formatDate(obj.deadline)}
                            </span>
                        </div>

                        <div className="goals-table__col goals-table__col--actions">
                            <div className="goals-table__action-buttons" onClick={function (e) { e.stopPropagation(); }}>
                                {onEdit && ['draft', 'revision_requested', 'rejected'].includes(obj.status) && <button className="goals-table__btn goals-table__btn--edit" onClick={function () { onEdit(obj); }} title="Edit">✏️</button>}
                                {onValidate && canReview && <button className="goals-table__btn" onClick={function () { onValidate(obj); }} title="Review" style={{ background: '#f59e0b', borderRadius: '6px', border: 'none', padding: '4px 8px', cursor: 'pointer' }}>⚡ Review</button>}
                                <div className="goals-table__action-menu">
                                    <button className="goals-table__action-btn">⋮</button>
                                    <div className="goals-table__dropdown">
                                        <button onClick={function () { onGoalClick(obj); }}>View Details</button>
                                        {onEdit && ['draft', 'revision_requested', 'rejected'].includes(obj.status) && <button onClick={function () { onEdit(obj); }}>Edit Goal</button>}
                                        <button onClick={function () { onDuplicate(obj._id); }}>Duplicate</button>
                                        {onDelete && <button className="goals-table__dropdown--danger" onClick={function () { onDelete(obj._id); }}>Delete Goal</button>}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {expanded && (
                        <div className="goals-table__expanded">
                            <div className="goals-table__expanded-info">
                                <div><strong>Description:</strong> {obj.description || 'No description'}</div>
                                <div><strong>Weight:</strong> {obj.weight}%</div>
                                <div><strong>KPIs:</strong> {obj.kpis?.length || 0}</div>
                                {obj.successIndicator && <div><strong>Success Indicator:</strong> {obj.successIndicator}</div>}
                                {obj.source === 'manager_assigned' && obj.assignedBy && <div><strong>Assigned by:</strong> {obj.assignedBy?.name || obj.assignedBy}</div>}
                                {obj.evaluationRating && <div><strong>Evaluation:</strong> {obj.evaluationRating.replace('_', ' ')}</div>}
                                {obj.status === 'rejected' && (obj.rejectionReason || obj.managerComments) && (
                                    <div className="goals-table__rejection-notice">
                                        <strong>⚠️ Rejection Reason:</strong> {obj.rejectionReason || obj.managerComments}
                                    </div>
                                )}
                                {obj.status === 'revision_requested' && (obj.revisionReason || obj.managerComments) && (
                                    <div className="goals-table__rejection-notice" style={{ borderColor: '#e67e22', background: '#fff7ed' }}>
                                        <strong>↩ Revision Required:</strong> {obj.revisionReason || obj.managerComments}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {obj.children && obj.children.length > 0 && expanded && (
                    <div className="goals-table__children">
                        {obj.children.map(function (child) { return renderRow(child, level + 1); })}
                    </div>
                )}
            </React.Fragment>
        );
    }

    return (
        <div className="goals-table">
            <div className="goals-table__header">
                <div className="goals-table__col goals-table__col--title">Goal</div>
                <div className="goals-table__col goals-table__col--weight">Weight</div>
                <div className="goals-table__col goals-table__col--progress" onClick={function() { handleSort('progress'); }} style={{ cursor: 'pointer', userSelect: 'none', display: 'flex', alignItems: 'center' }} title="Sort by Progress">
                    Progress {getSortIcon('progress')}
                </div>

                <div className="goals-table__col goals-table__col--date" onClick={function() { handleSort('deadline'); }} style={{ cursor: 'pointer', userSelect: 'none', display: 'flex', alignItems: 'center' }} title="Sort by End Date">
                    End Date {getSortIcon('deadline')}
                </div>
                <div className="goals-table__col goals-table__col--actions"></div>
            </div>
            {roots.map(function (obj) { return renderRow(obj, 0); })}
        </div>
    );
}

export default GoalTable;
