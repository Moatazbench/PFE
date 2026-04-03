import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../components/AuthContext';
import { useToast } from '../components/common/Toast';

function AuditLogsPage() {
  const { user } = useAuth();
  const toast = useToast();
  
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [filterEntity, setFilterEntity] = useState('all');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  useEffect(() => { fetchLogs(); }, []);

  async function fetchLogs() {
    setLoading(true);
    try {
      let url = '/api/audit-logs?limit=100';
      if (filterEntity !== 'all') url += `&entityType=${filterEntity}`;
      if (dateRange.start) url += `&startDate=${dateRange.start}`;
      if (dateRange.end) url += `&endDate=${dateRange.end}`;

      const res = await api.get(url);
      setLogs(res.data.logs || []);
    } catch (err) {
      toast.error('Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  }

  function handleFilterSubmit(e) {
    e.preventDefault();
    fetchLogs();
  }

  const getActionBadge = (action) => {
    const actMap = {
      'create': { c: '#0f172a', bg: '#f1f5f9' },
      'update': { c: '#0f172a', bg: '#e2e8f0' },
      'delete': { c: '#ef4444', bg: '#fef2f2' },
      'submitted': { c: '#3b82f6', bg: '#eff6ff' },
      'approved': { c: '#22c55e', bg: '#f0fdf4' },
      'rejected': { c: '#ef4444', bg: '#fef2f2' },
      'revision_requested': { c: '#f97316', bg: '#fff7ed' },
      'midyear_assessed': { c: '#8b5cf6', bg: '#f5f3ff' },
      'final_evaluated': { c: '#6366f1', bg: '#eef2ff' },
      'locked': { c: '#1e293b', bg: '#f8fafc' },
      'unlocked': { c: '#f59e0b', bg: '#fffbeb' },
      'phase_changed': { c: '#0ea5e9', bg: '#e0f2fe' }
    };
    const s = actMap[action] || { c: '#64748b', bg: '#f8fafc' };
    return <span style={{ padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold', color: s.c, backgroundColor: s.bg, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{action.replace('_', ' ')}</span>;
  };

  const getEntityIcon = (entity) => {
    const map = {
      'goal': '🎯', 'review': '📝', 'goal_review': '📝', 'cycle': '🔄',
      'user': '👤', 'team': '👥', 'notification': '🔔'
    };
    return map[entity] || '📄';
  };

  return (
    <div className="page" style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '2.2rem', color: 'var(--text-dark)' }}>🛡️ System Audit Logs</h1>
          <p className="text-muted" style={{ margin: '0.5rem 0 0 0' }}>Security, activity, and administrative trace.</p>
        </div>
      </div>

      <div className="card shadow-sm" style={{ padding: '1.5rem', marginBottom: '2rem', background: '#f8fafc', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
        <form onSubmit={handleFilterSubmit} style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end' }}>
          <div className="form-group" style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>Entity Type</label>
            <select className="form-control hover-lift" value={filterEntity} onChange={e => setFilterEntity(e.target.value)} style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
              <option value="all">All Entities</option>
              <option value="goal">Annual Goals</option>
              <option value="goal_review">Assessments</option>
              <option value="cycle">Cycles</option>
              <option value="user">Users</option>
            </select>
          </div>
          <div className="form-group" style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>Start Date</label>
            <input type="date" className="form-control" value={dateRange.start} onChange={e => setDateRange({...dateRange, start: e.target.value})} style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
          </div>
          <div className="form-group" style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>End Date</label>
            <input type="date" className="form-control" value={dateRange.end} onChange={e => setDateRange({...dateRange, end: e.target.value})} style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
          </div>
          <button type="submit" className="btn btn--primary" style={{ padding: '0.75rem 2rem', fontWeight: 'bold', height: '44px' }}>Filter Logs</button>
        </form>
      </div>

      {loading ? (
        <div className="page-loading"><div className="spinner"></div><p>Searching logs...</p></div>
      ) : logs.length === 0 ? (
        <div className="empty-state">No audit logs match your criteria.</div>
      ) : (
        <div style={{ background: '#fff', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
          <table style={{ minWidth: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ background: '#0f172a', color: '#fff', textAlign: 'left' }}>
                <th style={{ padding: '1rem', width: '200px' }}>Timestamp (Local)</th>
                <th style={{ padding: '1rem', width: '180px' }}>Performed By</th>
                <th style={{ padding: '1rem', width: '250px' }}>Entity & Action</th>
                <th style={{ padding: '1rem' }}>Description / Changes</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log._id} style={{ borderBottom: '1px solid #f1f5f9', background: log.action === 'delete' ? '#fff1f2' : 'transparent' }}>
                  <td style={{ padding: '1rem', color: '#64748b' }}>
                    {new Date(log.timestamp).toLocaleString()}
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <div><strong>{log.userName || 'System'}</strong></div>
                    <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{log.ipAddress || 'Internal'}</div>
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span title={log.entityType}>{getEntityIcon(log.entityType)}</span>
                      <strong style={{ textTransform: 'capitalize' }}>{log.entityType.replace('_', ' ')}</strong>
                    </div>
                    {getActionBadge(log.action)}
                  </td>
                  <td style={{ padding: '1rem' }}>
                     <div style={{ marginBottom: '0.5rem', color: '#0f172a' }}>{log.description}</div>
                     {(log.changes?.before || log.changes?.after) && log.action !== 'create' && (
                       <div style={{ fontSize: '0.8rem', background: '#f8fafc', padding: '0.5rem', borderRadius: '4px', fontFamily: 'monospace', color: '#475569' }}>
                         {log.changes.before && <div><span style={{color: '#ef4444'}}>-</span> {JSON.stringify(log.changes.before).substring(0,60)}...</div>}
                         {log.changes.after && <div><span style={{color: '#22c55e'}}>+</span> {JSON.stringify(log.changes.after).substring(0,60)}...</div>}
                       </div>
                     )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default AuditLogsPage;
