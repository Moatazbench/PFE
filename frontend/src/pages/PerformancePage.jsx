import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../components/AuthContext';
import { useToast } from '../components/common/Toast';

function PerformancePage() {
  const { user } = useAuth();
  const toast = useToast();
  
  const [cycles, setCycles] = useState([]);
  const [selectedCycleId, setSelectedCycleId] = useState('');
  const [viewMode, setViewMode] = useState('self'); // 'self' | 'team'
  
  const [myStats, setMyStats] = useState(null);
  const [teamStats, setTeamStats] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchCycles(); }, []);
  useEffect(() => { 
    if (selectedCycleId) fetchPerformanceData(); 
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

  async function fetchPerformanceData() {
    setLoading(true);
    try {
      // My Performance
      const myRes = await api.get(`/api/performance/summary/${user.id}/${selectedCycleId}`);
      setMyStats(myRes.data);

      // Team Performance (if manager)
      if (['TEAM_LEADER', 'MANAGER', 'ADMIN', 'HR'].includes(user.role)) {
        const tRes = await api.get(`/api/performance/team-summary/${user.id}/${selectedCycleId}`);
        setTeamStats(tRes.data.team || []);
      }
    } catch (err) {
      toast.error('Failed to load performance summary');
    } finally {
      setLoading(false);
    }
  }

  const getLabelColor = (label) => {
    if (label === 'Exceeded Expectations') return '#8b5cf6';
    if (label === 'Achieved') return '#22c55e';
    if (label === 'Partially Achieved') return '#eab308';
    return '#ef4444';
  };

  if (loading && !selectedCycleId) return <div className="page-loading"><div className="spinner"></div><p>Loading performance data...</p></div>;

  return (
    <div className="page" style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '2.2rem', color: 'var(--text-dark)' }}>🏆 Performance Summaries</h1>
          <p className="text-muted" style={{ margin: '0.5rem 0 0 0' }}>View weighted performance statistics for the cycle.</p>
        </div>
        <select value={selectedCycleId} onChange={e => setSelectedCycleId(e.target.value)} className="form-control hover-lift" style={{ padding: '0.75rem', borderRadius: '8px', minWidth: '200px', fontWeight: 'bold' }}>
          {cycles.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
        </select>
      </div>

      {!selectedCycleId ? (
        <div className="empty-state">No cycles available.</div>
      ) : (
        <>
          {['TEAM_LEADER', 'MANAGER', 'ADMIN', 'HR'].includes(user.role) && (
             <div style={{ display: 'flex', gap: '1rem', borderBottom: '2px solid var(--border-color)', paddingBottom: '1rem', marginBottom: '2rem' }}>
              <button onClick={() => setViewMode('self')} style={{ background:'none', border:'none', fontSize:'1.1rem', fontWeight: viewMode === 'self' ? 'bold' : 'normal', color: viewMode === 'self' ? 'var(--primary)' : 'var(--text-muted)', cursor: 'pointer', paddingBottom:'0.5rem', borderBottom: viewMode === 'self' ? '3px solid var(--primary)' : '3px solid transparent' }}>
                My Performance
              </button>
              <button onClick={() => setViewMode('team')} style={{ background:'none', border:'none', fontSize:'1.1rem', fontWeight: viewMode === 'team' ? 'bold' : 'normal', color: viewMode === 'team' ? 'var(--primary)' : 'var(--text-muted)', cursor: 'pointer', paddingBottom:'0.5rem', borderBottom: viewMode === 'team' ? '3px solid var(--primary)' : '3px solid transparent' }}>
                Team Summary
              </button>
            </div>
          )}

          {viewMode === 'self' && myStats && (
            <div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(280px, 1fr))', gap:'1.5rem', marginBottom:'2rem' }}>
                <div className="card shadow-sm" style={{ textAlign:'center', padding:'2rem', borderTop: `4px solid ${getLabelColor(myStats.performanceLabel)}` }}>
                  <h3 style={{ margin:'0 0 0.5rem 0', color:'var(--text-muted)' }}>Weighted Score</h3>
                  <div style={{ fontSize:'3.5rem', fontWeight:'bold', color: getLabelColor(myStats.performanceLabel), lineHeight:'1' }}>{myStats.performanceScore}%</div>
                  <div style={{ marginTop:'1rem', display:'inline-block', background:'#f8fafc', padding:'0.5rem 1rem', borderRadius:'99px', fontWeight:'bold', color: getLabelColor(myStats.performanceLabel) }}>{myStats.performanceLabel}</div>
                </div>

                <div className="card shadow-sm" style={{ display:'flex', flexDirection:'column', justifyContent:'center', padding:'2rem' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'1rem', borderBottom:'1px solid #f1f5f9', paddingBottom:'0.5rem' }}>
                     <span style={{ color:'var(--text-muted)' }}>Total Goals</span>
                     <span style={{ fontWeight:'bold', fontSize:'1.2rem' }}>{myStats.totalGoals}</span>
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'1rem', borderBottom:'1px solid #f1f5f9', paddingBottom:'0.5rem' }}>
                     <span style={{ color:'var(--text-muted)' }}>Total Weight</span>
                     <span style={{ fontWeight:'bold', fontSize:'1.2rem', color: myStats.totalWeight === 100 ? '#22c55e' : '#ef4444' }}>{myStats.totalWeight}%</span>
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between' }}>
                     <span style={{ color:'var(--text-muted)' }}>Avg Manager Rating</span>
                     <span style={{ fontWeight:'bold', fontSize:'1.2rem' }}>{myStats.averageRating || 'N/A'} {myStats.averageRating && ' / 5'}</span>
                  </div>
                </div>
              </div>

              <h3>Goal Breakdown</h3>
              <div style={{ display:'grid', gap:'1rem' }}>
                {myStats.goals.map((g, idx) => (
                  <div key={idx} className="card" style={{ padding:'1rem 1.5rem', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <div>
                      <h4 style={{ margin:'0 0 0.25rem 0' }}>{g.title}</h4>
                      <p style={{ margin:0, fontSize:'0.9rem', color:'var(--text-muted)' }}>Weight: {g.weight}%</p>
                    </div>
                    <div style={{ textAlign:'right' }}>
                      <div style={{ fontSize:'1.2rem', fontWeight:'bold', color:'var(--primary-dark)' }}>Current: {g.progress}%</div>
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
                <div style={{ overflowX: 'auto', background:'#fff', borderRadius:'8px', boxShadow:'0 1px 3px rgba(0,0,0,0.1)' }}>
                  <table style={{ minWidth:'100%', borderCollapse:'collapse' }}>
                    <thead>
                      <tr style={{ background:'#f8fafc', borderBottom:'2px solid var(--border-color)', textAlign:'left' }}>
                        <th style={{ padding:'1rem 1.5rem' }}>Employee</th>
                        <th style={{ padding:'1rem 1.5rem' }}>Total Goals</th>
                        <th style={{ padding:'1rem 1.5rem' }}>Total Weight</th>
                        <th style={{ padding:'1rem 1.5rem' }}>Weighted Score</th>
                        <th style={{ padding:'1rem 1.5rem' }}>Avg Rating</th>
                        <th style={{ padding:'1rem 1.5rem' }}>Performance Label</th>
                      </tr>
                    </thead>
                    <tbody>
                      {teamStats.map((emp, i) => (
                        <tr key={i} style={{ borderBottom:'1px solid var(--border-color)' }}>
                          <td style={{ padding:'1rem 1.5rem', fontWeight:'bold' }}>{emp.employee.name}</td>
                          <td style={{ padding:'1rem 1.5rem' }}>{emp.totalGoals}</td>
                          <td style={{ padding:'1rem 1.5rem' }}><span style={{ color: emp.totalWeight === 100 ? 'inherit' : '#ef4444' }}>{emp.totalWeight}%</span></td>
                          <td style={{ padding:'1rem 1.5rem', fontWeight:'bold' }}>{emp.performanceScore}%</td>
                          <td style={{ padding:'1rem 1.5rem' }}>{emp.averageRating || '-'}</td>
                          <td style={{ padding:'1rem 1.5rem' }}>
                            <span style={{ color: getLabelColor(emp.performanceLabel), fontWeight:'bold' }}>{emp.performanceLabel}</span>
                          </td>
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
