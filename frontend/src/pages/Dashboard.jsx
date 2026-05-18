import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import api from '../services/api';
import { useAuth } from '../components/AuthContext';
import DashboardHeader from '../components/dashboard/DashboardHeader';
import GoalCard from '../components/dashboard/GoalCard';
import MeetingCard from '../components/dashboard/MeetingCard';
import TaskCard from '../components/dashboard/TaskCard';
import FeedbackCard from '../components/dashboard/FeedbackCard';
import DashboardAnalytics from '../components/dashboard/DashboardAnalytics';
import LoadingSkeleton from '../components/common/LoadingSkeleton';
import { buildProductivitySummary, formatDuration } from '../utils/workManagement';
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
    <motion.div
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
    </motion.div>
  );
}

function EmptyPanel({ title, text, actionLabel, actionHref }) {
  return (
    <div className="dash-inline-empty">
      <strong>{title}</strong>
      <p>{text}</p>
      {actionLabel && actionHref ? <Link to={actionHref}>{actionLabel}</Link> : null}
    </div>
  );
}

function Dashboard() {
  var auth = useAuth();
  var user = auth.user;
  var [activeTab, setActiveTab] = useState('me');
  var [dashboardData, setDashboardData] = useState(INITIAL_DATA);
  var [loading, setLoading] = useState(true);
  var [pageError, setPageError] = useState('');
  var [sectionErrors, setSectionErrors] = useState({});
  var [refreshTick, setRefreshTick] = useState(0);

  var userId = getUserId(user);
  var isAdminOrHr = user?.role === 'ADMIN' || user?.role === 'HR';

  useEffect(function () {
    if (!userId) return;

    var cancelled = false;

    async function loadDashboard() {
      setLoading(true);
      setPageError('');

      try {
        var scope = getScopeFromTab(activeTab);

        var requests = await Promise.all([
          api.get('/stats/dashboard', { params: { scope: scope } }).catch(function () {
            return { data: { users: 0, teams: 0, objectives: 0, cycles: 0 } };
          }),
          activeTab === 'me'
            ? api.get('/objectives/my').catch(function () { return { data: { objectives: [] } }; })
            : api.get('/objectives', { params: activeTab === 'team' ? { scope: 'team' } : {} }).catch(function () {
                return { data: { objectives: [] } };
              }),
          api.get('/cycles').catch(function () { return { data: [] }; }),
          api.get('/teams').catch(function () { return { data: { teams: [] } }; }),
          api.get('/meetings', { params: { upcoming: 'true' } }).catch(function () { return { data: { meetings: [] } }; }),
          api.get('/feedback/received').catch(function () { return { data: { feedbacks: [] } }; }),
          activeTab === 'org' && isAdminOrHr
            ? api.get('/tasks/all', { params: { limit: 200 } }).catch(function () { return { data: { tasks: [] } }; })
            : activeTab === 'me'
              ? api.get('/tasks/my', { params: { limit: 100 } }).catch(function () { return { data: { tasks: [] } }; })
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
          var teamTaskResponses = await Promise.all(
            scopeTeams.map(function (team) {
              return api.get('/tasks/team/' + team._id).catch(function () {
                nextSectionErrors.tasks = 'Some team task records could not be loaded.';
                return { data: { tasks: [] } };
              });
            })
          );

          if (!cancelled) {
            tasks = dedupeById(
              teamTaskResponses.flatMap(function (response) {
                return normalizeTasksPayload(response?.data);
              })
            );
          }
        }

        var checkIns = [];
        if (activeCycle?._id && ['phase2', 'phase3'].includes(activeCycle?.currentPhase)) {
          try {
            if (activeTab === 'me') {
              var checkInResponse = await api.get('/checkins', { params: { cycle_id: activeCycle._id } });
              checkIns = dedupeById(normalizeCheckInsPayload(checkInResponse?.data));
            } else if (activeTab === 'team' && user?.role === 'TEAM_LEADER') {
              var leaderCheckInResponse = await api.get('/checkins/team', { params: { cycle_id: activeCycle._id } });
              checkIns = dedupeById(normalizeCheckInsPayload(leaderCheckInResponse?.data));
            } else if (activeTab !== 'me') {
              nextSectionErrors.checkIns = 'Check-ins are currently surfaced in personal and managed team views.';
            }
          } catch (checkInError) {
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

  var objectiveSummary = useMemo(function () {
    return getObjectiveSummary(dashboardData.objectives);
  }, [dashboardData.objectives]);

  var taskSummary = useMemo(function () {
    return getTaskSummary(dashboardData.tasks);
  }, [dashboardData.tasks]);

  var checkInSummary = useMemo(function () {
    return getCheckInSummary(dashboardData.checkIns);
  }, [dashboardData.checkIns]);

  var productivitySummary = useMemo(function () {
    return buildProductivitySummary(dashboardData.tasks);
  }, [dashboardData.tasks]);

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
      []
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
  }, [dashboardData.checkIns, dashboardData.feedbacks, dashboardData.meetings, dashboardData.objectives, dashboardData.tasks]);

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
        <div className="dash-loading-state">
          <LoadingSkeleton rows={2} height={112} />
          <LoadingSkeleton rows={2} height={132} />
          <LoadingSkeleton rows={3} height={118} />
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
          value={objectiveSummary.total}
          label="Objectives in scope"
          hint={objectiveSummary.active + ' active and ' + objectiveSummary.review + ' in review'}
          points={weeklySparkline}
          accent="#6366f1"
        />
        <MetricCard
          eyebrow="Execution"
          value={taskSummary.total}
          label="Tracked tasks"
          hint={taskSummary.done + ' completed, ' + taskSummary.overdue + ' overdue'}
          points={taskSparkline}
          accent="#0ea5e9"
        />
        <MetricCard
          eyebrow="Check-ins"
          value={checkInSummary.total}
          label="Submitted updates"
          hint={checkInSummary.pending + ' pending review'}
          points={checkInSparkline}
          accent="#14b8a6"
        />
        <MetricCard
          eyebrow="Productivity"
          value={formatDuration(productivitySummary.weekSeconds)}
          label="Tracked this week"
          hint={formatDuration(productivitySummary.todaySeconds) + ' logged today'}
          points={taskSparkline}
          accent="#ec4899"
        />
        <MetricCard
          eyebrow="KPI coverage"
          value={kpis.length}
          label="Active KPI records"
          hint={objectiveSummary.averageProgress + '% average goal progress'}
          points={kpiSparkline}
          accent="#f59e0b"
        />
      </div>

      <div className="dash-overview-grid">
        <motion.div
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
        </motion.div>

        <motion.div
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
              actionLabel="Manage cycles"
              actionHref="/cycles"
            />
          )}
        </motion.div>

        <motion.div
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
        </motion.div>
      </div>

      <DashboardAnalytics
        activeTab={activeTab}
        objectives={dashboardData.objectives}
        tasks={dashboardData.tasks}
        teams={activeTab === 'team' ? dashboardData.scopeTeams : dashboardData.teams}
        user={user}
        checkIns={dashboardData.checkIns}
        loading={loading}
      />

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
