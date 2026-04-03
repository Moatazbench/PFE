import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../components/AuthContext';
import { useToast } from '../components/common/Toast';
import ConfirmDialog from '../components/common/ConfirmDialog';

function FinalEvaluationPage() {
  const { user } = useAuth();
  const toast = useToast();
  
  const [cycles, setCycles] = useState([]);
  const [selectedCycleId, setSelectedCycleId] = useState('');
  const [activeCycle, setActiveCycle] = useState(null);
  const [viewMode, setViewMode] = useState('self'); // 'self' | 'team'
  
  const [myGoals, setMyGoals] = useState([]);
  const [teamGoals, setTeamGoals] = useState([]);
  const [loading, setLoading] = useState(true);

  // Assessment Modals
  const [showSelfModal, setShowSelfModal] = useState(false);
  const [showManagerModal, setShowManagerModal] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState(null);
  const [confirmLockData, setConfirmLockData] = useState(null);
  
  const [formData, setFormData] = useState({
    comment: '',
    progressPercentage: 100,
    rating: 3, 
    finalCompletion: 100,
    evidence: ''
  });

  useEffect(() => { fetchCycles(); }, []);
  useEffect(() => { 
    if (selectedCycleId) fetchGoals(); 
  }, [selectedCycleId]);

  async function fetchCycles() {
    try {
      const res = await api.get('/api/cycles');
      const data = res.data.filter(c => ['phase3', 'closed'].includes(c.currentPhase) && c.status !== 'draft');
      setCycles(data);
      if (data.length > 0) {
        setSelectedCycleId(data[0]._id);
        setActiveCycle(data[0]);
      } else {
        setLoading(false);
      }
    } catch (err) {
      toast.error('Failed to load cycles');
      setLoading(false);
    }
  }

  async function fetchGoals() {
    setLoading(true);
    try {
      const myRes = await api.get(`/api/goals?cycleId=${selectedCycleId}`);
      const myEligible = myRes.data.goals.filter(g => ['approved', 'midyear_assessed', 'final_evaluated', 'locked'].includes(g.status));
      const myGoalsWithReviews = await Promise.all(myEligible.map(async (g) => {
        const rRes = await api.get(`/api/goals/${g._id}/reviews?phase=endyear`);
        return { ...g, reviews: rRes.data.reviews || [] };
      }));
      setMyGoals(myGoalsWithReviews);

      if (['TEAM_LEADER', 'MANAGER', 'ADMIN', 'HR'].includes(user.role)) {
        const teamRes = await api.get(`/api/goals?cycleId=${selectedCycleId}&managerId=${user.id}`);
        const teamEligible = teamRes.data.goals.filter(g => ['approved', 'midyear_assessed', 'final_evaluated', 'locked'].includes(g.status));
        const teamGoalsWithReviews = await Promise.all(teamEligible.map(async (g) => {
          const rrRes = await api.get(`/api/goals/${g._id}/reviews?phase=endyear`);
          return { ...g, reviews: rrRes.data.reviews || [] };
        }));
        setTeamGoals(teamGoalsWithReviews);
      }
      
      const cycle = cycles.find(c => c._id === selectedCycleId);
      if (cycle) setActiveCycle(cycle);

    } catch (err) {
      toast.error('Failed to load goals');
    } finally {
      setLoading(false);
    }
  }

  function openSelfForm(goal) {
    if (activeCycle?.currentPhase !== 'phase3') return toast.error("Self-assessments can only be submitted during Phase 3.");
    setSelectedGoal(goal);
    setFormData({ comment: '', progressPercentage: goal.currentProgress || 100, rating: 3 });
    setShowSelfModal(true);
  }

  function openManagerForm(goal) {
    if (activeCycle?.currentPhase !== 'phase3') return toast.error("Evaluations can only be submitted during Phase 3.");
    setSelectedGoal(goal);
    setFormData({ comment: '', finalCompletion: goal.currentProgress || 100, rating: 3, evidence: '' });
    setShowManagerModal(true);
  }

  async function handleLockGoalConfirm() {
    try {
      await api.post(`/api/goals/${confirmLockData._id}/lock`, { comment: 'Final check completed' });
      toast.success('Goal locked successfully');
      setConfirmLockData(null);
      fetchGoals();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to lock goal');
      setConfirmLockData(null);
    }
  }

  async function handleSubmitSelf(e) {
    e.preventDefault();
    try {
      await api.post(`/api/goals/${selectedGoal._id}/self-assessment`, {
        comment: formData.comment,
        progressPercentage: formData.progressPercentage,
        rating: formData.rating
      });
      toast.success('Self-assessment submitted successfully');
      setShowSelfModal(false);
      fetchGoals();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit self-assessment');
    }
  }

  async function handleSubmitManager(e) {
    e.preventDefault();
    try {
      await api.post(`/api/goals/${selectedGoal._id}/final-evaluation`, {
        comment: formData.comment,
        finalCompletion: formData.finalCompletion,
        rating: formData.rating,
        evidence: formData.evidence
      });
      toast.success('Evaluation submitted successfully');
      setShowManagerModal(false);
      fetchGoals();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit evaluation');
    }
  }

  function getStatusBadge(gStatus) {
    if (gStatus === 'locked') return <span className="badge" style={{background:'#1e293b', color:'#fff'}}>Locked 🔒</span>;
    if (gStatus === 'final_evaluated') return <span className="badge" style={{background:'#6366f1', color:'#fff'}}>Evaluated</span>;
    return <span className="badge" style={{background:'#64748b', color:'#fff'}}>Pending End-Year</span>;
  }

  const renderGoalList = (list) => {
    if (list.length === 0) {
      return (
        <div style={{ textAlign:'center', padding:'3rem', background:'var(--bg-main)', borderRadius:'8px', border:'1px dashed var(--border-color)' }}>
          <span style={{ fontSize:'2rem' }}>📝</span>
          <h4>No Goals Found</h4>
          <p className="text-muted">No eligible goals available for end-year evaluation.</p>
        </div>
      );
    }

    return (
      <div style={{ display: 'grid', gap: '1.5rem' }}>
        {list.map(goal => {
          const selfReview = goal.reviews.find(r => r.reviewType === 'self_assessment');
          const mgrReview = goal.reviews.find(r => r.reviewType === 'manager_assessment');
          
          const isManagerView = viewMode === 'team';
          
          return (
            <div key={goal._id} className="card shadow-sm" style={{ borderLeft: goal.status === 'locked' ? '4px solid #1e293b' : '4px solid #6366f1' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <div style={{ flex: 1 }}>
                  {isManagerView && <div style={{ fontWeight:'bold', color:'var(--primary)', marginBottom:'0.5rem' }}>{goal.employeeId?.name}</div>}
                  <div style={{ display:'flex', gap:'1rem', alignItems:'center', marginBottom:'0.5rem' }}>
                    <h3 style={{ margin:0 }}>{goal.title}</h3>
                    {getStatusBadge(goal.status)}
                  </div>
                  <div style={{ display:'flex', gap:'1rem', fontSize:'0.85rem', marginBottom:'1rem' }}>
                    <span style={{ background:'#f1f5f9', padding:'0.25rem 0.6rem', borderRadius:'4px' }}>Target: <strong>{goal.targetValue} {goal.metric}</strong></span>
                    <span style={{ background:'#f1f5f9', padding:'0.25rem 0.6rem', borderRadius:'4px' }}>Weight: <strong>{goal.weight}%</strong></span>
                    <span style={{ background:'#f1f5f9', padding:'0.25rem 0.6rem', borderRadius:'4px' }}>Mid-Year: <strong>{goal.currentProgress}%</strong></span>
                  </div>
                </div>

                <div style={{ display:'flex', flexDirection:'column', gap:'0.5rem', minWidth:'140px', alignItems:'flex-end' }}>
                  {/* Actions */}
                  {goal.status !== 'locked' && activeCycle?.currentPhase === 'phase3' && (
                    <>
                      {!isManagerView && !selfReview && (
                        <button className="btn btn--primary" onClick={() => openSelfForm(goal)}>Start Self-Review</button>
                      )}
                      
                      {isManagerView && !mgrReview && (
                        <button className="btn btn--primary" style={{ background:'#4f46e5', borderColor:'#4f46e5' }} onClick={() => openManagerForm(goal)}>Evaluate Goal</button>
                      )}

                      {isManagerView && goal.status === 'final_evaluated' && (
                        <button className="btn btn--outline" style={{ color:'#1e293b', borderColor:'#1e293b' }} onClick={() => setConfirmLockData(goal)}>🔒 Lock Goal</button>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Review Boxes */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem', borderTop:'1px solid var(--border-color)', paddingTop:'1rem' }}>
                <div style={{ background: '#f8fafc', padding:'1rem', borderRadius:'8px' }}>
                  <h4 style={{ margin:'0 0 0.5rem 0', color: 'var(--text-dark)' }}>👤 Self-Assessment</h4>
                  {selfReview ? (
                    <>
                      <div style={{ fontWeight:'bold', fontSize:'1.1rem', color:'#3b82f6', marginBottom:'0.5rem' }}>Claimed {selfReview.progressPercentage}% | Rating: {selfReview.rating}/5</div>
                      <p style={{ fontSize:'0.9rem', margin:0 }}>"{selfReview.comment}"</p>
                    </>
                  ) : <p style={{ fontSize:'0.85rem', color:'var(--text-muted)', margin:0 }}>Not submitted.</p>}
                </div>
                
                <div style={{ background: '#f8fafc', padding:'1rem', borderRadius:'8px' }}>
                  <h4 style={{ margin:'0 0 0.5rem 0', color: 'var(--text-dark)' }}>👔 Manager Evaluation</h4>
                  {mgrReview ? (
                    <>
                      <div style={{ fontWeight:'bold', fontSize:'1.1rem', color:'#4f46e5', marginBottom:'0.5rem' }}>Final {mgrReview.progressPercentage}% | Rating: {mgrReview.rating}/5</div>
                      <p style={{ fontSize:'0.9rem', margin:0 }}>"{mgrReview.comment}"</p>
                    </>
                  ) : <p style={{ fontSize:'0.85rem', color:'var(--text-muted)', margin:0 }}>Not evaluated yet.</p>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  if (loading && !selectedCycleId) return <div className="page-loading"><div className="spinner"></div><p>Loading End-Year phase...</p></div>;

  return (
    <div className="page" style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '2.2rem', color: 'var(--text-dark)' }}>📝 End-Year Evaluations</h1>
          <p className="text-muted" style={{ margin: '0.5rem 0 0 0' }}>Final performance measurement and scoring for Phase 3.</p>
        </div>
        <select value={selectedCycleId} onChange={e => setSelectedCycleId(e.target.value)} className="form-control hover-lift" style={{ padding: '0.75rem', borderRadius: '8px', minWidth: '200px', fontWeight: 'bold' }}>
          {cycles.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
        </select>
      </div>

      {!activeCycle ? (
        <div className="empty-state">No Phase 3 cycles available.</div>
      ) : (
        <>
          {activeCycle.currentPhase !== 'phase3' && (
            <div className="alert alert--warning" style={{ marginBottom:'2rem', background:'#f8fafc', color:'#475569', padding:'1rem', borderRadius:'8px', borderLeft:'4px solid #64748b' }}>
              <strong>Note:</strong> This cycle is currently {activeCycle.currentPhase}. End-year evaluations can only be submitted during Phase 3.
            </div>
          )}

          {['TEAM_LEADER', 'MANAGER', 'ADMIN', 'HR'].includes(user.role) && (
             <div style={{ display: 'flex', gap: '1rem', borderBottom: '2px solid var(--border-color)', paddingBottom: '1rem', marginBottom: '2rem' }}>
              <button onClick={() => setViewMode('self')} style={{ background:'none', border:'none', fontSize:'1.1rem', fontWeight: viewMode === 'self' ? 'bold' : 'normal', color: viewMode === 'self' ? 'var(--primary)' : 'var(--text-muted)', cursor: 'pointer', paddingBottom:'0.5rem', borderBottom: viewMode === 'self' ? '3px solid var(--primary)' : '3px solid transparent' }}>
                My End-Year Review
              </button>
              <button onClick={() => setViewMode('team')} style={{ background:'none', border:'none', fontSize:'1.1rem', fontWeight: viewMode === 'team' ? 'bold' : 'normal', color: viewMode === 'team' ? 'var(--primary)' : 'var(--text-muted)', cursor: 'pointer', paddingBottom:'0.5rem', borderBottom: viewMode === 'team' ? '3px solid var(--primary)' : '3px solid transparent' }}>
                Team Evaluations
              </button>
            </div>
          )}

          {renderGoalList(viewMode === 'self' ? myGoals : teamGoals)}
        </>
      )}

      {/* Forms */}
      {showSelfModal && (
        <div className="modal-overlay">
          <div className="modal form-card" style={{ maxWidth: '600px', width: '90%' }}>
            <div className="modal-header">
              <h3>👤 Final Self-Assessment</h3>
              <button onClick={() => setShowSelfModal(false)} className="close-btn" style={{ background: 'transparent', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>×</button>
            </div>
            <form onSubmit={handleSubmitSelf}>
              <div style={{ display:'flex', gap:'1.5rem', marginBottom:'1.5rem', marginTop:'1rem' }}>
                <div className="form-group" style={{ flex:1 }}>
                   <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem' }}>Final Claimed Progress (%) <span style={{color: 'red'}}>*</span></label>
                   <input type="number" className="form-control" style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1' }} value={formData.progressPercentage} onChange={e => setFormData({...formData, progressPercentage: parseInt(e.target.value)})} min="0" max="100" required />
                </div>
                <div className="form-group" style={{ flex:1 }}>
                   <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem' }}>Self Rating (1-5)</label>
                   <input type="number" className="form-control" style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1' }} value={formData.rating} onChange={e => setFormData({...formData, rating: parseInt(e.target.value)})} min="1" max="5" required />
                </div>
              </div>
              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem' }}>Achievements & Reflections <span style={{color: 'red'}}>*</span></label>
                <textarea className="form-control" style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', minHeight: '120px' }} value={formData.comment} onChange={e => setFormData({...formData, comment: e.target.value})} placeholder="Summarize what you achieved against this goal..." required />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                <button type="button" className="btn btn--secondary" onClick={() => setShowSelfModal(false)}>Cancel</button>
                <button type="submit" className="btn btn--primary" style={{ padding: '0.75rem 2rem' }}>Submit Self-Assessment</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showManagerModal && (
        <div className="modal-overlay">
          <div className="modal form-card" style={{ maxWidth: '600px', width: '90%' }}>
            <div className="modal-header">
              <h3>👔 Manager Final Evaluation</h3>
              <button onClick={() => setShowManagerModal(false)} className="close-btn" style={{ background: 'transparent', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>×</button>
            </div>
            <form onSubmit={handleSubmitManager}>
              <div style={{ display:'flex', gap:'1.5rem', marginBottom:'1.5rem', marginTop:'1rem' }}>
                <div className="form-group" style={{ flex:1 }}>
                   <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem' }}>Validated Final Completion (%) <span style={{color: 'red'}}>*</span></label>
                   <input type="number" className="form-control" style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1' }} value={formData.finalCompletion} onChange={e => setFormData({...formData, finalCompletion: parseInt(e.target.value)})} min="0" max="100" required />
                </div>
                <div className="form-group" style={{ flex:1 }}>
                   <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem' }}>Manager Rating (1-5)</label>
                   <input type="number" className="form-control" style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1' }} value={formData.rating} onChange={e => setFormData({...formData, rating: parseInt(e.target.value)})} min="1" max="5" required />
                </div>
              </div>
              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem' }}>Evidence / Justification</label>
                <input type="text" className="form-control" style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1' }} value={formData.evidence} onChange={e => setFormData({...formData, evidence: e.target.value})} placeholder="Links, deliverables, quick notes..." />
              </div>
              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem' }}>Final Evaluation Comments <span style={{color: 'red'}}>*</span></label>
                <textarea className="form-control" style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', minHeight: '120px' }} value={formData.comment} onChange={e => setFormData({...formData, comment: e.target.value})} placeholder="Provide final constructive feedback for this goal..." required />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                <button type="button" className="btn btn--secondary" onClick={() => setShowManagerModal(false)}>Cancel</button>
                <button type="submit" className="btn btn--primary" style={{ background: '#4f46e5', borderColor: '#4f46e5', padding: '0.75rem 2rem' }}>Submit Evaluation</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog 
        open={!!confirmLockData} 
        title="🔒 Lock Goal" 
        message="Are you sure you want to lock this goal? This freezes the final score permanently." 
        confirmLabel="Lock Goal" 
        danger={false}
        onConfirm={handleLockGoalConfirm} 
        onCancel={() => setConfirmLockData(null)} 
      />
    </div>
  );
}

export default FinalEvaluationPage;
