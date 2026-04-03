import React, { useState } from 'react';
import api from '../../services/api';
import './CheckInModal.css';

function CheckInModal({ goal, onClose, onCheckInComplete }) {
    // Local state for KPI updates. Initialize with current values.
    const [kpiUpdates, setKpiUpdates] = useState(
        (goal.kpis || []).map(kpi => ({
            _id: kpi._id,
            title: kpi.title,
            metricType: kpi.metricType,
            initialValue: kpi.initialValue,
            targetValue: kpi.targetValue,
            currentValue: kpi.currentValue,
            unit: kpi.unit
        }))
    );
    const [message, setMessage] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');

    const handleKpiChange = (id, newCurrentValue) => {
        setKpiUpdates(prev => prev.map(kpi => {
            if (kpi._id === id) {
                return { ...kpi, currentValue: parseFloat(newCurrentValue) || 0 };
            }
            return kpi;
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setIsSubmitting(true);
        try {
            // Extract just what the backend needs
            const payloadKpis = kpiUpdates.map(k => ({ _id: k._id, currentValue: k.currentValue }));
            
            await api.post(`/api/objectives/${goal._id}/progress`, {
                message,
                kpiUpdates: payloadKpis
            });
            
            onCheckInComplete(); // refresh parent
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to submit check-in.');
            setIsSubmitting(false);
        }
    };

    return (
        <div className="goal-modal-overlay" onClick={onClose}>
            <div className="goal-modal" onClick={e => e.stopPropagation()}>
                <div className="goal-modal__header">
                    <h2>Update Progress</h2>
                    <button className="goal-modal__close" onClick={onClose} type="button">✕</button>
                </div>
                {error && <div className="goal-modal__error">{error}</div>}
                
                <form className="goal-modal__form" onSubmit={handleSubmit}>

                    {/* KPI Sliders */}
                    {kpiUpdates.length > 0 && (
                        <div className="check-in-kpis">
                            <label>Update Metrics</label>
                            {kpiUpdates.map(kpi => {
                                const range = kpi.targetValue - kpi.initialValue;
                                const isPositiveDirection = range >= 0;
                                const min = isPositiveDirection ? kpi.initialValue : kpi.targetValue;
                                const max = isPositiveDirection ? kpi.targetValue : kpi.initialValue;
                                
                                return (
                                    <div key={kpi._id} className="check-in-kpi-item">
                                        <div className="check-in-kpi-header">
                                            <span className="kpi-title">{kpi.title}</span>
                                            <span className="kpi-values">
                                                <input 
                                                    type="number" 
                                                    className="kpi-number-input"
                                                    value={kpi.currentValue}
                                                    onChange={e => handleKpiChange(kpi._id, e.target.value)}
                                                />
                                                <span className="kpi-target">/ {kpi.targetValue} {kpi.unit}</span>
                                            </span>
                                        </div>
                                        {kpi.metricType !== 'boolean' && (
                                            <input 
                                                type="range" 
                                                className="kpi-slider"
                                                min={min} 
                                                max={max} 
                                                step={range !== 0 && Math.abs(range) <= 10 ? 0.1 : 1}
                                                value={kpi.currentValue} 
                                                onChange={e => handleKpiChange(kpi._id, e.target.value)}
                                            />
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Narrative */}
                    <div className="goal-modal__field">
                        <label>Progress Update</label>
                        <textarea 
                            rows={4} 
                            placeholder="What progress have you made?" 
                            value={message}
                            onChange={e => setMessage(e.target.value)}
                            required
                        />
                    </div>

                    <div className="goal-modal__actions">
                        <button type="button" className="goal-modal__cancel" onClick={onClose}>Cancel</button>
                        <button type="submit" className="goal-modal__submit" disabled={isSubmitting}>
                            {isSubmitting ? 'Checking-in...' : 'Submit Check-in'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default CheckInModal;
