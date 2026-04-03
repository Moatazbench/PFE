import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../components/AuthContext';
import { useToast } from '../components/common/Toast';

function AdminDashboardPage() {
  const { user } = useAuth();
  const toast = useToast();
  
  const [cycles, setCycles] = useState([]);
  const [selectedCycleId, setSelectedCycleId] = useState('');
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchCycles(); }, []);
  useEffect(() => { 
    if (selectedCycleId) fetchDashboard(); 
  }, [selectedCycleId]);

  async function fetchCycles() {
    try {
      const res = await api.get('/api/cycles');
      const data = res.data.filter(c => c.status !== 'draft');
      setCycles(data);
      if (data.length > 0) setSelectedCycleId(data[0]._id);
      else setLoading(false);
    } catch (err) {
      toast.error('Failed to load cycles');
      setLoading(false);
    }
  }

  async function fetchDashboard() {
    setLoading(true);
    try {
      const res = await api.get(`/api/dashboard/admin/${selectedCycleId}`);
      setDashboardData(res.data);
    } catch (err) {
      toast.error('Failed to load admin dashboard');
    } finally {
      setLoading(false);
    }
  }

  function getStatusLabel(phase) {
    if (phase === 'phase1') return { label: 'Phase 1: Goal Setting', bg: '#eff6ff', c: '#3b82f6', border: '#bfdbfe' };
    if (phase === 'phase2') return { label: 'Phase 2: Mid-Year', bg: '#fefce8', c: '#eab308', border: '#fef08a' };
    if (phase === 'phase3') return { label: 'Phase 3: End-Year', bg: '#f5f3ff', c: '#8b5cf6', border: '#e9d5ff' };
    return { label: 'Closed', bg: '#f1f5f9', c: '#64748b', border: '#cbd5e1' };
  }

  function renderProgressBar(percentage, type = 'info') {
    const color = type === 'success' ? '#22c55e' : (type === 'warning' ? '#eab308' : '#3b82f6');
    return (
      <div style={{ height: '8px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden', marginTop: '0.5rem', marginBottom: '0.5rem' }}>
        <div style={{ height: '100%', width: `${percentage}%`, background: color, transition: 'width 0.3s' }}></div>
      </div>
    );
  }

  if (loading && !selectedCycleId) return <div className="page-loading"><div className="spinner"></div><p>Loading admin dashboard...</p></div>;

  return (
    <div className="page" style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '2.2rem', color: 'var(--text-dark)' }}>📊 Annual Cycle Dashboard</h1>
          <p className="text-muted" style={{ margin: '0.5rem 0 0 0' }}>High-level overview of performance operations.</p>
        </div>
        <select value={selectedCycleId} onChange={e => setSelectedCycleId(e.target.value)} className="form-control hover-lift" style={{ padding: '0.75rem', borderRadius: '8px', minWidth: '200px', fontWeight: 'bold' }}>
          {cycles.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
        </select>
      </div>

      {!dashboardData ? (
        <div className="empty-state">No dashboard data available.</div>
      ) : (
        <>
          <div className="card shadow-sm hover-lift" style={{ background: getStatusLabel(dashboardData.cycle.currentPhase).bg, border: `1px solid ${getStatusLabel(dashboardData.cycle.currentPhase).border}`, color: getStatusLabel(dashboardData.cycle.currentPhase).c, padding: '1.5rem', marginBottom: '2rem' }}>
             <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
               Current Status: {getStatusLabel(dashboardData.cycle.currentPhase).label}
             </h2>
             <p style={{ margin: '0.5rem 0 0 0', fontWeight: 'bold' }}>Total Employees Active: {dashboardData.totalEmployees}</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem', marginBottom: '2.5rem' }}>
            {/* Phase 1 Card */}
            <div className="card shadow-sm hover-lift" style={{ padding: '1.5rem', borderTop: '4px solid #3b82f6' }}>
              <h3 style={{ margin: '0 0 1rem 0', color: '#1e3a8a' }}>Phase 1 Validation</h3>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#3b82f6' }}>{dashboardData.phase1.validationCompletion}%</span>
                <span style={{ color: 'var(--text-muted)', fontWeight: 'bold' }}>Complete</span>
              </div>
              {renderProgressBar(dashboardData.phase1.validationCompletion, dashboardData.phase1.validationCompletion === 100 ? 'success' : 'info')}
              <div style={{ marginTop: '1rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                <div>✅ Employees with Approved Goals: <strong>{dashboardData.phase1.employeesComplete}</strong></div>
                <div>⏳ Employees Incomplete/Revising: <strong>{dashboardData.phase1.employeesIncomplete}</strong></div>
                <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border-color)' }}>
                  Total Goals Created: <strong>{dashboardData.phase1.totalGoals}</strong>
                </div>
              </div>
            </div>

            {/* Phase 2 Card */}
            <div className="card shadow-sm hover-lift" style={{ padding: '1.5rem', borderTop: '4px solid #eab308' }}>
              <h3 style={{ margin: '0 0 1rem 0', color: '#713f12' }}>Phase 2 Mid-Year Checkings</h3>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#eab308' }}>{dashboardData.phase2.completionPercentage}%</span>
                <span style={{ color: 'var(--text-muted)', fontWeight: 'bold' }}>Assessed</span>
              </div>
              {renderProgressBar(dashboardData.phase2.completionPercentage, dashboardData.phase2.completionPercentage === 100 ? 'success' : 'warning')}
              <div style={{ marginTop: '1rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                <div>✅ Goals Assessed by Managers: <strong>{dashboardData.phase2.assessed}</strong></div>
                <div>⏳ Goals Pending Assessment: <strong>{dashboardData.phase2.notAssessed}</strong></div>
                <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border-color)' }}>
                  Total Eligible Goals: <strong>{dashboardData.phase2.totalEligible}</strong>
                </div>
              </div>
            </div>

            {/* Phase 3 Card */}
            <div className="card shadow-sm hover-lift" style={{ padding: '1.5rem', borderTop: '4px solid #8b5cf6' }}>
              <h3 style={{ margin: '0 0 1rem 0', color: '#4c1d95' }}>Phase 3 Final Evaluations</h3>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#8b5cf6' }}>{dashboardData.phase3.completionPercentage}%</span>
                <span style={{ color: 'var(--text-muted)', fontWeight: 'bold' }}>Evaluated</span>
              </div>
              {renderProgressBar(dashboardData.phase3.completionPercentage, dashboardData.phase3.completionPercentage === 100 ? 'success' : 'info')}
              <div style={{ marginTop: '1rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                <div>✅ Manager Final Evaluations: <strong>{dashboardData.phase3.evaluated}</strong></div>
                <div>⏳ Pending Evaluations: <strong>{dashboardData.phase3.notEvaluated}</strong></div>
                <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border-color)' }}>
                  Organization Avg Score: <strong>{dashboardData.phase3.averagePerformanceScore}%</strong>
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '3rem' }}>
             <button className="btn btn--outline" onClick={() => window.location.href='/performance'}>View Detailed Performance Lists ➡️</button>
          </div>
        </>
      )}
    </div>
  );
}

export default AdminDashboardPage;
