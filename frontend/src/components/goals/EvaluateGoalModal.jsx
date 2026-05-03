import React, { useState } from 'react';
import api from '../../services/api';
import { useToast } from '../common/Toast';

var ratingOptions = [
    { value: 'exceeded', label: 'Exceeded Expectations', color: '#7c3aed', icon: '🌟' },
    { value: 'met', label: 'Met Expectations', color: '#27ae60', icon: '✅' },
    { value: 'partially_met', label: 'Partially Met', color: '#f59e0b', icon: '⚡' },
    { value: 'not_met', label: 'Did Not Meet', color: '#e74c3c', icon: '❌' },
];

function EvaluateGoalModal({ goal, onClose, onEvaluated }) {
    var toast = useToast();
    var [rating, setRating] = useState('');
    var [comment, setComment] = useState('');
    var [adjustedPercent, setAdjustedPercent] = useState(goal.achievementPercent || 0);
    var [loading, setLoading] = useState(false);

    async function handleSubmit(e) {
        e.preventDefault();
        if (!rating) { toast.error('Please select an evaluation rating.'); return; }
        setLoading(true);
        try {
            await api.post('/api/objectives/' + goal._id + '/evaluate', {
                evaluationRating: rating,
                evaluationComment: comment,
                managerAdjustedPercent: adjustedPercent,
            });
            toast.success('Objective evaluated successfully!');
            if (onEvaluated) onEvaluated();
            onClose();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to evaluate goal.');
        } finally { setLoading(false); }
    }

    return (
        <div className="goal-modal-overlay" onClick={onClose}>
            <div className="goal-modal" onClick={function (e) { e.stopPropagation(); }} style={{ maxWidth: '550px' }}>
                <div className="goal-modal__header">
                    <h2>📊 Evaluate Objective</h2>
                    <button className="goal-modal__close" onClick={onClose}>✕</button>
                </div>

                <div style={{ padding: '1.5rem' }}>
                    <div style={{ background: 'var(--bg-main, #f8fafc)', borderRadius: '12px', padding: '1rem', marginBottom: '1.5rem', border: '1px solid var(--border-color)' }}>
                        <h3 style={{ margin: '0 0 4px 0', fontSize: '1rem' }}>{goal.title}</h3>
                        <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>{goal.owner?.name} • Progress: {goal.achievementPercent || 0}%</p>
                    </div>

                    <form onSubmit={handleSubmit}>
                        <label style={{ fontWeight: 600, marginBottom: '10px', display: 'block' }}>Evaluation Rating *</label>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '1.5rem' }}>
                            {ratingOptions.map(function (opt) {
                                return (
                                    <button key={opt.value} type="button" onClick={function () { setRating(opt.value); }}
                                        style={{ padding: '14px 12px', borderRadius: '10px', border: rating === opt.value ? '2px solid ' + opt.color : '1px solid var(--border-color)', background: rating === opt.value ? opt.color + '15' : 'var(--bg-surface, #fff)', cursor: 'pointer', textAlign: 'center', fontWeight: 600, fontSize: '0.9rem' }}>
                                        <div style={{ fontSize: '1.2rem', marginBottom: '4px' }}>{opt.icon}</div>
                                        {opt.label}
                                    </button>
                                );
                            })}
                        </div>

                        <div className="goal-modal__field" style={{ marginBottom: '1rem' }}>
                            <label>Evaluation Comment</label>
                            <textarea value={comment} onChange={function (e) { setComment(e.target.value); }}
                                placeholder="Provide feedback on this goal..." rows={3}
                                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', resize: 'vertical' }}></textarea>
                        </div>

                        <div className="goal-modal__field" style={{ marginBottom: '1rem' }}>
                            <label>Final Score Adjustment (%)</label>
                            <input type="number" min={0} max={100} value={adjustedPercent} onChange={function (e) { setAdjustedPercent(parseInt(e.target.value)); }}
                                style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', width: '120px' }} />
                        </div>

                        <div className="goal-modal__actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '1.5rem' }}>
                            <button type="button" className="btn btn--outline" onClick={onClose}>Cancel</button>
                            <button type="submit" className="btn btn--primary" disabled={loading || !rating}>
                                {loading ? 'Submitting...' : 'Submit Evaluation'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}

export default EvaluateGoalModal;
