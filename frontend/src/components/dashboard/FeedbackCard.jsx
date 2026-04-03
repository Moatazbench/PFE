import React, { useState, useEffect } from 'react';
import { useAuth } from '../AuthContext';
import api from '../../services/api';
import { useToast } from '../common/Toast';

function FeedbackCard() {
    var { user } = useAuth();
    var [feedbacks, setFeedbacks] = useState([]);
    var [loading, setLoading] = useState(true);
    var [showForm, setShowForm] = useState(false);
    var [users, setUsers] = useState([]);
    var [form, setForm] = useState({ recipientId: '', type: 'praise', message: '' });
    var toast = useToast();

    var types = [
        { key: 'praise', label: '👏 Praise', color: '#059669' },
        { key: 'suggestion', label: '💡 Suggestion', color: '#d97706' },
        { key: 'concern', label: '⚠️ Concern', color: '#dc2626' },
    ];

    useEffect(function () {
        fetchFeedbacks();
    }, []);

    async function fetchFeedbacks() {
        setLoading(true);
        try {
            var res = await api.get('/api/feedback/received');
            setFeedbacks((res.data.feedbacks || []).slice(0, 5));
        } catch (err) {
            console.error('Error fetching feedbacks', err);
        } finally {
            setLoading(false);
        }
    }

    useEffect(function() {
        if (showForm && users.length === 0) {
            api.get('/api/users/filter/list').then(res => setUsers(res.data.users || [])).catch(console.error);
        }
    }, [showForm, users.length]);

    async function handleSend() {
        if (!form.recipientId || !form.message.trim()) return;

        try {
            await api.post('/api/feedback', {
                recipientId: form.recipientId,
                type: form.type,
                message: form.message,
                visibility: 'private'
            });
            toast.success('Feedback sent securely');
            setForm({ recipientId: '', type: 'praise', message: '' });
            setShowForm(false);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to send feedback');
        }
    }

    function getTypeInfo(type) {
        return types.find(function (t) { return t.key === type; }) || types[0];
    }

    return (
        <div className="dash-card dash-card--feedback">
            <div className="dash-card__header">
                <span className="dash-card__icon">💬</span>
                <h3>Recent Feedback</h3>
                <button
                    onClick={function () { setShowForm(!showForm); }}
                    style={{ marginLeft: 'auto', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', padding: '4px 12px', cursor: 'pointer', fontSize: '0.8rem' }}
                >
                    {showForm ? 'Cancel' : '+ Give'}
                </button>
            </div>
            <div className="dash-card__body">
                {showForm && (
                    <div style={{ marginBottom: '12px', padding: '12px', background: '#f0f9ff', borderRadius: '8px' }}>
                        <select
                            className="form-control"
                            value={form.recipientId}
                            onChange={function(e) { setForm({...form, recipientId: e.target.value}); }}
                            style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '6px', marginBottom: '8px', display: 'block' }}
                        >
                            <option value="">Select Colleague...</option>
                            {users.map(function(u) {
                                if(u._id === user._id) return null;
                                return <option key={u._id} value={u._id}>{u.name} ({u.role})</option>;
                            })}
                        </select>
                        <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
                            {types.map(function (t) {
                                return (
                                    <button
                                        key={t.key}
                                        onClick={function () { setForm(Object.assign({}, form, { type: t.key })); }}
                                        style={{
                                            flex: 1, padding: '6px',
                                            border: form.type === t.key ? '2px solid ' + t.color : '1px solid #ddd',
                                            borderRadius: '6px',
                                            background: form.type === t.key ? t.color + '15' : 'white',
                                            cursor: 'pointer', fontSize: '0.8rem'
                                        }}
                                    >
                                        {t.label}
                                    </button>
                                );
                            })}
                        </div>
                        <textarea
                            placeholder="Write your feedback..."
                            value={form.message}
                            onChange={function (e) { setForm(Object.assign({}, form, { message: e.target.value })); }}
                            rows={2}
                            style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '6px', marginBottom: '8px', resize: 'none', boxSizing: 'border-box' }}
                        />
                        <button
                            onClick={handleSend}
                            disabled={!form.recipientId || !form.message.trim()}
                            style={{ width: '100%', padding: '8px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
                        >
                            Send Feedback
                        </button>
                    </div>
                )}

                {loading ? (
                    <p className="dash-card__loading">Loading...</p>
                ) : feedbacks.length === 0 ? (
                    <div className="dash-card__empty-state">
                        <div className="dash-card__empty-icon">💬</div>
                        <p>No new feedback received</p>
                        <span className="dash-card__empty-hint">Request feedback from your peers</span>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {feedbacks.map(function (fb) {
                            var info = getTypeInfo(fb.type);
                            return (
                                <div key={fb._id} style={{ padding: '8px', background: '#f8fafc', borderRadius: '6px', borderLeft: '3px solid ' + info.color }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                                        <span><strong>{fb.sender?.name || 'Anonymous'}</strong> → <strong>You</strong></span>
                                        <span style={{ color: info.color, fontWeight: 600 }}>{info.label}</span>
                                    </div>
                                    <p style={{ fontSize: '0.8rem', color: '#4b5563', margin: '4px 0 2px' }}>{fb.message}</p>
                                    <small style={{ color: '#9ca3af' }}>{new Date(fb.createdAt).toLocaleDateString()}</small>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}

export default FeedbackCard;
