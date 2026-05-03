import React, { useState, useEffect } from 'react';
import { useAuth } from '../components/AuthContext';
import ConfirmDialog from '../components/common/ConfirmDialog';
import { useToast, ToastContainer } from '../components/common/Toast';
import api from '../services/api';

function Cycles() {
  var { user } = useAuth();
  var toast = useToast();
  var [cycles, setCycles] = useState([]);
  var [loading, setLoading] = useState(true);
  var [showModal, setShowModal] = useState(false);
  var [editingCycle, setEditingCycle] = useState(null);
  var [confirmPhaseStart, setConfirmPhaseStart] = useState(null);
  var [phaseCheckResult, setPhaseCheckResult] = useState(null);
  var [showBlockedModal, setShowBlockedModal] = useState(false);
  var [checkingPhase, setCheckingPhase] = useState(null);

  var [formData, setFormData] = useState({
    name: '', year: new Date().getFullYear(), status: 'draft',
    phase1Start: '', phase1End: '', phase2Start: '', phase2End: '', phase3Start: '', phase3End: ''
  });
  var [error, setError] = useState('');

  async function fetchCycles() {
    try {
      var res = await api.get('/api/cycles');
      setCycles(res.data);
    } catch (err) {
      toast.error('Failed to fetch cycles.');
    } finally { setLoading(false); }
  }

  useEffect(function() { fetchCycles(); }, []);

  function openCreateModal() {
    setEditingCycle(null);
    setFormData({ name: '', year: new Date().getFullYear(), status: 'draft', phase1Start: '', phase1End: '', phase2Start: '', phase2End: '', phase3Start: '', phase3End: '' });
    setShowModal(true); setError('');
  }

  function openEditModal(cycle) {
    setEditingCycle(cycle);
    setFormData({
      name: cycle.name || '', year: cycle.year || new Date().getFullYear(), status: cycle.status || 'draft',
      phase1Start: cycle.phase1Start ? cycle.phase1Start.substring(0, 10) : '',
      phase1End: cycle.phase1End ? cycle.phase1End.substring(0, 10) : '',
      phase2Start: cycle.phase2Start ? cycle.phase2Start.substring(0, 10) : '',
      phase2End: cycle.phase2End ? cycle.phase2End.substring(0, 10) : '',
      phase3Start: cycle.phase3Start ? cycle.phase3Start.substring(0, 10) : '',
      phase3End: cycle.phase3End ? cycle.phase3End.substring(0, 10) : ''
    });
    setShowModal(true); setError('');
  }

  async function handleSubmit(e) {
    e.preventDefault(); setError('');
    try {
      if (editingCycle) {
        await api.put('/api/cycles/' + editingCycle._id, formData);
        toast.success('Cycle updated successfully!');
      } else {
        await api.post('/api/cycles', formData);
        toast.success('Cycle created successfully!');
      }
      setShowModal(false); fetchCycles();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save cycle.');
    }
  }

  async function handleDelete(cycle) {
    try {
      await api.delete('/api/cycles/' + cycle._id);
      toast.success('Cycle deleted.'); fetchCycles();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete cycle.');
    }
  }

async function handlePhasePreCheck(cycle) {
  // Admins bypass all checks — advance freely
  if (user.role === 'ADMIN') {
    setConfirmPhaseStart(cycle);
    return;
  }

  if (cycle.status === 'draft') {
    setConfirmPhaseStart(cycle);
    return;
  }

  setCheckingPhase(cycle._id);
  try {
    var res = await api.get('/api/cycles/' + cycle._id + '/phase-check');
    if (res.data.ready) {
      setConfirmPhaseStart(cycle);
    } else {
      setPhaseCheckResult(res.data);
      setShowBlockedModal(true);
    }
  } catch (err) {
    toast.error(err.response?.data?.message || 'Failed to check phase readiness.');
  } finally {
    setCheckingPhase(null);
  }
}

  async function handlePhaseAdvanceConfirm() {
    var cycle = confirmPhaseStart;
    var nextPhase = 'phase1';
    if (cycle.status === 'draft') nextPhase = 'phase1';
    else if (cycle.currentPhase === 'phase1') nextPhase = 'phase2';
    else if (cycle.currentPhase === 'phase2') nextPhase = 'phase3';
    else if (cycle.currentPhase === 'phase3') nextPhase = 'closed';
    try {
      await api.patch('/api/cycles/' + cycle._id + '/phase', { currentPhase: nextPhase });
      toast.success('Advanced to ' + (nextPhase === 'closed' ? 'Closed' : 'Phase ' + nextPhase.replace('phase', '')));
      setConfirmPhaseStart(null); fetchCycles();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to change phase.');
      setConfirmPhaseStart(null);
    }
  }

  async function handleRollback(cycle) {
    try {
      await api.post('/api/cycles/' + cycle._id + '/rollback');
      toast.success('Phase rolled back to Phase 1 (Goal Setting).');
      setShowModal(false);
      setEditingCycle(null);
      fetchCycles();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to roll back phase.');
    }
  }

  function formatDate(d) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  function getPhaseLabel(phase) {
    if (phase === 'phase1') return 'Phase 1 · Goal Setting';
    if (phase === 'phase2') return 'Phase 2 · Mid-Year Execution';
    if (phase === 'phase3') return 'Phase 3 · End-Year';
    return 'Closed';
  }

  if (loading) return (
    <div className="ent-loading">
      <div className="ent-spinner"></div>
      <p style={{ color: 'var(--shell-text-secondary)', fontSize: '14px' }}>Loading cycles...</p>
    </div>
  );

  return (
    <div>
      {/* Page Header */}
      <div className="ent-page-header">
        <div>
          <h1 className="ent-page-header__title">Annual Cycles</h1>
          <p className="ent-page-header__subtitle">Configure and manage the 3-phase performance lifecycle</p>
        </div>
        {(user.role === 'ADMIN' || user.role === 'HR') && (
          <div className="ent-page-header__actions">
            <button onClick={openCreateModal} className="ent-btn ent-btn--primary">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Create Cycle
            </button>
          </div>
        )}
      </div>

      {/* Cycles Grid */}
      {cycles.length === 0 ? (
        <div className="ent-empty">
          <div className="ent-empty__icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
          </div>
          <p className="ent-empty__title">No cycles yet</p>
          <p className="ent-empty__text">Create your first annual evaluation cycle to begin the performance process.</p>
        </div>
      ) : (
        <div className="ent-grid ent-grid--2">
          {cycles.map(function(cycle) {
            var isActive = cycle.status === 'in_progress';
            var isClosed = cycle.status === 'closed';
            var isDraft = cycle.status === 'draft';

            var phases = [
              { key: 'phase1', label: 'Goal Setting', start: cycle.phase1Start, end: cycle.phase1End, color: '#4F46E5' },
              { key: 'phase2', label: 'Mid-Year Execution', start: cycle.phase2Start, end: cycle.phase2End, color: '#2563EB' },
              { key: 'phase3', label: 'End-Year Review', start: cycle.phase3Start, end: cycle.phase3End, color: '#7C3AED' },
            ];

            return (
              <div key={cycle._id} className={'ent-card' + (isActive ? ' ent-card--active' : '')}>
                {/* Card Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                  <div>
                    <h3 style={{ margin: '0 0 4px', fontSize: '16px', fontWeight: 700, letterSpacing: '-0.3px' }}>{cycle.name}</h3>
                    <span style={{ fontSize: '13px', color: 'var(--shell-text-secondary)' }}>Fiscal Year {cycle.year}</span>
                  </div>
                  <span className={'ent-badge ent-badge--dot' + (isDraft ? ' ent-badge--draft' : isClosed ? ' ent-badge--closed' : ' ent-badge--active')}>
                    {isDraft ? 'Draft' : isClosed ? 'Closed' : getPhaseLabel(cycle.currentPhase)}
                  </span>
                </div>

                {/* Phase Timeline */}
                <div style={{ background: 'var(--shell-bg-inset)', borderRadius: 'var(--shell-radius-md)', padding: '14px 16px', marginBottom: '20px' }}>
                  {phases.map(function(p) {
                    var isCurrent = isActive && cycle.currentPhase === p.key;
                    return (
                      <div key={p.key} className={'ent-phase-row' + (isCurrent ? ' ent-phase-row--active' : '')}>
                        <div className="ent-phase-row__label">
                          <span className="ent-phase-row__dot" style={isCurrent ? { background: p.color } : {}}></span>
                          {p.label}
                        </div>
                        <span className="ent-phase-row__dates">{formatDate(p.start)} — {formatDate(p.end)}</span>
                      </div>
                    );
                  })}
                </div>

                {/* Actions */}
                {(user.role === 'ADMIN' || user.role === 'HR') && (
                  <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid var(--shell-border)', paddingTop: '16px' }}>
                    <button className="ent-btn ent-btn--secondary ent-btn--sm" onClick={function(){openEditModal(cycle);}}>Edit</button>
                    {user.role === 'ADMIN' && (
                      <button className="ent-btn ent-btn--danger ent-btn--sm" onClick={function(){handleDelete(cycle);}}>Delete</button>
                    )}
                    {!isClosed && (
                      <button className="ent-btn ent-btn--primary ent-btn--sm" style={{ marginLeft: 'auto' }} onClick={function(){handlePhasePreCheck(cycle);}} disabled={checkingPhase === cycle._id}>
                        {checkingPhase === cycle._id ? 'Checking...' : (isDraft ? 'Start Cycle' : 'Advance Phase')}
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* CREATE / EDIT MODAL */}
      {showModal && (
        <div className="ent-modal-overlay">
          <div className="ent-modal">
            {/* Modal Header */}
            <div className="ent-modal__header">
              <h3 className="ent-modal__title">{editingCycle ? 'Edit Cycle' : 'Create Cycle'}</h3>
              <button className="ent-modal__close" onClick={function(){setShowModal(false);}}>×</button>
            </div>

            {/* Modal Body */}
            <div className="ent-modal__body">
              {error && <div className="ent-alert ent-alert--danger" style={{marginBottom:'16px'}}>{error}</div>}

              <form id="cycleForm" onSubmit={handleSubmit}>
                <div style={{ marginBottom:'20px' }}>
                  <label className="ent-label">Cycle Name <span style={{color:'var(--shell-danger)'}}>*</span></label>
                  <input className="ent-input" type="text" value={formData.name} onChange={function(e){setFormData({...formData, name: e.target.value});}} placeholder="e.g., Annual Performance 2026" required />
                </div>

                <div style={{ display:'flex', gap:'16px', marginBottom:'24px' }}>
                  <div style={{ flex:1 }}>
                    <label className="ent-label">Year <span style={{color:'var(--shell-danger)'}}>*</span></label>
                    <input className="ent-input" type="number" value={formData.year} onChange={function(e){setFormData({...formData, year: e.target.value});}} min="2020" max="2050" required />
                  </div>
                  <div style={{ flex:1 }}>
                    <label className="ent-label">Status</label>
                    <select className="ent-select" value={formData.status} disabled><option value="draft">Draft</option><option value="in_progress">In Progress</option><option value="closed">Closed</option></select>
                  </div>
                </div>

                {[
                  { label: 'Phase 1: Goal Setting', startKey: 'phase1Start', endKey: 'phase1End', color: '#4F46E5' },
                  { label: 'Phase 2: Mid-Year Execution', startKey: 'phase2Start', endKey: 'phase2End', color: '#2563EB' },
                  { label: 'Phase 3: End-Year Review', startKey: 'phase3Start', endKey: 'phase3End', color: '#7C3AED' }
                ].map(function(phase) {
                  return (
                    <div key={phase.label} style={{ background:'var(--shell-bg-inset)', borderRadius:'var(--shell-radius-md)', padding:'16px', marginBottom:'12px', borderLeft:'3px solid ' + phase.color }}>
                      <h4 style={{ margin:'0 0 12px', fontSize:'13px', fontWeight:600, color: phase.color }}>{phase.label}</h4>
                      <div style={{ display:'flex', gap:'12px' }}>
                        <div style={{ flex:1 }}>
                          <label className="ent-label" style={{ fontSize:'12px', color:'var(--shell-text-secondary)' }}>Start</label>
                          <input className="ent-input" type="date" value={formData[phase.startKey]} onChange={function(e){var upd = {}; upd[phase.startKey] = e.target.value; setFormData({...formData, ...upd});}} required />
                        </div>
                        <div style={{ flex:1 }}>
                          <label className="ent-label" style={{ fontSize:'12px', color:'var(--shell-text-secondary)' }}>End</label>
                          <input className="ent-input" type="date" value={formData[phase.endKey]} onChange={function(e){var upd = {}; upd[phase.endKey] = e.target.value; setFormData({...formData, ...upd});}} required />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </form>
            </div>

            {/* Modal Footer */}
            <div className="ent-modal__footer">
              {user.role === 'ADMIN' && editingCycle && editingCycle.currentPhase === 'phase2' && (
                <button type="button" className="ent-btn ent-btn--secondary" onClick={function(){handleRollback(editingCycle);}}>
                  Roll Back to Phase 1
                </button>
              )}
              <button type="button" className="ent-btn ent-btn--secondary" onClick={function(){setShowModal(false);}}>Cancel</button>
              <button type="submit" form="cycleForm" className="ent-btn ent-btn--primary">{editingCycle ? 'Update Cycle' : 'Create Cycle'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Phase Advance Confirmation */}
      {confirmPhaseStart && (function() {
        var cycle = confirmPhaseStart;
        var nextPhase = 'phase1';
        var msg = 'Start Phase 1: Goal Setting? This will officially open the cycle.';
        if (cycle.status === 'draft') nextPhase = 'phase1';
        else if (cycle.currentPhase === 'phase1') { nextPhase = 'phase2'; msg = 'Advance to Mid-Year Execution? Goal structure will be locked. Progress tracking and assessments will open.'; }
        else if (cycle.currentPhase === 'phase2') { nextPhase = 'phase3'; msg = 'Advance to Phase 3: End-Year? Mid-year metrics will be locked.'; }
        else if (cycle.currentPhase === 'phase3') { nextPhase = 'closed'; msg = 'Close this cycle? All data will be locked permanently.'; }
        return (
          <ConfirmDialog
            open={!!confirmPhaseStart} title="Advance Phase" message={msg}
            confirmLabel={nextPhase === 'closed' ? 'Close Cycle' : 'Proceed to ' + nextPhase.replace('phase', 'Phase ')}
            danger={nextPhase === 'closed'}
            onConfirm={handlePhaseAdvanceConfirm}
            onCancel={function(){setConfirmPhaseStart(null);}}
          />
        );
      })()}

      {showBlockedModal && phaseCheckResult && (
        <div className="ent-modal-overlay">
          <div className="ent-modal" style={{ maxWidth: '720px' }}>
            <div className="ent-modal__header">
              <h3 className="ent-modal__title">Phase Advance Blocked</h3>
              <button className="ent-modal__close" onClick={function(){setShowBlockedModal(false); setPhaseCheckResult(null);}}>Ã—</button>
            </div>
            <div className="ent-modal__body">
              <div className="ent-alert ent-alert--danger" style={{ marginBottom: '16px' }}>
                {(phaseCheckResult.issues || []).join(' ')}
              </div>
              {(phaseCheckResult.unapprovedObjectives || []).length > 0 && (
                <div>
                  <h4 style={{ margin: '0 0 12px', fontSize: '14px' }}>Unapproved Objectives</h4>
                  <div style={{ display: 'grid', gap: '10px' }}>
                    {(phaseCheckResult.unapprovedObjectives || []).map(function(objective) {
                      return (
                        <div key={objective._id} style={{ border: '1px solid var(--shell-border)', borderRadius: '10px', padding: '12px 14px', background: 'var(--shell-bg-inset)' }}>
                          <div style={{ fontWeight: 700, marginBottom: '4px' }}>{objective.title}</div>
                          <div style={{ fontSize: '13px', color: 'var(--shell-text-secondary)' }}>
                            Owner: {objective.owner} | Status: {objective.status}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
            <div className="ent-modal__footer">
              <button type="button" className="ent-btn ent-btn--primary" onClick={function(){setShowBlockedModal(false); setPhaseCheckResult(null);}}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <ToastContainer toasts={toast.toasts} removeToast={toast.removeToast} />
    </div>
  );
}

export default Cycles;
