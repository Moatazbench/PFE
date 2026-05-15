import React, { useState } from 'react';
import api from '../../services/api';
import { useToast } from '../common/Toast';
import GoalStatusBadge from './GoalStatusBadge';

function ManagerReviewModal({ goal, onClose, onReviewed }) {
    var toast = useToast();
    var [action, setAction] = useState(''); // approved, rejected
    var [managerComments, setManagerComments] = useState('');
    var [loading, setLoading] = useState(false);

    async function handleSubmit(e) {
        e.preventDefault();
        if (!action) { toast.error('Please select an action.'); return; }
        if (action === 'rejected' && !managerComments.trim()) {
            toast.error('Please provide a reason for rejection.'); return;
        }
        setLoading(true);
        try {
            await api.post('/objectives/' + goal._id + '/validate', {
                status: action,
                managerComments: managerComments,
                rejectionReason: action === 'rejected' ? managerComments : undefined,
            });
            var labels = { approved: 'approved', rejected: 'rejected' };
            toast.success('Objective ' + (labels[action] || action) + ' successfully!');
            if (onReviewed) onReviewed();
            onClose();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to review goal.');
        } finally { setLoading(false); }
    }

    return (
        <div className="goal-modal-overlay" onClick={onClose}>
            <div className="goal-modal" onClick={function (e) { e.stopPropagation(); }} style={{ maxWidth: '620px' }}>
                <div className="goal-modal__header">
                    <h2>📋 Review Objective</h2>
                    <button className="goal-modal__close" onClick={onClose}>✕</button>
                </div>

                <div style={{ padding: '1.5rem' }}>
                    {/* Goal Summary Card */}
                    <div style={{ background: 'var(--bg-main, #f8fafc)', borderRadius: '12px', padding: '1.5rem', marginBottom: '1.5rem', border: '1px solid var(--border-color, #e2e8f0)' }}>
                        <div style={{ marginBottom: '12px' }}>
                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', marginBottom: '4px' }}>Objective Title</label>
                            <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#0f172a' }}>{goal.title}</h3>
                        </div>
                        <div style={{ marginBottom: '12px' }}>
                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', marginBottom: '4px' }}>Description</label>
                            <p style={{ margin: 0, color: '#334155', fontSize: '0.9rem', lineHeight: '1.5' }}>{goal.description || 'No description provided'}</p>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', padding: '12px 0 0 0', borderTop: '1px solid var(--border-color, #e2e8f0)' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', marginBottom: '2px' }}>Owner</label>
                                <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#0f172a' }}>{goal.owner?.name || 'Unknown'}</span>
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', marginBottom: '2px' }}>Weight</label>
                                <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#0f172a' }}>{goal.weight}%</span>
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', marginBottom: '2px' }}>Status</label>
                                <GoalStatusBadge status={goal.status || 'draft'} type="workflow" />
                            </div>
                        </div>
                        {goal.successIndicator && (
                            <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--border-color, #e2e8f0)' }}>
                                <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', marginBottom: '4px' }}>Success Indicator</label>
                                <span style={{ fontSize: '0.9rem', color: '#334155' }}>{goal.successIndicator}</span>
                            </div>
                        )}
                    </div>

                    <form onSubmit={handleSubmit}>
                        <div style={{ marginBottom: '1.5rem' }}>
                            <label style={{ fontWeight: 700, marginBottom: '10px', display: 'block', fontSize: '0.95rem', color: '#0f172a' }}>Decision <span style={{ color: '#dc2626' }}>*</span></label>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                <button type="button" onClick={function () { setAction('approved'); }}
                                    style={{ padding: '14px', borderRadius: '10px', border: action === 'approved' ? '2px solid #16a34a' : '1.5px solid var(--border-color, #e2e8f0)', background: action === 'approved' ? '#dcfce7' : 'var(--bg-surface, #fff)', cursor: 'pointer', fontWeight: 700, fontSize: '0.95rem', transition: 'all 0.15s ease' }}>
                                    ✅ Approve
                                </button>
                                <button type="button" onClick={function () { setAction('rejected'); }}
                                    style={{ padding: '14px', borderRadius: '10px', border: action === 'rejected' ? '2px solid #dc2626' : '1.5px solid var(--border-color, #e2e8f0)', background: action === 'rejected' ? '#fee2e2' : 'var(--bg-surface, #fff)', cursor: 'pointer', fontWeight: 700, fontSize: '0.95rem', transition: 'all 0.15s ease' }}>
                                    ❌ Reject
                                </button>
                            </div>
                        </div>

                        {action === 'rejected' && (
                            <div style={{ marginBottom: '1.25rem' }}>
                                <label style={{ fontWeight: 700, marginBottom: '8px', display: 'block', fontSize: '0.9rem', color: '#0f172a' }}>Rejection Reason <span style={{ color: '#dc2626' }}>*</span></label>
                                <textarea value={managerComments} onChange={function (e) { setManagerComments(e.target.value); }}
                                    placeholder="Please provide feedback for the rejection..."
                                    rows={3} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1.5px solid var(--border-color, #e2e8f0)', resize: 'vertical', fontSize: '0.9rem', fontFamily: 'inherit' }}
                                ></textarea>
                            </div>
                        )}

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color, #e2e8f0)' }}>
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
