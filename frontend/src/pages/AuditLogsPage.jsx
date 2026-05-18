import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { ToastContainer, useToast } from '../components/common/Toast';

function AuditLogsPage() {
  var toast = useToast();
  var [logs, setLogs] = useState([]);
  var [loading, setLoading] = useState(true);
  var [filterEntity, setFilterEntity] = useState('all');
  var [dateRange, setDateRange] = useState({ start: '', end: '' });

  useEffect(function () {
    fetchLogs();
  }, []);

  async function fetchLogs() {
    setLoading(true);

    try {
      var url = '/audit-logs?limit=100';
      if (filterEntity !== 'all') url += '&entityType=' + filterEntity;
      if (dateRange.start) url += '&startDate=' + dateRange.start;
      if (dateRange.end) url += '&endDate=' + dateRange.end;

      var response = await api.get(url);
      setLogs(response.data.logs || []);
    } catch (error) {
      toast.error('Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  }

  function handleFilterSubmit(event) {
    event.preventDefault();
    fetchLogs();
  }

  function getActionBadge(action) {
    var toneMap = {
      create: 'success',
      update: 'neutral',
      delete: 'danger',
      submitted: 'info',
      approved: 'success',
      rejected: 'danger',
      revision_requested: 'warning',
      midyear_assessed: 'info',
      final_evaluated: 'info',
      locked: 'neutral',
      unlocked: 'warning',
      phase_changed: 'info',
    };

    return (
      <span className={'ui-badge ui-badge--' + (toneMap[action] || 'neutral')}>
        {String(action || 'unknown').replace(/_/g, ' ')}
      </span>
    );
  }

  function getEntityLabel(entity) {
    return String(entity || 'record').replace(/_/g, ' ');
  }

  return (
    <div className="audit-logs-page">
      <div className="ds-page-header">
        <div className="ds-page-header__left">
          <h1 className="ds-page-header__title">System Audit Logs</h1>
          <p className="ds-page-header__subtitle">Security, workflow, and administrative activity across the platform.</p>
        </div>
      </div>

      <div className="ui-surface">
        <form className="audit-logs__filters" onSubmit={handleFilterSubmit}>
          <div className="audit-logs__field">
            <label htmlFor="audit-entity">Entity type</label>
            <select id="audit-entity" value={filterEntity} onChange={function (event) { setFilterEntity(event.target.value); }}>
              <option value="all">All entities</option>
              <option value="goal">Annual goals</option>
              <option value="goal_review">Assessments</option>
              <option value="cycle">Cycles</option>
              <option value="user">Users</option>
            </select>
          </div>

          <div className="audit-logs__field">
            <label htmlFor="audit-start">Start date</label>
            <input
              id="audit-start"
              type="date"
              value={dateRange.start}
              onChange={function (event) { setDateRange(Object.assign({}, dateRange, { start: event.target.value })); }}
            />
          </div>

          <div className="audit-logs__field">
            <label htmlFor="audit-end">End date</label>
            <input
              id="audit-end"
              type="date"
              value={dateRange.end}
              onChange={function (event) { setDateRange(Object.assign({}, dateRange, { end: event.target.value })); }}
            />
          </div>

          <button type="submit" className="btn btn--primary">Filter logs</button>
        </form>
      </div>

      {loading ? (
        <div className="page-loading">
          <div className="spinner"></div>
          <p>Searching logs...</p>
        </div>
      ) : logs.length === 0 ? (
        <div className="empty-state">
          <h3>No matching logs</h3>
          <p>Adjust the filters to broaden the activity window.</p>
        </div>
      ) : (
        <div className="ui-surface audit-logs__table-wrap">
          <table className="audit-logs__table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Performed by</th>
                <th>Entity and action</th>
                <th>Description and changes</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(function (log) {
                return (
                  <tr key={log._id} className={log.action === 'delete' ? 'audit-logs__row--destructive' : ''}>
                    <td>{new Date(log.timestamp).toLocaleString()}</td>
                    <td>
                      <div className="audit-logs__meta">
                        <strong>{log.userName || 'System'}</strong>
                        <span className="audit-logs__ip">{log.ipAddress || 'Internal'}</span>
                      </div>
                    </td>
                    <td>
                      <div className="audit-logs__entity">
                        <strong>{getEntityLabel(log.entityType)}</strong>
                      </div>
                      {getActionBadge(log.action)}
                    </td>
                    <td>
                      <div className="audit-logs__meta">
                        <span>{log.description}</span>
                        {(log.changes?.before || log.changes?.after) && log.action !== 'create' ? (
                          <div className="audit-logs__changes">
                            {log.changes.before ? <div>- {JSON.stringify(log.changes.before).substring(0, 60)}...</div> : null}
                            {log.changes.after ? <div>+ {JSON.stringify(log.changes.after).substring(0, 60)}...</div> : null}
                          </div>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <ToastContainer toasts={toast.toasts} removeToast={toast.removeToast} />
    </div>
  );
}

export default AuditLogsPage;
