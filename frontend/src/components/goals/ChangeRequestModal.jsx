import React, { useState } from 'react';
import api from '../../services/api';
import { useToast } from '../common/Toast';

var requestTypes = [
    { value: 'due_date_extension', label: 'Due Date Extension', icon: '📅' },
    { value: 'scope_change', label: 'Scope / Description Change', icon: '📝' },
    { value: 'pause', label: 'Pause / On Hold', icon: '⏸️' },
    { value: 'cancellation', label: 'Request Cancellation', icon: '⊘' },
];

function ChangeRequestModal({ goal, onClose, onRequested }) {
    var toast = useToast();
    var [requestType, setRequestType] = useState('');
    var [reason, setReason] = useState('');
    var [newDeadline, setNewDeadline] = useState('');
    var [newTitle, setNewTitle] = useState(goal.title || '');
    var [newDescription, setNewDescription] = useState(goal.description || '');
    var [loading, setLoading] = useState(false);

    async function handleSubmit(e) {
        e.preventDefault();
        if (!requestType || !reason.trim()) { toast.error('Please fill in all required fields.'); return; }
        setLoading(true);
        try {
            await api.post('/api/objectives/' + goal._id + '/change-requests', {
                requestType, reason,
                newDeadline: requestType === 'due_date_extension' ? newDeadline : undefined,
                newTitle: requestType === 'scope_change' ? newTitle : undefined,
                newDescription: requestType === 'scope_change' ? newDescription : undefined,
            });
            toast.success('Change request submitted!');
            if (onRequested) onRequested();
            onClose();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to submit change request.');
        } finally { setLoading(false); }
    }

    return (
        <div className="goal-modal-overlay" onClick={onClose}>
            <div className="goal-modal" onClick={function (e) { e.stopPropagation(); }} style={{ maxWidth: '550px' }}>
                <div className="goal-modal__header">
                    <h2>📋 Change Request</h2>
                    <button className="goal-modal__close" onClick={onClose}>✕</button>
                </div>
                <div style={{ padding: '1.5rem' }}>
                    <form onSubmit={handleSubmit}>
                        <div style={{ marginBottom: '1rem' }}>
                            <label style={{ fontWeight: 600, marginBottom: '8px', display: 'block' }}>Request Type *</label>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                {requestTypes.map(function (rt) {
                                    return (
                                        <button key={rt.value} type="button" onClick={function () { setRequestType(rt.value); }}
                                            style={{ padding: '12px', borderRadius: '10px', border: requestType === rt.value ? '2px solid #6366f1' : '1px solid var(--border-color)', background: requestType === rt.value ? '#eef2ff' : 'var(--bg-surface, #fff)', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', textAlign: 'center' }}>
                                            <div style={{ fontSize: '1.2rem', marginBottom: '4px' }}>{rt.icon}</div>
                                            {rt.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="goal-modal__field" style={{ marginBottom: '1rem' }}>
                            <label>Reason *</label>
                            <textarea value={reason} onChange={function (e) { setReason(e.target.value); }}
                                placeholder="Explain why this change is needed..." rows={3}
                                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', resize: 'vertical' }} required></textarea>
                        </div>

                        {requestType === 'due_date_extension' && (
                            <div className="goal-modal__field" style={{ marginBottom: '1rem' }}>
                                <label>New Deadline</label>
                                <input type="date" value={newDeadline} onChange={function (e) { setNewDeadline(e.target.value); }}
                                    style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)' }} />
                            </div>
                        )}

                        {requestType === 'scope_change' && (
                            <>
                                <div className="goal-modal__field" style={{ marginBottom: '1rem' }}>
                                    <label>Updated Title</label>
                                    <input type="text" value={newTitle} onChange={function (e) { setNewTitle(e.target.value); }}
                                        style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)' }} />
                                </div>
                                <div className="goal-modal__field" style={{ marginBottom: '1rem' }}>
                                    <label>Updated Description</label>
                                    <textarea value={newDescription} onChange={function (e) { setNewDescription(e.target.value); }} rows={3}
                                        style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', resize: 'vertical' }}></textarea>
                                </div>
                            </>
                        )}

                        <div className="goal-modal__actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '1.5rem' }}>
                            <button type="button" className="btn btn--outline" onClick={onClose}>Cancel</button>
                            <button type="submit" className="btn btn--primary" disabled={loading || !requestType || !reason.trim()}>
                                {loading ? 'Submitting...' : 'Submit Request'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}

export default ChangeRequestModal;
