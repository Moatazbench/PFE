import React, { useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import { useAuth } from '../components/AuthContext';

function Evaluations() {
  const { user } = useAuth();
  const [cycles, setCycles] = useState([]);
  const [objectives, setObjectives] = useState([]);
  const [selectedCycleId, setSelectedCycleId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    setError('');
    try {
      const [cyclesRes, objectivesRes] = await Promise.all([
        api.get('/api/cycles'),
        api.get('/api/objectives/my'),
      ]);

      const cycleData = cyclesRes.data || [];
      const objectiveData = objectivesRes.data?.objectives || [];

      setCycles(cycleData);
      setObjectives(objectiveData);

      if (cycleData.length > 0) {
        const activeCycle = cycleData.find((cycle) => cycle.status !== 'draft') || cycleData[0];
        setSelectedCycleId(activeCycle._id);
      }
    } catch (err) {
      setError('Failed to load assessment overview.');
    } finally {
      setLoading(false);
    }
  }

  const selectedCycle = useMemo(
    () => cycles.find((cycle) => cycle._id === selectedCycleId) || null,
    [cycles, selectedCycleId]
  );

  const cycleObjectives = useMemo(() => {
    return objectives.filter((objective) => {
      const cycleId = objective.cycle?._id || objective.cycle;
      return cycleId === selectedCycleId;
    });
  }, [objectives, selectedCycleId]);

  const groupedObjectives = useMemo(() => {
    return {
      draft: cycleObjectives.filter((objective) => ['draft', 'revision_requested', 'rejected'].includes(objective.status)),
      active: cycleObjectives.filter((objective) => ['approved', 'validated'].includes(objective.status)),
      finalized: cycleObjectives.filter((objective) => ['evaluated', 'locked'].includes(objective.status)),
    };
  }, [cycleObjectives]);

  function formatPhaseDate(value) {
    if (!value) return 'Not set';
    return new Date(value).toLocaleDateString();
  }

  if (loading) {
    return <div className="loading">Loading assessment overview...</div>;
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="page-header__left">
          <h1 className="page-title">Assessments</h1>
          <p className="page-subtitle">Cycle phases, objective progress, and evaluation readiness in one place.</p>
        </div>
        <div className="page-header__actions">
          <select value={selectedCycleId} onChange={(event) => setSelectedCycleId(event.target.value)} className="form-select" style={{ minWidth: '220px' }}>
            {cycles.map((cycle) => (
              <option key={cycle._id} value={cycle._id}>{cycle.name} ({cycle.year})</option>
            ))}
          </select>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      {!selectedCycle ? (
        <div className="empty-state">
          <h3>No cycle selected</h3>
          <p>Create a cycle first to unlock assessments.</p>
        </div>
      ) : (
        <>
          <div className="card" style={{ marginBottom: '1.5rem', padding: '1.5rem' }}>
            <h3 style={{ marginTop: 0 }}>{selectedCycle.name}</h3>
            <p style={{ color: 'var(--text-muted)' }}>Current phase: <strong>{selectedCycle.currentPhase}</strong> · Status: <strong>{selectedCycle.status}</strong></p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
              <div>
                <strong>Phase 1</strong>
                <div>{formatPhaseDate(selectedCycle.phase1Start)} to {formatPhaseDate(selectedCycle.phase1End)}</div>
              </div>
              <div>
                <strong>Phase 2</strong>
                <div>{formatPhaseDate(selectedCycle.phase2Start)} to {formatPhaseDate(selectedCycle.phase2End)}</div>
              </div>
              <div>
                <strong>Phase 3</strong>
                <div>{formatPhaseDate(selectedCycle.phase3Start)} to {formatPhaseDate(selectedCycle.phase3End)}</div>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            <div className="card" style={{ padding: '1.25rem' }}>
              <h4 style={{ marginTop: 0 }}>Draft Objectives</h4>
              <div style={{ fontSize: '2rem', fontWeight: 700 }}>{groupedObjectives.draft.length}</div>
              <p style={{ color: 'var(--text-muted)' }}>Still in setup or revision.</p>
            </div>
            <div className="card" style={{ padding: '1.25rem' }}>
              <h4 style={{ marginTop: 0 }}>Active Objectives</h4>
              <div style={{ fontSize: '2rem', fontWeight: 700 }}>{groupedObjectives.active.length}</div>
              <p style={{ color: 'var(--text-muted)' }}>Approved and contributing to evaluation score.</p>
            </div>
            <div className="card" style={{ padding: '1.25rem' }}>
              <h4 style={{ marginTop: 0 }}>Finalized Objectives</h4>
              <div style={{ fontSize: '2rem', fontWeight: 700 }}>{groupedObjectives.finalized.length}</div>
              <p style={{ color: 'var(--text-muted)' }}>Evaluated or locked for final review.</p>
            </div>
          </div>

          <div className="card" style={{ padding: '1.5rem' }}>
            <h3 style={{ marginTop: 0 }}>Objective Readiness</h3>
            {cycleObjectives.length === 0 ? (
              <p style={{ color: 'var(--text-muted)' }}>No objectives found for this cycle.</p>
            ) : (
              <div style={{ display: 'grid', gap: '1rem' }}>
                {cycleObjectives.map((objective) => (
                  <div key={objective._id} style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', padding: '1rem', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
                    <div>
                      <strong>{objective.title}</strong>
                      <div style={{ color: 'var(--text-muted)', marginTop: '0.25rem' }}>{objective.description || 'No description provided.'}</div>
                    </div>
                    <div style={{ textAlign: 'right', minWidth: '180px' }}>
                      <div><strong>{objective.weight}%</strong> weight</div>
                      <div>{objective.achievementPercent || 0}% progress</div>
                      <div style={{ color: 'var(--text-muted)' }}>{objective.status}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default Evaluations;
