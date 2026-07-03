import React, { useState } from 'react';
import { aiAPI } from '../../api/ai';
import './AIPredictionSimulator.css';

const AIPredictionSimulator = () => {
    const [metrics, setMetrics] = useState({
        kpi_score: 80,
        goal_completion_percent: 75,
        checkin_count: 10,
        avg_checkin_progress: 70,
        feedback_count: 20,
        positive_feedback_ratio: 0.8,
        task_completion_percent: 85,
        tasks_on_time_percent: 80,
    });

    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setMetrics(prev => ({
            ...prev,
            [name]: parseFloat(value)
        }));
    };

    const handlePredict = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await aiAPI.predictPerformance(metrics);
            setResult(response.prediction);
        } catch (err) {
            setError(err.message || 'Prediction failed');
        } finally {
            setLoading(false);
        }
    };

    const formatRating = (rating) => {
        if (!rating) return '';
        return rating.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    };

    return (
        <div className="ai-simulator-container glass-card fade-in">
            <div className="ai-simulator-header">
                <span className="text-primary mr-2" style={{fontSize: '24px'}}>✨</span>
                <h2>AI Performance Predictor</h2>
            </div>
            
            <p className="text-muted mb-4">
                Adjust the metrics below to simulate an employee's performance profile and instantly see the AI's prediction.
            </p>

            <div className="ai-simulator-grid">
                <div className="metrics-panel">
                    <h3>Adjust Metrics</h3>
                    <div className="sliders-container">
                        <div className="slider-group">
                            <label>🎯 KPI Score: {metrics.kpi_score}</label>
                            <input type="range" name="kpi_score" min="0" max="100" value={metrics.kpi_score} onChange={handleChange} />
                        </div>
                        <div className="slider-group">
                            <label>✅ Goal Completion: {metrics.goal_completion_percent}%</label>
                            <input type="range" name="goal_completion_percent" min="0" max="100" value={metrics.goal_completion_percent} onChange={handleChange} />
                        </div>
                        <div className="slider-group">
                            <label>📈 Check-in Count: {metrics.checkin_count}</label>
                            <input type="range" name="checkin_count" min="0" max="20" value={metrics.checkin_count} onChange={handleChange} />
                        </div>
                        <div className="slider-group">
                            <label>📈 Avg Check-in Progress: {metrics.avg_checkin_progress}%</label>
                            <input type="range" name="avg_checkin_progress" min="0" max="100" value={metrics.avg_checkin_progress} onChange={handleChange} />
                        </div>
                        <div className="slider-group">
                            <label>💬 Feedback Count: {metrics.feedback_count}</label>
                            <input type="range" name="feedback_count" min="0" max="50" value={metrics.feedback_count} onChange={handleChange} />
                        </div>
                        <div className="slider-group">
                            <label>💬 Positive Feedback Ratio: {(metrics.positive_feedback_ratio * 100).toFixed(0)}%</label>
                            <input type="range" name="positive_feedback_ratio" min="0" max="1" step="0.05" value={metrics.positive_feedback_ratio} onChange={handleChange} />
                        </div>
                        <div className="slider-group">
                            <label>✅ Task Completion: {metrics.task_completion_percent}%</label>
                            <input type="range" name="task_completion_percent" min="0" max="100" value={metrics.task_completion_percent} onChange={handleChange} />
                        </div>
                        <div className="slider-group">
                            <label>⏱️ Tasks On Time: {metrics.tasks_on_time_percent}%</label>
                            <input type="range" name="tasks_on_time_percent" min="0" max="100" value={metrics.tasks_on_time_percent} onChange={handleChange} />
                        </div>
                    </div>
                    <button 
                        className="btn-primary w-full mt-4" 
                        onClick={handlePredict} 
                        disabled={loading}
                    >
                        {loading ? 'Analyzing...' : 'Run AI Prediction'}
                    </button>
                    {error && <div className="text-danger mt-2">{error}</div>}
                </div>

                <div className="results-panel">
                    <h3>Prediction Results</h3>
                    {result ? (
                        <div className="results-content fade-in">
                            <div className="result-highlight">
                                <div className="highlight-box">
                                    <h4>Predicted Rating</h4>
                                    <div className="rating-badge">{formatRating(result.rating)}</div>
                                </div>
                                <div className="highlight-box">
                                    <h4>Promotion Ready</h4>
                                    <div className={`promo-badge ${result.promotion_ready ? 'success' : 'warning'}`}>
                                        {result.promotion_ready ? 'Yes' : 'Not Yet'}
                                    </div>
                                    <small>{(result.promotion_probability * 100).toFixed(1)}% probability</small>
                                </div>
                            </div>
                            
                            <div className="review-summary mt-4">
                                <h4>AI Summary</h4>
                                <p>{result.review_summary}</p>
                            </div>

                            <div className="strengths-weaknesses">
                                <div className="sw-box">
                                    <h4>Strengths</h4>
                                    <ul>
                                        {result.strengths?.map((s, i) => <li key={i}>{s}</li>)}
                                    </ul>
                                </div>
                                <div className="sw-box">
                                    <h4>Areas to Improve</h4>
                                    <ul>
                                        {result.weaknesses?.map((w, i) => <li key={i}>{w}</li>)}
                                    </ul>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="empty-state">
                            <span className="text-muted mb-2" style={{fontSize: '48px'}}>✨</span>
                            <p className="text-muted">Adjust the metrics and click predict to see the AI's analysis.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AIPredictionSimulator;
