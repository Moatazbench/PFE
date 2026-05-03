import React, { useState, useEffect } from 'react';
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

  useEffect(function () { loadData(); }, []);

  function loadData() {
    setLoading(true);
    var scope = 'me';
    if (user && (user.role === 'ADMIN' || user.role === 'HR')) scope = 'org';
    else if (user && user.role === 'TEAM_LEADER') scope = 'team';

    var promises = [
      api.get('/api/stats/dashboard?scope=' + scope).catch(function () { return { data: {} }; }),
      api.get('/api/tasks/stats').catch(function () { return { data: {} }; }),
      api.get('/api/feedback/stats').catch(function () { return { data: {} }; }),
      api.get('/api/objectives' + (scope === 'me' ? '/my' : '')).catch(function () { return { data: [] }; }),
      api.get('/api/cycles').catch(function () { return { data: [] }; }),
    ];
    if (user && (user.role === 'ADMIN' || user.role === 'HR')) {
      promises.push(api.get('/api/stats/performance').catch(function () { return null; }));
    }

    Promise.all(promises)
      .then(function (res) {
        if (res[0] && res[0].data) setDashStats(res[0].data);
        if (res[1] && res[1].data && res[1].data.stats) setTaskStats(res[1].data.stats);
        if (res[2] && res[2].data && res[2].data.stats) setFeedbackStats(res[2].data.stats);
        
        // Objectives
        var objData = res[3] ? res[3].data : [];
        var objArr = Array.isArray(objData) ? objData : (objData.objectives || objData.individualObjectives || []);
        setObjectives(objArr);
        
        // Cycles
        var cyclesData = res[4] ? (Array.isArray(res[4].data) ? res[4].data : []) : [];
        var active = cyclesData.find(function(c) { return c.status === 'in_progress' || c.status === 'active'; });
        if (active) setActiveCycle(active);
        
        if (res[5] && res[5].data) setPerformance(res[5].data);
      })
      .catch(function () {})
      .finally(function () { setLoading(false); });
  }

  if (loading) {
    return <div className="ds-main__inner"><div className="page-loading"><div className="spinner"></div><p>Loading analytics...</p></div></div>;
  }

  var dash = dashStats || {};
  var tasks = taskStats || {};
  var feedback = feedbackStats || {};

  // Computed insights from objectives
  var objArr = Array.isArray(objectives) ? objectives : [];
  var approvedCount = objArr.filter(function(o) { return ['approved', 'validated'].includes(o.status); }).length;
  var draftCount = objArr.filter(function(o) { return o.status === 'draft'; }).length;
  var pendingCount = objArr.filter(function(o) { return ['pending', 'submitted', 'pending_approval'].includes(o.status); }).length;
  var rejectedCount = objArr.filter(function(o) { return o.status === 'rejected' || o.status === 'revision_requested'; }).length;
  var avgProgress = approvedCount > 0 ? Math.round(objArr.filter(function(o) { return ['approved', 'validated'].includes(o.status); }).reduce(function(s, o) { return s + (o.achievementPercent || 0); }, 0) / approvedCount) : 0;
  var completionRate = objArr.length > 0 ? Math.round((approvedCount / objArr.length) * 100) : 0;

  // At risk objectives (approved but < 30% progress)
  var atRiskCount = objArr.filter(function(o) { return ['approved', 'validated'].includes(o.status) && (o.achievementPercent || 0) < 30; }).length;

  return (
    <div className="ds-main__inner">
      <div className="ds-page-header">
        <div className="ds-page-header__left">
          <h1 className="ds-page-header__title">Analytics</h1>
          <p className="ds-page-header__subtitle">Performance insights and real-time data</p>
        </div>
      </div>

      {/* Active Cycle Phase */}
      {activeCycle && (
        <div style={{ background: 'linear-gradient(135deg, #1e293b, #334155)', borderRadius: '14px', padding: '1.25rem 1.75rem', marginBottom: '1.75rem', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px' }}>Active Cycle</div>
            <div style={{ fontSize: '1.15rem', fontWeight: 700 }}>
              {activeCycle.name} — {activeCycle.currentPhase === 'phase1' ? '📝 Goal Setting' : activeCycle.currentPhase === 'phase2' ? '⚖️ Mid-Year Execution' : activeCycle.currentPhase === 'phase3' ? '📊 End-Year' : '🔒 Closed'}
            </div>
          </div>
        </div>
      )}

      {/* Overview Stats */}
      <div className="analytics-section">
        <h2 className="section-title">Overview</h2>
        <div className="stats-row">
          <div className="mini-stat mini-stat--purple"><span className="mini-stat__value">{dash.objectives || 0}</span><span className="mini-stat__label">Objectives</span></div>
          <div className="mini-stat mini-stat--blue"><span className="mini-stat__value">{dash.teams || 0}</span><span className="mini-stat__label">Teams</span></div>
          <div className="mini-stat mini-stat--green"><span className="mini-stat__value">{dash.users || 0}</span><span className="mini-stat__label">Users</span></div>
          <div className="mini-stat mini-stat--orange"><span className="mini-stat__value">{dash.cycles || 0}</span><span className="mini-stat__label">Cycles</span></div>
        </div>
      </div>

      {/* Objective Analytics — NEW */}
      <div className="analytics-section">
        <h2 className="section-title">🎯 Objective Analytics</h2>
        <div className="stats-row">
          <div className="mini-stat"><span className="mini-stat__value">{objArr.length}</span><span className="mini-stat__label">Total Objectives</span></div>
          <div className="mini-stat"><span className="mini-stat__value" style={{ color: '#059669' }}>{approvedCount}</span><span className="mini-stat__label">Approved</span></div>
          <div className="mini-stat"><span className="mini-stat__value" style={{ color: '#d97706' }}>{pendingCount}</span><span className="mini-stat__label">Pending Review</span></div>
          <div className="mini-stat"><span className="mini-stat__value" style={{ color: '#64748b' }}>{draftCount}</span><span className="mini-stat__label">Draft</span></div>
          <div className="mini-stat"><span className="mini-stat__value" style={{ color: '#dc2626' }}>{rejectedCount}</span><span className="mini-stat__label">Rejected</span></div>
        </div>

        {/* Progress Indicators */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem', marginTop: '1.5rem' }}>
          <div style={{ background: 'var(--bg-main, #f8fafc)', padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--border-color, #e2e8f0)' }}>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Average Progress</div>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: avgProgress >= 70 ? '#059669' : avgProgress >= 40 ? '#d97706' : '#64748b' }}>{avgProgress}%</div>
            <div style={{ height: '8px', background: 'rgba(0,0,0,0.08)', borderRadius: '4px', marginTop: '8px' }}>
              <div style={{ height: '100%', width: avgProgress + '%', background: avgProgress >= 70 ? '#059669' : avgProgress >= 40 ? '#d97706' : '#94a3b8', borderRadius: '4px', transition: 'width 0.5s' }}></div>
            </div>
          </div>
          <div style={{ background: 'var(--bg-main, #f8fafc)', padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--border-color, #e2e8f0)' }}>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Approval Rate</div>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: completionRate >= 80 ? '#059669' : '#3b82f6' }}>{completionRate}%</div>
            <div style={{ height: '8px', background: 'rgba(0,0,0,0.08)', borderRadius: '4px', marginTop: '8px' }}>
              <div style={{ height: '100%', width: completionRate + '%', background: completionRate >= 80 ? '#059669' : '#3b82f6', borderRadius: '4px', transition: 'width 0.5s' }}></div>
            </div>
          </div>
          <div style={{ background: atRiskCount > 0 ? '#fef2f2' : 'var(--bg-main, #f8fafc)', padding: '1.25rem', borderRadius: '12px', border: '1px solid ' + (atRiskCount > 0 ? '#fecaca' : 'var(--border-color, #e2e8f0)') }}>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>⚠️ At Risk</div>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: atRiskCount > 0 ? '#dc2626' : '#059669' }}>{atRiskCount}</div>
            <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '4px' }}>Objectives with {'<'}30% progress</div>
          </div>
        </div>
      </div>

      {/* Task Analytics */}
      <div className="analytics-section">
        <h2 className="section-title">✅ Task Analytics</h2>
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
        <h2 className="section-title">💬 Feedback Analytics</h2>
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
          <h2 className="section-title">🏆 Performance Overview</h2>
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
