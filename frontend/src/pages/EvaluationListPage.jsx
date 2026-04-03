import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../components/AuthContext';
import { useToast, ToastContainer } from '../components/common/Toast';

function EvaluationListPage() {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [evaluations, setEvaluations] = useState([]);
  const [cycles, setCycles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterCycle, setFilterCycle] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [viewMode, setViewMode] = useState('evaluator'); // 'evaluator' | 'employee' | 'all'
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [teamMembers, setTeamMembers] = useState([]);

  const [createForm, setCreateForm] = useState({
    employeeId: '',
    cycleId: '',
    period: '',
    scoringMethod: 'weighted_average',
  });
  const [creating, setCreating] = useState(false);

  const isManager = ['TEAM_LEADER', 'MANAGER', 'ADMIN', 'HR'].includes(user?.role);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (filterCycle || filterStatus) fetchEvaluations();
  }, [filterCycle, filterStatus, viewMode]);

  async function fetchData() {
    try {
      const [cyclesRes] = await Promise.all([
        api.get('/api/cycles'),
      ]);
      const allCycles = cyclesRes.data.filter(c => c.status !== 'draft');
      setCycles(allCycles);
      if (allCycles.length > 0) {
        setFilterCycle(allCycles[0]._id);
      }

      // Fetch team members for create modal
      if (isManager) {
        try {
          const teamRes = await api.get('/api/team-members');
          setTeamMembers(teamRes.data.members || teamRes.data || []);
        } catch (e) {
          // Fallback: try teams endpoint
          try {
            const teamsRes = await api.get('/api/teams');
            const myTeam = teamsRes.data.find(t => String(t.leader?._id || t.leader) === String(user?.id));
            if (myTeam) {
              setTeamMembers(myTeam.members || []);
            }
          } catch (e2) { /* ignore */ }
        }
      }

      await fetchEvaluations();
    } catch (err) {
      toast.error('Failed to load data');
      setLoading(false);
    }
  }

  async function fetchEvaluations() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterCycle) params.append('cycleId', filterCycle);
      if (filterStatus) params.append('status', filterStatus);

      let url = '/api/evaluations';
      if (viewMode === 'evaluator' && isManager) {
        url = `/api/evaluations/evaluator/${user.id}`;
      } else if (viewMode === 'employee') {
        url = `/api/evaluations/employee/${user.id}`;
      }

      const res = await api.get(`${url}?${params.toString()}`);
      setEvaluations(res.data.evaluations || []);
    } catch (err) {
      toast.error('Failed to load evaluations');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateEvaluation(e) {
    e.preventDefault();
    if (!createForm.employeeId || !createForm.cycleId) {
      toast.error('Please select an employee and cycle');
      return;
    }
    setCreating(true);
    try {
      const res = await api.post('/api/evaluations', createForm);
      toast.success('Evaluation created successfully!');
      setShowCreateModal(false);
      setCreateForm({ employeeId: '', cycleId: '', period: '', scoringMethod: 'weighted_average' });
      // Navigate to the scoring page
      navigate(`/evaluation-scoring?id=${res.data.evaluation._id}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create evaluation');
    } finally {
      setCreating(false);
    }
  }

  function getStatusStyle(status) {
    const m = {
      draft: { bg: '#64748b', text: '#fff', label: 'Draft' },
      in_progress: { bg: '#3b82f6', text: '#fff', label: 'In Progress' },
      submitted: { bg: '#f59e0b', text: '#fff', label: 'Submitted' },
      approved: { bg: '#22c55e', text: '#fff', label: 'Approved' },
      rejected: { bg: '#ef4444', text: '#fff', label: 'Rejected' },
      completed: { bg: '#8b5cf6', text: '#fff', label: 'Completed' },
    };
    return m[status] || m.draft;
  }

  function getScoreColor(score) {
    if (score == null) return '#94a3b8';
    if (score >= 8) return '#8b5cf6';
    if (score >= 6) return '#22c55e';
    if (score >= 5) return '#eab308';
    if (score >= 3) return '#f97316';
    return '#ef4444';
  }

  const activeEvals = evaluations;
  const pendingReview = evaluations.filter(e => e.status === 'submitted' && ['ADMIN', 'HR'].includes(user?.role));

  return (
    <div className="eval-list-page">
      <ToastContainer toasts={toast.toasts} removeToast={toast.removeToast} />

      {/* Page Header */}
      <div className="eval-list-header">
        <div>
          <h1 className="eval-list-title">⭐ Employee Evaluations</h1>
          <p className="eval-list-subtitle">Manage and track performance evaluations across your team.</p>
        </div>
        <div className="eval-list-header-actions">
          {isManager && (
            <button className="btn eval-btn-create" onClick={() => setShowCreateModal(true)}>
              ➕ Create Evaluation
            </button>
          )}
        </div>
      </div>

      {/* Stats cards */}
      <div className="eval-stats-row">
        <div className="eval-stat-card">
          <span className="eval-stat-number">{evaluations.length}</span>
          <span className="eval-stat-label">Total Evaluations</span>
        </div>
        <div className="eval-stat-card eval-stat-draft">
          <span className="eval-stat-number">{evaluations.filter(e => ['draft', 'in_progress'].includes(e.status)).length}</span>
          <span className="eval-stat-label">In Progress</span>
        </div>
        <div className="eval-stat-card eval-stat-submitted">
          <span className="eval-stat-number">{evaluations.filter(e => e.status === 'submitted').length}</span>
          <span className="eval-stat-label">Submitted</span>
        </div>
        <div className="eval-stat-card eval-stat-completed">
          <span className="eval-stat-number">{evaluations.filter(e => e.status === 'completed').length}</span>
          <span className="eval-stat-label">Completed</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="eval-tabs">
        {isManager && (
          <button
            className={`eval-tab ${viewMode === 'evaluator' ? 'active' : ''}`}
            onClick={() => setViewMode('evaluator')}
          >👔 My Evaluations (Evaluator)</button>
        )}
        <button
          className={`eval-tab ${viewMode === 'employee' ? 'active' : ''}`}
          onClick={() => setViewMode('employee')}
        >👤 My Reviews (Employee)</button>
        {['ADMIN', 'HR'].includes(user?.role) && (
          <button
            className={`eval-tab ${viewMode === 'all' ? 'active' : ''}`}
            onClick={() => setViewMode('all')}
          >📋 All Evaluations</button>
        )}
      </div>

      {/* Filters */}
      <div className="eval-filters">
        <select
          value={filterCycle}
          onChange={e => setFilterCycle(e.target.value)}
          className="eval-filter-select"
        >
          <option value="">All Cycles</option>
          {cycles.map(c => <option key={c._id} value={c._id}>{c.name} ({c.year})</option>)}
        </select>
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="eval-filter-select"
        >
          <option value="">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="in_progress">In Progress</option>
          <option value="submitted">Submitted</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="completed">Completed</option>
        </select>
      </div>

      {/* Pending approval banner */}
      {pendingReview.length > 0 && ['ADMIN', 'HR'].includes(user?.role) && (
        <div className="eval-pending-banner">
          ⚠️ <strong>{pendingReview.length}</strong> evaluation(s) pending your approval
        </div>
      )}

      {/* Evaluations list */}
      {loading ? (
        <div className="eval-loading">
          <div className="spinner"></div>
          <p>Loading evaluations...</p>
        </div>
      ) : activeEvals.length === 0 ? (
        <div className="eval-empty-state">
          <span style={{ fontSize: '3rem' }}>📋</span>
          <h3>No Evaluations Found</h3>
          <p>
            {viewMode === 'evaluator' ? 'You haven\'t created any evaluations yet.' :
             viewMode === 'employee' ? 'No evaluations have been created for you.' :
             'No evaluations match your filters.'}
          </p>
          {isManager && viewMode === 'evaluator' && (
            <button className="btn eval-btn-create" onClick={() => setShowCreateModal(true)}>
              Create Your First Evaluation
            </button>
          )}
        </div>
      ) : (
        <div className="eval-list-grid">
          {activeEvals.map(ev => {
            const statusStyle = getStatusStyle(ev.status);
            const reviewed = ev.goalAssessments?.filter(a => a.reviewed).length || 0;
            const total = ev.goalAssessments?.length || 0;
            const score = ev.finalScore || ev.suggestedScore;

            return (
              <div
                key={ev._id}
                className="eval-list-card"
                onClick={() => navigate(`/evaluation-scoring?id=${ev._id}`)}
              >
                <div className="eval-card-top">
                  <div className="eval-card-avatar">
                    {(viewMode === 'employee' ? ev.evaluatorId?.name : ev.employeeId?.name)?.charAt(0)?.toUpperCase() || '?'}
                  </div>
                  <div className="eval-card-info">
                    <h3 className="eval-card-name">
                      {viewMode === 'employee' ? `Evaluated by ${ev.evaluatorId?.name}` : ev.employeeId?.name}
                    </h3>
                    <span className="eval-card-period">{ev.period || ev.cycleId?.name}</span>
                    <span className="eval-card-role">{ev.employeeId?.role}</span>
                  </div>
                  <span className="eval-card-status" style={{ backgroundColor: statusStyle.bg, color: statusStyle.text }}>
                    {statusStyle.label}
                  </span>
                </div>

                <div className="eval-card-bottom">
                  <div className="eval-card-progress">
                    <span className="eval-card-progress-label">Goals Reviewed</span>
                    <div className="eval-card-progress-bar">
                      <div className="eval-card-progress-fill" style={{ width: total > 0 ? `${(reviewed / total) * 100}%` : '0%' }}></div>
                    </div>
                    <span className="eval-card-progress-text">{reviewed}/{total}</span>
                  </div>

                  {score != null && (
                    <div className="eval-card-score" style={{ color: getScoreColor(score) }}>
                      <span className="eval-card-score-value">{score}</span>
                      <span className="eval-card-score-label">/10</span>
                    </div>
                  )}
                </div>

                <div className="eval-card-footer">
                  <span>{new Date(ev.createdAt).toLocaleDateString()}</span>
                  {ev.employeeAcknowledgment?.acknowledged && <span className="eval-ack-badge">✅ Acknowledged</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Evaluation Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal eval-create-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>➕ Create New Evaluation</h3>
              <button onClick={() => setShowCreateModal(false)} className="close-btn" style={{ background: 'transparent', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>×</button>
            </div>

            <form onSubmit={handleCreateEvaluation}>
              <div className="eval-create-form">
                <div className="eval-create-field">
                  <label className="eval-create-label">Employee <span style={{ color: 'red' }}>*</span></label>
                  <select
                    value={createForm.employeeId}
                    onChange={e => setCreateForm(f => ({ ...f, employeeId: e.target.value }))}
                    className="eval-create-select"
                    required
                  >
                    <option value="">Select Employee...</option>
                    {teamMembers.map(m => {
                      const memberId = m._id || m.id;
                      const memberName = m.name || m.email;
                      return <option key={memberId} value={memberId}>{memberName}</option>;
                    })}
                  </select>
                </div>

                <div className="eval-create-field">
                  <label className="eval-create-label">Cycle <span style={{ color: 'red' }}>*</span></label>
                  <select
                    value={createForm.cycleId}
                    onChange={e => {
                      const cycle = cycles.find(c => c._id === e.target.value);
                      setCreateForm(f => ({
                        ...f,
                        cycleId: e.target.value,
                        period: cycle ? `${cycle.name} ${cycle.year}` : '',
                      }));
                    }}
                    className="eval-create-select"
                    required
                  >
                    <option value="">Select Cycle...</option>
                    {cycles.map(c => <option key={c._id} value={c._id}>{c.name} ({c.year})</option>)}
                  </select>
                </div>

                <div className="eval-create-field">
                  <label className="eval-create-label">Period Label</label>
                  <input
                    type="text"
                    value={createForm.period}
                    onChange={e => setCreateForm(f => ({ ...f, period: e.target.value }))}
                    className="eval-create-input"
                    placeholder="e.g., End-Year 2025"
                  />
                </div>

                <div className="eval-create-field">
                  <label className="eval-create-label">Scoring Method</label>
                  <select
                    value={createForm.scoringMethod}
                    onChange={e => setCreateForm(f => ({ ...f, scoringMethod: e.target.value }))}
                    className="eval-create-select"
                  >
                    <option value="weighted_average">Weighted Average</option>
                    <option value="simple_average">Simple Average</option>
                  </select>
                </div>
              </div>

              <div className="eval-create-actions">
                <button type="button" className="btn btn--secondary" onClick={() => setShowCreateModal(false)}>Cancel</button>
                <button type="submit" className="btn eval-btn-create" disabled={creating}>
                  {creating ? 'Creating...' : 'Create & Start Evaluation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default EvaluationListPage;
