import React, { Suspense, lazy, useEffect, useMemo, useReducer, useState } from 'react';
import api from '../services/api';
import { useAuth } from '../components/AuthContext';
import { ToastContainer, useToast } from '../components/common/Toast';
import ConfirmDialog from '../components/common/ConfirmDialog';
import LoadingSkeleton from '../components/common/LoadingSkeleton';
import usePersistentTimer from '../hooks/usePersistentTimer';
import {
  buildDailyProductivity,
  buildProductivitySummary,
  buildTimesheetEntries,
  formatDuration,
  getStatusForStage,
  getTrackedSeconds,
  getWorkflowStage,
} from '../utils/workManagement';
import '../work-management.css';

const KanbanBoard = lazy(() => import('../components/tasks/KanbanBoard'));
const ProductivityTimerWidget = lazy(() => import('../components/tasks/ProductivityTimerWidget'));

var priorityColors = { low: '#6b7280', medium: '#3b82f6', high: '#f59e0b', urgent: '#ef4444' };
var statusLabels = { todo: 'To Do', in_progress: 'In Progress', done: 'Done', cancelled: 'Cancelled' };
var statusColors = { todo: '#6b7280', in_progress: '#3b82f6', done: '#10b981', cancelled: '#ef4444' };
var INITIAL_TASK_FORM = {
  title: '',
  description: '',
  priority: 'medium',
  dueDate: '',
  labels: '',
  linkedGoal: '',
  notes: '',
  workflowStage: 'todo',
  progress: 0,
};
var INITIAL_WORKFLOW_STATE = {
  showForm: false,
  editingTask: null,
  confirmDelete: null,
  form: INITIAL_TASK_FORM,
  loadError: '',
};

function taskWorkflowReducer(state, action) {
  switch (action.type) {
    case 'OPEN_CREATE_FORM':
      return Object.assign({}, state, {
        showForm: true,
        editingTask: null,
        form: Object.assign({}, INITIAL_TASK_FORM),
      });
    case 'OPEN_EDIT_FORM':
      return Object.assign({}, state, {
        showForm: true,
        editingTask: action.taskId,
        form: Object.assign({}, action.form),
      });
    case 'CLOSE_FORM':
      return Object.assign({}, state, {
        showForm: false,
        editingTask: null,
        form: Object.assign({}, INITIAL_TASK_FORM),
      });
    case 'UPDATE_FORM_FIELD':
      return Object.assign({}, state, {
        form: Object.assign({}, state.form, {
          [action.field]: action.value,
        }),
      });
    case 'REQUEST_DELETE':
      return Object.assign({}, state, { confirmDelete: action.taskId });
    case 'CLEAR_DELETE':
      return Object.assign({}, state, { confirmDelete: null });
    case 'SET_LOAD_ERROR':
      return Object.assign({}, state, { loadError: action.message || '' });
    case 'CLEAR_LOAD_ERROR':
      return state.loadError ? Object.assign({}, state, { loadError: '' }) : state;
    default:
      return state;
  }
}

function buildLocalStats(taskList) {
  var now = new Date();
  var summary = {
    total: 0,
    todo: 0,
    inProgress: 0,
    done: 0,
    cancelled: 0,
    overdue: 0,
    completionRate: 0,
  };

  (taskList || []).forEach(function (task) {
    summary.total += 1;
    if (task.status === 'done') summary.done += 1;
    else if (task.status === 'in_progress') summary.inProgress += 1;
    else if (task.status === 'cancelled') summary.cancelled += 1;
    else summary.todo += 1;

    if (task.dueDate && !['done', 'cancelled'].includes(task.status) && new Date(task.dueDate) < now) {
      summary.overdue += 1;
    }
  });

  summary.completionRate = summary.total > 0 ? Math.round((summary.done / summary.total) * 100) : 0;
  return summary;
}

