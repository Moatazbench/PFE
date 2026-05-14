import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { useAuth } from '../components/AuthContext';
import { useToast } from '../components/common/Toast';
import { Link } from 'react-router-dom';
import FinalEvaluationEmployee from './FinalEvaluationEmployee';
import FinalEvaluationManager from './FinalEvaluationManager';

function FinalEvaluationPage() {
  const { user } = useAuth();
  const toast = useToast();

  const [cycles, setCycles] = useState([]);
  const [selectedCycleId, setSelectedCycleId] = useState('');
  const [activeCycle, setActiveCycle] = useState(null);
  const [viewMode, setViewMode] = useState(['ADMIN', 'HR'].includes(user?.role) ? 'team' : 'self'); // 'self' or 'team'
  const [loading, setLoading] = useState(true);

  const isManagerRole = ['TEAM_LEADER', 'ADMIN', 'HR'].includes(user?.role);

  useEffect(() => { fetchCycles(); }, []);

  async function fetchCycles() {
    try {
      const res = await api.get('/cycles');
      const data = (Array.isArray(res.data) ? res.data : []).filter(c =>
        (c.currentPhase === 'phase3' || c.currentPhase === 'closed') && c.status !== 'draft'
      );
      setCycles(data);
      if (data.length > 0) {
        const preferredCycle = data.find(c => c.currentPhase === 'phase3') || data[0];
        setSelectedCycleId(preferredCycle._id);
        setActiveCycle(preferredCycle);
      } else {
        setLoading(false);
      }
    } catch (err) {
      toast.error('Failed to load cycles');
      setLoading(false);
    }
  }

  if (loading && !selectedCycleId) {
    return <div className="page-loading"><div className="spinner"></div><p>Loading End-Year phase...</p></div>;
  }

  return (
    <div className="page" style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '2.2rem', color: 'var(--text-dark)' }}>End-Year Evaluations</h1>
          <p className="text-muted" style={{ margin: '0.5rem 0 0 0' }}>Final performance measurement, auto-scoring, and reviews.</p>
          {['ADMIN', 'HR'].includes(user?.role) && (
            <Link to="/hr-validation" style={{ display: 'inline-block', marginTop: '0.85rem', fontWeight: 700 }}>
              Open HR validation queue
            </Link>
          )}
        </div>
        <select
          value={selectedCycleId}
          onChange={(e) => {
            setSelectedCycleId(e.target.value);
            const cycle = cycles.find(c => c._id === e.target.value);
            if (cycle) setActiveCycle(cycle);
          }}
          className="form-control hover-lift"
          style={{ padding: '0.75rem', borderRadius: '8px', minWidth: '200px', fontWeight: 'bold' }}
        >
          {cycles.map(cycle => (
            <option key={cycle._id} value={cycle._id}>{cycle.name}</option>
          ))}
        </select>
      </div>

      {!activeCycle ? (
        <div className="empty-state">No evaluation cycles available.</div>
      ) : (
        <>
          {activeCycle.currentPhase !== 'phase3' && (
            <div className="alert alert--warning" style={{ marginBottom: '2rem', background: '#f8fafc', color: '#475569', padding: '1rem', borderRadius: '8px', borderLeft: '4px solid #64748b' }}>
              <strong>Note:</strong> This cycle is currently {activeCycle.currentPhase}. You can review completed evaluation data here, but new end-year evaluation actions are only available during Phase 3.
            </div>
          )}

          {isManagerRole && (
            <div style={{ display: 'flex', gap: '1rem', borderBottom: '2px solid var(--border-color)', paddingBottom: '1rem', marginBottom: '2rem' }}>
              <button onClick={() => setViewMode('self')} style={{ background: 'none', border: 'none', fontSize: '1.1rem', fontWeight: viewMode === 'self' ? 'bold' : 'normal', color: viewMode === 'self' ? 'var(--primary)' : 'var(--text-muted)', cursor: 'pointer', paddingBottom: '0.5rem', borderBottom: viewMode === 'self' ? '3px solid var(--primary)' : '3px solid transparent' }}>
                My Evaluation
              </button>
              <button onClick={() => setViewMode('team')} style={{ background: 'none', border: 'none', fontSize: '1.1rem', fontWeight: viewMode === 'team' ? 'bold' : 'normal', color: viewMode === 'team' ? 'var(--primary)' : 'var(--text-muted)', cursor: 'pointer', paddingBottom: '0.5rem', borderBottom: viewMode === 'team' ? '3px solid var(--primary)' : '3px solid transparent' }}>
                Team Evaluations
              </button>
            </div>
          )}

          {viewMode === 'self' ? (
            <FinalEvaluationEmployee cycleId={selectedCycleId} activeCycle={activeCycle} />
          ) : (
            <FinalEvaluationManager cycleId={selectedCycleId} activeCycle={activeCycle} />
          )}
        </>
      )}
    </div>
  );
}

export default FinalEvaluationPage;
