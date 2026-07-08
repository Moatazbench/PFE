import React, { useEffect, useRef, useState } from 'react';
import api from '../services/api';
import { useAuth } from '../components/AuthContext';
import {
  Chart as ChartJS,
  ArcElement,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip as ChartTooltip,
  Legend,
  PointElement,
  LineElement,
} from 'chart.js';
import { Doughnut, Bar } from 'react-chartjs-2';
import EmptyState from '../components/common/EmptyState';

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, ChartTooltip, Legend, PointElement, LineElement);

/* ── small helper stat card ── */
function StatCard({ label, value, icon, color }) {
  return (
    <div style={{
      background: 'var(--shell-bg-card, #fff)',
      border: '1px solid var(--shell-border, #e2e8f0)',
      borderRadius: 16,
      padding: '20px 22px',
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      boxShadow: '0 2px 10px rgba(0,0,0,0.04)',
      minWidth: 0,
    }}>
      <div style={{
        width: 44, height: 44, borderRadius: 12,
        background: color + '20',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '1.3rem', flexShrink: 0,
      }}>
        {icon}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--shell-text-secondary, #64748b)', marginBottom: 3 }}>{label}</div>
        <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--shell-text, #0f172a)', lineHeight: 1 }}>{value}</div>
      </div>
    </div>
  );
}

