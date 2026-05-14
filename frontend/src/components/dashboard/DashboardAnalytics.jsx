import React, { useEffect, useMemo, useState } from 'react';
import {
  Chart as ChartJS,
  ArcElement,
  BarElement,
  CategoryScale,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
} from 'chart.js';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import api from '../../services/api';
import LoadingSkeleton from '../common/LoadingSkeleton';

ChartJS.register(ArcElement, BarElement, CategoryScale, Legend, LineElement, LinearScale, PointElement, Tooltip);

function EmptyChartState({ title, text }) {
  return (
    <div className="dash-chart-empty">
      <div className="dash-chart-empty__icon">No data</div>
      <h4>{title}</h4>
      <p>{text}</p>
    </div>
  );
}

function DashboardAnalytics({ activeTab, objectives, teams, user }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(function () {
    var cancelled = false;

    async function loadTasks() {
      setLoading(true);
      try {
        var loadedTasks = [];

        if (activeTab === 'me') {
          var myTasksRes = await api.get('/tasks/my', { params: { limit: 100 } });
          loadedTasks = myTasksRes.data?.tasks || [];
        } else if (activeTab === 'org' && (user.role === 'ADMIN' || user.role === 'HR')) {
          var allTasksRes = await api.get('/tasks/all', { params: { limit: 200 } });
          loadedTasks = allTasksRes.data?.tasks || [];
        } else {
          var accessibleTeams = Array.isArray(teams) ? teams : [];
          if (accessibleTeams.length > 0) {
            var taskResponses = await Promise.all(
              accessibleTeams.map(function (team) {
                return api.get('/tasks/team/' + team._id).catch(function () {
                  return { data: { tasks: [] } };
                });
              })
            );
            loadedTasks = taskResponses.flatMap(function (response) {
              return response.data?.tasks || [];
            });
          }
        }

        if (!cancelled) {
          var seen = new Set();
          setTasks(loadedTasks.filter(function (task) {
            if (!task || seen.has(task._id)) return false;
            seen.add(task._id);
            return true;
          }));
        }
      } catch (err) {
        console.error('Failed to load dashboard analytics tasks', err);
        if (!cancelled) setTasks([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadTasks();
    return function () {
      cancelled = true;
    };
  }, [activeTab, teams, user.role]);

  const objectiveStatusData = useMemo(function () {
    var labels = ['Draft', 'Pending', 'Approved', 'Completed'];
    var counts = { draft: 0, pending: 0, approved: 0, completed: 0 };

    (objectives || []).forEach(function (objective) {
      var status = objective.status || 'draft';
      if (status === 'draft') counts.draft += 1;
      else if (['pending', 'submitted', 'pending_approval', 'revision_requested'].includes(status)) counts.pending += 1;
      else if (['approved', 'validated', 'assigned', 'acknowledged'].includes(status)) counts.approved += 1;
      else if (['evaluated', 'locked', 'archived'].includes(status) || (objective.achievementPercent || 0) >= 100) counts.completed += 1;
    });

    return {
      labels: labels,
      datasets: [{
        data: [counts.draft, counts.pending, counts.approved, counts.completed],
        backgroundColor: ['#94a3b8', '#f59e0b', '#3b82f6', '#10b981'],
        borderWidth: 0,
        hoverOffset: 6,
      }]
    };
  }, [objectives]);

  const taskStatusData = useMemo(function () {
    var counts = { todo: 0, in_progress: 0, done: 0, cancelled: 0 };
    (tasks || []).forEach(function (task) {
      counts[task.status] = (counts[task.status] || 0) + 1;
    });

    return {
      labels: ['To Do', 'In Progress', 'Done', 'Cancelled'],
      datasets: [{
        label: 'Tasks',
        data: [counts.todo, counts.in_progress, counts.done, counts.cancelled],
        backgroundColor: '#4f46e5',
        borderRadius: 10,
        maxBarThickness: 32,
      }]
    };
  }, [tasks]);

  const progressTrendData = useMemo(function () {
    var buckets = {};
    (objectives || []).forEach(function (objective) {
      var stamp = objective.updatedAt || objective.createdAt;
      if (!stamp) return;
      var date = new Date(stamp);
      if (Number.isNaN(date.getTime())) return;
      var key = date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0');
      if (!buckets[key]) buckets[key] = { total: 0, count: 0 };
      buckets[key].total += Number(objective.achievementPercent || 0);
      buckets[key].count += 1;
    });

    var sortedKeys = Object.keys(buckets).sort().slice(-6);
    return {
      labels: sortedKeys.map(function (key) {
        var parts = key.split('-');
        return new Date(Number(parts[0]), Number(parts[1]) - 1, 1).toLocaleDateString('en-US', { month: 'short' });
      }),
      datasets: [{
        label: 'Average progress',
        data: sortedKeys.map(function (key) {
          return buckets[key].count > 0 ? Math.round(buckets[key].total / buckets[key].count) : 0;
        }),
        borderColor: '#0f766e',
        backgroundColor: 'rgba(15, 118, 110, 0.14)',
        fill: true,
        tension: 0.35,
        pointRadius: 4,
        pointHoverRadius: 5,
      }]
    };
  }, [objectives]);

  const teamPerformanceData = useMemo(function () {
    if (activeTab === 'me') {
      var personalObjectives = (objectives || []).slice(0, 6);
      return {
        labels: personalObjectives.map(function (objective) {
          return objective.title.length > 16 ? objective.title.slice(0, 16) + '…' : objective.title;
        }),
        datasets: [{
          label: 'Progress',
          data: personalObjectives.map(function (objective) { return Number(objective.achievementPercent || 0); }),
          backgroundColor: '#14b8a6',
          borderRadius: 10,
          maxBarThickness: 30,
        }]
      };
    }

    var performanceByTeam = (teams || []).map(function (team) {
      var ownerIds = [team.leader?._id || team.leader].concat((team.members || []).map(function (member) { return member._id || member; }))
        .filter(Boolean)
        .map(String);
      var teamObjectives = (objectives || []).filter(function (objective) {
        return ownerIds.includes(String(objective.owner?._id || objective.owner || ''));
      });
      var avg = teamObjectives.length > 0
        ? Math.round(teamObjectives.reduce(function (sum, objective) {
            return sum + Number(objective.achievementPercent || 0);
          }, 0) / teamObjectives.length)
        : 0;

      return {
        label: team.name,
        score: avg,
      };
    }).slice(0, 6);

    return {
      labels: performanceByTeam.map(function (entry) { return entry.label; }),
      datasets: [{
        label: 'Average progress',
        data: performanceByTeam.map(function (entry) { return entry.score; }),
        backgroundColor: ['#4f46e5', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'],
        borderRadius: 12,
        maxBarThickness: 30,
      }]
    };
  }, [activeTab, objectives, teams]);

  const employeeProgress = useMemo(function () {
    var progressMap = {};
    (objectives || []).forEach(function (objective) {
      var owner = objective.owner;
      var ownerId = owner?._id || owner || 'unknown';
      if (!progressMap[ownerId]) {
        progressMap[ownerId] = {
          name: owner?.name || (activeTab === 'me' ? (user.name || 'You') : 'Unknown'),
          total: 0,
          count: 0,
        };
      }
      progressMap[ownerId].total += Number(objective.achievementPercent || 0);
      progressMap[ownerId].count += 1;
    });

    return Object.values(progressMap)
      .map(function (entry) {
        return {
          name: entry.name,
          progress: entry.count > 0 ? Math.round(entry.total / entry.count) : 0,
        };
      })
      .sort(function (a, b) { return b.progress - a.progress; })
      .slice(0, 5);
  }, [activeTab, objectives, user.name]);

  if (loading) {
    return (
      <div className="dash-analytics-grid">
        <div className="dash-card dash-analytics-card"><LoadingSkeleton rows={3} height={88} /></div>
        <div className="dash-card dash-analytics-card"><LoadingSkeleton rows={3} height={88} /></div>
        <div className="dash-card dash-analytics-card"><LoadingSkeleton rows={3} height={88} /></div>
        <div className="dash-card dash-analytics-card"><LoadingSkeleton rows={3} height={88} /></div>
      </div>
    );
  }

  var chartOptionsBase = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: {
          usePointStyle: true,
          boxWidth: 10,
          color: '#64748b',
          font: { size: 11, weight: 600 }
        }
      }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: '#64748b', font: { size: 11 } }
      },
      y: {
        beginAtZero: true,
        grid: { color: 'rgba(148, 163, 184, 0.15)' },
        ticks: { color: '#64748b', font: { size: 11 } }
      }
    }
  };

  return (
    <div className="dash-analytics-grid">
      <div className="dash-card dash-analytics-card">
        <div className="dash-analytics-card__header">
          <div>
            <h3>Objective Status</h3>
            <p>Live breakdown of current objective states</p>
          </div>
        </div>
        <div className="dash-analytics-card__body dash-analytics-card__body--donut">
          {objectiveStatusData.datasets[0].data.every(function (value) { return value === 0; }) ? (
            <EmptyChartState title="No objectives yet" text="Create or assign objectives to start tracking status." />
          ) : (
            <Doughnut
              data={objectiveStatusData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                cutout: '72%',
                plugins: chartOptionsBase.plugins
              }}
            />
          )}
        </div>
      </div>

      <div className="dash-card dash-analytics-card">
        <div className="dash-analytics-card__header">
          <div>
            <h3>Tasks by Status</h3>
            <p>Workload split from real task records</p>
          </div>
        </div>
        <div className="dash-analytics-card__body">
          {taskStatusData.datasets[0].data.every(function (value) { return value === 0; }) ? (
            <EmptyChartState title="No tasks yet" text="Tasks will appear here once work is assigned." />
          ) : (
            <Bar
              data={taskStatusData}
              options={chartOptionsBase}
            />
          )}
        </div>
      </div>

      <div className="dash-card dash-analytics-card dash-analytics-card--wide">
        <div className="dash-analytics-card__header">
          <div>
            <h3>Progress Trend</h3>
            <p>Average objective progress over recent months</p>
          </div>
        </div>
        <div className="dash-analytics-card__body">
          {progressTrendData.labels.length === 0 ? (
            <EmptyChartState title="No trend data yet" text="Progress updates will build this trend automatically." />
          ) : (
            <Line
              data={progressTrendData}
              options={chartOptionsBase}
            />
          )}
        </div>
      </div>

      <div className="dash-card dash-analytics-card">
        <div className="dash-analytics-card__header">
          <div>
            <h3>{activeTab === 'me' ? 'Objective Progress' : 'Team Performance'}</h3>
            <p>{activeTab === 'me' ? 'Current progress across your objectives' : 'Average completion by team'}</p>
          </div>
        </div>
        <div className="dash-analytics-card__body">
          {teamPerformanceData.labels.length === 0 ? (
            <EmptyChartState title="Nothing to compare yet" text="Progress will appear once objectives are active." />
          ) : (
            <Bar
              data={teamPerformanceData}
              options={chartOptionsBase}
            />
          )}
        </div>
      </div>

      <div className="dash-card dash-analytics-card">
        <div className="dash-analytics-card__header">
          <div>
            <h3>{activeTab === 'me' ? 'My Progress' : 'People Progress'}</h3>
            <p>{activeTab === 'me' ? 'Your current average completion' : 'Top average completion levels'}</p>
          </div>
        </div>
        <div className="dash-analytics-progress-list">
          {employeeProgress.length === 0 ? (
            <EmptyChartState title="No people data yet" text="People progress will appear here once objectives exist." />
          ) : (
            employeeProgress.map(function (entry) {
              return (
                <div key={entry.name} className="dash-analytics-progress-item">
                  <div className="dash-analytics-progress-item__top">
                    <span>{entry.name}</span>
                    <strong>{entry.progress}%</strong>
                  </div>
                  <div className="dash-analytics-progress-item__bar">
                    <div className="dash-analytics-progress-item__fill" style={{ width: entry.progress + '%' }}></div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

export default DashboardAnalytics;
