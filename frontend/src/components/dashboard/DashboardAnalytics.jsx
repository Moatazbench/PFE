import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import LoadingSkeleton from '../common/LoadingSkeleton';
import {
  buildLeaderboard,
  collectKpis,
  getCheckInSummary,
  getObjectiveSummary,
  getTaskSummary,
} from './dashboardUtils';

var cardTransition = {
  duration: 0.32,
  ease: 'easeOut',
};
const MotionDiv = motion.div;

function EmptyChartState({ title, text }) {
  return (
    <div className="dash-chart-empty">
      <div className="dash-chart-empty__icon">No data</div>
      <h4>{title}</h4>
      <p>{text}</p>
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

function DashboardAnalytics({ activeTab, objectives, tasks, teams, user, checkIns, insights, loading }) {
  var leaderboard = useMemo(function () {
    return buildLeaderboard(objectives, activeTab, user, insights);
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

  if (loading) {
    return (
      <div className="dash-analytics-grid">
        <div className="dash-card dash-analytics-card"><LoadingSkeleton rows={3} height={88} /></div>
        <div className="dash-card dash-analytics-card dash-analytics-card--wide"><LoadingSkeleton rows={3} height={88} /></div>
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
            label: 'Average score',
            value: insights?.averagePerformanceScore == null ? '—' : insights.averagePerformanceScore + '%',
            hint: (insights?.atRiskEmployees || 0) + ' at-risk employees',
          },
        ]}
      />

      <div className="dash-analytics-grid">

        <MotionDiv
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
        </MotionDiv>

        <MotionDiv
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
        </MotionDiv>
      </div>
    </div>
  );
}

export default React.memo(DashboardAnalytics);
