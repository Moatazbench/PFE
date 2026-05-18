import React, { useEffect, useState } from 'react';
import { useAuth } from '../AuthContext';
import api from '../../services/api';
import { useToast } from '../common/Toast';
import LoadingSkeleton from '../common/LoadingSkeleton';

function FeedbackCard({ feedbacks, loading, error }) {
  var auth = useAuth();
  var user = auth.user;
  var toast = useToast();
  var [showForm, setShowForm] = useState(false);
  var [users, setUsers] = useState([]);
  var [form, setForm] = useState({ recipientId: '', type: 'praise', message: '' });

  var types = [
    { key: 'praise', label: 'Praise', color: '#059669' },
    { key: 'suggestion', label: 'Suggestion', color: '#d97706' },
    { key: 'concern', label: 'Concern', color: '#dc2626' },
  ];

  useEffect(function () {
    if (!showForm || users.length > 0) return;

    api.get('/users/filter/list')
      .then(function (response) {
        setUsers(response?.data?.users || []);
      })
      .catch(function (fetchError) {
        console.error(fetchError);
      });
  }, [showForm, users.length]);

  async function handleSend() {
    if (!form.recipientId || !form.message.trim()) return;

    try {
      await api.post('/feedback', {
        recipientId: form.recipientId,
        type: form.type,
        message: form.message,
        visibility: 'private',
      });
      toast.success('Feedback sent securely');
      setForm({ recipientId: '', type: 'praise', message: '' });
      setShowForm(false);
    } catch (requestError) {
      toast.error(requestError.response?.data?.message || 'Failed to send feedback');
    }
  }

  function getTypeInfo(type) {
    return types.find(function (entry) {
      return entry.key === type;
    }) || types[0];
  }

  return (
    <div className="dash-card dash-card--feedback">
      <div className="dash-card__header">
        <div>
          <h3>Feedback</h3>
          <p className="dash-card__subtitle">Recent received feedback and quick private sharing</p>
        </div>
        <button
          className="dash-card__action"
          onClick={function () { setShowForm(!showForm); }}
          type="button"
        >
          {showForm ? 'Close' : 'Give feedback'}
        </button>
      </div>

      <div className="dash-card__body">
        {showForm && (
          <div className="dash-feedback-form">
            <select
              className="dash-feedback-form__field"
              value={form.recipientId}
              onChange={function (event) {
                setForm(Object.assign({}, form, { recipientId: event.target.value }));
              }}
            >
              <option value="">Select teammate</option>
              {users.map(function (entry) {
                if (String(entry._id) === String(user?._id || user?.id)) return null;
                return (
                  <option key={entry._id} value={entry._id}>
                    {entry.name} ({entry.role})
                  </option>
                );
              })}
            </select>

            <div className="dash-feedback-form__types">
              {types.map(function (type) {
                return (
                  <button
                    key={type.key}
                    type="button"
                    className={'dash-feedback-form__type' + (form.type === type.key ? ' dash-feedback-form__type--active' : '')}
                    onClick={function () {
                      setForm(Object.assign({}, form, { type: type.key }));
                    }}
                    style={{
                      '--dash-feedback-accent': type.color,
                    }}
                  >
                    {type.label}
                  </button>
                );
              })}
            </div>

            <textarea
              className="dash-feedback-form__field dash-feedback-form__textarea"
              value={form.message}
              rows={3}
              placeholder="Share concise, constructive feedback"
              onChange={function (event) {
                setForm(Object.assign({}, form, { message: event.target.value }));
              }}
            ></textarea>

            <button
              className="dash-feedback-form__submit"
              type="button"
              disabled={!form.recipientId || !form.message.trim()}
              onClick={handleSend}
            >
              Send feedback
            </button>
          </div>
        )}

        {loading ? (
          <LoadingSkeleton rows={3} height={64} />
        ) : error ? (
          <div className="dash-card__empty-state">
            <p>Feedback could not be loaded.</p>
            <span className="dash-card__empty-hint">{error}</span>
          </div>
        ) : (feedbacks || []).length === 0 ? (
          <div className="dash-card__empty-state">
            <p>No recent feedback received.</p>
            <span className="dash-card__empty-hint">New peer and manager feedback will appear here.</span>
          </div>
        ) : (
          <div className="dash-feedback-list">
            {(feedbacks || []).slice(0, 4).map(function (feedback) {
              var typeInfo = getTypeInfo(feedback.type);
              return (
                <div
                  key={feedback._id}
                  className="dash-feedback-row"
                  style={{ borderLeftColor: typeInfo.color }}
                >
                  <div className="dash-feedback-row__top">
                    <span>{feedback?.sender?.name || 'Anonymous'}</span>
                    <strong style={{ color: typeInfo.color }}>{typeInfo.label}</strong>
                  </div>
                  <p>{feedback.message}</p>
                  <span className="dash-feedback-row__date">
                    {new Date(feedback.createdAt).toLocaleDateString()}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default React.memo(FeedbackCard);
