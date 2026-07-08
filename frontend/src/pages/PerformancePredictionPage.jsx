import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Bar, Line } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Tooltip, Legend, Filler
} from 'chart.js';
import { aiAPI } from '../api/ai';
import UserAvatar from '../components/UserAvatar';
import '../components/ai/AIPredictionSimulator.css';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Tooltip, Legend, Filler);

function humanize(value) {
  return String(value || '').replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function MetricCard({ label, value, tone = '#4f46e5' }) {
  return <div className="card prediction-metric" style={{ borderTop: `3px solid ${tone}` }}><small>{label}</small><strong>{value}</strong></div>;
}

function factorColor(value) {
  if (value == null) return '#cbd5e1';
  if (value >= 75) return '#16a34a';
  if (value >= 55) return '#f59e0b';
  return '#e11d48';
}

function PerformancePredictionPage() {
  const { employeeId } = useParams();
  const [searchParams] = useSearchParams();
  const cycleId = searchParams.get('cycleId');
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    if (!cycleId) return undefined;
    aiAPI.getEmployeePrediction(employeeId, cycleId)
      .then((response) => {
        if (!cancelled) setData(response);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Prediction failed.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [cycleId, employeeId]);

  const loadPrediction = () => {
    setLoading(true);
    setError('');
    aiAPI.getEmployeePrediction(employeeId, cycleId)
      .then(setData)
      .catch((err) => setError(err.message || 'Prediction failed.'))
      .finally(() => setLoading(false));
  };

  const trajectoryOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 850, easing: 'easeOutQuart' },
    interaction: { intersect: false, mode: 'index' },
    scales: {
      y: { min: 0, max: 100, grid: { color: '#e2e8f066' }, ticks: { callback: (value) => `${value}%` } },
      x: { grid: { display: false } }
    },
    plugins: { legend: { display: false }, tooltip: { callbacks: { label: (context) => `${context.raw}%` } } }
  }), []);

  const contributionOptions = useMemo(() => ({
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 900, easing: 'easeOutQuart' },
    scales: {
      x: { min: 0, max: 100, grid: { color: '#e2e8f066' }, ticks: { callback: (value) => `${value}%` } },
      y: { grid: { display: false } }
    },
    plugins: { legend: { display: false }, tooltip: { callbacks: { label: (context) => context.raw == null ? 'No data' : `${context.raw}%` } } }
  }), []);

  if (!cycleId) return <div className="page predictor-state predictor-state--error"><strong>Prediction unavailable</strong><p>A cycle is required to generate this prediction.</p><button className="btn btn--outline" onClick={() => navigate('/performance')}>Back to performance</button></div>;
  if (loading) return <div className="page-loading"><div className="spinner"></div><p>Analyzing real performance metrics…</p></div>;
  if (error) return <div className="page predictor-state predictor-state--error"><strong>Prediction unavailable</strong><p>{error}</p><button className="btn btn--outline" onClick={() => navigate('/performance')}>Back to performance</button></div>;

  const { employee, metrics, prediction, forecasts, contributions = [], objectiveBreakdown = [] } = data;
  const forecastLineData = (items, color) => ({
    labels: items.map((item) => item.label),
    datasets: [{
      data: items.map((item) => item.value),
      borderColor: color,
      borderWidth: 3,
      pointRadius: 6,
      pointHoverRadius: 8,
      pointBackgroundColor: items.map((item, index) => index === 0 ? '#64748b' : color),
      pointBorderColor: '#fff',
      pointBorderWidth: 2,
      tension: .38,
      fill: true,
      backgroundColor: (context) => {
        const chart = context.chart;
        const { ctx, chartArea } = chart;
        if (!chartArea) return `${color}20`;
        const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
        gradient.addColorStop(0, `${color}42`);
        gradient.addColorStop(1, `${color}00`);
        return gradient;
      }
    }]
  });
  const availableContributions = contributions.filter((factor) => factor.value != null);
  const contributionData = {
    labels: contributions.map((factor) => factor.label),
    datasets: [{
      data: contributions.map((factor) => factor.value == null ? 0 : factor.value),
      backgroundColor: contributions.map((factor) => factorColor(factor.value)),
      borderRadius: 7,
      barThickness: 18
    }]
  };
  const positiveFactors = availableContributions.filter((factor) => factor.value >= 75).sort((a, b) => b.value - a.value);
  const riskFactors = availableContributions.filter((factor) => factor.value < 60).sort((a, b) => a.value - b.value);
  const futurePerformance = forecasts?.performance || [];
  const productivityForecast = forecasts?.productivity || [];
  const flightRiskForecast = forecasts?.flightRisk || [];
  const fiveYearDelta = forecasts?.five_year_delta ?? 0;
  const futureRisk = flightRiskForecast[flightRiskForecast.length - 1];

  return (
    <main className="page prediction-detail">
      <div className="ds-page-header">
        <div className="ds-page-header__left">
          <h1 className="ds-page-header__title">
            <span className="ds-icon-circle ds-icon-circle--ai ds-icon-circle--sm">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '20px', height: '20px' }}>
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
              </svg>
            </span>
            {employee.name}
          </h1>
          <p className="ds-page-header__subtitle">
            <span className="ds-badge ds-badge--ai" style={{ marginRight: 8 }}>AI Predictor</span>
            {humanize(employee.role)} · {employee.team?.name || 'No team assigned'}
          </p>
        </div>
        <div className="ds-page-header__actions">
          <button className="ds-btn ds-btn--outline" onClick={function () { navigate('/performance'); }}>Back</button>
          <button className="ds-btn ds-btn--primary ds-card--accent-ai" onClick={loadPrediction}>Regenerate prediction</button>
        </div>
      </div>

      {!prediction.reliable && <div className="alert alert--warning">Not enough data to generate a reliable prediction yet. Available metrics are shown without invented values.</div>}
      {forecasts && (
        <section className="prediction-spotlights">
          <div className={`prediction-spotlight prediction-spotlight--${forecasts.direction}`}><small>Performance direction</small><strong>{humanize(forecasts.direction)}</strong><span>{fiveYearDelta > 0 ? '+' : ''}{fiveYearDelta} points over 5 years</span></div>
          <div className={`prediction-spotlight prediction-spotlight--risk-${futureRisk?.category || 'medium'}`}><small>Projected flight risk</small><strong>{humanize(futureRisk?.category || 'Unknown')}</strong><span>{futureRisk?.value ?? '—'}% at 5 years</span></div>
          <div className="prediction-spotlight prediction-spotlight--confidence"><small>Prediction confidence</small><strong>{prediction.confidence_percent}%</strong><span>{humanize(prediction.confidence_level)} confidence</span></div>
        </section>
      )}

      <section className="prediction-metrics">
        <MetricCard label="Current performance" value={metrics.current_score == null ? '—' : `${metrics.current_score}%`} />
        <MetricCard label="Predicted performance" value={prediction.predicted_score == null ? '—' : `${prediction.predicted_score}%`} tone="#0ea5e9" />
        <MetricCard label="Risk level" value={humanize(prediction.risk_level)} tone={prediction.risk_level === 'high' ? '#dc2626' : '#16a34a'} />
        <MetricCard label="Confidence" value={`${humanize(prediction.confidence_level)} (${prediction.confidence_percent}%)`} tone="#8b5cf6" />
        <MetricCard label="Objective completion" value={metrics.objective_completion_percent == null ? '—' : `${metrics.objective_completion_percent}%`} tone="#f59e0b" />
        <MetricCard label="Task completion" value={metrics.task_completion_percent == null ? '—' : `${metrics.task_completion_percent}%`} tone="#10b981" />
        <MetricCard label="Check-in activity" value={`${metrics.checkin_count} check-in${metrics.checkin_count === 1 ? '' : 's'}`} tone="#6366f1" />
      </section>

      <section className="prediction-charts">
        <article className="card prediction-analytics-card prediction-analytics-card--trajectory">
          <div className="prediction-card-heading"><div><span className="predictor-eyebrow">1Y · 2Y · 5Y</span><h3>Future performance forecast</h3></div><span className={`prediction-trend-chip prediction-trend-chip--${forecasts?.direction}`}>{humanize(forecasts?.direction)}</span></div>
          <div className="prediction-chart-canvas">
            {futurePerformance.length ? <Line data={forecastLineData(futurePerformance, '#4f46e5')} options={trajectoryOptions} /> : <div className="prediction-empty">Not enough data to generate a future forecast.</div>}
          </div>
          {!forecasts?.historical_data_available && <p className="prediction-data-note">Prediction generated from available current-cycle data only. More historical data is needed for higher confidence.</p>}
          <p className="prediction-insight">Performance trend: {humanize(forecasts?.direction)} · Expected {fiveYearDelta >= 0 ? 'growth' : 'decline'}: {fiveYearDelta > 0 ? '+' : ''}{fiveYearDelta} points over 5 years.</p>
        </article>

        <article className="card prediction-analytics-card">
          <div className="prediction-card-heading"><div><span className="predictor-eyebrow">Work output outlook</span><h3>Productivity forecast</h3></div></div>
          <div className="prediction-chart-canvas">
            {productivityForecast.length ? <Bar data={{ labels: productivityForecast.map((item) => item.label), datasets: [{ data: productivityForecast.map((item) => item.value), backgroundColor: ['#64748b', '#2563eb', '#4f46e5', '#7c3aed'], borderRadius: 8 }] }} options={{ ...trajectoryOptions, plugins: { legend: { display: false } } }} /> : <div className="prediction-empty">Objective, task, and check-in data are insufficient for a productivity forecast.</div>}
          </div>
          <p className="prediction-insight">Forecast combines weighted objectives, tasks, check-ins, and team contribution.</p>
        </article>

        <article className="card prediction-analytics-card">
          <div className="prediction-card-heading"><div><span className="predictor-eyebrow">Disengagement outlook</span><h3>Flight risk forecast</h3></div><span className={`prediction-trend-chip risk-level--${futureRisk?.category}`}>{humanize(futureRisk?.category)}</span></div>
          <div className="prediction-chart-canvas">
            {flightRiskForecast.length ? <Line data={forecastLineData(flightRiskForecast, '#e11d48')} options={trajectoryOptions} /> : <div className="prediction-empty">Not enough activity data to estimate flight risk.</div>}
          </div>
          <p className="prediction-insight">Projected risk reflects performance direction, objectives, task completion, and check-in consistency.</p>
        </article>

        <article className="card prediction-analytics-card">
          <div className="prediction-card-heading"><div><span className="predictor-eyebrow">Prediction drivers</span><h3>Prediction factor breakdown</h3></div></div>
          <div className="prediction-chart-canvas prediction-chart-canvas--factors">
            {availableContributions.length ? <Bar data={contributionData} options={contributionOptions} /> : <div className="prediction-empty">Prediction generated without enough factor data for a contribution chart.</div>}
          </div>
          {availableContributions.length < contributions.length && <p className="prediction-data-note">Unavailable factors are shown in gray and are excluded from the fallback calculation.</p>}
          <div className="prediction-color-key"><span className="strong">Strong ≥75%</span><span className="medium">Watch 55–74%</span><span className="risk">Attention &lt;55%</span></div>
        </article>

        <article className="card prediction-analytics-card prediction-risk-panel">
          <div className="prediction-card-heading"><div><span className="predictor-eyebrow">AI explanation</span><h3>Signals &amp; confidence</h3></div></div>
          <div className="confidence-block"><div><small>Prediction confidence</small><strong>{prediction.confidence_percent}%</strong></div><div className="confidence-track"><span style={{ width: `${prediction.confidence_percent}%` }} /></div></div>
          <div className="factor-columns">
            <div><h4>Positive factors</h4>{positiveFactors.length ? <ul>{positiveFactors.slice(0, 3).map((factor) => <li key={factor.key}>{factor.label} <strong>{factor.value}%</strong></li>)}</ul> : <p>No strong positive factor is available yet.</p>}</div>
            <div><h4>Risk factors</h4>{riskFactors.length ? <ul>{riskFactors.slice(0, 3).map((factor) => <li key={factor.key}>{factor.label} <strong>{factor.value}%</strong></li>)}</ul> : <p>No material risk factor detected.</p>}</div>
          </div>
          <div className="prediction-method-note"><strong>{humanize(prediction.source)}</strong><span>{forecasts?.methodology || prediction.explanation}</span></div>
        </article>

        <article className="card prediction-analytics-card">
          <div className="prediction-card-heading"><div><span className="predictor-eyebrow">Weighted scoring</span><h3>Objective breakdown</h3></div></div>
          {objectiveBreakdown.length ? (
            <div className="objective-breakdown">
              {objectiveBreakdown.map((objective) => (
                <div className="objective-row" key={objective.id || objective.title}>
                  <div className="objective-row__heading"><div><strong>{objective.title}</strong><span>{humanize(objective.category)} · Weight {objective.weight}%</span></div><b>{objective.contribution} pts</b></div>
                  <div className="objective-progress"><span style={{ width: `${Math.max(0, Math.min(100, objective.progress || 0))}%`, background: factorColor(objective.progress) }} /></div>
                  <div className="objective-row__footer"><span>Progress {objective.progress}%</span><span>Contribution {objective.contribution}/{objective.weight} points</span></div>
                </div>
              ))}
            </div>
          ) : <div className="prediction-empty">No eligible objectives are available for this cycle.</div>}
        </article>
      </section>
    </main>
  );
}

export default PerformancePredictionPage;
