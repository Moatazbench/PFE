import React, { useState, useEffect, useRef } from 'react';
import api from '../services/api';
import { useAuth } from '../components/AuthContext';
import DashboardHeader from '../components/dashboard/DashboardHeader';
import GoalCard from '../components/dashboard/GoalCard';
import MeetingCard from '../components/dashboard/MeetingCard';
import TaskCard from '../components/dashboard/TaskCard';
import FeedbackCard from '../components/dashboard/FeedbackCard';
import ProgressDonut from '../components/dashboard/ProgressDonut';

function Dashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('me');
  const [objectives, setObjectives] = useState([]);
  const [stats, setStats] = useState({ users: 0, teams: 0, objectives: 0, cycles: 0 });
  const [recentActivity, setRecentActivity] = useState({ objectives: [], decisions: [] });
  const [performance, setPerformance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userTeams, setUserTeams] = useState([]); // Teams the user belongs to
  const [goalsList, setGoalsList] = useState([]); // Goals from new /api/goals system
  const hasFetchedRef = useRef(false);

  // Map tab keys to API scope values
  function getScopeFromTab(tab) {
    if (tab === 'team') return 'team';
    if (tab === 'org') return 'org';
    return 'me';
  }

  async function fetchData(tab) {
    if (!hasFetchedRef.current) setLoading(true);
    try {
      const scope = getScopeFromTab(tab);
      const params = { scope };

      const promises = [
        api.get('/api/stats/dashboard', { params }),
        api.get('/api/stats/recent-activity', { params }),
      ];

      if (tab === 'me') {
        promises.push(api.get('/api/objectives/my'));
      } else if (tab === 'team') {
        promises.push(api.get('/api/objectives', { params: { scope: 'team' } }));
      } else {
        promises.push(api.get('/api/objectives'));
      }

      if (user.role === 'ADMIN' || user.role === 'HR') {
        promises.push(api.get('/api/stats/performance'));
      }

      // Also fetch goals from the new /api/goals system
      promises.push(api.get('/api/goals'));

      const results = await Promise.all(promises);
      setStats(results[0].data);
      setRecentActivity(results[1].data);
      
      const resData = results[2].data;
      const objArr = Array.isArray(resData) ? resData : (resData.objectives || resData.individualObjectives || []);
      setObjectives(objArr);
      
      const performanceIdx = (user.role === 'ADMIN' || user.role === 'HR') ? 3 : null;
      const goalsIdx = performanceIdx !== null ? 4 : 3;
      
      if (performanceIdx !== null && results[performanceIdx]) setPerformance(results[performanceIdx].data);
      
      // Extract goals from new system
      if (results[goalsIdx]) {
        const goalsData = results[goalsIdx].data;
        setGoalsList(goalsData.goals || []);
      }
      
      hasFetchedRef.current = true;
      
      if (tab === 'team') {
        try {
          const teamsRes = await api.get('/api/teams');
          const allTeams = Array.isArray(teamsRes.data) ? teamsRes.data : (teamsRes.data.teams || []);
          const myTeams = allTeams.filter(t => {
            const isLeader = t.leader && (t.leader._id === user.id || t.leader === user.id);
            const isMember = (t.members || []).some(m => (m._id || m) === user.id);
            return isLeader || isMember;
          });
          setUserTeams(myTeams);
        } catch (e) { setUserTeams([]); }
      } else { setUserTeams([]); }
    } catch (err) {
      console.error('Fetch dashboard data error:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(function () {
    hasFetchedRef.current = false;
    fetchData(activeTab);
  }, [activeTab]);

  function handleTabChange(newTab) {
    setActiveTab(newTab);
  }



  function getTimelineItems() {
    var items = [];
    var objArr = Array.isArray(objectives) ? objectives : [];
    objArr.forEach(function (o) {
      items.push({ type: 'goal', title: o.title, date: o.updatedAt || o.createdAt, progress: o.achievementPercent || 0 });
    });
    if (recentActivity.decisions) {
      recentActivity.decisions.forEach(function (d) {
        items.push({ type: 'decision', title: d.subject || d.type, date: d.createdAt, status: d.decision });
      });
    }
    items.sort(function (a, b) { return new Date(b.date) - new Date(a.date); });
    return items.slice(0, 8);
  }

  // Tab-aware labels
  function getStatsLabels() {
    if (activeTab === 'me') return { goals: 'My Goals', teams: 'My Team', users: 'Profile', cycles: 'Active Cycles' };
    if (activeTab === 'team') return { goals: 'Team Goals', teams: 'Teams', users: 'Team Members', cycles: 'Active Cycles' };
    return { goals: 'All Goals', teams: 'All Teams', users: 'All Users', cycles: 'All Cycles' };
  }

  function getNeedsAttentionGoals() {
    var objArr = Array.isArray(objectives) ? objectives : [];
    var fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    return objArr.filter(function (o) {
      if (!['approved', 'validated'].includes(o.status)) return false;
      if (o.achievementPercent >= 100) return false;
      var lastUpdated = new Date(o.updatedAt || o.createdAt);
      return lastUpdated < fourteenDaysAgo;
    });
  }


  var labels = getStatsLabels();

  var staleGoals = getNeedsAttentionGoals();

  if (loading) {
    return (
      <div className="dash-loading">
        <div className="dash-loading__spinner"></div>
        <p>Loading your dashboard...</p>
      </div>
    );
  }

  return (
    <div className="dash">
      <DashboardHeader activeTab={activeTab} onTabChange={handleTabChange} />

      {/* Scope context banner — changes per tab */}
      {activeTab === 'team' && (
        <div style={{ background: 'linear-gradient(135deg,#ede9fe,#dbeafe)', border: '1px solid #c4b5fd', borderRadius: '14px', padding: '1.25rem 1.75rem', marginBottom: '1.75rem', display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <div><span style={{ fontSize: '2rem' }}>👥</span></div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#4c1d95' }}>
              My Team{userTeams.length > 1 ? 's' : ''}
              {userTeams.length > 0 && <span style={{ marginLeft: '8px', background: '#7c3aed', color: '#fff', borderRadius: '99px', padding: '2px 10px', fontSize: '0.8rem' }}>{userTeams.length} team{userTeams.length > 1 ? 's' : ''}</span>}
            </div>
            {userTeams.length > 0 ? (
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '8px' }}>
                {userTeams.map(function(t) { return (
                  <span key={t._id} style={{ background: '#fff', border: '1px solid #c4b5fd', borderRadius: '8px', padding: '4px 12px', fontSize: '0.85rem', color: '#5b21b6' }}>
                    <strong>{t.name}</strong> &mdash; {(t.members || []).length} member{(t.members || []).length !== 1 ? 's' : ''}
                    {t.leader && <span style={{ color: '#7c3aed', marginLeft: '6px' }}>(Leader: {t.leader.name})</span>}
                  </span>
                ); })}
              </div>
            ) : (
              <p style={{ margin: '4px 0 0', color: '#6d28d9', fontSize: '0.9rem' }}>Showing team-scoped data. You are not yet assigned to a team.</p>
            )}
          </div>
        </div>
      )}
      {activeTab === 'org' && (
        <div style={{ background: 'linear-gradient(135deg,#ecfdf5,#d1fae5)', border: '1px solid #6ee7b7', borderRadius: '14px', padding: '1.25rem 1.75rem', marginBottom: '1.75rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <span style={{ fontSize: '2rem' }}>🏢</span>
          <div>
            <div style={{ fontWeight: 800, color: '#065f46' }}>My Organisation — Company-Wide View</div>
            <p style={{ margin: '4px 0 0', color: '#047857', fontSize: '0.9rem' }}>Showing all organisation goals and metrics. Data is not filtered by team or individual.</p>
          </div>
        </div>
      )}

      {/* Quick Stats Row */}
      <div className="dash-stats-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        <div className="dash-stat dash-card shadow-sm" style={{ borderLeft: '4px solid var(--primary)' }}>
          <div className="dash-stat__icon" style={{ background: 'var(--primary-light)', color: 'var(--primary)', fontSize: '1.5rem', width: '48px', height: '48px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🎯</div>
          <div className="dash-stat__info">
            <span className="dash-stat__value" style={{ fontSize: '1.8rem', fontWeight: '800', display: 'block' }}>{stats.objectives}</span>
            <span className="dash-stat__label" style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{labels.goals}</span>
          </div>
        </div>
        <div className="dash-stat dash-card shadow-sm" style={{ borderLeft: '4px solid #3B82F6' }}>
          <div className="dash-stat__icon" style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3B82F6', fontSize: '1.5rem', width: '48px', height: '48px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>👥</div>
          <div className="dash-stat__info">
            <span className="dash-stat__value" style={{ fontSize: '1.8rem', fontWeight: '800', display: 'block' }}>{stats.teams}</span>
            <span className="dash-stat__label" style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{labels.teams}</span>
          </div>
        </div>
        <div className="dash-stat dash-card shadow-sm" style={{ borderLeft: '4px solid #10B981' }}>
          <div className="dash-stat__icon" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10B981', fontSize: '1.5rem', width: '48px', height: '48px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>👤</div>
          <div className="dash-stat__info">
            <span className="dash-stat__value" style={{ fontSize: '1.8rem', fontWeight: '800', display: 'block' }}>{stats.users}</span>
            <span className="dash-stat__label" style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{labels.users}</span>
          </div>
        </div>
        <div className="dash-stat dash-card shadow-sm" style={{ borderLeft: '4px solid #F59E0B' }}>
          <div className="dash-stat__icon" style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#F59E0B', fontSize: '1.5rem', width: '48px', height: '48px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>📅</div>
          <div className="dash-stat__info">
            <span className="dash-stat__value" style={{ fontSize: '1.8rem', fontWeight: '800', display: 'block' }}>{stats.cycles}</span>
            <span className="dash-stat__label" style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{labels.cycles}</span>
          </div>
        </div>
      </div>

      {/* Progress Circles Row */}
      <div className="dash-progress-row" style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1.5rem', marginBottom: '2.5rem' }}>
        <div className="dash-card shadow-sm" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
          <h3 style={{ marginBottom: '1.5rem', textAlign: 'center' }}>Overall Progress</h3>
          {(() => {
            var objArr = Array.isArray(objectives) ? objectives : [];
            var approvedArr = objArr.filter(function(o) { return ['approved', 'validated'].includes(o.status); });
            var liveAvg = approvedArr.length > 0
              ? Math.round(approvedArr.reduce(function(s, o) { return s + (o.achievementPercent || 0); }, 0) / approvedArr.length)
              : 0;
            return (
              <>
                <ProgressDonut percentage={liveAvg} size={150} strokeWidth={15} />
                <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
                  <span style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--primary)' }}>{liveAvg}%</span>
                  <p className="text-muted">Average goal progress {activeTab === 'me' ? '(personal)' : activeTab === 'team' ? '(team)' : '(organisation)'}</p>
                </div>
              </>
            );
          })()}
        </div>
        <div className="dash-card shadow-sm" style={{ padding: '1.5rem' }}>
          <h3 style={{ marginBottom: '1rem' }}>Key Performance Indicators</h3>
          {(() => {
            // Gather all KPIs across active objectives
            var objArr = Array.isArray(objectives) ? objectives : [];
            var allKpis = [];
            objArr.forEach(function(o) {
              if (!['approved', 'validated'].includes(o.status)) return;
              if (!o.kpis || o.kpis.length === 0) return;
              o.kpis.forEach(function(kpi) {
                allKpis.push({ goalTitle: o.title, name: kpi.name, current: kpi.currentValue || 0, target: kpi.targetValue || 100, unit: kpi.unit || '', type: kpi.type });
              });
            });
            if (allKpis.length === 0) {
              return (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '120px', color: 'var(--text-muted)' }}>
                  <div style={{ fontSize: '2rem', marginBottom: '8px' }}>📊</div>
                  <p style={{ margin: 0, textAlign: 'center' }}>No KPIs tracked yet.<br /><a href="/goals" style={{ color: 'var(--primary)' }}>Add KPIs to your goals →</a></p>
                </div>
              );
            }
            return (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1rem' }}>
                {allKpis.slice(0, 4).map(function(kpi, i) {
                  var pct = kpi.target > 0 ? Math.min(Math.round((kpi.current / kpi.target) * 100), 100) : 0;
                  var colors = ['var(--primary)', '#3B82F6', '#10B981', '#F59E0B'];
                  var color = colors[i % colors.length];
                  return (
                    <div key={i} style={{ padding: '1rem', background: 'var(--bg-main)', borderRadius: '12px' }}>
                      <div style={{ color: color, fontWeight: '700', fontSize: '0.85rem', marginBottom: '2px' }}>{kpi.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '8px' }}>📎 {kpi.goalTitle}</div>
                      <div style={{ fontSize: '1.3rem', fontWeight: '800', margin: '4px 0' }}>{kpi.current}{kpi.unit} <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 400 }}>/ {kpi.target}{kpi.unit}</span></div>
                      <div className="progress-bar-bg" style={{ height: '8px', background: 'rgba(0,0,0,0.1)', borderRadius: '4px' }}>
                        <div className="progress-bar-fill" style={{ width: pct + '%', height: '100%', background: color, borderRadius: '4px', transition: 'width 0.5s ease' }}></div>
                      </div>
                      <div style={{ textAlign: 'right', fontSize: '0.75rem', color: color, marginTop: '4px', fontWeight: '600' }}>{pct}%</div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      </div>

      {/* AI Risk Alerts removed — AI feature removed */}

      {/* Action Center - Needs Attention */}
      {staleGoals.length > 0 && (
        <div className="dash-risk-alerts" style={{ background: '#FFFBEB', borderColor: '#FDE68A' }}>
          <h3 className="dash-risk-alerts__title" style={{ color: '#92400E' }}>⚠️ Action Center: Needs Attention ({staleGoals.length})</h3>
          <p style={{ fontSize: '0.85rem', color: '#B45309', margin: '0 0 12px 0' }}>These goals haven't had a check-in for over 14 days.</p>
          <div className="dash-risk-alerts__list">
            {staleGoals.slice(0, 5).map(function (g, i) {
              return (
                <div key={i} className="dash-risk-item" style={{ background: '#FEF3C7', color: '#92400E', borderLeft: '4px solid #F59E0B', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>🎯 {g.title} <span style={{fontSize: '0.8rem', opacity: 0.8}}>(Last updated: {new Date(g.updatedAt||g.createdAt).toLocaleDateString()})</span></span>
                  <button className="submit-btn" style={{ padding: '4px 10px', fontSize: '0.75rem', background: '#D97706' }} onClick={function() { window.location.href='/goals'; }}>
                    {activeTab === 'me' ? 'Check-in Now' : 'View Goal'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}



      {/* Main Cards Grid */}
      <div className="dash-grid">
        <div className="dash-grid__col dash-grid__col--left">
          <MeetingCard />
        </div>
        <div className="dash-grid__col dash-grid__col--right">
          <GoalCard objectives={objectives} goalsList={goalsList} loading={false} />
          <TaskCard />
        </div>
      </div>

      {/* Performance Timeline */}
      <div className="dash-timeline">
        <h3 className="dash-timeline__title">📈 Performance Timeline</h3>
        {getTimelineItems().length === 0 ? (
          <p className="dash-timeline__empty">No recent activity to display.</p>
        ) : (
          <div className="dash-timeline__list">
            {getTimelineItems().map(function (item, i) {
              var dotColor = item.type === 'goal' ? '#4F46E5' : '#10B981';
              var statusLabel = item.status ? (' — ' + (item.status || '').replace(/_/g, ' ')) : '';
              return (
                <div key={i} className="dash-timeline__item">
                  <div className="dash-timeline__dot" style={{ background: dotColor }}></div>
                  <div className="dash-timeline__content">
                    <div className="dash-timeline__item-title">
                      {item.type === 'goal' ? '🎯' : '⚖️'} {item.title}
                      <span className="dash-timeline__item-status">{statusLabel}</span>
                    </div>
                    <div className="dash-timeline__item-date">
                      {item.date ? new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                      {item.progress > 0 && <span className="dash-timeline__item-progress">{item.progress}%</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Bottom Row */}
      <div className="dash-bottom-row">
        <FeedbackCard />
      </div>

      {/* Performance section for ADMIN/HR */}
      {performance && (user.role === 'ADMIN' || user.role === 'HR') && (
        <div className="dash-performance">
          <h2 className="dash-performance__title">📊 Executive Performance Overview</h2>
          <div className="dash-performance__grid">
            <div className="dash-performance__stat">
              <span className="dash-performance__stat-label">Company Average</span>
              <span className="dash-performance__stat-value">
                {performance.overview?.companyAverage?.toFixed(1) || '0.0'}<small>/100</small>
              </span>
            </div>
            <div className="dash-performance__stat dash-performance__stat--danger">
              <span className="dash-performance__stat-label">Red Flags (&lt;60%)</span>
              <span className="dash-performance__stat-value">
                {performance.overview?.redFlagsCount || 0}<small> employees</small>
              </span>
            </div>
          </div>
          <div className="dash-performance__lists">
            <div className="dash-performance__list">
              <h4>🏆 Top 5 Performers</h4>
              {performance.topPerformers?.length === 0 ? (
                <p className="dash-card__empty">No data available.</p>
              ) : (
                <ul>
                  {performance.topPerformers?.map(function (p) { return (
                    <li key={p._id}>
                      <span>{p.user?.name || 'Unknown'} <small>({p.user?.role || 'N/A'})</small></span>
                      <span className="dash-performance__score dash-performance__score--good">{p.finalScore.toFixed(1)}</span>
                    </li>
                  ); })}
                </ul>
              )}
            </div>
            <div className="dash-performance__list">
              <h4>⚠️ Bottom 5 Performers</h4>
              {performance.bottomPerformers?.length === 0 ? (
                <p className="dash-card__empty">No data available.</p>
              ) : (
                <ul>
                  {performance.bottomPerformers?.map(function (p) { return (
                    <li key={p._id}>
                      <span>{p.user?.name || 'Unknown'} <small>({p.user?.role || 'N/A'})</small></span>
                      <span className={'dash-performance__score' + (p.finalScore < 60 ? ' dash-performance__score--bad' : ' dash-performance__score--warn')}>{p.finalScore.toFixed(1)}</span>
                    </li>
                  ); })}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;