/* ── chart section wrapper ── */
function ChartCard({ title, children }) {
  return (
    <div style={{
      background: 'var(--shell-bg-card, #fff)',
      border: '1px solid var(--shell-border, #e2e8f0)',
      borderRadius: 16,
      padding: '20px 24px',
      boxShadow: '0 2px 10px rgba(0,0,0,0.04)',
    }}>
      <h3 style={{ margin: '0 0 18px', fontSize: '0.97rem', fontWeight: 700, color: 'var(--shell-text, #0f172a)' }}>{title}</h3>
      {children}
    </div>
  );
}

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
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 20px', gap: 16 }}>
          <div className="dash-loading__spinner" />
          <p style={{ color: 'var(--shell-text-secondary, #64748b)' }}>Loading analytics...</p>
        </div>
      </div>
    );
  }

  var objectivesList = Array.isArray(objectives) ? objectives : [];
  var approvedCount = objectivesList.filter(function (o) { return ['approved', 'validated'].includes(o.status); }).length;
  var draftCount = objectivesList.filter(function (o) { return o.status === 'draft'; }).length;
  var pendingCount = objectivesList.filter(function (o) { return ['pending', 'submitted', 'pending_approval'].includes(o.status); }).length;
  var rejectedCount = objectivesList.filter(function (o) { return o.status === 'rejected' || o.status === 'revision_requested'; }).length;
  var avgProgress = approvedCount > 0
    ? Math.round(objectivesList.filter(function (o) { return ['approved', 'validated'].includes(o.status); }).reduce(function (sum, o) { return sum + (o.achievementPercent || 0); }, 0) / approvedCount)
    : 0;
  var completionRate = objectivesList.length > 0 ? Math.round((approvedCount / objectivesList.length) * 100) : 0;
  var atRiskCount = objectivesList.filter(function (o) { return ['approved', 'validated'].includes(o.status) && (o.achievementPercent || 0) < 30; }).length;

  // ── Chart data ──
  var objDonutData = {
    labels: ['Approved', 'Pending', 'Draft', 'Rejected'],
    datasets: [{
      data: [approvedCount, pendingCount, draftCount, rejectedCount],
      backgroundColor: ['#10b981', '#f59e0b', '#94a3b8', '#ef4444'],
      borderWidth: 0,
      hoverOffset: 6,
    }],
  };

  var taskBarData = {
    labels: ['Total', 'Completed', 'In Progress', 'Overdue'],
    datasets: [{
      label: 'Tasks',
      data: [taskStats.total || 0, taskStats.done || 0, taskStats.inProgress || 0, taskStats.overdue || 0],
      backgroundColor: ['#818cf8', '#10b981', '#3b82f6', '#ef4444'],
      borderRadius: 8,
      borderSkipped: false,
    }],
  };

  var feedbackBarData = feedbackStats.byType && feedbackStats.byType.length > 0
    ? {
        labels: feedbackStats.byType.map(function (e) { return e._id || 'Other'; }),
        datasets: [{
          label: 'Feedback',
          data: feedbackStats.byType.map(function (e) { return e.count; }),
          backgroundColor: ['#818cf8', '#10b981', '#f59e0b', '#3b82f6', '#ef4444'].slice(0, feedbackStats.byType.length),
          borderRadius: 8,
          borderSkipped: false,
        }],
      }
    : null;

  var perfBarData = performance && performance.topPerformers && performance.topPerformers.length > 0
    ? {
        labels: performance.topPerformers.map(function (e) { return e.user?.name || 'Unknown'; }),
        datasets: [{
          label: 'Score',
          data: performance.topPerformers.map(function (e) { return Number((e.finalScore || 0).toFixed(1)); }),
          backgroundColor: '#818cf8',
          borderRadius: 8,
          borderSkipped: false,
        }],
      }
    : null;

  var chartOpts = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { mode: 'index' } },
    scales: { x: { grid: { display: false } }, y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.04)' } } },
  };

  var donutOpts = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '68%',
    plugins: {
      legend: { position: 'bottom', labels: { usePointStyle: true, padding: 16, font: { size: 12 } } },
    },
  };

  return (
    <div className="ds-main__inner">
      <div className="ds-page-header">
        <div className="ds-page-header__left">
          <h1 className="ds-page-header__title">
            <span className="ds-icon-circle ds-icon-circle--primary ds-icon-circle--sm">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '20px', height: '20px' }}>
                <path d="M21.21 15.89A10 10 0 1 1 8 2.83"></path>
                <path d="M22 12A10 10 0 0 0 12 2v10z"></path>
              </svg>
            </span>
            Analytics
          </h1>
          <p className="ds-page-header__subtitle">Performance, task, and feedback insight across the current workspace.</p>
        </div>
      </div>

      {activeCycle ? (
        <div style={{ background: 'linear-gradient(135deg, #4F46E5 0%, #818CF8 100%)', borderRadius: 16, padding: '18px 24px', marginBottom: 24, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, opacity: 0.8, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 4 }}>Active cycle</div>
            <div style={{ fontSize: '1.15rem', fontWeight: 800 }}>{activeCycle.name}</div>
            <div style={{ fontSize: '0.85rem', opacity: 0.85, marginTop: 2 }}>
              {activeCycle.currentPhase === 'phase1' ? 'Objective setting' : activeCycle.currentPhase === 'phase2' ? 'Mid-year execution' : activeCycle.currentPhase === 'phase3' ? 'Final evaluation' : 'Closed cycle'}
            </div>
          </div>
          <span style={{ background: 'rgba(255,255,255,0.2)', padding: '6px 16px', borderRadius: 20, fontWeight: 700, fontSize: '0.85rem' }}>
            {String(activeCycle.currentPhase || 'phase1').replace('phase', 'Phase ')}
          </span>
        </div>
      ) : null}

      {/* ── Overview KPIs ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        <StatCard label="Objectives" value={dashStats.objectives || 0} icon="🎯" color="#4F46E5" />
        <StatCard label="Teams" value={dashStats.teams || 0} icon="👥" color="#10b981" />
        <StatCard label="Users" value={dashStats.users || 0} icon="👤" color="#f59e0b" />
        <StatCard label="Cycles" value={dashStats.cycles || 0} icon="🔄" color="#3b82f6" />
      </div>

      {/* ── Objectives section ── */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--shell-text, #0f172a)', margin: '0 0 16px' }}>Objective Analytics</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
          <ChartCard title="Status Breakdown">
            <div style={{ height: 240, position: 'relative' }}>
              {objectivesList.length > 0
                ? <Doughnut data={objDonutData} options={donutOpts} />
                : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--shell-text-secondary, #64748b)', fontSize: '0.9rem' }}>No data yet</div>
              }
            </div>
          </ChartCard>

          <ChartCard title="Progress & Rates">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {[
                { label: 'Average Progress', value: avgProgress + '%', fill: avgProgress, color: '#4F46E5' },
                { label: 'Approval Rate', value: completionRate + '%', fill: completionRate, color: '#10b981' },
              ].map(function (item) {
                return (
                  <div key={item.label}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: '0.88rem', color: 'var(--shell-text-secondary, #64748b)', fontWeight: 500 }}>{item.label}</span>
                      <span style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--shell-text, #0f172a)' }}>{item.value}</span>
                    </div>
                    <div style={{ height: 8, borderRadius: 8, background: 'var(--shell-border, #e2e8f0)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: item.fill + '%', background: item.color, borderRadius: 8, transition: 'width 0.6s ease' }} />
                    </div>
                  </div>
                );
              })}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: atRiskCount > 0 ? '#fef2f2' : '#f0fdf4', borderRadius: 10, marginTop: 4 }}>
                <span style={{ fontSize: '1.4rem' }}>{atRiskCount > 0 ? '⚠️' : '✅'}</span>
                <div>
                  <div style={{ fontSize: '0.78rem', fontWeight: 700, color: atRiskCount > 0 ? '#991b1b' : '#166534' }}>At-risk objectives</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 800, color: atRiskCount > 0 ? '#dc2626' : '#16a34a' }}>{atRiskCount} <span style={{ fontSize: '0.78rem', fontWeight: 500 }}>under 30% progress</span></div>
                </div>
              </div>
            </div>
          </ChartCard>

          <ChartCard title="Counts Summary">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { label: 'Total', value: objectivesList.length, color: '#64748b' },
                { label: 'Approved', value: approvedCount, color: '#10b981' },
                { label: 'Pending', value: pendingCount, color: '#f59e0b' },
                { label: 'Draft', value: draftCount, color: '#94a3b8' },
                { label: 'Rejected', value: rejectedCount, color: '#ef4444' },
              ].map(function (item) {
                return (
                  <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--shell-border, #f1f5f9)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: item.color, flexShrink: 0 }} />
                      <span style={{ fontSize: '0.88rem', color: 'var(--shell-text-secondary, #64748b)' }}>{item.label}</span>
                    </div>
                    <span style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--shell-text, #0f172a)' }}>{item.value}</span>
                  </div>
                );
              })}
            </div>
          </ChartCard>
        </div>
      </div>

      {/* ── Tasks section ── */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--shell-text, #0f172a)', margin: '0 0 16px' }}>Task Analytics</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
          <ChartCard title="Task Status Distribution">
            <div style={{ height: 220, position: 'relative' }}>
              <Bar data={taskBarData} options={chartOpts} />
            </div>
          </ChartCard>
          <ChartCard title="Task KPIs">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { label: 'Total', value: taskStats.total || 0, color: '#818cf8' },
                { label: 'Completed', value: taskStats.done || 0, color: '#10b981' },
                { label: 'In Progress', value: taskStats.inProgress || 0, color: '#3b82f6' },
                { label: 'Overdue', value: taskStats.overdue || 0, color: '#ef4444' },
                { label: 'Completion', value: (taskStats.completionRate || 0) + '%', color: '#4F46E5' },
              ].map(function (item) {
                return (
                  <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.88rem', color: 'var(--shell-text-secondary, #64748b)' }}>{item.label}</span>
                    <span style={{ fontSize: '0.95rem', fontWeight: 800, color: item.color }}>{item.value}</span>
                  </div>
                );
              })}
            </div>
          </ChartCard>
        </div>
      </div>

      {/* ── Feedback section ── */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--shell-text, #0f172a)', margin: '0 0 16px' }}>Feedback Analytics</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <StatCard label="Received" value={feedbackStats.received || 0} icon="📥" color="#10b981" />
            <StatCard label="Sent" value={feedbackStats.sent || 0} icon="📤" color="#4F46E5" />
          </div>
          {feedbackBarData ? (
            <ChartCard title="Feedback by Type">
              <div style={{ height: 140, position: 'relative' }}>
                <Bar data={feedbackBarData} options={chartOpts} />
              </div>
            </ChartCard>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', background: 'var(--shell-bg-inset, #f8fafc)', borderRadius: 16, border: '1px dashed var(--shell-border, #e2e8f0)' }}>
              <EmptyState title="No feedback type breakdown" />
            </div>
          )}
        </div>
      </div>

      {/* ── Performance overview (Admin/HR) ── */}
      {performance ? (
        <div>
          <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--shell-text, #0f172a)', margin: '0 0 16px' }}>Performance Overview</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <StatCard label="Company Average" value={(performance.overview?.companyAverage?.toFixed(1)) || '0.0'} icon="📊" color="#4F46E5" />
              <StatCard label="Red Flags" value={performance.overview?.redFlagsCount || 0} icon="🚩" color="#ef4444" />
            </div>

            {perfBarData ? (
              <ChartCard title="Top Performers">
                <div style={{ height: 180, position: 'relative' }}>
                  <Bar data={perfBarData} options={{ ...chartOpts, plugins: { ...chartOpts.plugins, legend: { display: false } } }} />
                </div>
              </ChartCard>
            ) : null}

            <ChartCard title="Needs Attention">
              {performance.bottomPerformers && performance.bottomPerformers.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {performance.bottomPerformers.slice(0, 5).map(function (entry) {
                    return (
                      <div key={entry._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: '#fef2f2', borderRadius: 8 }}>
                        <span style={{ fontSize: '0.88rem', color: '#991b1b', fontWeight: 500 }}>{entry.user?.name || 'Unknown'}</span>
                        <span style={{ fontSize: '0.88rem', fontWeight: 800, color: '#dc2626' }}>{(entry.finalScore || 0).toFixed(1)}</span>
                      </div>
                    );
                  })}
                </div>
              ) : <EmptyState title="No data available" />}
            </ChartCard>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default AnalyticsPage;
