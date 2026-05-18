import React, { useMemo } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { motion } from 'framer-motion';
import LoadingSkeleton from '../common/LoadingSkeleton';
import {
  buildComparisonChart,
  buildLeaderboard,
  buildObjectiveStatusChart,
  buildTaskStatusChart,
  buildWeeklyActivity,
  collectKpis,
  getCheckInSummary,
  getObjectiveSummary,
  getTaskSummary,
} from './dashboardUtils';
import { buildDailyProductivity, buildProductivitySummary, formatDuration } from '../../utils/workManagement';

var cardTransition = {
  duration: 0.32,
  ease: 'easeOut',
};

function EmptyChartState({ title, text }) {
  return (
    <div className="dash-chart-empty">
      <div className="dash-chart-empty__icon">No data</div>
      <h4>{title}</h4>
      <p>{text}</p>
    </div>
  );
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="dash-chart-tooltip">
      <strong>{label}</strong>
      {payload.map(function (entry, index) {
        return (
          <div key={(entry.name || entry.dataKey || 'metric') + '-' + index} className="dash-chart-tooltip__row">
            <span style={{ color: entry.color }}>{entry.name || entry.dataKey}</span>
            <strong>{entry.value}</strong>
          </div>
        );
      })}
    </div>
  );
}

function KPIChip({ item }) {
  return (
    <div className="dash-kpi-chip">
      <div className="dash-kpi-chip__top">
        <span>{item.title}</span>
        <strong>{item.progress}%</strong>
      </div>
      <div className="dash-kpi-chip__meta">
        <span>{item.objectiveTitle}</span>
        <span>
          {item.currentValue}
          {item.unit}
          {' / '}
          {item.targetValue}
          {item.unit}
        </span>
      </div>
      <div className="dash-kpi-chip__bar">
        <div className="dash-kpi-chip__fill" style={{ width: item.progress + '%' }}></div>
      </div>
    </div>
  );
}

function StatStrip({ items }) {
  return (
    <div className="dash-analytics-strip">
      {items.map(function (item) {
        return (
          <div key={item.label} className="dash-analytics-strip__item">
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            <small>{item.hint}</small>
          </div>
        );
      })}
    </div>
  );
}

