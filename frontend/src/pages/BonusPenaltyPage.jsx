import React, { useEffect, useState, useMemo } from 'react';
import api from '../services/api';
import { useAuth } from '../components/AuthContext';
import { useToast } from '../components/common/Toast';

function BonusPenaltyPage() {
  const { user } = useAuth();
  const toast = useToast();

  const [records, setRecords] = useState([]);
  const [users, setUsers] = useState([]);
  const [eligibleEvaluations, setEligibleEvaluations] = useState([]);
  const [eligibleError, setEligibleError] = useState('');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filterType, setFilterType] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [reviewNotes, setReviewNotes] = useState({});
  const [formData, setFormData] = useState({
    employee: '',
    type: 'bonus',
    value: '',
    reason: '',
    finalEvaluation: ''
  });
  const [saving, setSaving] = useState(false);

  const isHROrAdmin = ['HR', 'ADMIN'].includes(user?.role);
  const canRecommend = ['ADMIN', 'HR', 'TEAM_LEADER'].includes(user?.role);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      if (isHROrAdmin) {
        const recordsRes = await api.get('/bonus-penalty');
        setRecords(recordsRes.data.records || []);
        if (canRecommend) {
          const usersRes = await api.get('/users');
          setUsers(usersRes.data?.users || []);
        } else {
          setUsers([]);
        }
      } else {
        const usersRes = await api.get('/team-members');
        const usersList = Array.isArray(usersRes.data) ? usersRes.data : usersRes.data?.members || [];
        setUsers(usersList);
        const results = await Promise.allSettled(usersList.map((member) => api.get(`/bonus-penalty/employee/${member._id || member.id}`)));
        setRecords(results.flatMap((result) => result.status === 'fulfilled' ? result.value.data.records || [] : []));
      }
      if (canRecommend) {
        try {
          const eligibleRes = await api.get('/bonus-penalty/eligible-evaluations');
          setEligibleEvaluations(eligibleRes.data.evaluations || []);
          setEligibleError('');
        } catch (err) {
          setEligibleEvaluations([]);
          setEligibleError(err.response?.data?.message || 'Failed to load eligible evaluations.');
        }
      }
    } catch {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  }

  async function handleApproval(recordId, approvalStatus) {
    const notes = String(reviewNotes[recordId] || '').trim();
    if (approvalStatus === 'rejected' && !notes) {
      toast.error('Explain what documentation the manager must correct.');
      return;
    }
    try {
      await api.put(`/bonus-penalty/${recordId}/approval`, { approvalStatus, reviewNotes: notes });
      toast.success(approvalStatus === 'approved'
        ? 'Documentation marked as reviewed.'
        : 'Recommendation sent back for documentation correction.');
      setReviewNotes((previous) => ({ ...previous, [recordId]: '' }));
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update approval.');
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!formData.employee || !formData.finalEvaluation || !formData.value || Number(formData.value) <= 0 || !formData.reason.trim()) {
      toast.error('Employee, linked final evaluation, reason, and a value greater than zero are required.');
      return;
    }
    setSaving(true);
    try {
      await api.post('/bonus-penalty', formData);
      toast.success(`${formData.type === 'bonus' ? 'Bonus' : 'Penalty'} recommendation recorded successfully.`);
      setFormData({ employee: '', type: 'bonus', value: '', reason: '', finalEvaluation: '' });
      setShowForm(false);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create record.');
    } finally {
      setSaving(false);
    }
  }

  const filteredRecords = useMemo(() => {
    let list = records;
    if (filterType !== 'all') list = list.filter(r => r.type === filterType);
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      list = list.filter(r =>
        (r.employee?.name || '').toLowerCase().includes(term) ||
        (r.reason || '').toLowerCase().includes(term)
      );
    }
    return list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [records, filterType, searchTerm]);

  const stats = useMemo(() => {
    const bonuses = records.filter(r => r.type === 'bonus');
    const penalties = records.filter(r => r.type === 'penalty');
    return {
      totalBonuses: bonuses.length,
      totalPenalties: penalties.length,
      totalBonusValue: bonuses.reduce((sum, r) => sum + (r.value || 0), 0),
      totalPenaltyValue: penalties.reduce((sum, r) => sum + (r.value || 0), 0)
    };
  }, [records]);

  const selectableEvaluations = useMemo(() => (
    eligibleEvaluations.filter((evaluation) => !(evaluation.existingTypes || []).includes(formData.type))
  ), [eligibleEvaluations, formData.type]);

  if (loading) {
    return <div className="page-loading"><div className="spinner"></div><p>Loading bonus & penalty data...</p></div>;
  }

  return (
    <div className="page" style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '2rem', color: 'var(--text-dark)' }}>
            💰 Bonus & Penalty Management
          </h1>
          <p className="text-muted" style={{ margin: '0.5rem 0 0 0' }}>
            Managers recommend. HR reviews the supporting reason, linked evaluation, objective context, and documentation before recording a review outcome.
          </p>
        </div>
        {canRecommend && (
          <button
            className="btn btn--primary"
            onClick={() => setShowForm(!showForm)}
            style={{ padding: '0.75rem 1.5rem', borderRadius: '10px', fontWeight: 700 }}
          >
            {showForm ? 'Cancel' : '+ New Record'}
          </button>
        )}
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        <div className="card shadow-sm" style={{ padding: '1.25rem', borderRadius: '12px', textAlign: 'center', borderTop: '4px solid #16a34a' }}>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#16a34a' }}>{stats.totalBonuses}</div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>Total Bonuses</div>
        </div>
        <div className="card shadow-sm" style={{ padding: '1.25rem', borderRadius: '12px', textAlign: 'center', borderTop: '4px solid #dc2626' }}>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#dc2626' }}>{stats.totalPenalties}</div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>Total Penalties</div>
        </div>
        <div className="card shadow-sm" style={{ padding: '1.25rem', borderRadius: '12px', textAlign: 'center', borderTop: '4px solid #0284c7' }}>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#0284c7' }}>{stats.totalBonusValue}</div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>Bonus Value Total</div>
        </div>
        <div className="card shadow-sm" style={{ padding: '1.25rem', borderRadius: '12px', textAlign: 'center', borderTop: '4px solid #f59e0b' }}>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#f59e0b' }}>{stats.totalPenaltyValue}</div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>Penalty Value Total</div>
        </div>
      </div>

      {/* Create Form */}
      {showForm && canRecommend && (
        <div className="card shadow-sm" style={{ padding: '1.5rem', marginBottom: '2rem', borderRadius: '12px', border: '2px solid var(--primary)', background: 'var(--shell-bg-inset, #f8fafc)' }}>
          <h3 style={{ margin: '0 0 1rem 0' }}>Create Bonus / Penalty</h3>
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <label className="ent-label">Employee</label>
                <select
                  className="ent-select"
                  value={formData.employee}
                  onChange={e => setFormData({ ...formData, employee: e.target.value })}
                  required
                >
                  <option value="">Select an employee...</option>
                  {users.map(u => (
                    <option key={u._id || u.id} value={u._id || u.id}>{u.name}{u.email ? ` (${u.email})` : ''}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="ent-label">Type</label>
                <select
                  className="ent-select"
                  value={formData.type}
                  onChange={e => setFormData({ ...formData, type: e.target.value })}
                >
                  <option value="bonus">Bonus</option>
                  <option value="penalty">Penalty</option>
                </select>
              </div>
              <div>
                <label className="ent-label">Value</label>
                <input
                  type="number"
                  className="ent-input"
                  value={formData.value}
                  onChange={e => setFormData({ ...formData, value: e.target.value })}
                  placeholder="e.g. 500"
                  required
                  min="0.01"
                  step="0.01"
                />
              </div>
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label className="ent-label">Linked Final Evaluation</label>
              <select
                className="ent-select"
                value={formData.finalEvaluation}
                onChange={e => {
                  const selected = eligibleEvaluations.find((evaluation) => String(evaluation._id) === e.target.value);
                  setFormData({
                    ...formData,
                    finalEvaluation: e.target.value,
                    employee: selected?.employee?._id || formData.employee
                  });
                }}
                required
              >
                <option value="">{eligibleError || 'Select a validated final evaluation...'}</option>
                {selectableEvaluations.map((evaluation) => (
                  <option key={evaluation._id} value={evaluation._id}>
                    {evaluation.employee?.name || 'Employee'} - {evaluation.cycle?.name || evaluation.cycle?.year || 'Cycle'} - {evaluation.status} - {evaluation.final_score ?? 'N/A'}%
                  </option>
                ))}
              </select>
              {!eligibleError && selectableEvaluations.length === 0 && (
                <p className="text-muted" style={{ margin: '0.35rem 0 0 0' }}>No eligible validated evaluations for this record type.</p>
              )}
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label className="ent-label">Reason</label>
              <textarea
                className="ent-input"
                style={{ minHeight: '80px' }}
                value={formData.reason}
                onChange={e => setFormData({ ...formData, reason: e.target.value })}
                placeholder="Explain the reason for this bonus or penalty..."
                required
              />
            </div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button type="submit" className="btn btn--primary" disabled={saving}>
                {saving ? 'Saving...' : 'Save Record'}
              </button>
              <button type="button" className="btn btn--outline" onClick={() => setShowForm(false)}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '0.5rem', background: 'var(--shell-bg-inset)', padding: '0.5rem', borderRadius: '8px' }}>
          <button className={`btn btn--${filterType === 'all' ? 'primary' : 'outline'} btn--sm`} onClick={() => setFilterType('all')}>All</button>
          <button className={`btn btn--${filterType === 'bonus' ? 'primary' : 'outline'} btn--sm`} onClick={() => setFilterType('bonus')}>Bonuses</button>
          <button className={`btn btn--${filterType === 'penalty' ? 'primary' : 'outline'} btn--sm`} onClick={() => setFilterType('penalty')}>Penalties</button>
        </div>
        <input
          type="text"
          className="ent-input"
          placeholder="Search by name or reason..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          style={{ maxWidth: '300px', borderRadius: '8px' }}
        />
      </div>

      {/* Records List */}
      {filteredRecords.length === 0 ? (
        <div className="card shadow-sm" style={{ padding: '3rem', textAlign: 'center', borderRadius: '12px' }}>
          <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>📋</div>
          <h3 style={{ margin: '0 0 0.5rem 0' }}>No Records Found</h3>
          <p className="text-muted">No bonus or penalty records match your filters.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {filteredRecords.map(record => (
            <div
              key={record._id}
              className="card shadow-sm hover-lift"
              style={{
                padding: '1.25rem 1.5rem',
                borderRadius: '12px',
                borderLeft: `4px solid ${record.type === 'bonus' ? '#16a34a' : '#dc2626'}`,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '1rem',
                flexWrap: 'wrap'
              }}
            >
              <div style={{ flex: 1, minWidth: '200px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
                  <strong style={{ fontSize: '1.05rem' }}>{record.employee?.name || 'Unknown'}</strong>
                  <span style={{
                    padding: '0.2rem 0.6rem',
                    borderRadius: '20px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    background: record.type === 'bonus' ? '#dcfce7' : '#fef2f2',
                    color: record.type === 'bonus' ? '#166534' : '#991b1b',
                    textTransform: 'uppercase'
                  }}>
                    {record.type}
                  </span>
                </div>
                <p style={{ margin: '0 0 0.3rem 0', fontSize: '0.9rem', color: 'var(--text-dark)', lineHeight: 1.5 }}>
                  {record.reason}
                </p>
                <div className="text-muted" style={{ fontSize: '0.8rem' }}>
                  Assigned by {record.assignedBy?.name || 'System'} · {new Date(record.createdAt).toLocaleDateString()}
                </div>
                <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap', marginTop: '0.55rem' }}>
                  <span className="badge">{record.approvalStatus || 'approved'}</span>
                  {record.finalEvaluation && <span className="badge">Final score: {record.finalEvaluation.final_score}%</span>}
                  {record.hrDecision && <span className="badge">HR: {(record.hrDecision.actionLabel || record.hrDecision.action || '').replace(/_/g, ' ')}</span>}
                  {record.objective && <span className="badge">Objective: {record.objective.title}</span>}
                </div>
                {isHROrAdmin && record.approvalStatus === 'pending' && (
                  <div style={{ marginTop: '0.8rem', padding: '0.85rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                    <label className="ent-label">HR documentation review note</label>
                    <textarea
                      className="ent-input"
                      style={{ minHeight: '68px' }}
                      value={reviewNotes[record._id] || ''}
                      onChange={(event) => setReviewNotes((previous) => ({ ...previous, [record._id]: event.target.value }))}
                      placeholder="Optional review note, or required correction reason when sending back."
                    />
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.65rem', flexWrap: 'wrap' }}>
                      <button className="btn btn--primary btn--sm" onClick={() => handleApproval(record._id, 'approved')}>Mark Documentation Reviewed</button>
                      <button className="btn btn--outline btn--sm" onClick={() => handleApproval(record._id, 'rejected')}>Send Back for Documentation</button>
                    </div>
                  </div>
                )}
                {record.reviewNotes && (
                  <div style={{ marginTop: '0.65rem', padding: '0.7rem', background: record.approvalStatus === 'rejected' ? '#fef2f2' : '#f0fdf4', borderRadius: '8px', fontSize: '0.88rem' }}>
                    <strong>HR documentation note:</strong> {record.reviewNotes}
                    {record.reviewedBy?.name && <span className="text-muted"> · {record.reviewedBy.name}</span>}
                  </div>
                )}
              </div>
              <div style={{
                textAlign: 'center',
                padding: '0.5rem 1rem',
                background: record.type === 'bonus' ? '#f0fdf4' : '#fef2f2',
                borderRadius: '10px',
                minWidth: '80px'
              }}>
                <div style={{
                  fontSize: '1.5rem',
                  fontWeight: 800,
                  color: record.type === 'bonus' ? '#16a34a' : '#dc2626'
                }}>
                  {record.type === 'bonus' ? '+' : '-'}{record.value}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default BonusPenaltyPage;
