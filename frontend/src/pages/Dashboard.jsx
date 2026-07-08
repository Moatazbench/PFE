import React, { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import api from '../services/api';
import { useAuth } from '../components/AuthContext';
import DashboardHeader from '../components/dashboard/DashboardHeader';
import GoalCard from '../components/dashboard/GoalCard';
import MeetingCard from '../components/dashboard/MeetingCard';
import TaskCard from '../components/dashboard/TaskCard';
import FeedbackCard from '../components/dashboard/FeedbackCard';
import LoadingSkeleton from '../components/common/LoadingSkeleton';
import EmptyState from '../components/common/EmptyState';
import {
  buildRecentTimeline,
  collectKpis,
  dedupeById,
  filterObjectivesForCycle,
  findActiveCycle,
  getCheckInSummary,
  getObjectiveSummary,
  getScopeLabel,
  getTaskSummary,
  getUserId,
  normalizeCheckInsPayload,
  normalizeCyclesPayload,
  normalizeFeedbackPayload,
  normalizeMeetingsPayload,
  normalizeObjectivesPayload,
  normalizeTasksPayload,
  normalizeTeamsPayload,
  resolveScopeTeams,
  statusTone,
} from '../components/dashboard/dashboardUtils';

const DashboardAnalytics = lazy(() => import('../components/dashboard/DashboardAnalytics'));
const MotionDiv = motion.div;

var INITIAL_DATA = {
  stats: { users: 0, teams: 0, objectives: 0, cycles: 0 },
  objectives: [],
  meetings: [],
  tasks: [],
  feedbacks: [],
  checkIns: [],
  teams: [],
  scopeTeams: [],
  cycles: [],
  activeCycle: null,
};

function getScopeFromTab(tab) {
  if (tab === 'team') return 'team';
  if (tab === 'org') return 'org';
  return 'me';
}

function Sparkline({ points, color }) {
  var safePoints = Array.isArray(points) && points.length > 0 ? points : [0, 0, 0, 0];
  var maxValue = Math.max.apply(null, safePoints.concat([1]));
  var width = 112;
  var height = 34;
  var step = safePoints.length > 1 ? width / (safePoints.length - 1) : width;
  var path = safePoints.map(function (point, index) {
    var x = index * step;
    var y = height - (point / maxValue) * (height - 4) - 2;
    return (index === 0 ? 'M' : 'L') + x + ' ' + y;
  }).join(' ');

  return (
    <svg className="dash-sparkline" viewBox={'0 0 ' + width + ' ' + height} aria-hidden="true">
      <path d={path} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

function MetricCard({ eyebrow, value, label, hint, points, accent }) {
  return (
    <MotionDiv
      className="dash-metric-card dash-card"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: 'easeOut' }}
    >
      <span className="dash-metric-card__eyebrow">{eyebrow}</span>
      <div className="dash-metric-card__value">{value}</div>
      <div className="dash-metric-card__label">{label}</div>
      <Sparkline points={points} color={accent} />
      <div className="dash-metric-card__hint">{hint}</div>
    </MotionDiv>
  );
}

function EmptyPanel({ title, text, actionLabel, actionHref }) {
  return (
    <EmptyState
      title={title}
      description={text}
      action={actionLabel && actionHref ? (
        <Link to={actionHref} className="btn btn--primary" style={{ display: 'inline-block' }}>
          {actionLabel}
        </Link>
      ) : null}
    />
  );
}

function Dashboard() {
  var auth = useAuth();
  var user = auth.user;
  var [activeTab, setActiveTab] = useState(function () {
    if (user?.role === 'ADMIN' || user?.role === 'HR') return 'org';
    if (user?.role === 'TEAM_LEADER') return 'team';
    return 'me';
  });
  var [dashboardData, setDashboardData] = useState(INITIAL_DATA);
  var [loading, setLoading] = useState(true);
  var [pageError, setPageError] = useState('');
  var [sectionErrors, setSectionErrors] = useState({});
  var [refreshTick, setRefreshTick] = useState(0);
  var [showDeferredAnalytics, setShowDeferredAnalytics] = useState(false);

  var userId = getUserId(user);
  var isAdminOrHr = user?.role === 'ADMIN' || user?.role === 'HR';
  var insights = dashboardData.stats?.insights || {};

  useEffect(function () {
    if (!userId) return;

    var cancelled = false;

    async function loadDashboard() {
      setLoading(true);
      setPageError('');

      try {
        var scope = getScopeFromTab(activeTab);
        var cacheKeyScope = ':tick:' + refreshTick;
        var shouldLoadTeams = activeTab !== 'me';

        var requests = await Promise.all([
          api.getCached('/stats/dashboard', { params: { scope: scope } }, { ttl: 20000, cacheKey: 'stats:dashboard:' + scope + cacheKeyScope }).catch(function () {
            return { data: { users: 0, teams: 0, objectives: 0, cycles: 0 } };
          }),
          activeTab === 'me'
            ? api.getCached('/objectives/my', { params: { compact: 'true' } }, { ttl: 20000, cacheKey: 'objectives:dashboard:me' + cacheKeyScope }).catch(function () { return { data: { objectives: [] } }; })
            : api.getCached('/objectives', {
                params: Object.assign(
                  { compact: 'true' },
                  activeTab === 'team' ? { scope: 'team' } : {}
                ),
              }, { ttl: 20000, cacheKey: 'objectives:dashboard:' + activeTab + cacheKeyScope }).catch(function () {
                return { data: { objectives: [] } };
              }),
          api.getCached('/cycles', undefined, { ttl: 60000, cacheKey: 'cycles:dashboard-list' + cacheKeyScope }).catch(function () { return { data: [] }; }),
          shouldLoadTeams
            ? api.getCached('/teams', undefined, { ttl: 30000, cacheKey: 'teams:dashboard-list' + cacheKeyScope }).catch(function () { return { data: { teams: [] } }; })
            : Promise.resolve({ data: { teams: [] } }),
          api.getCached('/meetings', { params: { upcoming: 'true' } }, { ttl: 30000, cacheKey: 'meetings:dashboard:upcoming' + cacheKeyScope }).catch(function () { return { data: { meetings: [] } }; }),
          api.getCached('/feedback/received', undefined, { ttl: 30000, cacheKey: 'feedback:dashboard:received' + cacheKeyScope }).catch(function () { return { data: { feedbacks: [] } }; }),
          activeTab === 'org' && isAdminOrHr
            ? api.getCached('/tasks/all', { params: { limit: 200 } }, { ttl: 15000, cacheKey: 'tasks:dashboard:org' + cacheKeyScope }).catch(function () { return { data: { tasks: [] } }; })
            : activeTab === 'me'
              ? api.getCached('/tasks/my', { params: { limit: 100 } }, { ttl: 15000, cacheKey: 'tasks:dashboard:me' + cacheKeyScope }).catch(function () { return { data: { tasks: [] } }; })
              : Promise.resolve({ data: { tasks: [] } }),
        ]);

        if (cancelled) return;

        var stats = requests[0]?.data || INITIAL_DATA.stats;
        var rawObjectives = normalizeObjectivesPayload(requests[1]?.data);
        var cycles = normalizeCyclesPayload(requests[2]?.data);
        var teams = normalizeTeamsPayload(requests[3]?.data);
        var meetings = dedupeById(normalizeMeetingsPayload(requests[4]?.data));
        var feedbacks = dedupeById(normalizeFeedbackPayload(requests[5]?.data));
        var tasks = dedupeById(normalizeTasksPayload(requests[6]?.data));
        var nextSectionErrors = {};

        var activeCycle = findActiveCycle(cycles);
        var scopeTeams = resolveScopeTeams(teams, user, activeTab);
        var objectives = filterObjectivesForCycle(dedupeById(rawObjectives), activeCycle);

        if (activeTab === 'team') {
          var scopedTeamIds = scopeTeams
            .map(function (team) { return team?._id; })
            .filter(Boolean)
            .map(String);

          if (scopedTeamIds.length > 0) {
            var sortedTeamIds = scopedTeamIds.slice().sort();
            var teamTaskResponse = await api.getCached('/tasks/teams', {
              params: { teamIds: sortedTeamIds.join(',') },
            }, {
              ttl: 15000,
              cacheKey: 'tasks:dashboard:team-batch:' + sortedTeamIds.join(',') + cacheKeyScope,
            }).catch(function () {
              nextSectionErrors.tasks = 'Some team task records could not be loaded.';
              return { data: { tasks: [] } };
            });

            if (!cancelled) {
              tasks = dedupeById(normalizeTasksPayload(teamTaskResponse?.data));
            }
          }
        }

        var checkIns = [];
        if (activeCycle?._id && ['phase2', 'phase3'].includes(activeCycle?.currentPhase)) {
          try {
            if (activeTab === 'me') {
              var checkInResponse = await api.getCached('/checkins', { params: { cycle_id: activeCycle._id } }, { ttl: 15000, cacheKey: 'checkins:dashboard:me:' + activeCycle._id + cacheKeyScope });
              checkIns = dedupeById(normalizeCheckInsPayload(checkInResponse?.data));
            } else if (activeTab === 'team' && user?.role === 'TEAM_LEADER') {
              var leaderCheckInResponse = await api.getCached('/checkins/team', { params: { cycle_id: activeCycle._id } }, { ttl: 15000, cacheKey: 'checkins:dashboard:team:' + activeCycle._id + cacheKeyScope });
              checkIns = dedupeById(normalizeCheckInsPayload(leaderCheckInResponse?.data));
            } else if (activeTab !== 'me') {
              nextSectionErrors.checkIns = 'Check-ins are currently surfaced in personal and managed team views.';
            }
          } catch {
            nextSectionErrors.checkIns = 'Check-ins are unavailable in this view for the active cycle.';
          }
        }

        if (cancelled) return;

        setDashboardData({
          stats: stats,
          objectives: objectives,
          meetings: meetings,
          tasks: tasks,
          feedbacks: feedbacks,
          checkIns: checkIns,
          teams: teams,
          scopeTeams: scopeTeams,
          cycles: cycles,
          activeCycle: activeCycle,
        });
        setSectionErrors(nextSectionErrors);
      } catch (error) {
        console.error('Dashboard load failed', error);
        if (!cancelled) {
          setPageError('The dashboard could not be loaded right now. Please retry.');
          setDashboardData(INITIAL_DATA);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadDashboard();

    return function () {
      cancelled = true;
    };
  }, [activeTab, isAdminOrHr, refreshTick, user, userId]);

  useEffect(function () {
    if (loading) return;

    var cleanup;

    function revealAnalytics() {
      setShowDeferredAnalytics(true);
    }

    if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
      var idleId = window.requestIdleCallback(revealAnalytics, { timeout: 900 });
      cleanup = function () {
        window.cancelIdleCallback(idleId);
      };
    } else {
      var timeoutId = window.setTimeout(revealAnalytics, 180);
      cleanup = function () {
        window.clearTimeout(timeoutId);
      };
    }

    return cleanup;
  }, [loading]);

  var objectiveSummary = useMemo(function () {
    return getObjectiveSummary(dashboardData.objectives);
  }, [dashboardData.objectives]);

  var taskSummary = useMemo(function () {
    return getTaskSummary(dashboardData.tasks);
  }, [dashboardData.tasks]);

  var checkInSummary = useMemo(function () {
    return getCheckInSummary(dashboardData.checkIns);
  }, [dashboardData.checkIns]);

  var kpis = useMemo(function () {
    return collectKpis(dashboardData.objectives);
  }, [dashboardData.objectives]);

  var weeklySparkline = useMemo(function () {
    var progressSeed = dashboardData.objectives.slice(0, 6).map(function (objective) {
      return Number(objective?.achievementPercent || 0);
    });
    return progressSeed.length > 0 ? progressSeed : [0, 12, 24, 38, 54, 68];
  }, [dashboardData.objectives]);

  var taskSparkline = useMemo(function () {
    return [
      taskSummary.todo,
      taskSummary.inProgress,
      taskSummary.done,
      taskSummary.done,
      taskSummary.inProgress,
      taskSummary.done,
    ];
  }, [taskSummary.done, taskSummary.inProgress, taskSummary.todo]);

  var checkInSparkline = useMemo(function () {
    return dashboardData.checkIns.slice(0, 6).map(function (checkIn) {
      return Number(checkIn?.progress_percent || 0);
    });
  }, [dashboardData.checkIns]);

  var kpiSparkline = useMemo(function () {
    return kpis.slice(0, 6).map(function (kpi) {
      return Number(kpi.progress || 0);
    });
  }, [kpis]);
  var timelineItems = useMemo(function () {
    return buildRecentTimeline(
      (dashboardData.stats?.insights?.recentActivity || [])
        .concat(dashboardData.objectives.map(function (objective) {
          return {
            id: 'objective-' + objective._id,
            type: 'Objective',
            title: objective.title,
            date: objective.updatedAt || objective.createdAt,
            meta: statusTone(objective?.status, objective?.achievementPercent).label,
          };
        }))
        .concat(dashboardData.tasks.map(function (task) {
          return {
            id: 'task-' + task._id,
            type: 'Task',
            title: task.title,
            date: task.updatedAt || task.createdAt,
            meta: task.status || 'todo',
          };
        }))
        .concat(dashboardData.checkIns.map(function (checkIn) {
          return {
            id: 'checkin-' + checkIn._id,
            type: 'Check-in',
            title: checkIn?.objective_id?.title || 'Objective check-in',
            date: checkIn.submitted_at || checkIn.updatedAt || checkIn.createdAt,
            meta: (checkIn.status || 'pending_review').replace(/_/g, ' '),
          };
        }))
        .concat(dashboardData.meetings.map(function (meeting) {
          return {
            id: 'meeting-' + meeting._id,
            type: 'Meeting',
            title: meeting.title,
            date: meeting.date,
            meta: meeting.type || 'meeting',
          };
        }))
        .concat(dashboardData.feedbacks.map(function (feedback) {
          return {
            id: 'feedback-' + feedback._id,
            type: 'Feedback',
            title: feedback.message,
            date: feedback.createdAt,
            meta: feedback.type || 'feedback',
          };
        }))
    );
  }, [dashboardData.checkIns, dashboardData.feedbacks, dashboardData.meetings, dashboardData.objectives, dashboardData.stats, dashboardData.tasks]);

  var needsAttentionObjectives = useMemo(function () {
    var threshold = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    return dashboardData.objectives.filter(function (objective) {
      if (Number(objective?.achievementPercent || 0) >= 100) return false;
      if (!['approved', 'validated', 'assigned', 'acknowledged'].includes(objective?.status)) return false;
      var lastTouched = new Date(objective?.updatedAt || objective?.createdAt || Date.now());
      return lastTouched < threshold;
    }).slice(0, 4);
  }, [dashboardData.objectives]);

  if (loading) {
    return (
      <div className="ds-main__inner">
        <DashboardHeader
          activeTab={activeTab}
          onTabChange={setActiveTab}
          activeCycle={null}
          summary={{ total: 0 }}
          onRefresh={function () {}}
          loading={true}
        />
        <div className="dash-loading-state" style={{ marginTop: 28 }}>
          <LoadingSkeleton rows={1} height={118} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24, marginTop: 28 }}>
            <LoadingSkeleton rows={2} height={150} />
            <LoadingSkeleton rows={2} height={150} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24, marginTop: 28 }}>
            <LoadingSkeleton rows={3} height={200} />
            <LoadingSkeleton rows={3} height={200} />
          </div>
        </div>
      </div>
    );
  }

  if (pageError) {
    return (
      <div className="ds-main__inner">
        <div className="dash-page-error dash-card">
          <strong>Dashboard unavailable</strong>
          <p>{pageError}</p>
          <button type="button" className="dash-hero__refresh" onClick={function () { setRefreshTick(refreshTick + 1); }}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="ds-main__inner">
      <DashboardHeader
        activeTab={activeTab}
        onTabChange={setActiveTab}
        activeCycle={dashboardData.activeCycle}
        summary={objectiveSummary}
        onRefresh={function () { setRefreshTick(refreshTick + 1); }}
        loading={loading}
      />

      <div className="dash-metrics-grid">
        <MetricCard
          eyebrow={getScopeLabel(activeTab)}
          value={insights.activeObjectives ?? objectiveSummary.total}
          label="Active objectives"
          hint={(insights.averageObjectiveProgress ?? objectiveSummary.averageProgress) + '% average progress'}
          points={weeklySparkline}
          accent="#6366f1"
        />
        <MetricCard
          eyebrow="Execution"
          value={insights.completedTasks ?? taskSummary.done}
          label="Completed tasks"
          hint={(insights.pendingTasks ?? (taskSummary.todo + taskSummary.inProgress)) + ' pending, ' + (insights.overdueTasks ?? taskSummary.overdue) + ' overdue'}
          points={taskSparkline}
          accent="#0ea5e9"
        />
        <MetricCard
          eyebrow="Check-ins"
          value={(insights.checkInCompletionRate ?? 0) + '%'}
          label="Check-in completion"
          hint={checkInSummary.total + ' updates visible in this view'}
          points={checkInSparkline}
          accent="#14b8a6"
        />
        <MetricCard
          eyebrow="Performance"
          value={insights.averagePerformanceScore == null ? '—' : insights.averagePerformanceScore + '%'}
          label="Average final score"
          hint={(insights.atRiskEmployees || 0) + ' employees currently at risk'}
          points={taskSparkline}
          accent="#ec4899"
        />
        <MetricCard
          eyebrow={isAdminOrHr ? 'HR queue' : 'Evaluation'}
          value={isAdminOrHr ? (insights.pendingHrValidation || 0) : (insights.finalEvaluationsGenerated || 0)}
          label={isAdminOrHr ? 'Pending HR review' : 'Final evaluations'}
          hint={isAdminOrHr
            ? (insights.pendingCompensation || 0) + ' compensation recommendations pending'
            : (insights.pendingManagerReviews || 0) + ' manager reviews pending'}
          points={kpiSparkline}
          accent="#f59e0b"
        />
      </div>

      {user?.role === 'HR' && (
        <MotionDiv
          className="dash-card"
          style={{ marginBottom: '1.25rem', padding: '1.25rem', borderTop: '4px solid #6366f1' }}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.26, ease: 'easeOut' }}
        >
          <div className="dash-card__header">
            <div>
              <h3>HR Process Review &amp; Development Follow-up</h3>
              <p className="dash-card__subtitle">Governance workload and employee follow-up requiring attention</p>
            </div>
            <Link to="/hr-validation" className="dash-card__link">Open HR review</Link>
          </div>
          <div className="dash-overview-card__grid">
            <div><span>Pending review</span><strong>{insights.pendingHrValidation || 0}</strong></div>
            <div><span>Consistency warnings</span><strong>{insights.evaluationsWithWarnings || 0}</strong></div>
            <div><span>Correction returns</span><strong>{insights.hrSendBacks || 0}</strong></div>
            <div><span>Low performance without plan</span><strong>{insights.lowPerformanceWithoutPlans || 0}</strong></div>
            <div><span>Active improvement plans</span><strong>{insights.activeImprovementPlans || 0}</strong></div>
            <div><span>Development actions pending</span><strong>{insights.pendingCareerActions || 0}</strong></div>
            <div><span>Compensation documents pending</span><strong>{insights.pendingCompensation || 0}</strong></div>
            <div><span>At-risk employees</span><strong>{insights.atRiskEmployees || 0}</strong></div>
          </div>
          {(insights.pendingHrValidation || 0) === 0 && (
            <p className="text-muted" style={{ margin: '1rem 0 0' }}>
              No evaluations pending HR review. Manager-submitted evaluations will appear here.
            </p>
          )}
        </MotionDiv>
      )}

      <div className="dash-overview-grid">
        <MotionDiv
          className="dash-card dash-overview-card"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, ease: 'easeOut' }}
        >
          <div className="dash-overview-card__header">
            <div>
              <h3>Scope overview</h3>
              <p>Existing backend totals with current dashboard context</p>
            </div>
          </div>
          <div className="dash-overview-card__grid">
            <div>
              <span>Users</span>
              <strong>{dashboardData.stats.users || 0}</strong>
            </div>
            <div>
              <span>Teams</span>
              <strong>{dashboardData.stats.teams || 0}</strong>
            </div>
            <div>
              <span>Objectives</span>
              <strong>{dashboardData.stats.objectives || objectiveSummary.total}</strong>
            </div>
            <div>
              <span>Cycles</span>
              <strong>{dashboardData.stats.cycles || dashboardData.cycles.length}</strong>
            </div>
          </div>
        </MotionDiv>

        <MotionDiv
          className="dash-card dash-overview-card"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, ease: 'easeOut' }}
        >
          <div className="dash-overview-card__header">
            <div>
              <h3>Active cycle</h3>
              <p>Current program phase and execution health</p>
            </div>
          </div>
          {dashboardData.activeCycle ? (
            <div className="dash-cycle-card">
              <strong>{dashboardData.activeCycle.name}</strong>
              <span>{String(dashboardData.activeCycle.currentPhase || 'phase1').replace('phase', 'Phase ')}</span>
              <div className="dash-cycle-card__meta">
                <span>{objectiveSummary.completed} completed objectives</span>
                <span>{checkInSummary.approved} approved check-ins</span>
              </div>
              <Link to="/goals" className="dash-card__link">Open objective workspace</Link>
            </div>
          ) : (
            <EmptyPanel
              title="No active cycle"
              text="The dashboard will pin the current cycle here once one is active."
              actionLabel={user?.role === 'ADMIN' ? 'Manage cycles' : ''}
              actionHref={user?.role === 'ADMIN' ? '/cycles' : ''}
            />
          )}
        </MotionDiv>

        <MotionDiv
          className="dash-card dash-overview-card"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, ease: 'easeOut' }}
        >
          <div className="dash-overview-card__header">
            <div>
              <h3>Needs attention</h3>
              <p>Objectives not updated recently</p>
            </div>
          </div>
          {needsAttentionObjectives.length === 0 ? (
            <EmptyPanel
              title="No stale objectives"
              text="Objectives have recent activity in this scope."
            />
          ) : (
            <div className="dash-attention-list">
              {needsAttentionObjectives.map(function (objective) {
                return (
                  <div key={objective._id} className="dash-attention-row">
                    <div>
                      <strong>{objective.title}</strong>
                      <span>{objective.owner?.name || 'Unassigned'}</span>
                    </div>
                    <span>{new Date(objective.updatedAt || objective.createdAt).toLocaleDateString()}</span>
                  </div>
                );
              })}
            </div>
          )}
        </MotionDiv>

        <MotionDiv
          className="dash-card dash-overview-card"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, ease: 'easeOut' }}
        >
          <div className="dash-overview-card__header">
            <div>
              <h3>Evaluation pipeline</h3>
              <p>Current end-year actions in this scope</p>
            </div>
          </div>
          <div className="dash-overview-card__grid">
            <div><span>Generated</span><strong>{insights.finalEvaluationsGenerated || 0}</strong></div>
            <div><span>Pending HR review</span><strong>{insights.pendingHrValidation || 0}</strong></div>
            <div><span>Reviewed</span><strong>{insights.recentlyValidated || 0}</strong></div>
            <div><span>Sent back</span><strong>{insights.hrSendBacks || 0}</strong></div>
          </div>
          <Link to={isAdminOrHr ? '/hr-validation' : '/final-evaluations'} className="dash-card__link">
            Open evaluation workflow
          </Link>
        </MotionDiv>
      </div>

      {(insights.subteams || []).length > 0 && (
        <div className="dash-card" style={{ marginBottom: '1.25rem', padding: '1.25rem' }}>
          <div className="dash-card__header">
            <div><h3>Subteam comparison</h3><p className="dash-card__subtitle">Progress, task delivery, and validated performance</p></div>
            <Link to="/my-team" className="dash-card__link">View team</Link>
          </div>
          <div className="dash-overview-card__grid">
            {insights.subteams.map(function (subteam) {
              return <div key={subteam.id}>
                <span>{subteam.name} · {subteam.members} members</span>
                <strong>{subteam.averageScore == null ? '—' : subteam.averageScore + '%'}</strong>
                <small>{subteam.objectiveProgress ?? '—'}% objectives · {subteam.taskCompletion ?? '—'}% tasks</small>
              </div>;
            })}
          </div>
        </div>
      )}

      {showDeferredAnalytics ? (
        <Suspense fallback={<div className="dash-card"><LoadingSkeleton rows={3} height={120} /></div>}>
          <DashboardAnalytics
            activeTab={activeTab}
            objectives={dashboardData.objectives}
            tasks={dashboardData.tasks}
            teams={activeTab === 'team' ? dashboardData.scopeTeams : dashboardData.teams}
            user={user}
            checkIns={dashboardData.checkIns}
            insights={insights}
            loading={loading}
          />
        </Suspense>
      ) : (
        <div className="dash-card">
          <LoadingSkeleton rows={3} height={120} />
        </div>
      )}

      <div className="dash-workbench-grid">
        <div className="dash-workbench-grid__main">
          <GoalCard objectives={dashboardData.objectives} loading={loading} checkIns={dashboardData.checkIns} />
          <TaskCard
            tasks={dashboardData.tasks}
            stats={taskSummary}
            loading={loading}
            error={sectionErrors.tasks}
          />
        </div>

        <div className="dash-workbench-grid__side">
          <MeetingCard meetings={dashboardData.meetings} loading={loading} error={sectionErrors.meetings} />

          <div className="dash-card dash-checkin-card">
            <div className="dash-card__header">
              <div>
                <h3>Check-in pulse</h3>
                <p className="dash-card__subtitle">Existing check-in workflow surfaced on the dashboard</p>
              </div>
            </div>

            <div className="dash-card__body">
              {sectionErrors.checkIns ? (
                <div className="dash-card__empty-state">
                  <p>{sectionErrors.checkIns}</p>
                  <span className="dash-card__empty-hint">This can happen outside the active check-in phase.</span>
                </div>
              ) : dashboardData.checkIns.length === 0 ? (
                <EmptyPanel
                  title="No check-ins in this scope"
                  text="Submitted employee updates will show here during the active execution phase."
                  actionLabel="Open objectives"
                  actionHref="/goals"
                />
              ) : (
                <div className="dash-checkin-list">
                  <div className="dash-checkin-list__summary">
                    <div>
                      <strong>{checkInSummary.averageProgress}%</strong>
                      <span>Average progress</span>
                    </div>
                    <div>
                      <strong>{checkInSummary.approved}</strong>
                      <span>Approved</span>
                    </div>
                    <div>
                      <strong>{checkInSummary.pending}</strong>
                      <span>Pending</span>
                    </div>
                  </div>
                  {dashboardData.checkIns.slice(0, 4).map(function (checkIn) {
                    return (
                      <div key={checkIn._id} className="dash-checkin-row">
                        <div>
                          <strong>{checkIn?.objective_id?.title || 'Objective check-in'}</strong>
                          <span>{(checkIn.status || 'pending_review').replace(/_/g, ' ')}</span>
                        </div>
                        <strong>{Number(checkIn.progress_percent || 0)}%</strong>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="dash-bottom-grid">
        <div className="dash-card dash-timeline-card">
          <div className="dash-card__header">
            <div>
              <h3>Recent activity</h3>
              <p className="dash-card__subtitle">Composed from objectives, tasks, meetings, check-ins, and feedback</p>
            </div>
          </div>

          <div className="dash-card__body">
            {timelineItems.length === 0 ? (
              <EmptyPanel
                title="No recent activity"
                text="As soon as this scope has updates, the latest events will be summarized here."
              />
            ) : (
              <div className="dash-timeline-list">
                {timelineItems.map(function (item) {
                  return (
                    <div key={item.id} className="dash-timeline-row">
                      <div className="dash-timeline-row__type">{item.type}</div>
                      <div className="dash-timeline-row__content">
                        <strong>{item.title}</strong>
                        <span>{item.meta}</span>
                      </div>
                      <div className="dash-timeline-row__date">
                        {item.date ? new Date(item.date).toLocaleDateString() : '-'}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <FeedbackCard feedbacks={dashboardData.feedbacks} loading={loading} error={sectionErrors.feedbacks} />
      </div>
    </div>
  );
}

export default Dashboard;
