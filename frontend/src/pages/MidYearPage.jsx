import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../components/AuthContext';
import { useToast } from '../components/common/Toast';

function MidYearPage() {
  const { user } = useAuth();
  const toast = useToast();
  
  const [cycles, setCycles] = useState([]);
  const [selectedCycleId, setSelectedCycleId] = useState('');
  const [activeCycle, setActiveCycle] = useState(null);
  const [viewMode, setViewMode] = useState('self'); // 'self' | 'team'
  
  const [myGoals, setMyGoals] = useState([]);
  const [teamGoals, setTeamGoals] = useState([]);
  const [loading, setLoading] = useState(true);

  // Assessment Modal
  const [showAssessmentModal, setShowAssessmentModal] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState(null);
  const [existingReview, setExistingReview] = useState(null);
  
  const [formData, setFormData] = useState({
    comment: '',
    progressPercentage: 50,
    status: 'on_track',
    blockers: '',
    supportRequired: ''
  });

  useEffect(() => { fetchCycles(); }, []);
  useEffect(() => { 
    if (selectedCycleId) fetchGoals(); 
  }, [selectedCycleId]);

  async function fetchCycles() {
    try {
      const res = await api.get('/api/cycles');
      const data = res.data.filter(c => ['phase2', 'phase3', 'closed'].includes(c.currentPhase) && c.status !== 'draft');
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
      // 1. Fetch My Goals + Reviews
      const myRes = await api.get(`/api/goals?cycleId=${selectedCycleId}`);
      const myApproved = myRes.data.goals.filter(g => ['approved', 'midyear_assessed', 'final_evaluated', 'locked'].includes(g.status));
      
      const myGoalsWithReviews = await Promise.all(myApproved.map(async (g) => {
        const rRes = await api.get(`/api/goals/${g._id}/reviews?phase=midyear`);
        return { ...g, reviews: rRes.data.reviews || [] };
      }));
      setMyGoals(myGoalsWithReviews);

      // 2. Fetch Team Goals + Reviews (if Manager)
      if (['TEAM_LEADER', 'MANAGER', 'ADMIN', 'HR'].includes(user.role)) {
        const teamRes = await api.get(`/api/goals?cycleId=${selectedCycleId}&managerId=${user.id}`);
        const teamApproved = teamRes.data.goals.filter(g => ['approved', 'midyear_assessed', 'final_evaluated', 'locked'].includes(g.status));
        
        const teamGoalsWithReviews = await Promise.all(teamApproved.map(async (g) => {
          const rrRes = await api.get(`/api/goals/${g._id}/reviews?phase=midyear`);
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

  function openAssessmentForm(goal, existingReviewData = null) {
    if (activeCycle?.currentPhase !== 'phase2') {
      toast.error("Assessments can only be submitted during Phase 2.");
      return;
    }

    setSelectedGoal(goal);
    setExistingReview(existingReviewData);
    
    if (existingReviewData) {
      setFormData({
        comment: existingReviewData.comment || '',
        progressPercentage: existingReviewData.progressPercentage || 50,
        status: existingReviewData.status || 'on_track',
        blockers: existingReviewData.blockers || '',
        supportRequired: existingReviewData.supportRequired || ''
      });
    } else {
      setFormData({ comment: '', progressPercentage: goal.currentProgress || 0, status: 'on_track', blockers: '', supportRequired: '' });
    }
    
    setShowAssessmentModal(true);
  }

  async function handleSubmitAssessment(e) {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        reviewType: viewMode === 'self' ? 'self_assessment' : 'manager_assessment'
      };

      await api.post(`/api/goals/${selectedGoal._id}/midyear-assessment`, payload);
      toast.success('Assessment submitted successfully');
      setShowAssessmentModal(false);
      fetchGoals();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit assessment');
    }
  }

  function getStatusBadge(gStatus) {
    if (gStatus === 'midyear_assessed') return <span className="badge" style={{background:'#c084fc', color:'#fff'}}>Assessed by Mgr</span>;
    if (gStatus === 'approved') return <span className="badge" style={{background:'#22c55e', color:'#fff'}}>Ready for Check-in</span>;
    return <span className="badge" style={{background:'#64748b', color:'#fff'}}>{gStatus}</span>;
  }

  const renderGoalList = (list) => {
    if (list.length === 0) {
      return (
        <div style={{ textAlign:'center', padding:'3rem', background:'var(--bg-main)', borderRadius:'8px', border:'1px dashed var(--border-color)' }}>
          <span style={{ fontSize:'2rem' }}>📝</span>
          <h4>No Goals Found</h4>
          <p className="text-muted">No approved goals are available for mid-year assessment.</p>
        </div>
      );
    }

    return (
      <div style={{ display: 'grid', gap: '1rem' }}>
        {list.map(goal => {
          const selfReview = goal.reviews.find(r => r.reviewType === 'self_assessment');
          const mgrReview = goal.reviews.find(r => r.reviewType === 'manager_assessment');
          
          const isManagerView = viewMode === 'team';
          const myReviewSubmitted = isManagerView ? !!mgrReview : !!selfReview;
          
          return (
            <div key={goal._id} className="card shadow-sm hover-lift" style={{ borderLeft: myReviewSubmitted ? '4px solid #c084fc' : '4px solid #eab308' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div style={{ flex: 1 }}>
                  {isManagerView && <div style={{ fontWeight:'bold', color:'var(--primary)', marginBottom:'0.5rem' }}>{goal.employeeId?.name}</div>}
                  <div style={{ display:'flex', gap:'1rem', alignItems:'center', marginBottom:'0.5rem' }}>
                    <h3 style={{ margin:0 }}>{goal.title}</h3>
                    {getStatusBadge(goal.status)}
                  </div>
                  <p style={{ color:'var(--text-muted)', fontSize:'0.9rem', marginBottom:'1rem' }}>{goal.description}</p>
                  
                  <div style={{ display:'flex', gap:'1rem', fontSize:'0.85rem' }}>
                    <span style={{ background:'#f1f5f9', padding:'0.25rem 0.6rem', borderRadius:'4px' }}>Target: <strong>{goal.targetValue} {goal.metric}</strong></span>
                    <span style={{ background:'#f1f5f9', padding:'0.25rem 0.6rem', borderRadius:'4px' }}>Current Progress: <strong>{goal.currentProgress}%</strong></span>
                  </div>

                  {/* Existing Reviews display */}
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem', marginTop:'1.5rem' }}>
                    
                    {/* Self Review Box */}
                    <div style={{ background: selfReview ? '#f0fdf4' : '#f8fafc', padding:'1rem', borderRadius:'8px', border:'1px solid', borderColor: selfReview ? '#bbf7d0' : '#e2e8f0' }}>
                      <h4 style={{ margin:'0 0 0.5rem 0', color: selfReview ? '#166534' : 'var(--text-muted)' }}>👤 Employee Self-Assessment</h4>
                      {selfReview ? (
                        <>
                          <div style={{ fontWeight:'bold', fontSize:'1.2rem', color:'#15803d', marginBottom:'0.5rem' }}>{selfReview.progressPercentage}% Complete</div>
                          <p style={{ fontSize:'0.9rem', margin:0 }}>"{selfReview.comment}"</p>
                        </>
                      ) : <p style={{ fontSize:'0.85rem', color:'var(--text-muted)', margin:0 }}>Not submitted yet.</p>}
                    </div>

                    {/* Manager Review Box */}
                    <div style={{ background: mgrReview ? '#fefce8' : '#f8fafc', padding:'1rem', borderRadius:'8px', border:'1px solid', borderColor: mgrReview ? '#fef08a' : '#e2e8f0' }}>
                      <h4 style={{ margin:'0 0 0.5rem 0', color: mgrReview ? '#854d0e' : 'var(--text-muted)' }}>👔 Manager Assessment</h4>
                      {mgrReview ? (
                        <>
                          <div style={{ fontWeight:'bold', fontSize:'1.2rem', color:'#a16207', marginBottom:'0.5rem' }}>{mgrReview.progressPercentage}% Validated</div>
                          <p style={{ fontSize:'0.9rem', margin:0 }}>"{mgrReview.comment}"</p>
                        </>
                      ) : <p style={{ fontSize:'0.85rem', color:'var(--text-muted)', margin:0 }}>Not validated yet.</p>}
                    </div>

                  </div>
                </div>

                <div style={{ marginLeft:'2rem', display:'flex', flexDirection:'column', justifyContent:'center', minWidth:'140px' }}>
                  {!myReviewSubmitted && activeCycle?.currentPhase === 'phase2' && (
                    <button className="btn btn--primary" onClick={() => openAssessmentForm(goal)}>Start Check-In</button>
                  )}
                  {myReviewSubmitted && (
                    <button className="btn btn--outline" disabled style={{ opacity:0.7 }}>✅ Submitted</button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  if (loading && !selectedCycleId) return <div className="page-loading"><div className="spinner"></div><p>Loading Mid-Year phase...</p></div>;

  return (
    <div className="page" style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '2.2rem', color: 'var(--text-dark)' }}>⚖️ Mid-Year Assessments</h1>
          <p className="text-muted" style={{ margin: '0.5rem 0 0 0' }}>Track progress and identify blockers halfway through the cycle.</p>
        </div>
        <select value={selectedCycleId} onChange={e => setSelectedCycleId(e.target.value)} className="form-control hover-lift" style={{ padding: '0.75rem', borderRadius: '8px', minWidth: '200px', fontWeight: 'bold' }}>
          {cycles.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
        </select>
      </div>

      {!activeCycle ? (
        <div className="empty-state">No Phase 2 cycles available.</div>
      ) : (
        <>
          {activeCycle.currentPhase !== 'phase2' && (
            <div className="alert alert--warning" style={{ marginBottom:'2rem', background:'#fffbeb', color:'#92400e', padding:'1rem', borderRadius:'8px', borderLeft:'4px solid #f59e0b' }}>
              <strong>Note:</strong> This cycle is currently in Phase: {activeCycle.currentPhase}. Mid-year assessments can only be submitted during Phase 2. You are viewing in read-only mode.
            </div>
          )}

          {['TEAM_LEADER', 'MANAGER', 'ADMIN', 'HR'].includes(user.role) && (
             <div style={{ display: 'flex', gap: '1rem', borderBottom: '2px solid var(--border-color)', paddingBottom: '1rem', marginBottom: '2rem' }}>
              <button 
                onClick={() => setViewMode('self')} 
                style={{ background:'none', border:'none', fontSize:'1.1rem', fontWeight: viewMode === 'self' ? 'bold' : 'normal', color: viewMode === 'self' ? 'var(--primary)' : 'var(--text-muted)', cursor: 'pointer', paddingBottom:'0.5rem', borderBottom: viewMode === 'self' ? '3px solid var(--primary)' : '3px solid transparent' }}
              >
                My Self-Assessments
              </button>
              <button 
                onClick={() => setViewMode('team')} 
                style={{ background:'none', border:'none', fontSize:'1.1rem', fontWeight: viewMode === 'team' ? 'bold' : 'normal', color: viewMode === 'team' ? 'var(--primary)' : 'var(--text-muted)', cursor: 'pointer', paddingBottom:'0.5rem', borderBottom: viewMode === 'team' ? '3px solid var(--primary)' : '3px solid transparent' }}
              >
                Team Assessments
              </button>
            </div>
          )}

          {renderGoalList(viewMode === 'self' ? myGoals : teamGoals)}
        </>
      )}

      {/* Assessment Modal */}
      {showAssessmentModal && (
        <div className="modal-overlay">
          <div className="modal form-card" style={{ maxWidth: '650px', width: '90%' }}>
            <div className="modal-header" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
              <h2 style={{ margin: 0 }}>📍 {viewMode === 'self' ? 'Self Check-in' : 'Manager Validation'}</h2>
              <button onClick={() => setShowAssessmentModal(false)} className="close-btn" style={{ background: 'transparent', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>×</button>
            </div>

            <div style={{ background:'#f1f5f9', padding:'1rem', borderRadius:'8px', marginBottom:'1.5rem' }}>
              <div style={{ fontWeight:'bold', marginBottom:'0.25rem', color:'#334155' }}>Goal:</div>
              <div style={{ fontSize:'1.1rem' }}>{selectedGoal?.title}</div>
            </div>

            <form onSubmit={handleSubmitAssessment}>
              <div style={{ display:'flex', gap:'1.5rem', marginBottom:'1.5rem' }}>
                <div className="form-group" style={{ flex:1 }}>
                   <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem' }}>Current Progress (%) <span style={{color: 'red'}}>*</span></label>
                   <input type="number" className="form-control" style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1' }} value={formData.progressPercentage} onChange={e => setFormData({...formData, progressPercentage: parseInt(e.target.value)})} min="0" max="100" required />
                </div>
                <div className="form-group" style={{ flex:1 }}>
                   <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem' }}>Status Track</label>
                   <select className="form-control" style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1' }} value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})}>
                     <option value="on_track">🟢 On Track</option>
                     <option value="at_risk">🟡 At Risk</option>
                     <option value="off_track">🔴 Off Track</option>
                     <option value="completed">✅ Early Completion</option>
                   </select>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem' }}>Progress Summary / Comments <span style={{color: 'red'}}>*</span></label>
                <textarea className="form-control" style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', minHeight: '100px', resize: 'vertical' }} value={formData.comment} onChange={e => setFormData({...formData, comment: e.target.value})} required />
              </div>

              {viewMode === 'self' && (
                <div style={{ display:'flex', gap:'1.5rem', marginBottom:'1.5rem' }}>
                  <div className="form-group" style={{ flex:1 }}>
                    <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem' }}>Any Blockers?</label>
                    <input type="text" className="form-control" style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1' }} value={formData.blockers} onChange={e => setFormData({...formData, blockers: e.target.value})} placeholder="e.g., waiting on IT access..." />
                  </div>
                  <div className="form-group" style={{ flex:1 }}>
                    <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem' }}>Support Required?</label>
                    <input type="text" className="form-control" style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1' }} value={formData.supportRequired} onChange={e => setFormData({...formData, supportRequired: e.target.value})} placeholder="e.g., budget approval..." />
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }}>
                <button type="button" className="btn btn--secondary" onClick={() => setShowAssessmentModal(false)}>Cancel</button>
                <button type="submit" className="btn btn--primary" style={{ background: '#8b5cf6', borderColor: '#8b5cf6', padding: '0.75rem 2rem', fontWeight: 'bold' }}>Submit Assessment</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

export default MidYearPage;
