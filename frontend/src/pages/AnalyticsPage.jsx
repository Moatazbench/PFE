import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { useAuth } from '../components/AuthContext';

function AnalyticsPage() {
  var { user } = useAuth();
  var [loading, setLoading] = useState(true);
  var [dashStats, setDashStats] = useState({ objectives: 0, teams: 0, users: 0, cycles: 0 });
  var [performance, setPerformance] = useState(null);
  var [taskStats, setTaskStats] = useState({ total: 0, done: 0, inProgress: 0, overdue: 0, completionRate: 0 });
  var [feedbackStats, setFeedbackStats] = useState({ received: 0, sent: 0, byType: [] });
  var [objectives, setObjectives] = useState([]);
  var [activeCycle, setActiveCycle] = useState(null);

  useEffect(function () {
    loadData();
  }, []);

  function loadData() {
    setLoading(true);
    var scope = 'me';

    if (user && (user.role === 'ADMIN' || user.role === 'HR')) scope = 'org';
    else if (user && user.role === 'TEAM_LEADER') scope = 'team';

    var requests = [
      api.getCached('/stats/dashboard', { params: { scope: scope } }, { ttl: 15000 }).catch(function () { return { data: {} }; }),
      api.getCached('/tasks/stats', undefined, { ttl: 15000 }).catch(function () { return { data: {} }; }),
      api.getCached('/feedback/stats', undefined, { ttl: 15000 }).catch(function () { return { data: {} }; }),
      api.get('/objectives' + (scope === 'me' ? '/my' : '')).catch(function () { return { data: [] }; }),
      api.getCached('/cycles', undefined, { ttl: 60000, cacheKey: 'cycles:analytics-list' }).catch(function () { return { data: [] }; }),
    ];

    if (user && (user.role === 'ADMIN' || user.role === 'HR')) {
      requests.push(api.get('/stats/performance').catch(function () { return null; }));
    }

    Promise.all(requests)
      .then(function (responses) {
        if (responses[0]?.data) setDashStats(responses[0].data);
        if (responses[1]?.data?.stats) setTaskStats(responses[1].data.stats);
        if (responses[2]?.data?.stats) setFeedbackStats(responses[2].data.stats);

        var objectivePayload = responses[3] ? responses[3].data : [];
        var objectiveList = Array.isArray(objectivePayload)
          ? objectivePayload
          : (objectivePayload.objectives || objectivePayload.individualObjectives || []);
        setObjectives(objectiveList);

        var cyclesPayload = responses[4] ? responses[4].data : [];
        var cycles = Array.isArray(cyclesPayload) ? cyclesPayload : [];
        var current = cycles.find(function (cycle) {
          return cycle.status === 'in_progress' || cycle.status === 'active';
        });
        setActiveCycle(current || null);

        if (responses[5]?.data) setPerformance(responses[5].data);
      })
      .catch(function () {})
      .finally(function () { setLoading(false); });
  }

  if (loading) {
    return (
      <div className="ds-main__inner">
        <div className="page-loading">
          <div className="spinner"></div>
          <p>Loading analytics...</p>
        </div>
      </div>
    );
  }

  var objectivesList = Array.isArray(objectives) ? objectives : [];
  var approvedCount = objectivesList.filter(function (objective) {
    return ['approved', 'validated'].includes(objective.status);
  }).length;
  var draftCount = objectivesList.filter(function (objective) { return objective.status === 'draft'; }).length;
  var pendingCount = objectivesList.filter(function (objective) {
    return ['pending', 'submitted', 'pending_approval'].includes(objective.status);
  }).length;
  var rejectedCount = objectivesList.filter(function (objective) {
    return objective.status === 'rejected' || objective.status === 'revision_requested';
  }).length;
  var avgProgress = approvedCount > 0
    ? Math.round(
        objectivesList
          .filter(function (objective) { return ['approved', 'validated'].includes(objective.status); })
          .reduce(function (sum, objective) { return sum + (objective.achievementPercent || 0); }, 0) / approvedCount
      )
    : 0;
  var completionRate = objectivesList.length > 0 ? Math.round((approvedCount / objectivesList.length) * 100) : 0;
  var atRiskCount = objectivesList.filter(function (objective) {
    return ['approved', 'validated'].includes(objective.status) && (objective.achievementPercent || 0) < 30;
  }).length;

  var overviewMetrics = [
    { label: 'Objectives', value: dashStats.objectives || 0 },
    { label: 'Teams', value: dashStats.teams || 0 },
    { label: 'Users', value: dashStats.users || 0 },
    { label: 'Cycles', value: dashStats.cycles || 0 },
  ];

  var objectiveMetrics = [
    { label: 'Total objectives', value: objectivesList.length, tone: 'neutral' },
    { label: 'Approved', value: approvedCount, tone: 'success' },
    { label: 'Pending review', value: pendingCount, tone: 'warning' },
    { label: 'Draft', value: draftCount, tone: 'neutral' },
    { label: 'Rejected', value: rejectedCount, tone: 'danger' },
  ];

  var taskMetrics = [
    { label: 'Total tasks', value: taskStats.total || 0, tone: 'neutral' },
    { label: 'Completed', value: taskStats.done || 0, tone: 'success' },
    { label: 'In progress', value: taskStats.inProgress || 0, tone: 'info' },
    { label: 'Overdue', value: taskStats.overdue || 0, tone: 'danger' },
    { label: 'Completion rate', value: (taskStats.completionRate || 0) + '%', tone: 'info' },
  ];

  return (
    <div className="ds-main__inner">
      <div className="ds-page-header">
        <div className="ds-page-header__left">
          <h1 className="ds-page-header__title">Analytics</h1>
          <p className="ds-page-header__subtitle">Performance, task, and feedback insight across the current workspace.</p>
        </div>
      </div>

      {activeCycle ? (
        <div className="ui-hero">
          <div>
            <span className="ui-hero__eyebrow">Active cycle</span>
            <h2 className="ui-hero__title">{activeCycle.name}</h2>
            <p className="ui-hero__subtitle">
              {activeCycle.currentPhase === 'phase1'
                ? 'Objective setting'
                : activeCycle.currentPhase === 'phase2'
                  ? 'Mid-year execution'
                  : activeCycle.currentPhase === 'phase3'
                    ? 'Final evaluation'
                    : 'Closed cycle'}
            </p>
          </div>
          <span className="ui-badge ui-badge--info">{String(activeCycle.currentPhase || 'phase1').replace('phase', 'Phase ')}</span>
        </div>
      ) : null}

      <section className="analytics-section">
        <h2 className="section-title">Overview</h2>
        <div className="stats-row">
          {overviewMetrics.map(function (metric) {
            return (
              <div key={metric.label} className="mini-stat">
                <span className="mini-stat__label">{metric.label}</span>
                <span className="mini-stat__value">{metric.value}</span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="analytics-section">
        <h2 className="section-title">Objective analytics</h2>
        <div className="ui-metric-grid ui-metric-grid--five">
          {objectiveMetrics.map(function (metric) {
            return (
              <div key={metric.label} className="ui-metric-card">
                <span className="ui-metric-card__label">{metric.label}</span>
                <strong className="ui-metric-card__value">{metric.value}</strong>
              </div>
            );
          })}
        </div>

        <div className="ui-progress-grid">
          <div className="ui-progress-card">
            <span className="ui-progress-card__label">Average progress</span>
            <strong className="ui-progress-card__value">{avgProgress}%</strong>
            <div className="ui-progress-bar">
              <div className="ui-progress-bar__fill" style={{ width: avgProgress + '%' }}></div>
            </div>
          </div>

          <div className="ui-progress-card">
            <span className="ui-progress-card__label">Approval rate</span>
            <strong className="ui-progress-card__value">{completionRate}%</strong>
            <div className="ui-progress-bar">
              <div className="ui-progress-bar__fill" style={{ width: completionRate + '%' }}></div>
            </div>
          </div>

          <div className={'ui-progress-card' + (atRiskCount > 0 ? ' ui-progress-card--danger' : '')}>
            <span className="ui-progress-card__label">At risk</span>
            <strong className="ui-progress-card__value">{atRiskCount}</strong>
            <span className="ui-metric-card__meta">Objectives under 30% progress</span>
          </div>
        </div>
      </section>

      <section className="analytics-section">
        <h2 className="section-title">Task analytics</h2>
        <div className="ui-metric-grid ui-metric-grid--five">
          {taskMetrics.map(function (metric) {
            return (
              <div key={metric.label} className="ui-metric-card">
                <span className="ui-metric-card__label">{metric.label}</span>
                <strong className="ui-metric-card__value">{metric.value}</strong>
              </div>
            );
          })}
        </div>
      </section>

      <section className="analytics-section">
        <h2 className="section-title">Feedback analytics</h2>
        <div className="stats-row">
          <div className="mini-stat">
            <span className="mini-stat__label">Received</span>
            <span className="mini-stat__value">{feedbackStats.received || 0}</span>
          </div>
          <div className="mini-stat">
            <span className="mini-stat__label">Sent</span>
            <span className="mini-stat__value">{feedbackStats.sent || 0}</span>
          </div>
        </div>

        {Array.isArray(feedbackStats.byType) && feedbackStats.byType.length > 0 ? (
          <div className="analytics-breakdown">
            <h3 className="subsection-title">By type</h3>
            <div className="breakdown-list">
              {feedbackStats.byType.map(function (entry) {
                return (
                  <div key={entry._id} className="breakdown-item">
                    <span>{entry._id}</span>
                    <strong>{entry.count}</strong>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
      </section>

      {performance ? (
        <section className="analytics-section">
          <h2 className="section-title">Performance overview</h2>
          <div className="stats-row">
            <div className="mini-stat">
              <span className="mini-stat__label">Company average</span>
              <span className="mini-stat__value">{performance.overview?.companyAverage?.toFixed(1) || '0.0'}</span>
            </div>
            <div className="mini-stat">
              <span className="mini-stat__label">Red flags</span>
              <span className="mini-stat__value">{performance.overview?.redFlagsCount || 0}</span>
            </div>
          </div>

          <div className="analytics-grid">
            <div className="analytics-card">
              <h3>Top performers</h3>
              {performance.topPerformers?.length ? (
                <div className="perf-list">
                  {performance.topPerformers.map(function (entry) {
                    return (
                      <div key={entry._id} className="perf-item">
                        <span>{entry.user?.name || 'Unknown'}</span>
                        <strong>{entry.finalScore?.toFixed(1) || '0.0'}</strong>
                      </div>
                    );
                  })}
                </div>
              ) : <p className="ui-metric-card__meta">No data</p>}
            </div>

            <div className="analytics-card">
              <h3>Needs attention</h3>
              {performance.bottomPerformers?.length ? (
                <div className="perf-list">
                  {performance.bottomPerformers.map(function (entry) {
                    return (
                      <div key={entry._id} className="perf-item">
                        <span>{entry.user?.name || 'Unknown'}</span>
                        <strong>{entry.finalScore?.toFixed(1) || '0.0'}</strong>
                      </div>
                    );
                  })}
                </div>
              ) : <p className="ui-metric-card__meta">No data</p>}
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}

export default AnalyticsPage;
