import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../components/AuthContext';
import { useToast } from '../components/common/Toast';
import ConfirmDialog from '../components/common/ConfirmDialog';

function ManagerReviewsPage() {
  const { user } = useAuth();
  const toast = useToast();
  
  const [cycles, setCycles] = useState([]);
  const [selectedCycleId, setSelectedCycleId] = useState('');
  
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState(null);
  const [reviewAction, setReviewAction] = useState('approve'); // approve, reject, revise
  const [managerComments, setManagerComments] = useState('');

  useEffect(() => { fetchCycles(); }, []);
  useEffect(() => { 
    if (selectedCycleId) fetchGoals(); 
  }, [selectedCycleId]);

  async function fetchCycles() {
    try {
      const res = await api.get('/api/cycles');
      const data = res.data.filter(c => c.status !== 'draft');
      setCycles(data);
      if (data.length > 0) setSelectedCycleId(data[0]._id);
      else setLoading(false);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load cycles');
      setLoading(false);
    }
  }

  async function fetchGoals() {
    setLoading(true);
    try {
      const res = await api.get(`/api/goals?cycleId=${selectedCycleId}&managerId=${user.id}`);
      setGoals(res.data.goals || []);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load team goals');
    } finally {
      setLoading(false);
    }
  }

  function handleCycleChange(e) {
    setSelectedCycleId(e.target.value);
  }

  function openReviewModal(goal, action) {
    setSelectedGoal(goal);
    setReviewAction(action);
    setManagerComments('');
    setShowReviewModal(true);
  }

  async function handleSubmitReview(e) {
    e.preventDefault();
    try {
      let endpoint = '';
      const payload = {};
      
      if (reviewAction === 'approve') {
        endpoint = `/api/goals/${selectedGoal._id}/approve`;
        payload.managerComments = managerComments;
        payload.comment = 'Goal approved';
      } else if (reviewAction === 'reject') {
        endpoint = `/api/goals/${selectedGoal._id}/reject`;
        payload.comment = managerComments;
      } else if (reviewAction === 'revise') {
        endpoint = `/api/goals/${selectedGoal._id}/revise`;
        payload.comment = managerComments;
      }

      await api.post(endpoint, payload);
      toast.success(`Goal ${reviewAction}d successfully`);
      setShowReviewModal(false);
      fetchGoals();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to process review');
    }
  }

  async function startReview(goalId) {
    try {
      await api.post(`/api/goals/${goalId}/review`);
      toast.success('Review started');
      fetchGoals();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to start review');
    }
  }

  const pendingGoals = goals.filter(g => ['submitted', 'under_review'].includes(g.status));
  const completedGoals = goals.filter(g => !['draft', 'submitted', 'under_review'].includes(g.status));

  const getStatusBadge = (status) => {
    const map = {
      submitted: { l: 'Awaiting Review', c: '#3b82f6', bg: '#eff6ff' },
      under_review: { l: 'Under Review', c: '#eab308', bg: '#fefce8' },
      needs_revision: { l: 'Needs Revision', c: '#f97316', bg: '#fff7ed' },
      approved: { l: 'Approved', c: '#22c55e', bg: '#f0fdf4' },
      rejected: { l: 'Rejected', c: '#ef4444', bg: '#fef2f2' },
      midyear_assessed: { l: 'Mid-Year Checked', c: '#8b5cf6', bg: '#f5f3ff' },
      final_evaluated: { l: 'Evaluated', c: '#6366f1', bg: '#eef2ff' },
      locked: { l: 'Locked', c: '#1e293b', bg: '#f8fafc' }
    };
    const s = map[status] || { l: status, c: '#64748b', bg: '#f1f5f9' };
    return <span style={{ padding: '0.25rem 0.75rem', borderRadius: '99px', fontSize: '0.8rem', fontWeight: 'bold', color: s.c, backgroundColor: s.bg }}>{s.l}</span>;
  };

  const getActionLabels = () => {
    if (reviewAction === 'approve') return { title: '✅ Approve Goal', btnClass: 'btn--primary', btnText: 'Approve' };
    if (reviewAction === 'reject') return { title: '❌ Reject Goal', btnClass: 'btn--danger', btnText: 'Reject' };
    return { title: '🔄 Request Revision', btnClass: 'btn--warning', btnText: 'Request Revision' };
  };

  if (loading && !selectedCycleId) return <div className="page-loading"><div className="spinner"></div><p>Loading team goals...</p></div>;

  return (
    <div className="page" style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '2.2rem', color: 'var(--text-dark)' }}>📋 Goal Approvals</h1>
          <p className="text-muted" style={{ margin: '0.5rem 0 0 0' }}>Review and approve Phase 1 goals for your team.</p>
        </div>
        <select value={selectedCycleId} onChange={handleCycleChange} className="form-control hover-lift" style={{ padding: '0.75rem', borderRadius: '8px', minWidth: '200px', fontWeight: 'bold' }}>
          {cycles.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
        </select>
      </div>

      {!selectedCycleId ? (
        <div className="empty-state">No active cycles.</div>
      ) : (
        <>
          <h2 style={{ borderBottom: '2px solid var(--border-color)', paddingBottom: '0.5rem', marginBottom: '1.5rem', display:'flex', alignItems:'center', gap:'0.5rem' }}>
            <span style={{ background:'#3b82f6', color:'#fff', width:'24px', height:'24px', borderRadius:'12px', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.9rem' }}>{pendingGoals.length}</span>
            Action Required
          </h2>
          
          {pendingGoals.length === 0 ? (
            <div style={{ background: '#f8fafc', padding: '2rem', borderRadius: '8px', textAlign: 'center', color: 'var(--text-muted)', marginBottom: '3rem' }}>
              🎉 All caught up! No goals waiting for your review.
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '1rem', marginBottom: '3rem' }}>
              {pendingGoals.map(goal => (
                <div key={goal._id} className="card shadow-sm hover-lift" style={{ borderLeft: '4px solid #3b82f6' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <span style={{ fontWeight: 'bold', color: 'var(--primary-dark)', background: '#e0e7ff', padding: '0.2rem 0.6rem', borderRadius: '4px', fontSize: '0.85rem' }}>{goal.employeeId?.name}</span>
                        <h3 style={{ margin: 0 }}>{goal.title}</h3>
                        {getStatusBadge(goal.status)}
                      </div>
                      
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', background: '#f8fafc', padding: '1rem', borderRadius: '8px', marginTop: '1rem', fontSize: '0.9rem' }}>
                        <div><strong>Category:</strong> {goal.category}</div>
                        <div><strong>Priority:</strong> <span style={{ textTransform: 'capitalize' }}>{goal.priority}</span></div>
                        <div><strong>Weight:</strong> <span style={{ background: '#bfdbfe', padding: '0.1rem 0.4rem', borderRadius: '4px', fontWeight: 'bold', color: '#1e3a8a' }}>{goal.weight}%</span></div>
                        <div><strong>Metric:</strong> {goal.metric || 'N/A'}</div>
                        <div><strong>Target:</strong> {goal.targetValue || 'N/A'}</div>
                        <div><strong>Due Date:</strong> {goal.dueDate ? new Date(goal.dueDate).toLocaleDateString() : 'N/A'}</div>
                      </div>
                      <p style={{ marginTop: '1rem', color: 'var(--text-muted)', fontSize: '0.95rem' }}>{goal.description}</p>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', minWidth: '140px', marginLeft: '1.5rem', borderLeft: '1px solid var(--border-color)', paddingLeft: '1.5rem' }}>
                      {goal.status === 'submitted' ? (
                        <button className="btn btn--secondary" onClick={() => startReview(goal._id)}>Start Review</button>
                      ) : (
                        <>
                          <button className="btn btn--primary" onClick={() => openReviewModal(goal, 'approve')}>✅ Approve</button>
                          <button className="btn btn--outline" style={{ color: '#f97316', borderColor: '#f97316' }} onClick={() => openReviewModal(goal, 'revise')}>🔄 Revise</button>
                          <button className="btn btn--outline" style={{ color: '#ef4444', borderColor: '#ef4444' }} onClick={() => openReviewModal(goal, 'reject')}>❌ Reject</button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <h2 style={{ borderBottom: '2px solid var(--border-color)', paddingBottom: '0.5rem', marginBottom: '1.5rem' }}>Recently Reviewed</h2>
          {completedGoals.length === 0 ? (
            <p className="text-muted">No completed reviews yet.</p>
          ) : (
            <div style={{ display: 'grid', gap: '1rem' }}>
              {completedGoals.map(goal => (
                <div key={goal._id} className="card" style={{ padding: '1rem', background: '#f8fafc' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <span style={{ fontWeight: 'bold' }}>{goal.employeeId?.name}</span>
                      <span>—</span>
                      <span style={{ color: 'var(--text-dark)' }}>{goal.title}</span>
                    </div>
                    {getStatusBadge(goal.status)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Review Action Modal */}
      {showReviewModal && (
        <div className="modal-overlay">
          <div className="modal form-card" style={{ maxWidth: '600px', width: '90%' }}>
            <div className="modal-header" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
              <h2 style={{ margin: 0 }}>{getActionLabels().title}</h2>
              <button onClick={() => setShowReviewModal(false)} className="close-btn" style={{ background: 'transparent', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>×</button>
            </div>
            
            <div style={{ marginBottom: '1.5rem', background: '#f8fafc', padding: '1rem', borderRadius: '8px' }}>
              <strong>Goal:</strong> {selectedGoal?.title}
            </div>

            <form onSubmit={handleSubmitReview}>
              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                  Comments / Feedback {reviewAction !== 'approve' && <span style={{color: 'red'}}>*</span>}
                </label>
                <textarea 
                  className="form-control" 
                  style={{ width: '100%', padding: '1rem', borderRadius: '8px', border: '1px solid #cbd5e1', minHeight: '120px', resize: 'vertical' }} 
                  placeholder={reviewAction === 'approve' ? "Optional: Add encouraging feedback..." : "Required: Explain what needs to be changed..."}
                  value={managerComments} 
                  onChange={e => setManagerComments(e.target.value)} 
                  required={reviewAction !== 'approve'}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }}>
                <button type="button" className="btn btn--secondary" onClick={() => setShowReviewModal(false)}>Cancel</button>
                <button type="submit" className={`btn ${getActionLabels().btnClass}`} style={{ padding: '0.75rem 2rem', fontWeight: 'bold' }}>
                  {getActionLabels().btnText}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default ManagerReviewsPage;
