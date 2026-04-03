import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../components/AuthContext';

var API = 'http://localhost:5000';

// Safe defaults so we never access properties on null
var EMPTY_DASH = { objectives: 0, teams: 0, users: 0, cycles: 0 };
var EMPTY_TASK = { total: 0, done: 0, inProgress: 0, overdue: 0, completionRate: 0 };
var EMPTY_FEEDBACK = { received: 0, sent: 0, byType: [] };

function AnalyticsPage() {
  var { user } = useAuth();
  var [loading, setLoading] = useState(true);
  var [dashStats, setDashStats] = useState(EMPTY_DASH);
  var [performance, setPerformance] = useState(null);
  var [taskStats, setTaskStats] = useState(EMPTY_TASK);
  var [feedbackStats, setFeedbackStats] = useState(EMPTY_FEEDBACK);

  var token = localStorage.getItem('token');
  var headers = { Authorization: 'Bearer ' + token };

  useEffect(function () { loadData(); }, []);

  function loadData() {
    setLoading(true);
    var promises = [
      axios.get(API + '/api/stats/dashboard', { headers: headers }).catch(function () { return null; }),
      axios.get(API + '/api/tasks/stats', { headers: headers }).catch(function () { return null; }),
      axios.get(API + '/api/feedback/stats', { headers: headers }).catch(function () { return null; }),
    ];
    if (user && (user.role === 'ADMIN' || user.role === 'HR')) {
      promises.push(axios.get(API + '/api/stats/performance', { headers: headers }).catch(function () { return null; }));
    }

    Promise.all(promises)
      .then(function (res) {
        // Each result is either an axios response or null (if that call failed)
        if (res[0] && res[0].data) setDashStats(res[0].data);
        if (res[1] && res[1].data && res[1].data.stats) setTaskStats(res[1].data.stats);
        if (res[2] && res[2].data && res[2].data.stats) setFeedbackStats(res[2].data.stats);
        if (res[3] && res[3].data) setPerformance(res[3].data);
      })
      .catch(function () {
        // Final safety net — state keeps its safe defaults
      })
      .finally(function () { setLoading(false); });
  }

  if (loading) {
    return <div className="page-container"><div className="loading-state"><div className="spinner"></div><p>Loading analytics...</p></div></div>;
  }

  // Defensive local references with fallbacks in case state is somehow still null
  var dash = dashStats || EMPTY_DASH;
  var tasks = taskStats || EMPTY_TASK;
  var feedback = feedbackStats || EMPTY_FEEDBACK;

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="page-header__left">
          <h1 className="page-title">📈 Analytics</h1>
          <p className="page-subtitle">Performance insights and usage data</p>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="analytics-section">
        <h2 className="section-title">Overview</h2>
        <div className="stats-row">
          <div className="mini-stat mini-stat--purple"><span className="mini-stat__value">{dash.objectives || 0}</span><span className="mini-stat__label">Goals</span></div>
          <div className="mini-stat mini-stat--blue"><span className="mini-stat__value">{dash.teams || 0}</span><span className="mini-stat__label">Teams</span></div>
          <div className="mini-stat mini-stat--green"><span className="mini-stat__value">{dash.users || 0}</span><span className="mini-stat__label">Users</span></div>
          <div className="mini-stat mini-stat--orange"><span className="mini-stat__value">{dash.cycles || 0}</span><span className="mini-stat__label">Cycles</span></div>
        </div>
      </div>

      {/* Task Analytics */}
      <div className="analytics-section">
        <h2 className="section-title">Task Analytics</h2>
        <div className="stats-row">
          <div className="mini-stat"><span className="mini-stat__value">{tasks.total || 0}</span><span className="mini-stat__label">Total Tasks</span></div>
          <div className="mini-stat"><span className="mini-stat__value" style={{ color: '#10b981' }}>{tasks.done || 0}</span><span className="mini-stat__label">Completed</span></div>
          <div className="mini-stat"><span className="mini-stat__value" style={{ color: '#3b82f6' }}>{tasks.inProgress || 0}</span><span className="mini-stat__label">In Progress</span></div>
          <div className="mini-stat"><span className="mini-stat__value" style={{ color: '#ef4444' }}>{tasks.overdue || 0}</span><span className="mini-stat__label">Overdue</span></div>
          <div className="mini-stat"><span className="mini-stat__value" style={{ color: '#6366f1' }}>{tasks.completionRate || 0}%</span><span className="mini-stat__label">Completion Rate</span></div>
        </div>
      </div>

      {/* Feedback Analytics */}
      <div className="analytics-section">
        <h2 className="section-title">Feedback Analytics</h2>
        <div className="stats-row">
          <div className="mini-stat"><span className="mini-stat__value">{feedback.received || 0}</span><span className="mini-stat__label">Received</span></div>
          <div className="mini-stat"><span className="mini-stat__value">{feedback.sent || 0}</span><span className="mini-stat__label">Sent</span></div>
        </div>
        {Array.isArray(feedback.byType) && feedback.byType.length > 0 && (
          <div className="analytics-breakdown">
            <h3 className="subsection-title">By Type</h3>
            <div className="breakdown-list">{feedback.byType.map(function (t) { return <div key={t._id} className="breakdown-item"><span className="breakdown-item__label">{t._id}</span><span className="breakdown-item__value">{t.count}</span></div>; })}</div>
          </div>
        )}
      </div>

      {/* Performance (Admin only) */}
      {performance && (
        <div className="analytics-section">
          <h2 className="section-title">Performance Overview</h2>
          <div className="stats-row">
            <div className="mini-stat mini-stat--green"><span className="mini-stat__value">{performance.overview?.companyAverage?.toFixed(1) || '0.0'}</span><span className="mini-stat__label">Company Avg</span></div>
            <div className="mini-stat mini-stat--red"><span className="mini-stat__value">{performance.overview?.redFlagsCount || 0}</span><span className="mini-stat__label">Red Flags (&lt;60)</span></div>
          </div>
          <div className="analytics-grid">
            <div className="analytics-card">
              <h3>🏆 Top Performers</h3>
              {performance.topPerformers?.length ? (
                <div className="perf-list">{performance.topPerformers.map(function (p) { return <div key={p._id} className="perf-item"><span>{p.user?.name || 'Unknown'}</span><span className="perf-score perf-score--good">{p.finalScore?.toFixed(1) || '0.0'}</span></div>; })}</div>
              ) : <p className="empty-text">No data</p>}
            </div>
            <div className="analytics-card">
              <h3>⚠️ Needs Attention</h3>
              {performance.bottomPerformers?.length ? (
                <div className="perf-list">{performance.bottomPerformers.map(function (p) { return <div key={p._id} className="perf-item"><span>{p.user?.name || 'Unknown'}</span><span className={'perf-score' + ((p.finalScore || 0) < 60 ? ' perf-score--bad' : ' perf-score--warn')}>{p.finalScore?.toFixed(1) || '0.0'}</span></div>; })}</div>
              ) : <p className="empty-text">No data</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AnalyticsPage;

