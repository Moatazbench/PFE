import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../components/AuthContext';
import { useToast } from '../components/common/Toast';
import ConfirmDialog from '../components/common/ConfirmDialog';
import LoadingSkeleton from '../components/common/LoadingSkeleton';

var priorityColors = { low: '#6b7280', medium: '#3b82f6', high: '#f59e0b', urgent: '#ef4444' };
var statusLabels = { todo: 'To Do', in_progress: 'In Progress', done: 'Done', cancelled: 'Cancelled' };
var statusColors = { todo: '#6b7280', in_progress: '#3b82f6', done: '#10b981', cancelled: '#ef4444' };

function TasksPage() {
  var { user } = useAuth();
  var toast = useToast();
  var [tab, setTab] = useState('my');
  var [tasks, setTasks] = useState([]);
  var [objectives, setObjectives] = useState([]);
  var [stats, setStats] = useState(null);
  var [loading, setLoading] = useState(true);
  var [showForm, setShowForm] = useState(false);
  var [editingTask, setEditingTask] = useState(null);
  var [confirmDelete, setConfirmDelete] = useState(null);
  var [form, setForm] = useState({ title: '', description: '', priority: 'medium', dueDate: '', labels: '', linkedGoal: '', notes: '' });
  var [sending, setSending] = useState(false);

  var hasFetchedRef = React.useRef(false);

  useEffect(function () {
    hasFetchedRef.current = false;
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

      deduped.sort(function (a, b) {
        return String(a.title || '').localeCompare(String(b.title || ''));
      });

      setObjectives(deduped);
    } catch (err) {
      setObjectives([]);
    }
  }

  function loadData() {
    // Only show loading for initial load to prevent flickering
    if (!hasFetchedRef.current) setLoading(true);
    var url = tab === 'my' ? '/tasks/my' : tab === 'assigned' ? '/tasks/assigned' : '/tasks/all';
    Promise.all([
      api.get(url),
      api.get('/tasks/stats'),
    ]).then(function (res) {
      setTasks(res[0].data.tasks || []);
      setStats(res[1].data.stats || null);
      hasFetchedRef.current = true;
    }).catch(function (err) {
      toast.error('Failed to load tasks');
    }).finally(function () {
      setLoading(false);
      fetchLinkableObjectives();
    });
  }

  function handleCreate() {
    if (!form.title.trim()) return;
    setSending(true);
    var data = Object.assign({}, form, { 
        labels: form.labels ? form.labels.split(',').map(function (l) { return l.trim(); }) : [],
        linkedGoal: form.linkedGoal || null,
        dueDate: form.dueDate || null 
    });
    api.post('/tasks', data)
      .then(function (res) { 
        setShowForm(false); 
        resetForm(); 
        setTimeout(loadData, 500); 
        toast.success('Task created!'); 
      })
      .catch(function (e) { toast.error(e.response?.data?.message || 'Error creating task'); })
      .finally(function () { setSending(false); });
  }

  function handleEdit(task) {
    setEditingTask(task._id);
    setForm({
      title: task.title,
      description: task.description || '',
      priority: task.priority || 'medium',
      dueDate: task.dueDate ? task.dueDate.substring(0, 10) : '',
      labels: (task.labels || []).join(', '),
      linkedGoal: task.linkedGoal?._id || '',
      notes: task.notes || '',
    });
    setShowForm(true);
  }

  function handleUpdate() {
    if (!form.title.trim()) return;
    setSending(true);
    var data = Object.assign({}, form, { 
        labels: form.labels ? form.labels.split(',').map(function (l) { return l.trim(); }) : [],
        linkedGoal: form.linkedGoal || null,
        dueDate: form.dueDate || null
    });
    api.put('/tasks/' + editingTask, data)
      .then(function () { 
        setShowForm(false); 
        setEditingTask(null); 
        resetForm(); 
        setTimeout(loadData, 500); 
        toast.success('Task updated!'); 
      })
      .catch(function (e) { toast.error(e.response?.data?.message || 'Error updating task'); })
      .finally(function () { setSending(false); });
  }

  function handleStatusChange(id, status) {
    api.put('/tasks/' + id, { status: status })
      .then(function () { loadData(); if (status === 'done') toast.success('Task marked as done! 🎉'); })
      .catch(function () { toast.error('Failed to update status'); });
  }

  function handleDelete(id) {
    api.delete('/tasks/' + id)
      .then(function () { loadData(); toast.success('Task deleted'); })
      .catch(function () { toast.error('Failed to delete task'); });
    setConfirmDelete(null);
  }

  function resetForm() {
    setEditingTask(null);
    setForm({ title: '', description: '', priority: 'medium', dueDate: '', labels: '', linkedGoal: '', notes: '' });
  }

  function cancelForm() {
    setShowForm(false);
    resetForm();
  }

  var tabs = [{ key: 'my', label: 'My Tasks' }, { key: 'assigned', label: 'Assigned by Me' }];
  if (user.role === 'ADMIN' || user.role === 'HR') tabs.push({ key: 'all', label: 'All Tasks' });

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="page-header__left">
          <h1 className="page-title">✅ Tasks</h1>
          <p className="page-subtitle">Manage and track your tasks</p>
        </div>
        <button className="btn btn--primary" onClick={function () { setShowForm(!showForm); if (showForm) resetForm(); }}>
          {showForm ? 'Cancel' : '+ New Task'}
        </button>
      </div>

      {stats && (
        <div className="stats-row">
          <div className="mini-stat"><span className="mini-stat__value">{stats.total}</span><span className="mini-stat__label">Total</span></div>
          <div className="mini-stat"><span className="mini-stat__value" style={{ color: '#6b7280' }}>{stats.todo}</span><span className="mini-stat__label">To Do</span></div>
          <div className="mini-stat"><span className="mini-stat__value" style={{ color: '#3b82f6' }}>{stats.inProgress}</span><span className="mini-stat__label">In Progress</span></div>
          <div className="mini-stat"><span className="mini-stat__value" style={{ color: '#10b981' }}>{stats.done}</span><span className="mini-stat__label">Done</span></div>
          <div className="mini-stat"><span className="mini-stat__value" style={{ color: '#ef4444' }}>{stats.overdue}</span><span className="mini-stat__label">Overdue</span></div>
          <div className="mini-stat"><span className="mini-stat__value">{stats.completionRate}%</span><span className="mini-stat__label">Completion</span></div>
        </div>
      )}

      {showForm && (
        <div className="form-card">
          <h3 className="form-card__title">{editingTask ? 'Edit Task' : 'Create Task'}</h3>
          <div className="form-grid">
            <div className="form-group form-group--full">
              <label>Title *</label>
              <input className="form-input" placeholder="Task title..." value={form.title} onChange={function (e) { setForm(Object.assign({}, form, { title: e.target.value })); }} />
            </div>
            <div className="form-group form-group--full">
              <label>Description</label>
              <textarea className="form-textarea" rows={2} placeholder="Description..." value={form.description} onChange={function (e) { setForm(Object.assign({}, form, { description: e.target.value })); }} />
            </div>
            <div className="form-group">
              <label>Priority</label>
              <select className="form-select" value={form.priority} onChange={function (e) { setForm(Object.assign({}, form, { priority: e.target.value })); }}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
            <div className="form-group">
              <label>Due Date</label>
              <input type="date" className="form-input" value={form.dueDate} onChange={function (e) { setForm(Object.assign({}, form, { dueDate: e.target.value })); }} />
            </div>
            <div className="form-group">
              <label>Linked Goal</label>
              <select className="form-select" value={form.linkedGoal} onChange={function (e) { setForm(Object.assign({}, form, { linkedGoal: e.target.value })); }}>
                <option value="">No linked goal</option>
                {objectives.map(function (o) {
                  var cycleName = o.cycle?.name ? ' - ' + o.cycle.name : '';
                  return <option key={o._id} value={o._id}>{o.title + cycleName}</option>;
                })}
              </select>
              {objectives.length === 0 && (
                <div style={{ marginTop: '0.4rem', fontSize: '0.82rem', color: '#b45309' }}>
                  No goals loaded yet. Reopen the form or refresh if you recently created goals.
                </div>
              )}
            </div>
            <div className="form-group">
              <label>Labels (comma-separated)</label>
              <input className="form-input" placeholder="e.g. urgent, review" value={form.labels} onChange={function (e) { setForm(Object.assign({}, form, { labels: e.target.value })); }} />
            </div>
          </div>
          <div className="form-actions">
            <button className="btn btn--secondary" onClick={cancelForm}>Cancel</button>
            <button className="btn btn--primary" onClick={editingTask ? handleUpdate : handleCreate} disabled={sending || !form.title.trim()}>
              {sending ? (editingTask ? 'Saving...' : 'Creating...') : (editingTask ? 'Save Changes' : 'Create Task')}
            </button>
          </div>
        </div>
      )}

      <div className="tab-bar">
        {tabs.map(function (t) { return <button key={t.key} className={'tab-btn' + (tab === t.key ? ' tab-btn--active' : '')} onClick={function () { setTab(t.key); }}>{t.label}</button>; })}
      </div>

      {loading ? (
        <LoadingSkeleton rows={4} height={80} />
      ) : tasks.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state__icon">✅</div>
          <h3>No tasks yet</h3>
          <p>{tab === 'my' ? "You're all caught up!" : 'No tasks found.'}</p>
          <button className="btn btn--primary" onClick={function () { setShowForm(true); }}>+ Create Task</button>
        </div>
      ) : (
        <div className="task-list">
          {tasks.map(function (t) {
            var isOverdue = t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'done' && t.status !== 'cancelled';
            return (
              <div key={t._id} className={'task-item' + (isOverdue ? ' task-item--overdue' : '')}>
                <div className="task-item__left">
                  <span className="task-item__status-dot" style={{ background: statusColors[t.status] }} />
                  <div className="task-item__info">
                    <span className="task-item__title">{t.title}</span>
                    {t.description && <p className="task-item__desc">{t.description}</p>}
                    <div className="task-item__meta">
                      <span className="status-chip" style={{ background: priorityColors[t.priority] + '18', color: priorityColors[t.priority] }}>{t.priority}</span>
                      {t.assignee && <span className="meta-tag">👤 {t.assignee.name}</span>}
                      {t.dueDate && <span className={'meta-tag' + (isOverdue ? ' meta-tag--danger' : '')}>{isOverdue ? '⚠️' : '📅'} {new Date(t.dueDate).toLocaleDateString()}</span>}
                      {t.linkedGoal && <span className="meta-tag">🎯 {t.linkedGoal.title || 'Goal'}</span>}
                      {(t.labels || []).map(function (l) { return <span key={l} className="meta-tag">{l}</span>; })}
                    </div>
                  </div>
                </div>
                <div className="task-item__right">
                  <select className="form-select form-select--sm" value={t.status} onChange={function (e) { handleStatusChange(t._id, e.target.value); }}>
                    {Object.entries(statusLabels).map(function (entry) { return <option key={entry[0]} value={entry[0]}>{entry[1]}</option>; })}
                  </select>
                  <button className="btn btn--ghost btn--sm" onClick={function () { handleEdit(t); }}>✏️</button>
                  <button className="btn btn--ghost btn--sm" style={{ color: '#ef4444' }} onClick={function () { setConfirmDelete(t._id); }}>🗑️</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        title="Delete Task?"
        message="This action cannot be undone."
        confirmLabel="Delete"
        danger={true}
        onConfirm={function () { handleDelete(confirmDelete); }}
        onCancel={function () { setConfirmDelete(null); }}
      />
    </div>
  );
}

export default TasksPage;
