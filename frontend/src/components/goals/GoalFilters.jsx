import React from 'react';
import { useAuth } from '../AuthContext';

function GoalFilters({ activeTab, onTabChange, cycles, selectedCycle, onCycleChange, searchTerm, onSearchChange, statusFilter, onStatusChange }) {
    var { user } = useAuth();
    var isManager = user && (user.role === 'TEAM_LEADER' || user.role === 'ADMIN' || user.role === 'HR');

    var tabs = [
        { key: 'my', label: 'My Objectives' },
        { key: 'team', label: 'My Team' },
    ];

    if (isManager) {
        tabs.push({ key: 'pending', label: 'Pending Review' });
        tabs.push({ key: 'awaiting_eval', label: 'Awaiting Evaluation' });
    }

    tabs.push({ key: 'all', label: 'All Objectives' });

    return (
        <div className="goals-filters">
            <div className="goals-filters__tabs">
                {tabs.map(function (tab) {
                    return (
                        <button
                            type="button"
                            key={tab.key}
                            className={'goals-filters__tab' + (activeTab === tab.key ? ' goals-filters__tab--active' : '')}
                            onClick={function () { onTabChange(tab.key); }}
                        >
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            <div className="goals-filters__controls">
                <input
                    type="text"
                    placeholder="Search objectives..."
                    value={searchTerm}
                    onChange={function (event) { onSearchChange(event.target.value); }}
                    className="goals-filters__search"
                />

                {typeof statusFilter !== 'undefined' && typeof onStatusChange !== 'undefined' && (
                    <select
                        className="goals-filters__cycle-select"
                        value={statusFilter}
                        onChange={function (event) { onStatusChange(event.target.value); }}
                        style={{ marginLeft: '1rem' }}
                    >
                        <option value="ALL">All Statuses</option>
                        <option value="draft">Draft</option>
                        <option value="pending">Pending</option>
                        <option value="submitted">Submitted</option>
                        <option value="approved">Approved</option>
                        <option value="validated">Validated</option>
                        <option value="rejected">Rejected</option>
                        <option value="revision_requested">Revision Needed</option>
                        <option value="pending_approval">Pending Approval</option>
                    </select>
                )}

                <select
                    className="goals-filters__cycle-select"
                    value={selectedCycle}
                    onChange={function (event) { onCycleChange(event.target.value); }}
                    style={{ marginLeft: '1rem' }}
                >
                    <option value="">All Cycles</option>
                    {cycles.map(function (cycle) {
                        return <option key={cycle._id} value={cycle._id}>{cycle.name} ({cycle.year})</option>;
                    })}
                </select>
            </div>
        </div>
    );
}

export default GoalFilters;
