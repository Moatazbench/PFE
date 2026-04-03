import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../components/AuthContext';
import ConfirmDialog from '../components/common/ConfirmDialog';
import { useToast } from '../components/common/Toast';
import api from '../services/api';

function Cycles() {
  const { user } = useAuth();
  const toast = useToast();
  const [cycles, setCycles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCycle, setEditingCycle] = useState(null);
  const [confirmPhaseStart, setConfirmPhaseStart] = useState(null);


  const [formData, setFormData] = useState({
    name: '',
    year: new Date().getFullYear(),
    status: 'draft',
    phase1Start: '', phase1End: '',
    phase2Start: '', phase2End: '',
    phase3Start: '', phase3End: ''
  });

  const [error, setError] = useState('');

  async function fetchCycles() {
    try {
      const res = await api.get('/api/cycles');
      setCycles(res.data);
    } catch (err) {
      console.error('Fetch cycles error:', err);
      toast.error('Failed to fetch cycles.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchCycles();
  }, []);

  function openCreateModal() {
    setEditingCycle(null);
    setFormData({
      name: '',
      year: new Date().getFullYear(),
      status: 'draft',
      phase1Start: '', phase1End: '',
      phase2Start: '', phase2End: '',
      phase3Start: '', phase3End: ''
    });
    setShowModal(true);
    setError('');
  }

  function openEditModal(cycle) {
    setEditingCycle(cycle);
    setFormData({
      name: cycle.name || '',
      year: cycle.year || new Date().getFullYear(),
      status: cycle.status || 'draft',
      phase1Start: cycle.phase1Start ? cycle.phase1Start.substring(0, 10) : '',
      phase1End: cycle.phase1End ? cycle.phase1End.substring(0, 10) : '',
      phase2Start: cycle.phase2Start ? cycle.phase2Start.substring(0, 10) : '',
      phase2End: cycle.phase2End ? cycle.phase2End.substring(0, 10) : '',
      phase3Start: cycle.phase3Start ? cycle.phase3Start.substring(0, 10) : '',
      phase3End: cycle.phase3End ? cycle.phase3End.substring(0, 10) : ''
    });
    setShowModal(true);
    setError('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    
    try {
      if (editingCycle) {
        await api.put(`/api/cycles/${editingCycle._id}`, formData);
        toast.success('Cycle updated successfully!');
      } else {
        await api.post('/api/cycles', formData);
        toast.success('Cycle created successfully!');
      }
      setShowModal(false);
      fetchCycles();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save cycle. Please try again.');
    }
  }

  async function handleDelete(cycle) {
    try {
      await api.delete(`/api/cycles/${cycle._id}`);
      toast.success('Cycle deleted successfully!');
      fetchCycles();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete cycle');
    }
  }

  async function handlePhaseAdvanceConfirm() {
    const cycle = confirmPhaseStart;
    let nextPhase = 'phase1';
    
    if (cycle.currentPhase === 'phase1') nextPhase = 'phase2';
    else if (cycle.currentPhase === 'phase2') nextPhase = 'phase3';
    else if (cycle.currentPhase === 'phase3') nextPhase = 'closed';

    try {
      await api.patch(`/api/cycles/${cycle._id}/phase`, { currentPhase: nextPhase });
      toast.success(`Successfully advanced to ${nextPhase === 'closed' ? 'Closed' : 'Phase ' + nextPhase.replace('phase','')}`);
      setConfirmPhaseStart(null);
      fetchCycles();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to change phase');
      setConfirmPhaseStart(null);
    }
  }

  function getStatusBadge(status, phase) {
    if (status === 'draft') return <span className="badge" style={{background:'#64748b', color:'#fff'}}>Draft</span>;
    if (status === 'closed') return <span className="badge" style={{background:'#0f172a', color:'#fff'}}>Closed</span>;
    
    // Active / in_progress
    const phaseLabels = {
      'phase1': 'Phase 1: Goal Setting',
      'phase2': 'Phase 2: Mid-Year',
      'phase3': 'Phase 3: End-Year'
    };
    return <span className="badge" style={{background:'#10b981', color:'#fff'}}>{phaseLabels[phase] || 'Active'}</span>;
  }

  function formatDate(d) {
    if (!d) return '--';
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  if (loading) return <div className="page-loading"><div className="spinner"></div><p>Loading Cycles...</p></div>;

  return (
    <div className="page" style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '2rem', color: 'var(--text-dark)' }}>🔄 Annual Cycles</h1>
          <p className="text-muted" style={{ margin: '0.5rem 0 0 0' }}>Manage the 3-phase performance lifecycle.</p>
        </div>
        {(user.role === 'ADMIN' || user.role === 'HR') && (
          <button onClick={openCreateModal} className="btn btn--primary" style={{ padding: '0.75rem 1.5rem', fontWeight:'bold' }}>+ Create Cycle</button>
        )}
      </div>

      {cycles.length === 0 ? (
        <div style={{ textAlign:'center', padding:'4rem', background:'var(--bg-main)', borderRadius:'12px', border:'1px dashed var(--border-color)' }}>
          <span style={{ fontSize:'3rem' }}>📅</span>
          <h3>No Cycles Found</h3>
          <p className="text-muted">Create your first annual evaluation cycle to begin the performance process.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '1.5rem', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))' }}>
          {cycles.map(cycle => (
            <div key={cycle._id} className="card shadow-sm hover-lift" style={{ borderTop: cycle.status === 'in_progress' ? '4px solid #10b981' : 'none' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'1.5rem' }}>
                <div>
                  <h3 style={{ margin: '0 0 0.5rem 0', color:'var(--primary-dark)' }}>{cycle.name}</h3>
                  <div style={{ fontSize:'0.9rem', color:'var(--text-muted)' }}>Year: <strong>{cycle.year}</strong></div>
                </div>
                {getStatusBadge(cycle.status, cycle.currentPhase)}
              </div>

              <div style={{ background:'var(--bg-light)', padding:'1rem', borderRadius:'8px', marginBottom:'1.5rem' }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'0.5rem', fontSize:'0.9rem' }}>
                  <span style={{ fontWeight: cycle.currentPhase==='phase1'?'bold':'normal', color:cycle.currentPhase==='phase1'?'var(--primary)':'var(--text-muted)' }}>
                    🎯 Phase 1 (Goals)
                  </span>
                  <span>{formatDate(cycle.phase1Start)} - {formatDate(cycle.phase1End)}</span>
                </div>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'0.5rem', fontSize:'0.9rem' }}>
                  <span style={{ fontWeight: cycle.currentPhase==='phase2'?'bold':'normal', color:cycle.currentPhase==='phase2'?'#3b82f6':'var(--text-muted)' }}>
                    ⚖️ Phase 2 (Mid-Year)
                  </span>
                  <span>{formatDate(cycle.phase2Start)} - {formatDate(cycle.phase2End)}</span>
                </div>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.9rem' }}>
                  <span style={{ fontWeight: cycle.currentPhase==='phase3'?'bold':'normal', color:cycle.currentPhase==='phase3'?'#8b5cf6':'var(--text-muted)' }}>
                    📝 Phase 3 (End-Year)
                  </span>
                  <span>{formatDate(cycle.phase3Start)} - {formatDate(cycle.phase3End)}</span>
                </div>
              </div>

              {(user.role === 'ADMIN' || user.role === 'HR') && (
                <div style={{ display:'flex', gap:'0.5rem', borderTop:'1px solid var(--border-color)', paddingTop:'1rem' }}>
                  <button className="btn btn--outline btn--sm" style={{ flex: 1 }} onClick={() => openEditModal(cycle)}>✏️ Edit</button>
                  {user.role === 'ADMIN' && (
                    <button className="btn btn--outline btn--sm" style={{ color:'var(--danger)', borderColor:'var(--danger)' }} onClick={() => handleDelete(cycle)}>🗑️ Delete</button>
                  )}
                  {cycle.status !== 'closed' && (
                    <button className="btn btn--primary btn--sm" style={{ flex: 2 }} onClick={() => setConfirmPhaseStart(cycle)}>
                      {cycle.status === 'draft' ? 'Start Cycle' : 'Advance Phase ⏭️'}
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* CREATE / EDIT MODAL */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: '600px', width: '90%' }}>
            <div className="modal-header">
              <h3>{editingCycle ? '✏️ Edit Annual Cycle' : '📅 Create Annual Cycle'}</h3>
              <button onClick={() => setShowModal(false)} className="close-btn" style={{ background:'transparent', border:'none', fontSize:'1.5rem', cursor:'pointer' }}>×</button>
            </div>
            <div className="modal-body" style={{ padding: '1.5rem' }}>
              {error && <div className="alert alert--danger highlight-warning" style={{ marginBottom:'1rem', padding:'1rem', background:'#fef2f2', color:'#b91c1c', border:'1px solid #fecaca', borderRadius:'6px' }}>{error}</div>}
              
              <form id="cycleForm" onSubmit={handleSubmit}>
                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label style={{ display:'block', marginBottom:'0.5rem', fontWeight:'600' }}>Cycle Name <span style={{color:'red'}}>*</span></label>
                  <input type="text" className="form-control hover-lift" style={{ width:'100%', padding:'0.75rem', border:'1px solid var(--border-color)', borderRadius:'6px' }} value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="e.g., Annual Performance 2026" required />
                </div>
                
                <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label style={{ display:'block', marginBottom:'0.5rem', fontWeight:'600' }}>Year <span style={{color:'red'}}>*</span></label>
                    <input type="number" className="form-control" style={{ width:'100%', padding:'0.75rem', border:'1px solid var(--border-color)', borderRadius:'6px' }} value={formData.year} onChange={e => setFormData({...formData, year: e.target.value})} min="2020" max="2050" required />
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label style={{ display:'block', marginBottom:'0.5rem', fontWeight:'600' }}>Status</label>
                    <select className="form-control" style={{ width:'100%', padding:'0.75rem', border:'1px solid var(--border-color)', borderRadius:'6px', background:'#f8fafc' }} value={formData.status} disabled>
                      <option value="draft">Draft</option>
                      <option value="in_progress">In Progress</option>
                      <option value="closed">Closed</option>
                    </select>
                  </div>
                </div>

                <div style={{ background:'var(--bg-light)', padding:'1rem', borderRadius:'8px', marginBottom:'1.5rem' }}>
                  <h4 style={{ margin:'0 0 1rem 0' }}>🎯 Phase 1: Goal Setting Dates</h4>
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label style={{ display:'block', fontSize:'0.85rem', marginBottom:'0.25rem' }}>Start Date</label>
                      <input type="date" className="form-control" style={{ width:'100%', padding:'0.5rem', border:'1px solid var(--border-color)', borderRadius:'4px' }} value={formData.phase1Start} onChange={e => setFormData({...formData, phase1Start: e.target.value})} required />
                    </div>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label style={{ display:'block', fontSize:'0.85rem', marginBottom:'0.25rem' }}>End Date</label>
                      <input type="date" className="form-control" style={{ width:'100%', padding:'0.5rem', border:'1px solid var(--border-color)', borderRadius:'4px' }} value={formData.phase1End} onChange={e => setFormData({...formData, phase1End: e.target.value})} required />
                    </div>
                  </div>
                </div>

                <div style={{ background:'var(--bg-light)', padding:'1rem', borderRadius:'8px', marginBottom:'1.5rem', borderLeft:'4px solid #3b82f6' }}>
                  <h4 style={{ margin:'0 0 1rem 0' }}>⚖️ Phase 2: Mid-Year Assessment Dates</h4>
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label style={{ display:'block', fontSize:'0.85rem', marginBottom:'0.25rem' }}>Start Date</label>
                      <input type="date" className="form-control" style={{ width:'100%', padding:'0.5rem', border:'1px solid var(--border-color)', borderRadius:'4px' }} value={formData.phase2Start} onChange={e => setFormData({...formData, phase2Start: e.target.value})} required />
                    </div>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label style={{ display:'block', fontSize:'0.85rem', marginBottom:'0.25rem' }}>End Date</label>
                      <input type="date" className="form-control" style={{ width:'100%', padding:'0.5rem', border:'1px solid var(--border-color)', borderRadius:'4px' }} value={formData.phase2End} onChange={e => setFormData({...formData, phase2End: e.target.value})} required />
                    </div>
                  </div>
                </div>

                <div style={{ background:'var(--bg-light)', padding:'1rem', borderRadius:'8px', marginBottom:'1.5rem', borderLeft:'4px solid #8b5cf6' }}>
                  <h4 style={{ margin:'0 0 1rem 0' }}>📝 Phase 3: Final Evaluation Dates</h4>
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label style={{ display:'block', fontSize:'0.85rem', marginBottom:'0.25rem' }}>Start Date</label>
                      <input type="date" className="form-control" style={{ width:'100%', padding:'0.5rem', border:'1px solid var(--border-color)', borderRadius:'4px' }} value={formData.phase3Start} onChange={e => setFormData({...formData, phase3Start: e.target.value})} required />
                    </div>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label style={{ display:'block', fontSize:'0.85rem', marginBottom:'0.25rem' }}>End Date</label>
                      <input type="date" className="form-control" style={{ width:'100%', padding:'0.5rem', border:'1px solid var(--border-color)', borderRadius:'4px' }} value={formData.phase3End} onChange={e => setFormData({...formData, phase3End: e.target.value})} required />
                    </div>
                  </div>
                </div>

              </form>
            </div>
            <div className="modal-footer" style={{ padding:'1rem 1.5rem', borderTop:'1px solid var(--border-color)', display:'flex', justifyContent:'flex-end', gap:'1rem' }}>
              <button type="button" className="btn btn--secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button type="submit" form="cycleForm" className="btn btn--primary" style={{ padding:'0.75rem 2rem', fontWeight:'bold' }}>{editingCycle ? '💾 Update Cycle' : '💾 Create Cycle'}</button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMATION DIALOGS */}


      {confirmPhaseStart && (() => {
        const cycle = confirmPhaseStart;
        let nextPhase = 'phase1';
        let msg = 'Start Phase 1: Goal Setting? This will officially open the cycle and allow employees to create goals.';
        
        if (cycle.currentPhase === 'phase1') {
          nextPhase = 'phase2';
          msg = 'Advance to Phase 2: Mid-Year? This will lock Phase 1 goal creation/editing and enable mid-year assessments.';
        } else if (cycle.currentPhase === 'phase2') {
          nextPhase = 'phase3';
          msg = 'Advance to Phase 3: End-Year? This will lock mid-year metrics and open final evaluations.';
        } else if (cycle.currentPhase === 'phase3') {
          nextPhase = 'closed';
          msg = 'Close Cycle? This will lock all goals and metrics permanently for this performance year.';
        }

        return (
          <ConfirmDialog 
            open={!!confirmPhaseStart} 
            title="Advance Phase" 
            message={msg} 
            confirmLabel={nextPhase === 'closed' ? 'Close Cycle' : `Proceed to ${nextPhase.replace('phase', 'Phase ')}`} 
            danger={nextPhase === 'closed'}
            onConfirm={handlePhaseAdvanceConfirm} 
            onCancel={() => setConfirmPhaseStart(null)} 
          />
        );
      })()}
    </div>
  );
}

export default Cycles;