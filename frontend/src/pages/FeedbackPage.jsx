import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../components/AuthContext';
import { useToast } from '../components/common/Toast';
import ConfirmDialog from '../components/common/ConfirmDialog';
import LoadingSkeleton from '../components/common/LoadingSkeleton';

function FeedbackPage() {
  var { user } = useAuth();
  var toast = useToast();
  var [tab, setTab] = useState('received');
  var [feedbacks, setFeedbacks] = useState([]);
  var [loading, setLoading] = useState(true);
  var [showForm, setShowForm] = useState(false);
  var [formMode, setFormMode] = useState('send'); // 'send' | 'request'
  var [users, setUsers] = useState([]);
  var [confirmDelete, setConfirmDelete] = useState(null);
  var [form, setForm] = useState({ recipientId: '', type: 'praise', message: '', anonymous: false, visibility: 'private', rating: null });
  var [requestForm, setRequestForm] = useState({ fromUserId: '', message: '' });
  var [sending, setSending] = useState(false);

  var types = [
    { key: 'praise', label: '👏 Praise', color: '#059669' },
    { key: 'suggestion', label: '💡 Suggestion', color: '#d97706' },
    { key: 'concern', label: '⚠️ Concern', color: '#dc2626' },
    { key: 'peer', label: '🤝 Peer', color: '#3b82f6' },
    { key: 'manager', label: '👔 Manager', color: '#6366f1' },
  ];

  useEffect(function () { loadData(); }, [tab]);

  function loadData() {
    setLoading(true);
    var url = tab === 'received' ? '/api/feedback/received' : tab === 'sent' ? '/api/feedback/sent' : '/api/feedback/all';
    Promise.all([
      api.get(url),
      api.get('/api/users/filter/list'),
    ]).then(function (res) {
      setFeedbacks(res[0].data.feedbacks || []);
      setUsers(Array.isArray(res[1].data) ? res[1].data : (res[1].data.users || []));
    }).catch(function () {
      toast.error('Failed to load feedback');
    }).finally(function () { setLoading(false); });
  }

  function handleSend() {
    if (!form.recipientId || !form.message.trim()) return;
    setSending(true);
    api.post('/api/feedback', form)
      .then(function () { setShowForm(false); setForm({ recipientId: '', type: 'praise', message: '', anonymous: false, visibility: 'private', rating: null }); loadData(); toast.success('Feedback sent!'); })
      .catch(function (e) { toast.error(e.response?.data?.message || 'Error sending feedback'); })
      .finally(function () { setSending(false); });
  }

  function handleRequest() {
    if (!requestForm.fromUserId) return;
    setSending(true);
    api.post('/api/feedback/request', requestForm)
      .then(function () { setShowForm(false); setRequestForm({ fromUserId: '', message: '' }); toast.success('Feedback request sent!'); })
      .catch(function (e) { toast.error(e.response?.data?.message || 'Error sending request'); })
      .finally(function () { setSending(false); });
  }

  function handleDelete(id) {
    api.delete('/api/feedback/' + id)
      .then(function () { loadData(); toast.success('Feedback deleted'); })
      .catch(function () { toast.error('Failed to delete feedback'); });
    setConfirmDelete(null);
  }

  function getTypeInfo(type) { return types.find(function (t) { return t.key === type; }) || { label: type, color: '#6b7280' }; }

  var tabs = [{ key: 'received', label: 'Received' }, { key: 'sent', label: 'Sent' }];
  if (user.role === 'ADMIN' || user.role === 'HR') tabs.push({ key: 'all', label: 'All Feedback' });

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="page-header__left">
          <h1 className="page-title">💬 Feedback</h1>
          <p className="page-subtitle">Send and receive continuous feedback</p>
        </div>
        <div className="page-header__actions">
          <button className="btn btn--secondary" onClick={function () { setFormMode('request'); setShowForm(!showForm || formMode !== 'request'); }}>
            {showForm && formMode === 'request' ? 'Cancel' : '📩 Request Feedback'}
          </button>
          <button className="btn btn--primary" onClick={function () { setFormMode('send'); setShowForm(!showForm || formMode !== 'send'); }}>
            {showForm && formMode === 'send' ? 'Cancel' : '+ Send Feedback'}
          </button>
        </div>
      </div>

      {showForm && formMode === 'send' && (
        <div className="form-card">
          <h3 className="form-card__title">Send Feedback</h3>
          <div className="form-grid">
            <div className="form-group">
              <label>Recipient</label>
              <select className="form-select" value={form.recipientId} onChange={function (e) { setForm(Object.assign({}, form, { recipientId: e.target.value })); }}>
                <option value="">Select person...</option>
                {users.filter(function (u) { return u._id !== user.id && u._id !== user._id; }).map(function (u) { return <option key={u._id} value={u._id}>{u.name} ({u.role})</option>; })}
              </select>
            </div>
            <div className="form-group">
              <label>Type</label>
              <div className="chip-group">
                {types.map(function (t) {
                  return <button key={t.key} className={'chip' + (form.type === t.key ? ' chip--active' : '')} style={form.type === t.key ? { background: t.color + '20', borderColor: t.color, color: t.color } : {}} onClick={function () { setForm(Object.assign({}, form, { type: t.key })); }}>{t.label}</button>;
                })}
              </div>
            </div>
            <div className="form-group form-group--full">
              <label>Message</label>
              <textarea className="form-textarea" rows={3} placeholder="Write your feedback..." value={form.message} onChange={function (e) { setForm(Object.assign({}, form, { message: e.target.value })); }} />
            </div>
            <div className="form-group">
              <label className="form-checkbox-label">
                <input type="checkbox" checked={form.anonymous} onChange={function (e) { setForm(Object.assign({}, form, { anonymous: e.target.checked })); }} />
                Send anonymously
              </label>
            </div>
            <div className="form-group">
              <label>Visibility</label>
              <select className="form-select" value={form.visibility} onChange={function (e) { setForm(Object.assign({}, form, { visibility: e.target.value })); }}>
                <option value="private">Private (recipient only)</option>
                <option value="public">Public</option>
                <option value="manager_only">Manager Only</option>
              </select>
            </div>
          </div>
          <div className="form-actions">
            <button className="btn btn--secondary" onClick={function () { setShowForm(false); }}>Cancel</button>
            <button className="btn btn--primary" onClick={handleSend} disabled={sending || !form.recipientId || !form.message.trim()}>{sending ? 'Sending...' : 'Send Feedback'}</button>
          </div>
        </div>
      )}

      {showForm && formMode === 'request' && (
        <div className="form-card">
          <h3 className="form-card__title">📩 Request Feedback</h3>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1rem', fontSize: '0.9rem' }}>Ask a colleague to give you feedback</p>
          <div className="form-grid">
            <div className="form-group">
              <label>Request feedback from</label>
              <select className="form-select" value={requestForm.fromUserId} onChange={function (e) { setRequestForm(Object.assign({}, requestForm, { fromUserId: e.target.value })); }}>
                <option value="">Select person...</option>
                {users.filter(function (u) { return u._id !== user.id && u._id !== user._id; }).map(function (u) { return <option key={u._id} value={u._id}>{u.name} ({u.role})</option>; })}
              </select>
            </div>
            <div className="form-group form-group--full">
              <label>Message (optional)</label>
              <textarea className="form-textarea" rows={2} placeholder="What would you like feedback on?" value={requestForm.message} onChange={function (e) { setRequestForm(Object.assign({}, requestForm, { message: e.target.value })); }} />
            </div>
          </div>
          <div className="form-actions">
            <button className="btn btn--secondary" onClick={function () { setShowForm(false); }}>Cancel</button>
            <button className="btn btn--primary" onClick={handleRequest} disabled={sending || !requestForm.fromUserId}>{sending ? 'Sending...' : 'Send Request'}</button>
          </div>
        </div>
      )}

      <div className="tab-bar">
        {tabs.map(function (t) { return <button key={t.key} className={'tab-btn' + (tab === t.key ? ' tab-btn--active' : '')} onClick={function () { setTab(t.key); }}>{t.label}</button>; })}
      </div>

      {loading ? (
        <LoadingSkeleton rows={4} height={90} />
      ) : feedbacks.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state__icon">💬</div>
          <h3>No feedback {tab === 'received' ? 'received' : tab === 'sent' ? 'sent' : ''} yet</h3>
          <p>{tab === 'received' ? 'Request feedback from a colleague to get started.' : 'Send your first piece of feedback.'}</p>
        </div>
      ) : (
        <div className="feedback-list">
          {feedbacks.map(function (fb) {
            var info = getTypeInfo(fb.type);
            return (
              <div key={fb._id} className="feedback-item">
                <div className="feedback-item__header">
                  <div className="feedback-item__people">
                    <span className="feedback-item__sender">{fb.anonymous && tab === 'received' ? 'Anonymous' : (fb.sender?.name || 'Unknown')}</span>
                    <span className="feedback-item__arrow">→</span>
                    <span className="feedback-item__recipient">{fb.recipient?.name || 'Unknown'}</span>
                  </div>
                  <div className="feedback-item__meta">
                    <span className="status-chip" style={{ background: info.color + '18', color: info.color }}>{info.label}</span>
                    {fb.isRequested && <span className="meta-tag">📩 Requested</span>}
                    <span className="feedback-item__date">{new Date(fb.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
                <p className="feedback-item__message">{fb.message}</p>
                {fb.rating && <div className="feedback-item__rating">{'⭐'.repeat(fb.rating)} <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{fb.rating}/5</span></div>}
                <div className="feedback-item__actions">
                  {fb.visibility && <span className="meta-tag">{fb.visibility}</span>}
                  {(tab === 'sent' || user.role === 'ADMIN') && <button className="btn btn--ghost btn--sm" style={{ color: '#ef4444' }} onClick={function () { setConfirmDelete(fb._id); }}>Delete</button>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        title="Delete Feedback?"
        message="This feedback will be permanently removed."
        confirmLabel="Delete"
        danger={true}
        onConfirm={function () { handleDelete(confirmDelete); }}
        onCancel={function () { setConfirmDelete(null); }}
      />
    </div>
  );
}

export default FeedbackPage;
