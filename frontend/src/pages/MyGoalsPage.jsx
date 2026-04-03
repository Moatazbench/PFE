import React, { useState, useEffect, useRef, useCallback } from 'react';
import api from '../services/api';
import { useAuth } from '../components/AuthContext';
import { useToast } from '../components/common/Toast';
import ConfirmDialog from '../components/common/ConfirmDialog';

function MyGoalsPage() {
  const { user } = useAuth();
  const toast = useToast();
  
  const [cycles, setCycles] = useState([]);
  const [selectedCycleId, setSelectedCycleId] = useState('');
  const [activeCycle, setActiveCycle] = useState(null);
  
  const [goals, setGoals] = useState([]);
  const [validationData, setValidationData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [editingGoal, setEditingGoal] = useState(null);
  const [deleteGoalId, setDeleteGoalId] = useState(null);
  const [submitCycleConfirm, setSubmitCycleConfirm] = useState(false);

  const [formData, setFormData] = useState({
    title: '', description: '', category: 'Performance', priority: 'medium',
    weight: 10, metric: '', targetValue: '', startDate: '', dueDate: ''
  });

  const hasFetchedRef = useRef(false);

  useEffect(() => { fetchCycles(); }, []);
  useEffect(() => { 
    if (selectedCycleId) {
      hasFetchedRef.current = false;
      fetchGoalsAndStatus(); 
    }
  }, [selectedCycleId]);

  async function fetchCycles() {
    try {
      const res = await api.get('/api/cycles');
      const data = Array.isArray(res.data) ? res.data : (res.data.cycles || []);
      setCycles(data);
      if (data.length > 0) {
        // Prefer active/in_progress cycles, then any non-closed, then first available
        const activeCycle = data.find(c => ['active', 'in_progress', 'open'].includes(c.status))
          || data.find(c => c.status !== 'closed')
          || data[0];
        setSelectedCycleId(activeCycle._id);
        setActiveCycle(activeCycle);
      } else {
        setLoading(false);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load cycles');
      setLoading(false);
    }
  }

  async function fetchGoalsAndStatus() {
    // Only show loading spinner on initial fetch
    if (!hasFetchedRef.current) setLoading(true);
    try {
      const gRes = await api.get(`/api/goals?cycleId=${selectedCycleId}`);
      setGoals(gRes.data.goals || []);
      
      const vRes = await api.get(`/api/goals/validation-status/${user.id}/${selectedCycleId}`);
      setValidationData(vRes.data);
      
      // Update active cycle ref
      const cycle = cycles.find(c => c._id === selectedCycleId);
      if (cycle) setActiveCycle(cycle);
      hasFetchedRef.current = true;
    } catch (err) {
      console.error(err);
      toast.error('Failed to load goal data');
    } finally {
      setLoading(false);
    }
  }

  function handleCycleChange(e) {
    setSelectedCycleId(e.target.value);
  }

  function openCreateModal() {
    setEditingGoal(null);
    setFormData({
      title: '', description: '', category: 'Performance', priority: 'medium',
      weight: 10, metric: '', targetValue: '', startDate: '', dueDate: ''
    });
    setShowGoalModal(true);
  }

  function openEditModal(goal) {
    setEditingGoal(goal);
    setFormData({
      title: goal.title || '', description: goal.description || '', category: goal.category || 'Performance',
      priority: goal.priority || 'medium', weight: goal.weight || 0, metric: goal.metric || '',
      targetValue: goal.targetValue || '', startDate: goal.startDate ? goal.startDate.substring(0, 10) : '',
      dueDate: goal.dueDate ? goal.dueDate.substring(0, 10) : ''
    });
    setShowGoalModal(true);
  }

  async function handleSaveGoal(e) {
    e.preventDefault();
    try {
      const payload = { ...formData, cycleId: selectedCycleId };
      if (editingGoal) {
        await api.patch(`/api/goals/${editingGoal._id}`, payload);
        toast.success('Goal updated successfully');
      } else {
        await api.post('/api/goals', payload);
        toast.success('Goal created successfully');
      }
      setShowGoalModal(false);
      // Wait 500ms for DB consistency before refreshing
      setTimeout(fetchGoalsAndStatus, 500); 
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save goal');
    }
  }

  async function handleDeleteConfirm() {
    try {
      await api.delete(`/api/goals/${deleteGoalId}`);
      toast.success('Goal deleted');
      setDeleteGoalId(null);
      // Wait 500ms for consistency
      setTimeout(fetchGoalsAndStatus, 500); 
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete goal');
      setDeleteGoalId(null);
    }
  }

  async function handleSubmitGoal(goalId) {
    try {
      await api.post(`/api/goals/${goalId}/submit`);
      toast.success('Goal submitted for review');
      // Wait 500ms for consistency
      setTimeout(fetchGoalsAndStatus, 500); 
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit goal');
    }
  }

  const getStatusBadge = (status) => {
    const map = {
      draft: { l: 'Draft', c: '#64748b', bg: '#f1f5f9' },
      submitted: { l: 'Submitted', c: '#3b82f6', bg: '#eff6ff' },
      under_review: { l: 'Under Review', c: '#eab308', bg: '#fefce8' },
      needs_revision: { l: 'Needs Revision', c: '#f97316', bg: '#fff7ed' },
      approved: { l: 'Approved', c: '#22c55e', bg: '#f0fdf4' },
      rejected: { l: 'Rejected', c: '#ef4444', bg: '#fef2f2' },
      midyear_assessed: { l: 'Mid-Year Checked', c: '#8b5cf6', bg: '#f5f3ff' },
      final_evaluated: { l: 'Evaluated', c: '#6366f1', bg: '#eef2ff' },
      locked: { l: 'Locked', c: '#1e293b', bg: '#f8fafc' }
    };
    const s = map[status] || map.draft;
    return <span style={{ padding: '0.25rem 0.75rem', borderRadius: '99px', fontSize: '0.8rem', fontWeight: 'bold', color: s.c, backgroundColor: s.bg }}>{s.l}</span>;
  };

  const getPriorityIcon = (p) => {
    if (p === 'high') return <span style={{color: '#eab308'}} title="High">⚡</span>;
    if (p === 'critical') return <span style={{color: '#ef4444'}} title="Critical">🔥</span>;
    return <span style={{color: '#3b82f6'}} title="Medium/Low">🔹</span>;
  };

  if (loading && !selectedCycleId) return <div className="page-loading"><div className="spinner"></div><p>Loading your goals...</p></div>;

  return (
    <div className="page" style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '2.2rem', color: 'var(--text-dark)' }}>🎯 My Annual Goals</h1>
          <p className="text-muted" style={{ margin: '0.5rem 0 0 0' }}>Plan, track, and align your yearly objectives.</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <select value={selectedCycleId} onChange={handleCycleChange} className="form-control hover-lift" style={{ padding: '0.75rem', borderRadius: '8px', minWidth: '200px', fontWeight: 'bold' }}>
            {cycles.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
          </select>
        </div>
      </div>

      {!activeCycle ? (
        <div className="empty-state">No active cycles available.</div>
      ) : (
        <>
          {/* Phase Banner */}
          <div style={{ background: 'linear-gradient(135deg, #1e293b, #0f172a)', padding: '1.5rem', borderRadius: '12px', color: '#fff', marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
            <div>
              <div style={{ fontSize: '0.9rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.5rem' }}>Current Phase</div>
              <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {activeCycle.currentPhase === 'phase1' && '📝 Phase 1: Goal Setting'}
                {activeCycle.currentPhase === 'phase2' && '⚖️ Phase 2: Mid-Year Assessment'}
                {activeCycle.currentPhase === 'phase3' && '📊 Phase 3: Final Evaluation'}
                {activeCycle.currentPhase === 'closed' && '🔒 Cycle Closed'}
              </h2>
            </div>
            {activeCycle.currentPhase === 'phase1' && (
              <button onClick={openCreateModal} className="btn" style={{ background: '#3b82f6', color: '#fff', border: 'none', padding: '0.75rem 1.5rem', borderRadius: '8px', fontWeight: 'bold', boxShadow: '0 4px 14px 0 rgba(59,130,246,0.39)', cursor: 'pointer' }}>
                + Add Goal
              </button>
            )}
          </div>

          {/* Validation Status */}
          {validationData && activeCycle.currentPhase === 'phase1' && (
            <div style={{ background: '#fff', border: `2px solid ${validationData.weightWarning ? '#ef4444' : '#22c55e'}`, borderRadius: '12px', padding: '1.5rem', marginBottom: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ margin: 0 }}>Validation Criteria</h3>
                <span style={{ fontWeight: 'bold', color: validationData.weightWarning ? '#ef4444' : '#22c55e' }}>
                  Total Weight: {validationData.totalWeight}% / 100%
                </span>
              </div>
              <div style={{ height: '8px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden', marginBottom: '1rem' }}>
                <div style={{ height: '100%', width: `${Math.min(validationData.totalWeight, 100)}%`, background: validationData.totalWeight === 100 ? '#22c55e' : (validationData.totalWeight > 100 ? '#ef4444' : '#3b82f6'), transition: 'width 0.3s' }}></div>
              </div>
              {validationData.weightWarning && <p style={{ color: '#ef4444', margin: 0, fontSize: '0.9rem' }}>⚠️ {validationData.weightWarning} You must fix this before goals can be fully approved.</p>}
              {validationData.rejectedCount > 0 && <p style={{ color: '#ef4444', margin: '0.5rem 0 0 0', fontSize: '0.9rem', fontWeight: 'bold' }}>⚠️ You have {validationData.rejectedCount} rejected goal(s) that require revision.</p>}
            </div>
          )}

          {/* Goal List */}
          {goals.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '4rem', background: 'var(--bg-main)', borderRadius: '12px', border: '1px dashed var(--border-color)' }}>
              <span style={{ fontSize: '3rem' }}>📭</span>
              <h3>No Goals Yet</h3>
              <p className="text-muted">You haven't added any goals for this cycle.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {goals.map(goal => (
                <div key={goal._id} className="card shadow-sm hover-lift" style={{ borderLeft: `4px solid ${goal.status === 'draft' ? '#94a3b8' : (goal.status === 'needs_revision' ? '#f97316' : '#22c55e')}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <h3 style={{ margin: 0 }}>{getPriorityIcon(goal.priority)} {goal.title}</h3>
                        {getStatusBadge(goal.status)}
                      </div>
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1rem' }}>{goal.description}</p>
                      <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.85rem' }}>
                        <span style={{ background: '#f1f5f9', padding: '0.25rem 0.5rem', borderRadius: '4px' }}>📊 Weight: <strong>{goal.weight}%</strong></span>
                        <span style={{ background: '#f1f5f9', padding: '0.25rem 0.5rem', borderRadius: '4px' }}>🎯 Target: <strong>{goal.targetValue} {goal.metric}</strong></span>
                        <span style={{ background: '#f1f5f9', padding: '0.25rem 0.5rem', borderRadius: '4px' }}>📅 Due: <strong>{new Date(goal.dueDate).toLocaleDateString()}</strong></span>
                      </div>
                      
                      {goal.status === 'needs_revision' && goal.managerComments && (
                        <div style={{ marginTop: '1rem', padding: '0.75rem', background: '#fff7ed', borderLeft: '3px solid #f97316', borderRadius: '4px', fontSize: '0.9rem' }}>
                          <strong>Manager Feedback:</strong> {goal.managerComments}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', minWidth: '120px' }}>
                      {['draft', 'needs_revision'].includes(goal.status) && activeCycle.currentPhase === 'phase1' && (
                        <>
                          <button className="btn btn--primary btn--sm" onClick={() => handleSubmitGoal(goal._id)}>Submit</button>
                          <button className="btn btn--outline btn--sm" onClick={() => openEditModal(goal)}>Edit</button>
                          <button className="btn btn--outline btn--sm" style={{ color: '#ef4444', borderColor: '#ef4444' }} onClick={() => setDeleteGoalId(goal._id)}>Delete</button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Goal Modal */}
      {showGoalModal && (
        <div className="modal-overlay">
          <div className="modal form-card" style={{ maxWidth: '700px', width: '90%' }}>
            <div className="modal-header" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
              <h2 style={{ margin: 0 }}>{editingGoal ? '✏️ Edit Goal' : '✨ New Goal'}</h2>
              <button onClick={() => setShowGoalModal(false)} className="close-btn" style={{ background: 'transparent', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>×</button>
            </div>
            <form onSubmit={handleSaveGoal}>
              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem' }}>Goal Title <span style={{color: 'red'}}>*</span></label>
                <input type="text" className="form-control" style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1' }} value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} required />
              </div>
              
              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem' }}>Description</label>
                <textarea className="form-control" style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', minHeight: '100px', resize: 'vertical' }} value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
              </div>

              <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1.5rem' }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem' }}>Category</label>
                  <select className="form-control" style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1' }} value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}>
                    <option>Performance</option>
                    <option>Development</option>
                    <option>Behavioral</option>
                    <option>Project</option>
                  </select>
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem' }}>Priority</label>
                  <select className="form-control" style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1' }} value={formData.priority} onChange={e => setFormData({...formData, priority: e.target.value})}>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
                <div className="form-group" style={{ width: '120px' }}>
                  <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem' }}>Weight (%) <span style={{color: 'red'}}>*</span></label>
                  <input type="number" className="form-control" style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1' }} value={formData.weight} onChange={e => setFormData({...formData, weight: parseInt(e.target.value)})} min="0" max="100" required />
                </div>
              </div>

              <div style={{ background: '#f8fafc', padding: '1.5rem', borderRadius: '8px', marginBottom: '2rem' }}>
                <h4 style={{ margin: '0 0 1rem 0' }}>Metrics & Timeline</h4>
                <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1rem' }}>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem' }}>Metric (e.g., "$", "leads", "%")</label>
                    <input type="text" className="form-control" style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1' }} value={formData.metric} onChange={e => setFormData({...formData, metric: e.target.value})} />
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem' }}>Target Value</label>
                    <input type="text" className="form-control" style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1' }} value={formData.targetValue} onChange={e => setFormData({...formData, targetValue: e.target.value})} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '1.5rem' }}>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem' }}>Start Date</label>
                    <input type="date" className="form-control" style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1' }} value={formData.startDate} onChange={e => setFormData({...formData, startDate: e.target.value})} />
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem' }}>Due Date</label>
                    <input type="date" className="form-control" style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1' }} value={formData.dueDate} onChange={e => setFormData({...formData, dueDate: e.target.value})} />
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }}>
                <button type="button" className="btn btn--secondary" onClick={() => setShowGoalModal(false)}>Cancel</button>
                <button type="submit" className="btn btn--primary" style={{ padding: '0.75rem 2rem', fontWeight: 'bold' }}>{editingGoal ? 'Update Goal' : 'Save as Draft'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      <ConfirmDialog 
        open={!!deleteGoalId} 
        title="Delete Goal" 
        message="Are you sure you want to delete this goal? This action cannot be undone." 
        danger={true} 
        confirmLabel="Delete" 
        onConfirm={handleDeleteConfirm} 
        onCancel={() => setDeleteGoalId(null)} 
      />
    </div>
  );
}

export default MyGoalsPage;
