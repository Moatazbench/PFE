import React, { useEffect, useState, useMemo } from 'react';
import api from '../services/api';
import { useAuth } from '../components/AuthContext';
import { useToast } from '../components/common/Toast';

function BonusPenaltyPage() {
  const { user } = useAuth();
  const toast = useToast();

  const [records, setRecords] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filterType, setFilterType] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({
    employee: '',
    type: 'bonus',
    value: '',
    reason: ''
  });
  const [saving, setSaving] = useState(false);

  const isHROrAdmin = ['HR', 'ADMIN'].includes(user?.role);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const usersRes = await api.get('/users');
      const usersList = Array.isArray(usersRes.data) ? usersRes.data : usersRes.data?.users || [];
      setUsers(usersList);

      // If HR/Admin, get records for all users
      // Otherwise only get records for team members
      if (isHROrAdmin && usersList.length > 0) {
        const allRecords = [];
        for (const u of usersList) {
          try {
            const res = await api.get(`/bonus-penalty/employee/${u._id}`);
            if (res.data.records) allRecords.push(...res.data.records);
          } catch { /* skip users without records */ }
        }
        setRecords(allRecords);
      }
    } catch (err) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!formData.employee || !formData.value || !formData.reason.trim()) {
      toast.error('All fields are required.');
      return;
    }
    setSaving(true);
    try {
      await api.post('/bonus-penalty', formData);
      toast.success(`${formData.type === 'bonus' ? 'Bonus' : 'Penalty'} recorded successfully.`);
      setFormData({ employee: '', type: 'bonus', value: '', reason: '' });
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
            Assign bonuses or penalties to employees based on performance.
          </p>
        </div>
        {isHROrAdmin && (
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
      {showForm && isHROrAdmin && (
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
                    <option key={u._id} value={u._id}>{u.name} ({u.email})</option>
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
                  min="0"
                />
              </div>
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
