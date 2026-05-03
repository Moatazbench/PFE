import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { useAuth } from '../components/AuthContext';
import { useToast } from '../components/common/Toast';

function PerformancePage() {
  const { user } = useAuth();
  const toast = useToast();

  const [cycles, setCycles] = useState([]);
  const [selectedCycleId, setSelectedCycleId] = useState('');
  const [viewMode, setViewMode] = useState('self');
  const [myStats, setMyStats] = useState(null);
  const [teamStats, setTeamStats] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCycles();
  }, []);

  useEffect(() => {
    if (selectedCycleId) {
      fetchPerformanceData();
    }
  }, [selectedCycleId]);

  async function fetchCycles() {
    setLoading(true);
    try {
      const res = await api.get('/api/cycles');
      const availableCycles = (res.data || []).filter((cycle) => cycle.status !== 'draft');
      setCycles(availableCycles);
      if (availableCycles.length > 0) {
        setSelectedCycleId(availableCycles[0]._id);
      }
    } catch (err) {
      toast.error('Failed to load cycles.');
      setLoading(false);
    }
  }

  async function fetchPerformanceData() {
    setLoading(true);
    try {
      const myRes = await api.get(`/api/performance/summary/${user.id}/${selectedCycleId}`);
      setMyStats(myRes.data);

      if (['TEAM_LEADER', 'ADMIN', 'HR'].includes(user.role)) {
        const teamRes = await api.get(`/api/performance/team-summary/${user.id}/${selectedCycleId}`);
        setTeamStats(teamRes.data.employees || []);
      }
    } catch (err) {
      toast.error('Failed to load performance summary.');
    } finally {
      setLoading(false);
    }
  }

  function getLabelColor(label) {
    if (label === 'Exceeded Expectations') return '#7c3aed';
    if (label === 'Achieved') return '#16a34a';
    if (label === 'Partially Achieved') return '#ca8a04';
    return '#dc2626';
  }

  if (loading && !selectedCycleId) {
    return <div className="page-loading"><div className="spinner"></div><p>Loading performance data...</p></div>;
  }

  return (
    <div className="page" style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '2.2rem', color: 'var(--text-dark)' }}>Performance Summaries</h1>
          <p className="text-muted" style={{ margin: '0.5rem 0 0 0' }}>Objective-weighted scores for the selected cycle.</p>
        </div>
        <select value={selectedCycleId} onChange={(event) => setSelectedCycleId(event.target.value)} className="form-control hover-lift" style={{ padding: '0.75rem', borderRadius: '8px', minWidth: '220px', fontWeight: 'bold' }}>
          {cycles.map((cycle) => (
            <option key={cycle._id} value={cycle._id}>{cycle.name}</option>
          ))}
        </select>
      </div>

      {!selectedCycleId ? (
        <div className="empty-state">No cycles available.</div>
      ) : (
        <>
          {['TEAM_LEADER', 'ADMIN', 'HR'].includes(user.role) && (
            <div style={{ display: 'flex', gap: '1rem', borderBottom: '2px solid var(--border-color)', paddingBottom: '1rem', marginBottom: '2rem' }}>
              <button onClick={() => setViewMode('self')} style={{ background: 'none', border: 'none', fontSize: '1.1rem', fontWeight: viewMode === 'self' ? 'bold' : 'normal', color: viewMode === 'self' ? 'var(--primary)' : 'var(--text-muted)', cursor: 'pointer', paddingBottom: '0.5rem', borderBottom: viewMode === 'self' ? '3px solid var(--primary)' : '3px solid transparent' }}>
                My Performance
              </button>
              <button onClick={() => setViewMode('team')} style={{ background: 'none', border: 'none', fontSize: '1.1rem', fontWeight: viewMode === 'team' ? 'bold' : 'normal', color: viewMode === 'team' ? 'var(--primary)' : 'var(--text-muted)', cursor: 'pointer', paddingBottom: '0.5rem', borderBottom: viewMode === 'team' ? '3px solid var(--primary)' : '3px solid transparent' }}>
                Team Summary
              </button>
            </div>
          )}

          {viewMode === 'self' && myStats && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
                <div className="card shadow-sm" style={{ textAlign: 'center', padding: '2rem', borderTop: `4px solid ${getLabelColor(myStats.performanceLabel)}` }}>
                  <h3 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-muted)' }}>Weighted Score</h3>
                  <div style={{ fontSize: '3.5rem', fontWeight: 'bold', color: getLabelColor(myStats.performanceLabel), lineHeight: '1' }}>{myStats.performanceScore}%</div>
                  <div style={{ marginTop: '1rem', display: 'inline-block', background: '#f8fafc', padding: '0.5rem 1rem', borderRadius: '99px', fontWeight: 'bold', color: getLabelColor(myStats.performanceLabel) }}>{myStats.performanceLabel}</div>
                </div>

                <div className="card shadow-sm" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '2rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.5rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Total Objectives</span>
                    <span style={{ fontWeight: 'bold', fontSize: '1.2rem' }}>{myStats.totalObjectives}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.5rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Total Weight</span>
                    <span style={{ fontWeight: 'bold', fontSize: '1.2rem', color: myStats.totalWeight <= 100 ? '#16a34a' : '#dc2626' }}>{myStats.totalWeight}%</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Avg Rating</span>
                    <span style={{ fontWeight: 'bold', fontSize: '1.2rem' }}>{myStats.averageRating || 'N/A'}</span>
                  </div>
                </div>
              </div>

              <h3>Objective Breakdown</h3>
              <div style={{ display: 'grid', gap: '1rem' }}>
                {(myStats.objectives || []).map((objective) => (
                  <div key={objective._id} className="card" style={{ padding: '1rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <h4 style={{ margin: '0 0 0.25rem 0' }}>{objective.title}</h4>
                      <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)' }}>Weight: {objective.weight}% · Status: {objective.status}</p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--primary-dark)' }}>Progress: {objective.achievementPercent}%</div>
                      <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Score: {objective.weightedScore}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {viewMode === 'team' && (
            <div>
              {teamStats.length === 0 ? (
                <div className="empty-state">No team performance data available for this cycle.</div>
              ) : (
                <div style={{ overflowX: 'auto', background: '#fff', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                  <table style={{ minWidth: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '2px solid var(--border-color)', textAlign: 'left' }}>
                        <th style={{ padding: '1rem 1.5rem' }}>Employee</th>
                        <th style={{ padding: '1rem 1.5rem' }}>Objectives</th>
                        <th style={{ padding: '1rem 1.5rem' }}>Weight</th>
                        <th style={{ padding: '1rem 1.5rem' }}>Score</th>
                        <th style={{ padding: '1rem 1.5rem' }}>Avg Rating</th>
                        <th style={{ padding: '1rem 1.5rem' }}>Label</th>
                      </tr>
                    </thead>
                    <tbody>
                      {teamStats.map((employee) => (
                        <tr key={employee.employeeId} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '1rem 1.5rem', fontWeight: 'bold' }}>{employee.employee?.name || employee.employeeId}</td>
                          <td style={{ padding: '1rem 1.5rem' }}>{employee.totalObjectives}</td>
                          <td style={{ padding: '1rem 1.5rem' }}>{employee.totalWeight}%</td>
                          <td style={{ padding: '1rem 1.5rem', fontWeight: 'bold' }}>{employee.performanceScore}%</td>
                          <td style={{ padding: '1rem 1.5rem' }}>{employee.averageRating || '-'}</td>
                          <td style={{ padding: '1rem 1.5rem', color: getLabelColor(employee.performanceLabel), fontWeight: 'bold' }}>{employee.performanceLabel}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default PerformancePage;
