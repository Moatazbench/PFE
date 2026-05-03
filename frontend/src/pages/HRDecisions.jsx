import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { useAuth } from '../components/AuthContext';

const ACTION_OPTIONS = [
  'reward',
  'promotion',
  'bonus',
  'satisfactory',
  'coaching',
  'training',
  'position_change',
  'termination_review',
];

function HRDecisions() {
  const { user } = useAuth();
  const [decisions, setDecisions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const canEdit = ['ADMIN', 'HR'].includes(user?.role);

  useEffect(() => {
    fetchDecisions();
  }, []);

  async function fetchDecisions() {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/api/hr-decisions');
      setDecisions(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      setError('Failed to load HR decisions.');
    } finally {
      setLoading(false);
    }
  }

  async function handleActionChange(id, action) {
    try {
      await api.put(`/api/hr-decisions/${id}`, {
        action,
        actionLabel: action.replace(/_/g, ' '),
      });
      fetchDecisions();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update HR decision.');
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this HR decision?')) return;
    try {
      await api.delete(`/api/hr-decisions/${id}`);
      fetchDecisions();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete HR decision.');
    }
  }

  if (loading) {
    return <div className="loading">Loading HR decisions...</div>;
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="page-header__left">
          <h1 className="page-title">HR Decisions</h1>
          <p className="page-subtitle">Final actions generated after cycle evaluations are submitted.</p>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      {decisions.length === 0 ? (
        <div className="empty-state">
          <h3>No HR decisions yet</h3>
          <p>Close a cycle with completed evaluations to generate decisions.</p>
        </div>
      ) : (
        <div className="decisions-grid">
          {decisions.map((decision) => (
            <div key={decision._id} className="decision-card">
              <div className="decision-header">
                <div>
                  <h3>{decision.user?.name || 'Unknown User'}</h3>
                  <p className="decision-email">{decision.user?.email}</p>
                </div>
                <span className="score-badge">{decision.finalScore}/100</span>
              </div>

              <p className="decision-cycle">{decision.cycle?.name} ({decision.cycle?.year})</p>
              <p>Individual score: <strong>{decision.individualScore}</strong></p>
              <p>Team score: <strong>{decision.teamScore}</strong></p>

              {canEdit ? (
                <select
                  value={decision.action}
                  onChange={(event) => handleActionChange(decision._id, event.target.value)}
                  className="action-select"
                >
                  {ACTION_OPTIONS.map((action) => (
                    <option key={action} value={action}>{action.replace(/_/g, ' ')}</option>
                  ))}
                </select>
              ) : (
                <div className="action-display">{decision.actionLabel || decision.action}</div>
              )}

              {decision.notes && (
                <div className="hr-comments">
                  <strong>Notes</strong>
                  <p>{decision.notes}</p>
                </div>
              )}

              <div className="decision-meta">
                {decision.decidedBy && <p>Decided by: {decision.decidedBy.name}</p>}
                {decision.decidedAt && <p>Updated: {new Date(decision.decidedAt).toLocaleString()}</p>}
              </div>

              {user?.role === 'ADMIN' && (
                <button className="btn btn--ghost btn--sm" onClick={() => handleDelete(decision._id)}>
                  Delete
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default HRDecisions;
