import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../components/AuthContext';
import { useToast, ToastContainer } from '../components/common/Toast';

function EvaluationListPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [evaluations, setEvaluations] = useState([]);
  const [cycles, setCycles] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [filterCycle, setFilterCycle] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [viewMode, setViewMode] = useState('evaluator');
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState({
    employeeId: '',
    cycleId: '',
    period: '',
  });

  const isManager = ['TEAM_LEADER', 'ADMIN', 'HR'].includes(user?.role);

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (cycles.length > 0) {
      fetchEvaluations();
    }
  }, [filterCycle, filterStatus, viewMode, cycles.length]);

  async function fetchInitialData() {
    setLoading(true);
    try {
      const cyclesRes = await api.get('/api/cycles');
      const availableCycles = (cyclesRes.data || []).filter((cycle) => cycle.status !== 'draft');
      setCycles(availableCycles);
      if (availableCycles.length > 0) {
        setFilterCycle(availableCycles[0]._id);
      }

      if (isManager) {
        const teamRes = await api.get('/api/team-members');
        setTeamMembers(Array.isArray(teamRes.data) ? teamRes.data : (teamRes.data.members || []));
      }
    } catch (err) {
      toast.error('Failed to load evaluation data.');
    } finally {
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
      toast.error('Failed to load evaluations.');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateEvaluation(event) {
    event.preventDefault();
    if (!createForm.employeeId || !createForm.cycleId) {
      toast.error('Please select an employee and cycle.');
      return;
    }

    setCreating(true);
    try {
      const res = await api.post('/api/evaluations', createForm);
      setShowCreateModal(false);
      setCreateForm({ employeeId: '', cycleId: '', period: '' });
      toast.success('Evaluation created.');
      navigate(`/evaluation-scoring?id=${res.data.evaluation._id}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create evaluation.');
    } finally {
      setCreating(false);
    }
  }

  function getStatusStyle(status) {
    const styles = {
      draft: { bg: '#64748b', text: '#fff', label: 'Draft' },
      in_progress: { bg: '#2563eb', text: '#fff', label: 'In Progress' },
      submitted: { bg: '#d97706', text: '#fff', label: 'Submitted' },
      approved: { bg: '#16a34a', text: '#fff', label: 'Approved' },
      rejected: { bg: '#dc2626', text: '#fff', label: 'Rejected' },
      completed: { bg: '#7c3aed', text: '#fff', label: 'Completed' },
    };
    return styles[status] || styles.draft;
  }

  function getScoreColor(score) {
    if (score == null) return '#94a3b8';
    if (score >= 90) return '#7c3aed';
    if (score >= 75) return '#16a34a';
    if (score >= 50) return '#ca8a04';
    return '#dc2626';
  }

  const pendingApprovals = evaluations.filter((evaluation) => evaluation.status === 'submitted' && ['ADMIN', 'HR'].includes(user?.role));

  return (
    <div className="eval-list-page">
      <ToastContainer toasts={toast.toasts} removeToast={toast.removeToast} />

      <div className="eval-list-header">
        <div>
          <h1 className="eval-list-title">Employee Evaluations</h1>
          <p className="eval-list-subtitle">Final evaluation records now score directly from approved objectives.</p>
        </div>
        {isManager && (
          <button className="btn eval-btn-create" onClick={() => setShowCreateModal(true)}>
            Create Evaluation
          </button>
        )}
      </div>

      <div className="eval-stats-row">
        <div className="eval-stat-card">
          <span className="eval-stat-number">{evaluations.length}</span>
          <span className="eval-stat-label">Total Evaluations</span>
        </div>
        <div className="eval-stat-card eval-stat-draft">
          <span className="eval-stat-number">{evaluations.filter((evaluation) => ['draft', 'in_progress'].includes(evaluation.status)).length}</span>
          <span className="eval-stat-label">Editable</span>
        </div>
        <div className="eval-stat-card eval-stat-submitted">
          <span className="eval-stat-number">{evaluations.filter((evaluation) => evaluation.status === 'submitted').length}</span>
          <span className="eval-stat-label">Submitted</span>
        </div>
        <div className="eval-stat-card eval-stat-completed">
          <span className="eval-stat-number">{evaluations.filter((evaluation) => evaluation.status === 'completed').length}</span>
          <span className="eval-stat-label">Completed</span>
        </div>
      </div>

      <div className="eval-tabs">
        {isManager && (
          <button className={`eval-tab ${viewMode === 'evaluator' ? 'active' : ''}`} onClick={() => setViewMode('evaluator')}>
            My Evaluations
          </button>
        )}
        <button className={`eval-tab ${viewMode === 'employee' ? 'active' : ''}`} onClick={() => setViewMode('employee')}>
          My Reviews
        </button>
        {['ADMIN', 'HR'].includes(user?.role) && (
          <button className={`eval-tab ${viewMode === 'all' ? 'active' : ''}`} onClick={() => setViewMode('all')}>
            All Evaluations
          </button>
        )}
      </div>

      <div className="eval-filters">
        <select value={filterCycle} onChange={(event) => setFilterCycle(event.target.value)} className="eval-filter-select">
          <option value="">All Cycles</option>
          {cycles.map((cycle) => (
            <option key={cycle._id} value={cycle._id}>{cycle.name} ({cycle.year})</option>
          ))}
        </select>
        <select value={filterStatus} onChange={(event) => setFilterStatus(event.target.value)} className="eval-filter-select">
          <option value="">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="in_progress">In Progress</option>
          <option value="submitted">Submitted</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="completed">Completed</option>
        </select>
      </div>

      {pendingApprovals.length > 0 && ['ADMIN', 'HR'].includes(user?.role) && (
        <div className="eval-pending-banner">
          <strong>{pendingApprovals.length}</strong> evaluation(s) are waiting for HR approval.
        </div>
      )}

      {loading ? (
        <div className="eval-loading">
          <div className="spinner"></div>
          <p>Loading evaluations...</p>
        </div>
      ) : evaluations.length === 0 ? (
        <div className="eval-empty-state">
          <h3>No Evaluations Found</h3>
          <p>{viewMode === 'employee' ? 'No evaluations have been created for you yet.' : 'No evaluations match the current filters.'}</p>
        </div>
      ) : (
        <div className="eval-list-grid">
          {evaluations.map((evaluation) => {
            const statusStyle = getStatusStyle(evaluation.status);
            const score = evaluation.finalScore ?? evaluation.suggestedScore;
            const objectiveCount = evaluation.objectiveAssessments?.length || 0;

            return (
              <div key={evaluation._id} className="eval-list-card" onClick={() => navigate(`/evaluation-scoring?id=${evaluation._id}`)}>
                <div className="eval-card-top">
                  <div className="eval-card-avatar">
                    {(viewMode === 'employee' ? evaluation.evaluatorId?.name : evaluation.employeeId?.name)?.charAt(0)?.toUpperCase() || '?'}
                  </div>
                  <div className="eval-card-info">
                    <h3 className="eval-card-name">
                      {viewMode === 'employee' ? `Evaluated by ${evaluation.evaluatorId?.name}` : evaluation.employeeId?.name}
                    </h3>
                    <span className="eval-card-period">{evaluation.period || evaluation.cycleId?.name}</span>
                    <span className="eval-card-role">{objectiveCount} objective(s)</span>
                  </div>
                  <span className="eval-card-status" style={{ backgroundColor: statusStyle.bg, color: statusStyle.text }}>
                    {statusStyle.label}
                  </span>
                </div>

                <div className="eval-card-bottom">
                  <div className="eval-card-progress">
                    <span className="eval-card-progress-label">Objective Score</span>
                    <div className="eval-card-progress-bar">
                      <div className="eval-card-progress-fill" style={{ width: `${Math.min(score || 0, 100)}%` }}></div>
                    </div>
                    <span className="eval-card-progress-text">{objectiveCount} scoped</span>
                  </div>

                  {score != null && (
                    <div className="eval-card-score" style={{ color: getScoreColor(score) }}>
                      <span className="eval-card-score-value">{score}</span>
                      <span className="eval-card-score-label">/100</span>
                    </div>
                  )}
                </div>

                <div className="eval-card-footer">
                  <span>{new Date(evaluation.createdAt).toLocaleDateString()}</span>
                  {evaluation.employeeAcknowledgment?.acknowledged && <span className="eval-ack-badge">Acknowledged</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal eval-create-modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h3>Create New Evaluation</h3>
              <button onClick={() => setShowCreateModal(false)} className="close-btn" style={{ background: 'transparent', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>x</button>
            </div>

            <form onSubmit={handleCreateEvaluation}>
              <div className="eval-create-form">
                <div className="eval-create-field">
                  <label className="eval-create-label">Employee</label>
                  <select
                    value={createForm.employeeId}
                    onChange={(event) => setCreateForm((current) => ({ ...current, employeeId: event.target.value }))}
                    className="eval-create-select"
                    required
                  >
                    <option value="">Select Employee...</option>
                    {teamMembers.map((member) => {
                      const memberId = member._id || member.id;
                      return <option key={memberId} value={memberId}>{member.name || member.email}</option>;
                    })}
                  </select>
                </div>

                <div className="eval-create-field">
                  <label className="eval-create-label">Cycle</label>
                  <select
                    value={createForm.cycleId}
                    onChange={(event) => {
                      const cycle = cycles.find((item) => item._id === event.target.value);
                      setCreateForm((current) => ({
                        ...current,
                        cycleId: event.target.value,
                        period: cycle ? `${cycle.name} ${cycle.year}` : '',
                      }));
                    }}
                    className="eval-create-select"
                    required
                  >
                    <option value="">Select Cycle...</option>
                    {cycles.map((cycle) => (
                      <option key={cycle._id} value={cycle._id}>{cycle.name} ({cycle.year})</option>
                    ))}
                  </select>
                </div>

                <div className="eval-create-field">
                  <label className="eval-create-label">Period Label</label>
                  <input
                    type="text"
                    value={createForm.period}
                    onChange={(event) => setCreateForm((current) => ({ ...current, period: event.target.value }))}
                    className="eval-create-input"
                    placeholder="End-Year 2026"
                  />
                </div>
              </div>

              <div className="eval-create-actions">
                <button type="button" className="btn btn--secondary" onClick={() => setShowCreateModal(false)}>Cancel</button>
                <button type="submit" className="btn eval-btn-create" disabled={creating}>
                  {creating ? 'Creating...' : 'Create Evaluation'}
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