function DashboardAnalytics({ activeTab, objectives, tasks, teams, user, checkIns, loading }) {
  var objectiveStatusChart = useMemo(function () {
    return buildObjectiveStatusChart(objectives);
  }, [objectives]);

  var taskStatusChart = useMemo(function () {
    return buildTaskStatusChart(tasks);
  }, [tasks]);

  var weeklyActivity = useMemo(function () {
    return buildWeeklyActivity(objectives, tasks, checkIns);
  }, [objectives, tasks, checkIns]);

  var comparisonChart = useMemo(function () {
    return buildComparisonChart(activeTab, objectives, teams, user);
  }, [activeTab, objectives, teams, user]);

  var leaderboard = useMemo(function () {
    return buildLeaderboard(objectives, activeTab, user);
  }, [activeTab, objectives, user]);

  var kpis = useMemo(function () {
    return collectKpis(objectives).slice(0, 6);
  }, [objectives]);

  var objectiveSummary = useMemo(function () {
    return getObjectiveSummary(objectives);
  }, [objectives]);

  var taskSummary = useMemo(function () {
    return getTaskSummary(tasks);
  }, [tasks]);

  var checkInSummary = useMemo(function () {
    return getCheckInSummary(checkIns);
  }, [checkIns]);

  var productivitySummary = useMemo(function () {
    return buildProductivitySummary(tasks);
  }, [tasks]);

  var trackedTimeTrend = useMemo(function () {
    return buildDailyProductivity(tasks, 7).map(function (entry) {
      return {
        label: entry.label,
        hours: Number((entry.trackedSeconds / 3600).toFixed(1)),
      };
    });
  }, [tasks]);

  if (loading) {
    return (
      <div className="dash-analytics-grid">
        <div className="dash-card dash-analytics-card"><LoadingSkeleton rows={3} height={88} /></div>
        <div className="dash-card dash-analytics-card"><LoadingSkeleton rows={3} height={88} /></div>
        <div className="dash-card dash-analytics-card dash-analytics-card--wide"><LoadingSkeleton rows={3} height={88} /></div>
        <div className="dash-card dash-analytics-card"><LoadingSkeleton rows={3} height={88} /></div>
      </div>
    );
  }

  return (
    <div className="dash-analytics-stack">
      <StatStrip
        items={[
          {
            label: 'Completion',
            value: objectiveSummary.completionRate + '%',
            hint: 'Objectives finished',
          },
          {
            label: 'Task throughput',
            value: taskSummary.completionRate + '%',
            hint: 'Tasks completed',
          },
          {
            label: 'Check-in health',
            value: checkInSummary.averageProgress + '%',
            hint: 'Average submitted progress',
          },
          {
            label: 'Active KPIs',
            value: kpis.length,
            hint: 'Tracked metrics',
          },
          {
            label: 'Tracked this week',
            value: formatDuration(productivitySummary.weekSeconds),
            hint: formatDuration(productivitySummary.todaySeconds) + ' today',
          },
        ]}
      />

      <div className="dash-analytics-grid">
        <motion.div
          className="dash-card dash-analytics-card dash-analytics-card--wide"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={cardTransition}
        >
          <div className="dash-analytics-card__header">
            <div>
              <h3>Progress and activity trend</h3>
              <p>Weekly objective momentum, completed work, and check-ins</p>
            </div>
          </div>
          <div className="dash-analytics-card__body">
            {weeklyActivity.every(function (point) { return point.activity === 0; }) ? (
              <EmptyChartState
                title="No activity yet"
                text="Recent updates, completed tasks, and check-ins will appear here automatically."
              />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={weeklyActivity}>
                  <defs>
                    <linearGradient id="dashProgressFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#4f46e5" stopOpacity="0.24" />
                      <stop offset="100%" stopColor="#4f46e5" stopOpacity="0.02" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(148, 163, 184, 0.14)" vertical={false} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} />
                  <YAxis yAxisId="left" tickLine={false} axisLine={false} />
                  <YAxis yAxisId="right" orientation="right" tickLine={false} axisLine={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend />
                  <Area
                    yAxisId="left"
                    type="monotone"
                    dataKey="progress"
                    stroke="#4f46e5"
                    fill="url(#dashProgressFill)"
                    strokeWidth={2.4}
                    name="Avg progress"
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="completedTasks"
                    stroke="#0ea5e9"
                    strokeWidth={2.2}
                    dot={{ r: 3 }}
                    name="Completed tasks"
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="checkIns"
                    stroke="#14b8a6"
                    strokeWidth={2.2}
                    dot={{ r: 3 }}
                    name="Check-ins"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </motion.div>

        <motion.div
          className="dash-card dash-analytics-card"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={cardTransition}
        >
          <div className="dash-analytics-card__header">
            <div>
              <h3>Tracked focus time</h3>
              <p>Daily timer output from the integrated productivity tracker</p>
            </div>
          </div>
          <div className="dash-analytics-card__body">
            {trackedTimeTrend.every(function (entry) { return entry.hours === 0; }) ? (
              <EmptyChartState
                title="No tracked time yet"
                text="Tracked sessions will start populating this chart as soon as time is logged on tasks."
              />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trackedTimeTrend}>
                  <CartesianGrid stroke="rgba(148, 163, 184, 0.14)" vertical={false} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} />
                  <YAxis tickLine={false} axisLine={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Line type="monotone" dataKey="hours" stroke="#ec4899" strokeWidth={2.4} dot={{ r: 3 }} name="Hours" />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </motion.div>

        <motion.div
          className="dash-card dash-analytics-card"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={cardTransition}
        >
          <div className="dash-analytics-card__header">
            <div>
              <h3>Objective distribution</h3>
              <p>Live status split from current dashboard objectives</p>
            </div>
          </div>
          <div className="dash-analytics-card__body dash-analytics-card__body--donut">
            {objectiveStatusChart.every(function (entry) { return entry.value === 0; }) ? (
              <EmptyChartState
                title="No objectives found"
                text="Objectives in the active scope will appear here once available."
              />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={objectiveStatusChart}
                    innerRadius={68}
                    outerRadius={100}
                    paddingAngle={3}
                    dataKey="value"
                    nameKey="name"
                  >
                    {objectiveStatusChart.map(function (entry) {
                      return <Cell key={entry.name} fill={entry.color} />;
                    })}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </motion.div>

        <motion.div
          className="dash-card dash-analytics-card"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={cardTransition}
        >
          <div className="dash-analytics-card__header">
            <div>
              <h3>Task flow</h3>
              <p>Task status distribution in the active dashboard scope</p>
            </div>
          </div>
          <div className="dash-analytics-card__body">
            {taskStatusChart.every(function (entry) { return entry.value === 0; }) ? (
              <EmptyChartState
                title="No tasks available"
                text="Assigned tasks will populate this chart once work is in motion."
              />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={taskStatusChart}>
                  <CartesianGrid stroke="rgba(148, 163, 184, 0.14)" vertical={false} />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} />
                  <YAxis tickLine={false} axisLine={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="value" radius={[10, 10, 0, 0]}>
                    {taskStatusChart.map(function (entry) {
                      return <Cell key={entry.name} fill={entry.color} />;
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </motion.div>

        <motion.div
          className="dash-card dash-analytics-card"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={cardTransition}
        >
          <div className="dash-analytics-card__header">
            <div>
              <h3>{activeTab === 'me' ? 'Objective comparison' : 'Team comparison'}</h3>
              <p>{activeTab === 'me' ? 'Current progress by objective' : 'Average progress by team'}</p>
            </div>
          </div>
          <div className="dash-analytics-card__body">
            {comparisonChart.length === 0 ? (
              <EmptyChartState
                title="Not enough data to compare"
                text="The dashboard will compare objectives or teams as soon as they are active."
              />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={comparisonChart} layout="vertical" margin={{ left: 18 }}>
                  <CartesianGrid stroke="rgba(148, 163, 184, 0.14)" horizontal={false} />
                  <XAxis type="number" tickLine={false} axisLine={false} domain={[0, 100]} />
                  <YAxis type="category" dataKey="label" tickLine={false} axisLine={false} width={108} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="value" fill="#6366f1" radius={[0, 10, 10, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </motion.div>

        <motion.div
          className="dash-card dash-analytics-card"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={cardTransition}
        >
          <div className="dash-analytics-card__header">
            <div>
              <h3>{activeTab === 'me' ? 'Progress snapshot' : 'Top contributors'}</h3>
              <p>{activeTab === 'me' ? 'Your current objective averages' : 'Highest average objective progress'}</p>
            </div>
          </div>
          <div className="dash-analytics-progress-list">
            {leaderboard.length === 0 ? (
              <EmptyChartState
                title="No contributor data"
                text="Owner-level progress will appear after objectives are assigned."
              />
            ) : (
              leaderboard.map(function (entry) {
                return (
                  <div key={entry.label} className="dash-analytics-progress-item">
                    <div className="dash-analytics-progress-item__top">
                      <span>{entry.label}</span>
                      <strong>{entry.value}%</strong>
                    </div>
                    <div className="dash-analytics-progress-item__bar">
                      <div className="dash-analytics-progress-item__fill" style={{ width: entry.value + '%' }}></div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </motion.div>

        <motion.div
          className="dash-card dash-analytics-card dash-analytics-card--wide"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={cardTransition}
        >
          <div className="dash-analytics-card__header">
            <div>
              <h3>KPI delivery board</h3>
              <p>Real KPI entries mapped from live objective data</p>
            </div>
          </div>
          <div className="dash-kpi-grid">
            {kpis.length === 0 ? (
              <EmptyChartState
                title="No tracked KPIs yet"
                text="This board now reads the existing KPI schema correctly and will populate when objectives include KPI entries."
              />
            ) : (
              kpis.map(function (item) {
                return <KPIChip key={item._id} item={item} />;
              })
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}

export default React.memo(DashboardAnalytics);
