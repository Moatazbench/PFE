import React from 'react';
import { Link } from 'react-router-dom';
import ProgressDonut from './ProgressDonut';
import LoadingSkeleton from '../common/LoadingSkeleton';
import { formatDuration, getTrackedSeconds } from '../../utils/workManagement';

function getPriorityColor(priority) {
  return { high: '#ef4444', medium: '#f59e0b', low: '#10b981' }[priority] || '#64748b';
}

function getStatusLabel(status) {
  return {
    todo: 'To do',
    in_progress: 'In progress',
    done: 'Done',
    cancelled: 'Cancelled',
  }[status] || 'Task';
}

function TaskCard({ tasks, stats, loading, error }) {
  var visibleTasks = (tasks || []).filter(function (task) {
    return ['todo', 'in_progress'].includes(task?.status);
  }).slice(0, 4);

  return (
    <div className="dash-card dash-card--tasks">
      <div className="dash-card__header">
        <div>
          <h3>Tasks in focus</h3>
          <p className="dash-card__subtitle">Pending and active work items</p>
        </div>
        <span className="dash-card__count">{stats?.total || 0}</span>
      </div>

      <div className="dash-card__body dash-card__body--split">
        <div className="dash-card__list">
          {loading ? (
            <LoadingSkeleton rows={3} height={62} />
          ) : error ? (
            <div className="dash-card__empty-state">
              <p>Tasks could not be loaded.</p>
              <span className="dash-card__empty-hint">{error}</span>
            </div>
          ) : visibleTasks.length === 0 ? (
            <div className="dash-card__empty-state">
              <p>No active tasks right now</p>
              <Link to="/tasks" className="dash-card__link">Open task board</Link>
            </div>
          ) : (
            visibleTasks.map(function (task) {
              return (
                <div key={task._id} className="dash-task-row">
                  <div className="dash-task-row__top">
                    <span className="dash-task-row__title">{task.title}</span>
                    <span
                      className="dash-task-row__priority"
                      style={{ backgroundColor: getPriorityColor(task.priority) }}
                    ></span>
                  </div>
                  <div className="dash-task-row__meta">
                    <span>{getStatusLabel(task.status)}</span>
                    {task?.linkedGoal?.title && <span>{task.linkedGoal.title}</span>}
                    {task?.dueDate && (
                      <span>
                        Due {new Date(task.dueDate).toLocaleDateString()}
                      </span>
                    )}
                    <span>{formatDuration(getTrackedSeconds(task))}</span>
                  </div>
                </div>
              );
            })
          )}
          {!loading && !error && (
            <Link to="/tasks" className="dash-card__link">View all tasks</Link>
          )}
        </div>

        <div className="dash-card__donut-section">
          <ProgressDonut percent={stats?.completionRate || 0} size={94} color="#3b82f6" label="Done" />
          <div className="dash-card__metric-stack">
            <strong>{stats?.inProgress || 0}</strong>
            <span>In progress</span>
            <small>{stats?.overdue || 0} overdue</small>
          </div>
        </div>
      </div>
    </div>
  );
}

export default React.memo(TaskCard);
