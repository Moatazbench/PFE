import React, { useEffect, useState, useMemo } from 'react';
import api from '../services/api';
import { useAuth } from '../components/AuthContext';
import { useToast } from '../components/common/Toast';
import { useNavigate } from 'react-router-dom';

const API_BASE_URL = api.defaults.baseURL || import.meta.env.VITE_API_BASE_URL || '/api';

const getDueBadge = (dueDate) => {
  if (!dueDate) return null;
  const days = Math.ceil((new Date(dueDate) - new Date()) / 86400000);
  if (days < 0) return { label: '🔴 Overdue', class: 'badge-red', isAtRisk: true };
  if (days <= 3) return { label: `🟡 Due in ${days} days`, class: 'badge-yellow', isAtRisk: true };
  return { label: '🟢 On schedule', class: 'badge-green', isAtRisk: false };
};


const getDaysRemaining = (dueDate) => {
  if (!dueDate) return null;
  return Math.ceil((new Date(dueDate) - new Date()) / 86400000);
};
function MidYearPage() {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [cycles, setCycles] = useState([]);
  const [selectedCycleId, setSelectedCycleId] = useState('');
  const [activeCycle, setActiveCycle] = useState(null);
  
  const [viewMode, setViewMode] = useState('self'); // 'self', 'team', 'dashboard'
  const [showAtRiskOnly, setShowAtRiskOnly] = useState(false);
  
  const [myObjectives, setMyObjectives] = useState([]);
  const [teamObjectives, setTeamObjectives] = useState([]);
  const [myCheckIns, setMyCheckIns] = useState([]);
  const [teamCheckIns, setTeamCheckIns] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [showCheckInModal, setShowCheckInModal] = useState(false);
  const [selectedObjective, setSelectedObjective] = useState(null);
  const [existingCheckIn, setExistingCheckIn] = useState(null);
  const [objectiveTasks, setObjectiveTasks] = useState([]);
  const [loadingTasks, setLoadingTasks] = useState(false);

  const [formData, setFormData] = useState({
    progress_percent: 0,
    notes: '',
    priority: 'medium'
  });
  const [uploadedAttachment, setUploadedAttachment] = useState(null);
  const [uploading, setUploading] = useState(false);

  async function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      // Let axios handle Content-Type automatically for FormData
      const res = await api.post('/checkins/upload', fd);
      setUploadedAttachment(res.data.attachment);
      toast.success('File uploaded: ' + file.name);
    } catch (err) {
      console.error('Upload error:', err);
      toast.error(err.response?.data?.message || 'Failed to upload file');
    } finally {
      setUploading(false);
    }
  }
  
  const [managerReviewData, setManagerReviewData] = useState({
    action: 'approve', // or request_revision
    feedback: '',
    progress_percent: null
  });

  const getAttachmentUrl = (attachment) => {
    if (!attachment?.url) return '#';
    return attachment.url.startsWith('http') ? attachment.url : `${API_BASE_URL}${attachment.url}`;
  };

  async function handleDownloadAttachment(attachment) {
    const fileUrl = getAttachmentUrl(attachment);
    if (fileUrl === '#') {
      toast.error('Attachment is unavailable');
      return;
    }

    try {
      const response = await fetch(fileUrl);
      if (!response.ok) throw new Error('Download failed');

      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = attachment?.name || 'attachment';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      toast.error('Failed to download attachment');
    }
  }

  const isManagerRole = ['TEAM_LEADER', 'ADMIN', 'HR'].includes(user?.role);

  useEffect(() => { fetchCycles(); }, []);
  useEffect(() => {
    if (selectedCycleId) {
      fetchObjectives();
      fetchCheckIns();
    }
  }, [selectedCycleId]);

  async function fetchCycles() {
    try {
      const res = await api.getCached('/cycles', undefined, { ttl: 60000, cacheKey: 'cycles:midyear-list' });
      const data = res.data.filter(c => c.currentPhase === 'phase2' && c.status !== 'draft');
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

  async function fetchObjectives() {
    setLoading(true);
    try {
      const myRes = await api.get('/objectives/user/' + user._id + '/cycle/' + selectedCycleId);
      const myList = [...(myRes.data.individualObjectives || []), ...(myRes.data.teamObjectives || [])]
        .filter(o => ['approved', 'validated', 'evaluated', 'locked'].includes(o.status));
      setMyObjectives(myList);

      if (isManagerRole) {
        const teamRes = await api.get('/objectives', { params: { cycle: selectedCycleId } });
        const allObjectives = teamRes.data.objectives || [];
        const filteredTeam = allObjectives.filter(o => {
          const ownerId = o.owner?._id || o.owner;
          return String(ownerId) !== String(user._id) && ['approved', 'validated', 'evaluated', 'locked'].includes(o.status);
        });
        setTeamObjectives(filteredTeam);
      }
    } catch (err) {
      toast.error('Failed to load objectives');
    } finally {
      setLoading(false);
    }
  }

  async function fetchCheckIns() {
    try {
      const selfRes = await api.get('/checkins', { params: { cycle_id: selectedCycleId } });
      setMyCheckIns(selfRes.data.checkIns || []);

      if (isManagerRole) {
        const teamRes = await api.get('/checkins/team', { params: { cycle_id: selectedCycleId } });
        setTeamCheckIns(teamRes.data.checkIns || []);
      }
    } catch (err) {
      toast.error('Failed to load check-ins');
    }
  }

  function syncCheckInState(objective, checkIn) {
    setExistingCheckIn(checkIn || null);
    setFormData({
      progress_percent: checkIn?.progress_percent ?? objective?.achievementPercent ?? 0,
      notes: checkIn?.notes ?? '',
      priority: checkIn?.priority ?? 'medium'
    });
    setUploadedAttachment(checkIn?.attachments?.[0] || null);
    setManagerReviewData({
      action: 'approve',
      feedback: '',
      progress_percent: checkIn?.progress_percent ?? null
    });
  }

  async function openCheckInModal(objective, checkIn) {
    if (activeCycle?.currentPhase !== 'phase2' && viewMode === 'self') {
      toast.error('Check-ins can only be submitted during Mid-Year Execution.');
      // allow read-only viewing though
    }

    setSelectedObjective(objective);
    syncCheckInState(objective, checkIn);

    setLoadingTasks(true);
    setShowCheckInModal(true);
    try {
      const requests = [api.get('/checkins/objective/' + objective._id + '/tasks')];
      const isManagerView = viewMode === 'team';

      if (isManagerView) {
        requests.push(api.get('/checkins/by-objective', { params: { objective_id: objective._id } }));
      }

      const [taskRes, checkInsRes] = await Promise.all(requests);
      setObjectiveTasks(taskRes.data.tasks || []);

      if (isManagerView) {
        const objectiveOwnerId = String(objective.owner?._id || objective.owner || '');
        const matchingCheckIns = (checkInsRes?.data?.checkIns || [])
          .filter(ci => String(ci.employee_id?._id || ci.employee_id || '') == objectiveOwnerId)
          .sort((a, b) => new Date(b.submitted_at || b.createdAt || 0) - new Date(a.submitted_at || a.createdAt || 0));

        const resolvedCheckIn = matchingCheckIns[0] || checkIn || null;
        syncCheckInState(objective, resolvedCheckIn);
      }
    } catch (err) {
      toast.error('Failed to load check-in details');
    } finally {
      setLoadingTasks(false);
    }
  }

  async function handleSubmitCheckIn(e) {
    e.preventDefault();
    try {
      const attachments = uploadedAttachment ? [uploadedAttachment] : [];
      const payload = {
        objective_id: selectedObjective._id,
        cycle_id: selectedCycleId,
        progress_percent: Number(formData.progress_percent),
        notes: formData.notes || '',
        priority: formData.priority || 'medium',
        attachments
      };
      console.log('Submitting check-in payload:', JSON.stringify(payload));
      await api.post('/checkins', payload);
      toast.success('Check-in submitted successfully');
      setShowCheckInModal(false);
      fetchCheckIns();
      fetchObjectives();
    } catch (err) {
      console.error('Check-in submit error:', err.response?.status, err.response?.data);
      toast.error(err.response?.data?.message || 'Failed to submit check-in');
    }
  }

  async function handleManagerReview(e) {
    e.preventDefault();
    if (!existingCheckIn) return;
    
    // Validate progress if provided
    if (managerReviewData.progress_percent !== null && managerReviewData.progress_percent !== undefined) {
      const prog = Number(managerReviewData.progress_percent);
      if (isNaN(prog) || prog < 0 || prog > 100) {
        toast.error('Progress must be a number between 0 and 100');
        return;
      }
    }
    
    // Validate feedback for revision requests
    if (managerReviewData.action === 'request_revision' && (!managerReviewData.feedback || managerReviewData.feedback.trim() === '')) {
      toast.error('Feedback is required when requesting revision');
      return;
    }

    try {
      const payload = {
        action: managerReviewData.action,
        feedback: managerReviewData.feedback
      };
      
      if (managerReviewData.progress_percent !== null && managerReviewData.progress_percent !== undefined) {
        payload.progress_percent = Number(managerReviewData.progress_percent);
      }
      
      await api.put('/checkins/' + existingCheckIn._id + '/review', payload);
      toast.success('Review submitted successfully');
      setShowCheckInModal(false);
      fetchCheckIns();
      fetchObjectives();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit review');
    }
  }

  function getStatusBadge(status) {
    switch(status) {
      case 'pending_review': return <span className="badge" style={{ background: '#eab308', color: '#fff' }}>Pending Review</span>;
      case 'revision_requested': return <span className="badge" style={{ background: '#f97316', color: '#fff' }}>Revision Requested</span>;
      case 'approved': return <span className="badge" style={{ background: '#22c55e', color: '#fff' }}>Approved</span>;
      default: return <span className="badge" style={{ background: '#94a3b8', color: '#fff' }}>Not Submitted</span>;
    }
  }

  // Dashboard Aggregation
  const teamDashboardData = useMemo(() => {
    if (!teamObjectives.length) return [];
    
    const employeeMap = {};
    teamObjectives.forEach(obj => {
      const empId = obj.owner?._id || obj.owner;
      const empName = obj.owner?.name || 'Unknown Employee';
      if (!employeeMap[empId]) {
        employeeMap[empId] = { id: empId, name: empName, objectives: 0, avgProgress: 0, totalProgress: 0, checkInsSubmitted: 0, checkInsApproved: 0 };
      }
      employeeMap[empId].objectives += 1;
      employeeMap[empId].totalProgress += (obj.achievementPercent || 0);
    });

    teamCheckIns.forEach(ci => {
      const empId = ci.employee_id?._id || ci.employee_id;
      if (employeeMap[empId]) {
        employeeMap[empId].checkInsSubmitted += 1;
        if (ci.status === 'approved') employeeMap[empId].checkInsApproved += 1;
      }
    });

    return Object.values(employeeMap).map(emp => {
      emp.avgProgress = emp.objectives > 0 ? Math.round(emp.totalProgress / emp.objectives) : 0;
      emp.completionRate = emp.checkInsSubmitted > 0 ? Math.round((emp.checkInsApproved / emp.checkInsSubmitted) * 100) : 0;
      return emp;
    });
  }, [teamObjectives, teamCheckIns]);

  function renderTeamDashboard() {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
        {teamDashboardData.map(emp => (
          <div key={emp.id} className="card shadow-sm" style={{ padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--shell-border)' }}>
            <h3 style={{ margin: '0 0 1rem 0' }}>{emp.name}</h3>
            
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                <span>Average Progress</span>
                <span style={{ fontWeight: 'bold' }}>{emp.avgProgress}%</span>
              </div>
              <div style={{ width: '100%', background: '#e2e8f0', borderRadius: '4px', height: '8px' }}>
                <div style={{ width: `${emp.avgProgress}%`, background: 'var(--primary)', height: '100%', borderRadius: '4px' }}></div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
              <div style={{ background: 'var(--shell-bg-inset)', padding: '0.75rem', borderRadius: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--primary)' }}>{emp.objectives}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Objectives</div>
              </div>
              <div style={{ background: 'var(--shell-bg-inset)', padding: '0.75rem', borderRadius: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: emp.completionRate === 100 ? '#16a34a' : '#d97706' }}>
                  {emp.checkInsApproved} / {emp.checkInsSubmitted}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Approved Check-ins</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  function renderObjectiveList(list, checkIns) {
    let filteredList = list;
    if (showAtRiskOnly) {
      filteredList = list.filter(obj => {
        const badge = getDueBadge(obj.dueDate);
        const daysRemaining = badge && badge.isAtRisk;
        const progressRisk = (obj.achievementPercent || 0) < 25 && badge && badge.isAtRisk;
        return daysRemaining || progressRisk;
      });
    }

    if (filteredList.length === 0) {
      return (
        <div className="ent-empty" style={{ padding: '3rem' }}>
          <span style={{ fontSize: '2rem' }}>📝</span>
          <h4>No Objectives Found</h4>
          <p className="text-muted">No objectives match the current filters.</p>
        </div>
      );
    }

    return (
      <div style={{ display: 'grid', gap: '1rem' }}>
        {filteredList.map(objective => {
          const checkIn = checkIns.find(c => c.objective_id === objective._id || c.objective_id?._id === objective._id);
          const ciStatus = checkIn?.status || 'draft';
          const isManagerView = viewMode === 'team';
          const dueBadge = getDueBadge(objective.dueDate);

          return (
            <div key={objective._id} className="card shadow-sm hover-lift" style={{ borderLeft: ciStatus === 'approved' ? '4px solid #22c55e' : ciStatus === 'revision_requested' ? '4px solid #f97316' : '4px solid #3b82f6' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div style={{ flex: 1 }}>
                  {isManagerView && (
                    <div style={{ fontWeight: 'bold', color: 'var(--primary)', marginBottom: '0.5rem' }}>
                      {objective.owner?.name || 'Unknown'}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                    <h3 style={{ margin: 0 }}>{objective.title}</h3>
                    {getStatusBadge(ciStatus)}
                    {dueBadge && <span className={`badge ${dueBadge.class}`} style={{ border: '1px solid currentColor', background: 'transparent', color: 'inherit' }}>{dueBadge.label}</span>}
                    {checkIn?.priority && <span className="badge" style={{ background: '#f1f5f9', color: '#475569', textTransform: 'capitalize' }}>{checkIn.priority} Priority</span>}
                  </div>
                  
                  <div style={{ display: 'flex', gap: '2rem', alignItems: 'center', marginTop: '1rem' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                        <span>Progress</span>
                        <span style={{ fontWeight: 'bold' }}>{objective.achievementPercent || 0}%</span>
                      </div>
                      <div style={{ width: '100%', background: '#e2e8f0', borderRadius: '4px', height: '8px' }}>
                        <div style={{ width: `${objective.achievementPercent || 0}%`, background: 'var(--primary)', height: '100%', borderRadius: '4px' }}></div>
                      </div>
                    </div>
                  </div>

                  {checkIn?.manager_feedback && (
                    <div style={{ marginTop: '1rem', background: '#fffbeb', borderLeft: '4px solid #f59e0b', padding: '0.75rem', borderRadius: '4px', fontSize: '0.9rem' }}>
                      <strong>Manager Feedback: </strong> {checkIn.manager_feedback}
                    </div>
                  )}

                  {isManagerView && dueBadge?.isAtRisk && (objective.achievementPercent || 0) < 30 && (
                    <div style={{ marginTop: '1rem', background: '#eff6ff', borderLeft: '4px solid #3b82f6', padding: '0.75rem', borderRadius: '4px', fontSize: '0.9rem', color: '#1e40af' }}>
                      💡 <strong>Tip:</strong> Consider a career development note for {objective.owner?.name || 'this employee'}, as this objective is at risk with low progress.
                    </div>
                  )}
                </div>

                <div style={{ marginLeft: '2rem', display: 'flex', flexDirection: 'column', justifyContent: 'center', minWidth: '160px' }}>
                  <button className="btn btn--primary" onClick={() => openCheckInModal(objective, checkIn)}>
                    {isManagerView ? 'Review Check-in' : (ciStatus === 'approved' || ciStatus === 'pending_review' ? 'View Check-in' : 'Update Check-in')}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  const renderCheckInModalBody = () => {
    const isEmployee = viewMode === 'self';
    const ciStatus = existingCheckIn?.status || 'draft';
    const readOnlyEmployee = isEmployee && (ciStatus === 'pending_review' || ciStatus === 'approved');
    const readOnlyManager = !isEmployee && ciStatus !== 'pending_review';
    
    const totalTasks = objectiveTasks.length;
    const completedTasks = objectiveTasks.filter(t => t.status === 'done').length;
    const remainingTasks = Math.max(totalTasks - completedTasks, 0);
    const computedProgress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    const dueBadge = getDueBadge(selectedObjective?.dueDate);
    const daysRemaining = getDaysRemaining(selectedObjective?.dueDate);

    return (
      <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto', padding: '1rem' }}>
        {existingCheckIn?.manager_feedback && ciStatus === 'revision_requested' && (
          <div className="alert alert--warning" style={{ marginBottom: '1.5rem', background: '#fffbeb', borderLeft: '4px solid #f59e0b', padding: '1rem' }}>
            <h4 style={{ margin: '0 0 0.5rem 0', color: '#b45309' }}>Revision Requested</h4>
            <p style={{ margin: 0 }}>{existingCheckIn.manager_feedback}</p>
          </div>
        )}

        <div style={{ background: 'var(--shell-bg-inset)', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem' }}>
          <h4 style={{ margin: '0 0 1rem 0' }}>Task Progress Sync</h4>
          {loadingTasks ? <p>Loading tasks...</p> : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
                <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.85rem' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Completed Tasks</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#16a34a' }}>{completedTasks}</div>
                </div>
                <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.85rem' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Remaining Tasks</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: remainingTasks > 0 ? '#d97706' : '#16a34a' }}>{remainingTasks}</div>
                </div>
                <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.85rem' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Total Tasks</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-dark)' }}>{totalTasks}</div>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.9rem' }}>
                <span>{completedTasks} of {totalTasks} tasks completed</span>
                <span style={{ fontWeight: 'bold' }}>{computedProgress}%</span>
              </div>
              <div style={{ width: '100%', background: '#e2e8f0', borderRadius: '4px', height: '8px', marginBottom: '1rem' }}>
                <div style={{ width: `${computedProgress}%`, background: '#22c55e', height: '100%', borderRadius: '4px' }}></div>
              </div>
              {isEmployee && !readOnlyEmployee && (
                <button type="button" className="btn btn--secondary btn--sm" onClick={() => setFormData({...formData, progress_percent: computedProgress})}>
                  Use Task Progress
                </button>
              )}
            </>
          )}
        </div>

        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem' }}>
          <h4 style={{ margin: '0 0 0.9rem 0' }}>Deadline Awareness</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem' }}>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Due Date</div>
              <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                {selectedObjective?.dueDate ? new Date(selectedObjective.dueDate).toLocaleDateString() : 'Not set'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Days Remaining</div>
              <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                {daysRemaining == null ? 'N/A' : daysRemaining < 0 ? `${Math.abs(daysRemaining)} day(s) late` : `${daysRemaining} day(s) left`}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Status</div>
              <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{dueBadge?.label || 'No due date'}</div>
            </div>
          </div>
        </div>

        {/* Manager notes banner — visible to employees too */}
        {isEmployee && selectedObjective?.manager_notes?.length > 0 && (
          <div style={{ marginBottom: '1.5rem', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '1rem' }}>
            <div style={{ fontWeight: 600, color: '#1e40af', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>💬 Notes from your Manager</div>
            {[...selectedObjective.manager_notes].reverse().map((note, idx) => (
              <div key={idx} style={{ background: '#fff', borderRadius: '6px', padding: '0.75rem', marginBottom: '0.5rem', border: '1px solid #dbeafe', fontSize: '0.9rem' }}>
                <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem' }}>{new Date(note.created_at).toLocaleString()}</div>
                {note.text}
              </div>
            ))}
          </div>
        )}

        {isEmployee ? (
          <form id="checkInForm" onSubmit={handleSubmitCheckIn}>
            <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1rem' }}>
              <div style={{ flex: 1 }}>
                <label className="ent-label">Manual Progress (%)</label>
                <input type="number" className="ent-input" value={formData.progress_percent} onChange={e => setFormData({...formData, progress_percent: Number(e.target.value)})} min="0" max="100" disabled={readOnlyEmployee} />
              </div>
              <div style={{ flex: 1 }}>
                <label className="ent-label">Priority</label>
                <select className="ent-select" value={formData.priority} onChange={e => setFormData({...formData, priority: e.target.value})} disabled={readOnlyEmployee}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label className="ent-label">Notes & Summary</label>
              <textarea className="ent-input" style={{ minHeight: '100px' }} value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} disabled={readOnlyEmployee} required placeholder="Summarize your progress..." />
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label className="ent-label">Evidence / Attachment</label>
              <div style={{ border: '2px dashed var(--shell-border, #d1d5db)', borderRadius: '8px', padding: '1rem', textAlign: 'center', background: 'var(--shell-bg-inset, #f9fafb)' }}>
                {uploading ? (
                  <div style={{ color: 'var(--primary)', fontWeight: 600 }}>⏳ Uploading...</div>
                ) : uploadedAttachment ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem' }}>
                    <span>📎</span>
                    <a href={getAttachmentUrl(uploadedAttachment)} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', fontWeight: 600, textDecoration: 'underline' }}>{uploadedAttachment.name}</a>
                    {!readOnlyEmployee && <button type="button" onClick={() => setUploadedAttachment(null)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '1.1rem' }} title="Remove">✕</button>}
                  </div>
                ) : (
                  <div>
                    <input type="file" id="checkin-file" style={{ display: 'none' }} onChange={handleFileUpload} disabled={readOnlyEmployee} accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.gif,.txt,.csv,.zip" />
                    <label htmlFor="checkin-file" style={{ cursor: readOnlyEmployee ? 'not-allowed' : 'pointer', color: 'var(--primary)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                      📂 Choose file to upload
                    </label>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Max 10MB — PDF, Word, Excel, Images, etc.</div>
                  </div>
                )}
              </div>
            </div>
          </form>
        ) : (
          <div>

            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Employee Notes</div>
              <p style={{ margin: '0.25rem 0 0 0', padding: '0.75rem', background: '#f8fafc', borderRadius: '4px', border: '1px solid #e2e8f0' }}>{existingCheckIn?.notes || 'No notes provided.'}</p>
            </div>
            
            <div style={{ display: 'flex', gap: '2rem', marginBottom: '1.5rem' }}>
              <div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Progress</div>
                <div style={{ fontWeight: 'bold', fontSize: '1.2rem' }}>{existingCheckIn?.progress_percent || 0}%</div>
              </div>
              <div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Priority</div>
                <div style={{ fontWeight: 'bold', fontSize: '1.2rem', textTransform: 'capitalize' }}>{existingCheckIn?.priority || 'Medium'}</div>
              </div>
            </div>

            <div style={{ marginBottom: '1.5rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem' }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.75rem', fontWeight: 600 }}>Employee Attachments ({existingCheckIn?.attachments?.length || 0})</div>
              {existingCheckIn?.attachments?.length > 0 ? (
                existingCheckIn.attachments.map((att, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 0', borderBottom: idx < existingCheckIn.attachments.length - 1 ? '1px solid #e2e8f0' : 'none' }}>
                    <span style={{ fontSize: '1.2rem' }}>{att.mimetype?.startsWith('image/') ? '[IMG]' : att.mimetype?.includes('pdf') ? '[PDF]' : '[FILE]'}</span>
                    <span style={{ flex: 1, fontSize: '0.9rem', fontWeight: 500 }}>{att.name || 'File'}</span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{att.size ? (att.size / 1024).toFixed(1) + ' KB' : ''}</span>
                    <a
                      href={getAttachmentUrl(att)}
                      target="_blank"
                      rel="noreferrer"
                      style={{ background: '#e0f2fe', color: '#075985', padding: '0.3rem 0.75rem', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap' }}
                    >View</a>
                    <button
                      type="button"
                      onClick={() => handleDownloadAttachment(att)}
                      style={{ background: 'var(--primary)', color: '#fff', padding: '0.3rem 0.75rem', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 600, border: 'none', cursor: 'pointer', whiteSpace: 'nowrap' }}
                    >Download</button>
                  </div>
                ))
              ) : (
                <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)' }}>No employee attachment was submitted for this check-in.</p>
              )}
            </div>

            {!readOnlyManager && (
              <form id="managerReviewForm" onSubmit={handleManagerReview} style={{ borderTop: '1px solid var(--shell-border)', paddingTop: '1.5rem' }}>
                <h4 style={{ margin: '0 0 1rem 0' }}>Manager Review</h4>
                <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                    <input type="radio" name="action" value="approve" checked={managerReviewData.action === 'approve'} onChange={() => setManagerReviewData({...managerReviewData, action: 'approve'})} />
                    Approve
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                    <input type="radio" name="action" value="request_revision" checked={managerReviewData.action === 'request_revision'} onChange={() => setManagerReviewData({...managerReviewData, action: 'request_revision'})} />
                    Request Revision
                  </label>
                </div>
                
                <div style={{ marginBottom: '1rem' }}>
                  <label className="ent-label">Adjust Progress (%) — Optional</label>
                  <input 
                    type="number" 
                    className="ent-input" 
                    value={managerReviewData.progress_percent ?? ''} 
                    onChange={e => setManagerReviewData({...managerReviewData, progress_percent: e.target.value === '' ? null : Number(e.target.value)})} 
                    min="0" 
                    max="100" 
                    placeholder="Leave empty to keep current progress"
                  />
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Current: {existingCheckIn?.progress_percent || 0}%</div>
                </div>
                
                <div style={{ marginBottom: '1rem' }}>
                  <label className="ent-label">Feedback Notes {managerReviewData.action === 'request_revision' && <span style={{ color: '#dc2626' }}>*</span>}</label>
                  <textarea className="ent-input" style={{ minHeight: '80px' }} value={managerReviewData.feedback} onChange={e => setManagerReviewData({...managerReviewData, feedback: e.target.value})} placeholder="Provide feedback or reasons for revision..." required={managerReviewData.action === 'request_revision'} />
                </div>
                
              </form>
            )}

            {!isEmployee && (
              <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--shell-border)' }}>
                <h4 style={{ margin: '0 0 1rem 0' }}>General Manager Notes</h4>
                {selectedObjective?.manager_notes?.length > 0 ? (
                  selectedObjective.manager_notes.map((note, idx) => (
                    <div key={idx} style={{ padding: '0.75rem', background: '#f8fafc', borderRadius: '4px', marginBottom: '0.5rem', border: '1px solid #e2e8f0', fontSize: '0.9rem' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>{new Date(note.created_at).toLocaleString()}</div>
                      {note.text}
                    </div>
                  ))
                ) : (
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>No manager notes yet.</p>
                )}
                
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', marginBottom: '2rem' }}>
                  <input type="text" className="ent-input" placeholder="Type a note and press Enter..." style={{ flex: 1 }} onKeyDown={async (e) => {
                    if (e.key === 'Enter' && e.target.value.trim()) {
                      e.preventDefault();
                      try {
                        const val = e.target.value.trim();
                        e.target.value = '';
                        const res = await api.put(`/objectives/${selectedObjective._id}/note`, { note: val });
                        toast.success('Note added!');
                        setSelectedObjective(res.data.objective);
                        fetchObjectives();
                      } catch (err) {
                        toast.error('Failed to add note: ' + (err.response?.data?.message || err.message));
                      }
                    }
                  }} />
                  <button type="button" className="btn btn--primary btn--sm" onClick={async (e) => {
                    const input = e.target.previousSibling;
                    if (input && input.value.trim()) {
                      try {
                        const val = input.value.trim();
                        input.value = '';
                        const res = await api.put(`/objectives/${selectedObjective._id}/note`, { note: val });
                        toast.success('Note added!');
                        setSelectedObjective(res.data.objective);
                        fetchObjectives();
                      } catch (err) {
                        toast.error('Failed to add note: ' + (err.response?.data?.message || err.message));
                      }
                    }
                  }}>Add Note</button>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--shell-bg-inset)', padding: '1rem', borderRadius: '8px' }}>
                  <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Need to discuss this check-in in person?</span>
                  <button type="button" className="btn btn--secondary btn--sm" onClick={() => {
                    const owner = selectedObjective?.owner;
                    const employeeId = owner?._id || owner;
                    const employeeName = owner?.name || 'Employee';
                    navigate('/meetings', { state: { 
                      createMeeting: true, 
                      employee_id: String(employeeId),
                      cycle_id: selectedCycleId,
                      meeting_type: 'general',
                      title: 'Mid-Year Review: ' + employeeName,
                      participants: [String(employeeId)]
                    }});
                  }}>
                    📅 Schedule 1-on-1 Meeting
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {existingCheckIn?.history && existingCheckIn.history.length > 0 && (
          <div style={{ marginTop: '2rem' }}>
            <h4 style={{ margin: '0 0 1rem 0' }}>Check-in History</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {existingCheckIn.history.map((h, i) => (
                <div key={i} style={{ borderLeft: '2px solid var(--shell-border)', paddingLeft: '1rem', position: 'relative' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--shell-border)', position: 'absolute', left: '-5px', top: '5px' }}></div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>{new Date(h.submitted_at).toLocaleString()}</div>
                  <div style={{ fontSize: '0.9rem' }}>{h.content}</div>
                  {h.manager_feedback && (
                    <div style={{ fontSize: '0.85rem', color: '#b45309', marginTop: '0.25rem' }}>Manager: {h.manager_feedback}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  // Render employee check-in form section or manager review section

  if (loading && !selectedCycleId) {
    return <div className="page-loading"><div className="spinner"></div><p>Loading Mid-Year Execution...</p></div>;
  }

  return (
    <div className="page" style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '2.2rem', color: 'var(--text-dark)' }}>Mid-Year Execution</h1>
          <p className="text-muted" style={{ margin: '0.5rem 0 0 0' }}>Track progress and manage check-ins halfway through the cycle.</p>
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
        <div className="empty-state">No Phase 2 cycles available.</div>
      ) : (
        <>
          {activeCycle.currentPhase !== 'phase2' && (
            <div className="alert alert--warning" style={{ marginBottom: '2rem', background: '#fffbeb', color: '#92400e', padding: '1rem', borderRadius: '8px', borderLeft: '4px solid #f59e0b' }}>
              <strong>Note:</strong> This cycle is currently in Phase: {activeCycle.currentPhase}. Check-ins can only be submitted during Mid-Year Execution. You are viewing in read-only mode.
            </div>
          )}

          {isManagerRole && (
            <div style={{ display: 'flex', gap: '1rem', borderBottom: '2px solid var(--border-color)', paddingBottom: '1rem', marginBottom: '2rem', alignItems: 'center' }}>
              <button
                onClick={() => setViewMode('self')}
                style={{ background: 'none', border: 'none', fontSize: '1.1rem', fontWeight: viewMode === 'self' ? 'bold' : 'normal', color: viewMode === 'self' ? 'var(--primary)' : 'var(--text-muted)', cursor: 'pointer', paddingBottom: '0.5rem', borderBottom: viewMode === 'self' ? '3px solid var(--primary)' : '3px solid transparent' }}
              >
                My Check-Ins
              </button>
              <button
                onClick={() => setViewMode('team')}
                style={{ background: 'none', border: 'none', fontSize: '1.1rem', fontWeight: viewMode === 'team' ? 'bold' : 'normal', color: viewMode === 'team' ? 'var(--primary)' : 'var(--text-muted)', cursor: 'pointer', paddingBottom: '0.5rem', borderBottom: viewMode === 'team' ? '3px solid var(--primary)' : '3px solid transparent' }}
              >
                Team Check-Ins
              </button>
              <button
                onClick={() => setViewMode('dashboard')}
                style={{ background: 'none', border: 'none', fontSize: '1.1rem', fontWeight: viewMode === 'dashboard' ? 'bold' : 'normal', color: viewMode === 'dashboard' ? 'var(--primary)' : 'var(--text-muted)', cursor: 'pointer', paddingBottom: '0.5rem', borderBottom: viewMode === 'dashboard' ? '3px solid var(--primary)' : '3px solid transparent' }}
              >
                Team Dashboard
              </button>

              {(viewMode === 'self' || viewMode === 'team') && (
                <label style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem' }}>
                  <input type="checkbox" checked={showAtRiskOnly} onChange={e => setShowAtRiskOnly(e.target.checked)} />
                  Show At-Risk Only
                </label>
              )}
            </div>
          )}

          {viewMode === 'dashboard' ? renderTeamDashboard() : renderObjectiveList(viewMode === 'self' ? myObjectives : teamObjectives, viewMode === 'self' ? myCheckIns : teamCheckIns)}
        </>
      )}

      {showCheckInModal && (
        <div className="ent-modal-overlay">
          <div className="ent-modal" style={{ maxWidth: '700px' }}>
            <div className="ent-modal__header">
              <h3 className="ent-modal__title">{viewMode === 'self' ? 'Objective Check-In' : 'Review Check-In'}</h3>
              <button className="ent-modal__close" onClick={() => setShowCheckInModal(false)}>×</button>
            </div>
            
            <div style={{ padding: '1rem', background: '#f8fafc', borderBottom: '1px solid var(--shell-border)' }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Objective</div>
              <div style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>{selectedObjective?.title}</div>
            </div>

            {renderCheckInModalBody()}

            <div className="ent-modal__footer">
              <button type="button" className="btn btn--secondary" onClick={() => setShowCheckInModal(false)}>Close</button>
              
              {viewMode === 'self' && (!existingCheckIn || existingCheckIn.status === 'draft' || existingCheckIn.status === 'revision_requested') && (
                <button type="submit" form="checkInForm" className="btn btn--primary">Submit Check-In</button>
              )}
              
              {viewMode === 'team' && existingCheckIn?.status === 'pending_review' && (
                <button type="submit" form="managerReviewForm" className="btn btn--primary">Submit Review</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default MidYearPage;