function mergeSessionIntoTask(task, session) {
  var existingTracking = task?.timeTracking || {};
  var existingSessions = Array.isArray(existingTracking.sessions) ? existingTracking.sessions : [];
  var nextSessions = [session].concat(existingSessions);
  var nextTotal = getTrackedSeconds(task) + session.durationSeconds;

  return Object.assign({}, task, {
    timeTracking: {
      totalSeconds: nextTotal,
      lastTrackedAt: session.endedAt,
      sessions: nextSessions.slice(0, 120),
    },
  });
}

function TasksPage() {
  var auth = useAuth();
  var user = auth.user;
  var toast = useToast();
  var timer = usePersistentTimer();

  var [tab, setTab] = useState('my');
  var [viewMode, setViewMode] = useState('list');
  var [tasks, setTasks] = useState([]);
  var [objectives, setObjectives] = useState([]);
  var [stats, setStats] = useState(null);
  var [loading, setLoading] = useState(true);
  var [savingTimer, setSavingTimer] = useState(false);
  var [workflowState, dispatchWorkflow] = useReducer(taskWorkflowReducer, INITIAL_WORKFLOW_STATE);

  useEffect(function () {
    loadData();
  }, [tab]);

  function normalizeObjectiveResponse(payload) {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.objectives)) return payload.objectives;
    if (Array.isArray(payload?.individualObjectives) || Array.isArray(payload?.teamObjectives)) {
      return [].concat(payload.individualObjectives || [], payload.teamObjectives || []);
    }
    return [];
  }

  async function fetchLinkableObjectives() {
    try {
      var responses = await Promise.allSettled([
        api.get('/objectives/my'),
        api.get('/objectives'),
      ]);

      var merged = [];
      responses.forEach(function (result) {
        if (result.status === 'fulfilled') {
          merged = merged.concat(normalizeObjectiveResponse(result.value.data));
        }
      });

      var currentUserId = String(user?._id || user?.id || '');
      var deduped = [];
      var seen = {};

      merged.forEach(function (objective) {
        if (!objective || !objective._id || seen[objective._id]) return;
        var ownerId = String(objective.owner?._id || objective.owner || '');
        if (ownerId !== currentUserId) return;
        seen[objective._id] = true;
        deduped.push(objective);
      });

      deduped.sort(function (left, right) {
        return String(left.title || '').localeCompare(String(right.title || ''));
      });

      setObjectives(deduped);
    } catch {
      setObjectives([]);
    }
  }

  function loadData() {
    setLoading(true);
    dispatchWorkflow({ type: 'CLEAR_LOAD_ERROR' });
    var url = tab === 'my' ? '/tasks/my' : tab === 'assigned' ? '/tasks/assigned' : '/tasks/all';
    Promise.all([
      api.get(url),
      api.get('/tasks/stats'),
      fetchLinkableObjectives(),
    ]).then(function (responses) {
      setTasks(responses[0].data.tasks || []);
      setStats(responses[1].data.stats || null);
    }).catch(function () {
      dispatchWorkflow({ type: 'SET_LOAD_ERROR', message: 'Tasks could not be loaded right now.' });
      toast.error('Failed to load tasks');
    }).finally(function () {
      setLoading(false);
    });
  }

  function closeForm() {
    dispatchWorkflow({ type: 'CLOSE_FORM' });
  }

  function buildTaskPayload() {
    return {
      title: workflowState.form.title,
      description: workflowState.form.description,
      priority: workflowState.form.priority,
      labels: workflowState.form.labels ? workflowState.form.labels.split(',').map(function (label) { return label.trim(); }).filter(Boolean) : [],
      linkedGoal: workflowState.form.linkedGoal || null,
      dueDate: workflowState.form.dueDate || null,
      notes: workflowState.form.notes || '',
      workflowStage: workflowState.form.workflowStage,
      status: getStatusForStage(workflowState.form.workflowStage),
      progress: Number(workflowState.form.progress || 0),
    };
  }

  function handleCreate() {
    if (!workflowState.form.title.trim()) return;

    api.post('/tasks', buildTaskPayload())
      .then(function () {
        closeForm();
        loadData();
        toast.success('Task created');
      })
      .catch(function (error) {
        toast.error(error.response?.data?.message || 'Error creating task');
      });
  }

  function handleEdit(task) {
    dispatchWorkflow({
      type: 'OPEN_EDIT_FORM',
      taskId: task._id,
      form: {
        title: task.title,
        description: task.description || '',
        priority: task.priority || 'medium',
        dueDate: task.dueDate ? task.dueDate.substring(0, 10) : '',
        labels: (task.labels || []).join(', '),
        linkedGoal: task.linkedGoal?._id || '',
        notes: task.notes || '',
        workflowStage: getWorkflowStage(task),
        progress: Number(task.progress || (task.status === 'done' ? 100 : 0)),
      },
    });
  }

  function handleUpdate() {
    if (!workflowState.form.title.trim() || !workflowState.editingTask) return;

    api.put('/tasks/' + workflowState.editingTask, buildTaskPayload())
      .then(function () {
        closeForm();
        loadData();
        toast.success('Task updated');
      })
      .catch(function (error) {
        toast.error(error.response?.data?.message || 'Error updating task');
      });
  }

  function handleStatusChange(id, status) {
    var workflowStage = status === 'done' ? 'completed' : status === 'in_progress' ? 'in_progress' : 'todo';
    setTasks(function (currentTasks) {
      var nextTasks = currentTasks.map(function (task) {
        return task._id === id ? Object.assign({}, task, { status: status, workflowStage: workflowStage, progress: status === 'done' ? 100 : task.progress }) : task;
      });
      setStats(buildLocalStats(nextTasks));
      return nextTasks;
    });

    api.put('/tasks/' + id, { status: status, workflowStage: workflowStage })
      .then(function () {
        if (status === 'done') toast.success('Task marked as done');
      })
      .catch(function () {
        toast.error('Failed to update task');
        loadData();
      });
  }

  function handleMoveTask(taskId, workflowStage) {
    var status = getStatusForStage(workflowStage);
    var nextProgress = workflowStage === 'completed' ? 100 : undefined;

    setTasks(function (currentTasks) {
      var nextTasks = currentTasks.map(function (task) {
        if (task._id !== taskId) return task;
        return Object.assign({}, task, {
          workflowStage: workflowStage,
          status: status,
          progress: workflowStage === 'completed' ? 100 : task.progress,
        });
      });
      setStats(buildLocalStats(nextTasks));
      return nextTasks;
    });

    api.put('/tasks/' + taskId, { workflowStage: workflowStage, status: status, progress: nextProgress })
      .catch(function () {
        toast.error('Could not move task');
        loadData();
      });
  }

  function handleDelete(id) {
    api.delete('/tasks/' + id)
      .then(function () {
        loadData();
        toast.success('Task deleted');
      })
      .catch(function () {
        toast.error('Failed to delete task');
      })
      .finally(function () {
        dispatchWorkflow({ type: 'CLEAR_DELETE' });
      });
  }

  function startTimerForTask(task, focusMode) {
    if (timer.timerState?.taskId && timer.timerState.taskId !== task._id) {
      toast.warning('Stop the active timer before starting another one');
      return;
    }

    if (timer.timerState?.taskId === task._id) {
      toast.info('This task is already being tracked');
      return;
    }

    timer.startTimer({
      taskId: task._id,
      taskTitle: task.title,
      linkedGoal: task?.linkedGoal?.title || '',
      taskSnapshot: task,
      focusMode: focusMode,
    });
    toast.success(focusMode ? 'Focus session started' : 'Timer started');
  }

  function stopAndPersistTimer() {
    var session = timer.stopTimer();
    if (!session) return;

    var trackedTask = tasks.find(function (task) { return task._id === session.taskId; }) || session.taskSnapshot;
    if (!trackedTask) {
      toast.error('Unable to locate task for this session');
      return;
    }

    var updatedTask = mergeSessionIntoTask(trackedTask, session);
    setSavingTimer(true);
    setTasks(function (currentTasks) {
      return currentTasks.map(function (task) {
        return task._id === session.taskId ? updatedTask : task;
      });
    });

    api.post('/tasks/' + session.taskId + '/time-entries', {
      startedAt: session.startedAt,
      endedAt: session.endedAt,
      durationSeconds: session.durationSeconds,
      focusMode: session.focusMode,
      source: session.source,
    }).then(function () {
      toast.success('Tracked ' + formatDuration(session.durationSeconds));
      loadData();
    }).catch(function (error) {
      toast.error(error.response?.data?.message || 'Failed to save tracked time');
      loadData();
    }).finally(function () {
      setSavingTimer(false);
    });
  }

  var tabs = [{ key: 'my', label: 'My Tasks' }, { key: 'assigned', label: 'Assigned by Me' }];
  if (user.role === 'ADMIN' || user.role === 'HR') tabs.push({ key: 'all', label: 'All Tasks' });

  var productivity = useMemo(function () {
    return buildProductivitySummary(tasks);
  }, [tasks]);

  var dailyProductivity = useMemo(function () {
    return buildDailyProductivity(tasks, 7);
  }, [tasks]);

  var timesheetEntries = useMemo(function () {
    return buildTimesheetEntries(tasks).slice(0, 10);
  }, [tasks]);

  var visibleTasks = useMemo(function () {
    return tasks.slice().sort(function (left, right) {
      var leftDue = left?.dueDate ? new Date(left.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
      var rightDue = right?.dueDate ? new Date(right.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
      return leftDue - rightDue;
    });
  }, [tasks]);

  return (
    <div className="page-container wm-page">
      <div className="page-header wm-page__header">
        <div className="page-header__left">
          <h1 className="page-title">Tasks Workspace</h1>
          <p className="page-subtitle">Track delivery, focus time, and execution flow in one place.</p>
        </div>
        <div className="wm-page__actions">
          <div className="wm-segmented">
            <button type="button" className={viewMode === 'list' ? 'is-active' : ''} onClick={function () { setViewMode('list'); }}>List</button>
            <button type="button" className={viewMode === 'kanban' ? 'is-active' : ''} onClick={function () { setViewMode('kanban'); }}>Kanban</button>
          </div>
          <button
            className="btn btn--primary"
            onClick={function () {
              dispatchWorkflow({ type: workflowState.showForm ? 'CLOSE_FORM' : 'OPEN_CREATE_FORM' });
            }}
          >
            {workflowState.showForm ? 'Cancel' : 'New Task'}
          </button>
        </div>
      </div>

      <div className="wm-stats-grid">
        <div className="wm-stat-card">
          <span>Total tracked</span>
          <strong>{formatDuration(productivity.totalSeconds)}</strong>
          <small>{productivity.activeDays} active days</small>
        </div>
        <div className="wm-stat-card">
          <span>Today</span>
          <strong>{formatDuration(productivity.todaySeconds)}</strong>
          <small>Across completed sessions</small>
        </div>
        <div className="wm-stat-card">
          <span>This week</span>
          <strong>{formatDuration(productivity.weekSeconds)}</strong>
          <small>{productivity.entries.length} logged sessions</small>
        </div>
        <div className="wm-stat-card">
          <span>Focus mode</span>
          <strong>{formatDuration(productivity.focusSeconds)}</strong>
          <small>{stats?.completionRate || 0}% task completion</small>
        </div>
      </div>

      {workflowState.loadError ? (
        <div className="wm-view-banner" role="alert">
          <div>
            <strong>Task data is temporarily unavailable</strong>
            <p>{workflowState.loadError}</p>
          </div>
          <button className="btn btn--secondary btn--sm" onClick={loadData}>Retry</button>
        </div>
      ) : null}

      {workflowState.showForm ? (
        <div className="form-card wm-form-card">
          <h3 className="form-card__title">{workflowState.editingTask ? 'Edit Task' : 'Create Task'}</h3>
          <div className="form-grid">
            <div className="form-group form-group--full">
              <label>Title *</label>
              <input className="form-input" value={workflowState.form.title} onChange={function (event) { dispatchWorkflow({ type: 'UPDATE_FORM_FIELD', field: 'title', value: event.target.value }); }} />
            </div>
            <div className="form-group form-group--full">
              <label>Description</label>
              <textarea className="form-textarea" rows={3} value={workflowState.form.description} onChange={function (event) { dispatchWorkflow({ type: 'UPDATE_FORM_FIELD', field: 'description', value: event.target.value }); }} />
            </div>
            <div className="form-group">
              <label>Priority</label>
              <select className="form-select" value={workflowState.form.priority} onChange={function (event) { dispatchWorkflow({ type: 'UPDATE_FORM_FIELD', field: 'priority', value: event.target.value }); }}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
            <div className="form-group">
              <label>Workflow stage</label>
              <select className="form-select" value={workflowState.form.workflowStage} onChange={function (event) { dispatchWorkflow({ type: 'UPDATE_FORM_FIELD', field: 'workflowStage', value: event.target.value }); }}>
                <option value="backlog">Backlog</option>
                <option value="todo">Todo</option>
                <option value="in_progress">In Progress</option>
                <option value="review">Review</option>
                <option value="completed">Completed</option>
              </select>
            </div>
            <div className="form-group">
              <label>Due date</label>
              <input type="date" className="form-input" value={workflowState.form.dueDate} onChange={function (event) { dispatchWorkflow({ type: 'UPDATE_FORM_FIELD', field: 'dueDate', value: event.target.value }); }} />
            </div>
            <div className="form-group">
              <label>Progress</label>
              <input type="range" min="0" max="100" step="5" value={workflowState.form.progress} onChange={function (event) { dispatchWorkflow({ type: 'UPDATE_FORM_FIELD', field: 'progress', value: event.target.value }); }} />
              <div className="wm-slider-value">{workflowState.form.progress}%</div>
            </div>
            <div className="form-group">
              <label>Linked goal</label>
              <select className="form-select" value={workflowState.form.linkedGoal} onChange={function (event) { dispatchWorkflow({ type: 'UPDATE_FORM_FIELD', field: 'linkedGoal', value: event.target.value }); }}>
                <option value="">No linked goal</option>
                {objectives.map(function (objective) {
                  return <option key={objective._id} value={objective._id}>{objective.title}</option>;
                })}
              </select>
            </div>
            <div className="form-group">
              <label>Labels</label>
              <input className="form-input" value={workflowState.form.labels} onChange={function (event) { dispatchWorkflow({ type: 'UPDATE_FORM_FIELD', field: 'labels', value: event.target.value }); }} />
            </div>
          </div>
          <div className="form-actions">
            <button className="btn btn--secondary" onClick={closeForm}>Cancel</button>
            <button className="btn btn--primary" onClick={workflowState.editingTask ? handleUpdate : handleCreate} disabled={!workflowState.form.title.trim()}>
              {workflowState.editingTask ? 'Save Changes' : 'Create Task'}
            </button>
          </div>
        </div>
      ) : null}

      <div className="tab-bar">
        {tabs.map(function (item) {
          return (
            <button key={item.key} className={'tab-btn' + (tab === item.key ? ' tab-btn--active' : '')} onClick={function () { setTab(item.key); }}>
              {item.label}
            </button>
          );
        })}
      </div>

      <div className="wm-view-banner">
        <div>
          <strong>{viewMode === 'kanban' ? 'Kanban board active' : 'List view active'}</strong>
          <p>
            {viewMode === 'kanban'
              ? 'Drag tasks between columns. Use the timer buttons inside each Kanban card.'
              : 'Use Start Timer or Focus Session on any task row to begin tracking time.'}
          </p>
        </div>
        <span className="wm-stage-pill">{viewMode === 'kanban' ? 'Board View' : 'List View'}</span>
      </div>

      <div className={'wm-layout' + (viewMode === 'kanban' ? ' wm-layout--kanban' : '')}>
        <section className="wm-main-panel">
          {loading ? (
            <LoadingSkeleton rows={5} height={88} />
          ) : visibleTasks.length === 0 ? (
            <div className="empty-state wm-empty-state">
              <div className="empty-state__icon">Tasks</div>
              <h3>No tasks in this view</h3>
              <p>Create a task to start tracking execution and focus time.</p>
              <button className="btn btn--primary" onClick={function () { dispatchWorkflow({ type: 'OPEN_CREATE_FORM' }); }}>Create Task</button>
            </div>
          ) : viewMode === 'kanban' ? (
            <Suspense fallback={<LoadingSkeleton rows={3} height={108} />}>
              <KanbanBoard
                tasks={visibleTasks}
                onMoveTask={handleMoveTask}
                activeTimerTaskId={timer.timerState?.taskId || ''}
                savingTimer={savingTimer}
                onStartTimer={startTimerForTask}
                onStopTimer={stopAndPersistTimer}
              />
            </Suspense>
          ) : (
            <div className="task-list wm-task-list">
              {visibleTasks.map(function (task) {
                var isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && !['done', 'cancelled'].includes(task.status);
                var trackedSeconds = getTrackedSeconds(task);
                var isActiveTimer = timer.timerState?.taskId === task._id;
                return (
                  <article key={task._id} className={'task-item wm-task-item' + (isOverdue ? ' task-item--overdue' : '')}>
                    <div className="task-item__left">
                      <span className="task-item__status-dot" style={{ background: statusColors[task.status] || '#6b7280' }} />
                      <div className="task-item__info">
                        <div className="wm-task-item__top">
                          <span className="task-item__title">{task.title}</span>
                          <span className="wm-stage-pill">{String(getWorkflowStage(task)).replace(/_/g, ' ')}</span>
                        </div>
                        {task.description ? <p className="task-item__desc">{task.description}</p> : null}
                        <div className="task-item__meta">
                          <span className="status-chip" style={{ background: priorityColors[task.priority] + '18', color: priorityColors[task.priority] }}>{task.priority}</span>
                          {task.assignee ? <span className="meta-tag">{task.assignee.name}</span> : null}
                          {task.dueDate ? <span className={'meta-tag' + (isOverdue ? ' meta-tag--danger' : '')}>{new Date(task.dueDate).toLocaleDateString()}</span> : null}
                          {task.linkedGoal ? <span className="meta-tag">{task.linkedGoal.title}</span> : null}
                          <span className="meta-tag">Tracked {formatDuration(trackedSeconds)}</span>
                          <span className="meta-tag">Progress {Number(task.progress || (task.status === 'done' ? 100 : 0))}%</span>
                        </div>
                      </div>
                    </div>

                    <div className="task-item__right wm-task-item__actions">
                      <div className="wm-task-item__timer">
                        {isActiveTimer ? (
                          <button className="btn btn--primary btn--sm" onClick={stopAndPersistTimer} disabled={savingTimer}>
                            {savingTimer ? 'Saving...' : 'Stop Timer'}
                          </button>
                        ) : (
                          <>
                            <button className="btn btn--secondary btn--sm" onClick={function () { startTimerForTask(task, false); }}>Start Timer</button>
                            <button className="btn btn--ghost btn--sm" onClick={function () { startTimerForTask(task, true); }}>Focus Session</button>
                          </>
                        )}
                      </div>
                      <select className="form-select form-select--sm" value={task.status} onChange={function (event) { handleStatusChange(task._id, event.target.value); }}>
                        {Object.entries(statusLabels).map(function (entry) {
                          return <option key={entry[0]} value={entry[0]}>{entry[1]}</option>;
                        })}
                      </select>
                      <button className="btn btn--ghost btn--sm" onClick={function () { handleEdit(task); }}>Edit</button>
                      <button className="btn btn--ghost btn--sm" style={{ color: '#ef4444' }} onClick={function () { dispatchWorkflow({ type: 'REQUEST_DELETE', taskId: task._id }); }}>Delete</button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <aside className="wm-side-panel">
          <div className="wm-panel-card">
            <div className="wm-panel-card__header">
              <div>
                <h3>Daily productivity</h3>
                <p>Last 7 days of tracked output.</p>
              </div>
            </div>
            <div className="wm-productivity-bars">
              {dailyProductivity.map(function (day) {
                var barHeight = productivity.weekSeconds > 0 ? Math.max(12, Math.round((day.trackedSeconds / Math.max.apply(null, dailyProductivity.map(function (entry) { return entry.trackedSeconds; }).concat([1]))) * 100)) : 12;
                return (
                  <div key={day.key} className="wm-productivity-bars__item">
                    <div className="wm-productivity-bars__bar-wrap">
                      <div className="wm-productivity-bars__bar" style={{ height: barHeight + '%' }}></div>
                    </div>
                    <strong>{formatDuration(day.trackedSeconds)}</strong>
                    <span>{day.label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="wm-panel-card">
            <div className="wm-panel-card__header">
              <div>
                <h3>Timesheet history</h3>
                <p>Recent tracked sessions across current tasks.</p>
              </div>
            </div>
            {timesheetEntries.length === 0 ? (
              <div className="wm-empty-inline">No tracked sessions yet.</div>
            ) : (
              <div className="wm-timesheet-list">
                {timesheetEntries.map(function (entry) {
                  return (
                    <div key={entry.id} className="wm-timesheet-row">
                      <div>
                        <strong>{entry.taskTitle}</strong>
                        <span>{new Date(entry.endedAt).toLocaleString()}</span>
                      </div>
                      <div className="wm-timesheet-row__meta">
                        {entry.focusMode ? <span className="wm-stage-pill">Focus</span> : null}
                        <strong>{formatDuration(entry.durationSeconds)}</strong>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {stats ? (
            <div className="wm-panel-card">
              <div className="wm-panel-card__header">
                <div>
                  <h3>Execution snapshot</h3>
                  <p>Current task health in this workspace.</p>
                </div>
              </div>
              <div className="wm-mini-stats">
                <div><span>Total</span><strong>{stats.total}</strong></div>
                <div><span>To do</span><strong>{stats.todo}</strong></div>
                <div><span>In progress</span><strong>{stats.inProgress}</strong></div>
                <div><span>Done</span><strong>{stats.done}</strong></div>
                <div><span>Overdue</span><strong>{stats.overdue}</strong></div>
                <div><span>Completion</span><strong>{stats.completionRate}%</strong></div>
              </div>
            </div>
          ) : null}
        </aside>
      </div>

      <Suspense fallback={null}>
        <ProductivityTimerWidget
          timerState={timer.timerState}
          elapsedSeconds={timer.elapsedSeconds}
          onPause={timer.pauseTimer}
          onResume={timer.resumeTimer}
          onStop={stopAndPersistTimer}
        />
      </Suspense>

      <ConfirmDialog
        open={!!workflowState.confirmDelete}
        title="Delete task?"
        message="This action cannot be undone."
        confirmLabel="Delete"
        danger={true}
        onConfirm={function () { handleDelete(workflowState.confirmDelete); }}
        onCancel={function () { dispatchWorkflow({ type: 'CLEAR_DELETE' }); }}
      />

      <ToastContainer toasts={toast.toasts} removeToast={toast.removeToast} />
    </div>
  );
}

export default TasksPage;
