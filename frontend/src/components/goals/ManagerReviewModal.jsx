import React, { useState } from 'react';
import api from '../../services/api';
import { useToast } from '../common/Toast';
import GoalStatusBadge from './GoalStatusBadge';

function ManagerReviewModal({ goal, onClose, onReviewed }) {
    var toast = useToast();
    var [action, setAction] = useState(''); // approved, rejected, revision_requested
    var [managerComments, setManagerComments] = useState('');
    var [managerAdjustedPercent, setManagerAdjustedPercent] = useState(goal.achievementPercent || 0);
    var [loading, setLoading] = useState(false);

    async function handleSubmit(e) {
        e.preventDefault();
        if (!action) { toast.error('Please select an action.'); return; }
        if ((action === 'rejected' || action === 'revision_requested') && !managerComments.trim()) {
            toast.error('Please provide a reason for rejection or revision.'); return;
        }
        setLoading(true);
        try {
            await api.post('/api/objectives/' + goal._id + '/validate', {
                status: action,
                managerComments: managerComments,
                managerAdjustedPercent: action === 'approved' ? managerAdjustedPercent : undefined,
                rejectionReason: action === 'rejected' ? managerComments : undefined,
                revisionReason: action === 'revision_requested' ? managerComments : undefined,
            });
            var labels = { approved: 'approved', rejected: 'rejected', revision_requested: 'sent back for revision' };
            toast.success('Objective ' + (labels[action] || action) + ' successfully!');
            if (onReviewed) onReviewed();
            onClose();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to review goal.');
        } finally { setLoading(false); }
    }

    return (
        <div className="goal-modal-overlay" onClick={onClose}>
            <div className="goal-modal" onClick={function (e) { e.stopPropagation(); }} style={{ maxWidth: '600px' }}>
                <div className="goal-modal__header">
                    <h2>📋 Review Objective</h2>
                    <button className="goal-modal__close" onClick={onClose}>✕</button>
                </div>

                <div style={{ padding: '1.5rem' }}>
                    <div style={{ background: 'var(--bg-main, #f8fafc)', borderRadius: '12px', padding: '1.25rem', marginBottom: '1.5rem', border: '1px solid var(--border-color)' }}>
                        <h3 style={{ margin: '0 0 8px 0', fontSize: '1.1rem' }}>{goal.title}</h3>
                        <p style={{ margin: '0 0 8px 0', color: '#64748b', fontSize: '0.9rem' }}>{goal.description || 'No description'}</p>
                        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', fontSize: '0.85rem' }}>
                            <span><strong>Owner:</strong> {goal.owner?.name || 'Unknown'}</span>
                            <span><strong>Weight:</strong> {goal.weight}%</span>
                            <GoalStatusBadge status={goal.status || 'draft'} type="workflow" />
                        </div>
                        {goal.successIndicator && <div style={{ marginTop: '8px', fontSize: '0.85rem' }}><strong>Success Indicator:</strong> {goal.successIndicator}</div>}
                    </div>

                    <form onSubmit={handleSubmit}>
                        <div style={{ marginBottom: '1.5rem' }}>
                            <label style={{ fontWeight: 600, marginBottom: '8px', display: 'block' }}>Decision *</label>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                                <button type="button" onClick={function () { setAction('approved'); }}
                                    style={{ padding: '12px', borderRadius: '10px', border: action === 'approved' ? '2px solid #27ae60' : '1px solid var(--border-color)', background: action === 'approved' ? '#d1fae5' : 'var(--bg-surface, #fff)', cursor: 'pointer', fontWeight: 600 }}>
                                    ✅ Approve
                                </button>
                                <button type="button" onClick={function () { setAction('revision_requested'); }}
                                    style={{ padding: '12px', borderRadius: '10px', border: action === 'revision_requested' ? '2px solid #e67e22' : '1px solid var(--border-color)', background: action === 'revision_requested' ? '#fff7ed' : 'var(--bg-surface, #fff)', cursor: 'pointer', fontWeight: 600 }}>
                                    ↩ Request Revision
                                </button>
                                <button type="button" onClick={function () { setAction('rejected'); }}
                                    style={{ padding: '12px', borderRadius: '10px', border: action === 'rejected' ? '2px solid #e74c3c' : '1px solid var(--border-color)', background: action === 'rejected' ? '#fee2e2' : 'var(--bg-surface, #fff)', cursor: 'pointer', fontWeight: 600 }}>
                                    ❌ Reject
                                </button>
                            </div>
                        </div>

                        <div className="goal-modal__field" style={{ marginBottom: '1rem' }}>
                            <label>Manager Comments {(action === 'rejected' || action === 'revision_requested') && <span style={{ color: '#e74c3c' }}>*</span>}</label>
                            <textarea value={managerComments} onChange={function (e) { setManagerComments(e.target.value); }}
                                placeholder={action === 'rejected' ? 'Reason for rejection...' : action === 'revision_requested' ? 'What needs to be changed...' : 'Optional comments...'}
                                rows={3} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', resize: 'vertical' }}
                            ></textarea>
                        </div>

                        {action === 'approved' && (
                            <div className="goal-modal__field" style={{ marginBottom: '1rem' }}>
                                <label>Adjusted Progress % (optional)</label>
                                <input type="number" min={0} max={100} value={managerAdjustedPercent} onChange={function (e) { setManagerAdjustedPercent(parseInt(e.target.value)); }}
                                    style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', width: '120px' }} />
                            </div>
                        )}

                        <div className="goal-modal__actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '1.5rem' }}>
                            <button type="button" className="btn btn--outline" onClick={onClose}>Cancel</button>
                            <button type="submit" className="btn btn--primary" disabled={loading || !action}>
                                {loading ? 'Processing...' : 'Submit Review'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}

export default ManagerReviewModal;
