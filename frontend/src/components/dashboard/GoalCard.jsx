import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import ProgressDonut from './ProgressDonut';
import UserAvatar from '../UserAvatar';
import LoadingSkeleton from '../common/LoadingSkeleton';
import { collectKpis, getObjectiveProgress, getObjectiveSummary, statusTone } from './dashboardUtils';

function GoalCard({ objectives, loading, checkIns }) {
  var summary = useMemo(function () {
    return getObjectiveSummary(objectives);
  }, [objectives]);

  var kpis = useMemo(function () {
    return collectKpis(objectives);
  }, [objectives]);

  var approvedCheckIns = (checkIns || []).filter(function (checkIn) {
    return checkIn?.status === 'approved';
  }).length;

  if (loading) {
    return (
      <div className="dash-card dash-card--goals">
        <div className="dash-card__header">
          <div>
            <h3>Objectives</h3>
            <p className="dash-card__subtitle">Current delivery snapshot</p>
          </div>
        </div>
        <div className="dash-card__body">
          <LoadingSkeleton rows={3} height={72} />
        </div>
      </div>
    );
  }

  return (
    <div className="dash-card dash-card--goals">
      <div className="dash-card__header">
        <div>
          <h3>Objectives</h3>
          <p className="dash-card__subtitle">Live goals, KPI coverage, and execution health</p>
        </div>
        <span className="dash-card__count">{summary.total}</span>
      </div>

      {summary.total === 0 ? (
        <div className="dash-card__body">
          <div className="dash-card__empty-state">
            <p>No objectives available in this scope.</p>
            <Link to="/goals" className="dash-card__link">Open objective workspace</Link>
          </div>
        </div>
      ) : (
        <div className="dash-card__body dash-card__body--split">
          <div className="dash-card__list">
            <div className="dash-goal-summary">
              <div className="dash-goal-summary__item">
                <strong>{summary.active}</strong>
                <span>Active</span>
              </div>
              <div className="dash-goal-summary__item">
                <strong>{summary.completed}</strong>
                <span>Completed</span>
              </div>
              <div className="dash-goal-summary__item">
                <strong>{kpis.length}</strong>
                <span>KPIs</span>
              </div>
              <div className="dash-goal-summary__item">
                <strong>{approvedCheckIns}</strong>
                <span>Approved check-ins</span>
              </div>
            </div>

            {(objectives || []).slice(0, 5).map(function (objective) {
              var tone = statusTone(objective?.status, objective?.achievementPercent);
              var progress = getObjectiveProgress(objective);
              var lastTouched = objective?.updatedAt || objective?.createdAt;

              return (
                <div key={objective._id} className="dash-goal-row">
                  <div className="dash-goal-row__lead">
                    <UserAvatar user={objective.owner} size={28} />
                    <div className="dash-goal-row__text">
                      <span className="dash-goal-row__title">{objective.title}</span>
                      <div className="dash-goal-row__meta">
                        <span
                          className="dash-goal-row__status"
                          style={{ background: tone.background, color: tone.color }}
                        >
                          {tone.label}
                        </span>
                        {objective?.weight ? <span>{objective.weight}% weight</span> : null}
                        <span>{(objective?.kpis || []).length} KPIs</span>
                      </div>
                    </div>
                  </div>

                  <div className="dash-goal-row__progress">
                    <strong>{progress}%</strong>
                    <span>
                      {lastTouched ? new Date(lastTouched).toLocaleDateString() : 'No date'}
                    </span>
                    <div className="dash-goal-row__bar">
                      <div className="dash-goal-row__fill" style={{ width: progress + '%' }}></div>
                    </div>
                  </div>
                </div>
              );
            })}

            <Link to="/goals" className="dash-card__link">View all objectives</Link>
          </div>

          <div className="dash-card__donut-section">
            <ProgressDonut percent={summary.averageProgress} size={104} color="#6366f1" label="Avg progress" />
            <div className="dash-card__metric-stack">
              <strong>{summary.completionRate}%</strong>
              <span>Completion rate</span>
              <small>{summary.review} objectives in review</small>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default React.memo(GoalCard);
