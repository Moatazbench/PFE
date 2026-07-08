import React, { useEffect, useState, useMemo } from 'react';
import api from '../services/api';
import { useAuth } from '../components/AuthContext';
import { Link } from 'react-router-dom';
import EmptyState from '../components/common/EmptyState';
import LoadingSkeleton from '../components/common/LoadingSkeleton';
import Badge from '../components/common/Badge';
import './HRDecisions.css';

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

function getAvatarFallback(name) {
  if (!name) return '?';
  const parts = name.trim().split(' ');
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return parts[0].substring(0, 2).toUpperCase();
}

function getAvatarColor(name) {
  const colors = ['#f59e0b', '#ef4444', '#10b981', '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899', '#14b8a6'];
  let hash = 0;
  for (let i = 0; i < (name || '').length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

function getActionBadgeType(action) {
  switch (action) {
    case 'promotion':
    case 'reward':
      return 'success';
    case 'bonus':
      return 'info';
    case 'coaching':
    case 'training':
      return 'warning';
    case 'position_change':
    case 'termination_review':
      return 'danger';
    default:
      return 'neutral';
  }
}

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
      const res = await api.get('/hr-decisions');
      setDecisions(Array.isArray(res.data) ? res.data : []);
    } catch {
      setError('Failed to load HR decisions. Please refresh or try again later.');
    } finally {
      setLoading(false);
    }
  }

  async function handleActionChange(id, action) {
    try {
      await api.put(`/hr-decisions/${id}`, {
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
      await api.delete(`/hr-decisions/${id}`);
      fetchDecisions();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete HR decision.');
    }
  }

  const summary = useMemo(() => {
    return decisions.reduce((acc, dec) => {
      acc.total++;
      if (['bonus', 'reward'].includes(dec.action)) acc.bonus++;
      if (dec.action === 'promotion') acc.promotion++;
      if (['coaching', 'training'].includes(dec.action)) acc.coaching++;
      if (['position_change', 'termination_review'].includes(dec.action)) acc.critical++;
      return acc;
    }, { total: 0, bonus: 0, promotion: 0, coaching: 0, critical: 0 });
  }, [decisions]);

  return (
    <div className="page-container hr-decisions-page">
      <div className="page-header">
        <div className="page-header__left">
          <h1 className="page-title">HR Decisions</h1>
          <p className="page-subtitle">Final actions generated after cycle evaluations are submitted.</p>
        </div>
      </div>

      {error && (
        <div style={{ padding: '16px', background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', borderRadius: '8px', marginBottom: '24px' }}>
          {error}
        </div>
      )}

      {!loading && decisions.length > 0 && (
        <div className="hr-summary-grid">
          <div className="hr-summary-card">
            <span>Total Decisions</span>
            <strong>{summary.total}</strong>
          </div>
          <div className="hr-summary-card hr-summary-card--highlight">
            <span>Promotions</span>
            <strong>{summary.promotion}</strong>
          </div>
          <div className="hr-summary-card">
            <span>Bonus & Rewards</span>
            <strong style={{ color: '#10b981' }}>{summary.bonus}</strong>
          </div>
          <div className="hr-summary-card">
            <span>Coaching Required</span>
            <strong style={{ color: '#f59e0b' }}>{summary.coaching}</strong>
          </div>
          <div className="hr-summary-card">
            <span>Critical Cases</span>
            <strong style={{ color: '#ef4444' }}>{summary.critical}</strong>
          </div>
        </div>
      )}

      {loading ? (
        <div className="decisions-grid">
          {[1, 2, 3, 4].map(i => <LoadingSkeleton key={i} height={400} />)}
        </div>
      ) : decisions.length === 0 ? (
        <EmptyState
          title="No HR decisions found"
          description="Reviewed final evaluations and HR follow-up decisions will appear here."
          icon="📋"
        />
      ) : (
        <div className="decisions-grid">
          {decisions.map((decision) => {
            const userName = decision.user?.name || 'Unknown User';
            const userEmail = decision.user?.email || 'No email';
            const avatarColor = getAvatarColor(userName);
            const initials = getAvatarFallback(userName);
            
            return (
              <div key={decision._id} className="hr-profile-card">
                <div className="hr-profile-header">
                  <div className="hr-avatar" style={{ backgroundColor: avatarColor }}>
                    {initials}
                  </div>
                  <div className="hr-profile-info">
                    <span className="hr-profile-name">{userName}</span>
                    <span className="hr-profile-email">{userEmail}</span>
                    {decision.user?.role && (
                      <span className="hr-profile-role">{decision.user.role} {decision.user.team?.name ? `• ${decision.user.team.name}` : ''}</span>
                    )}
                  </div>
                </div>

                <div className="hr-card-meta">
                  <span className="hr-cycle-name">{decision.cycle?.name} ({decision.cycle?.year})</span>
                  <Badge type={getActionBadgeType(decision.action)}>
                    {decision.actionLabel || (decision.action ? decision.action.replace(/_/g, ' ') : 'Pending')}
                  </Badge>
                </div>

                <div className="hr-scores-row">
                  <div className="hr-score-pill">
                    <span>Individual</span>
                    <strong>{decision.individualScore || '0'}</strong>
                  </div>
                  <div className="hr-score-pill">
                    <span>Team</span>
                    <strong>{decision.teamScore || '0'}</strong>
                  </div>
                  <div className="hr-score-pill">
                    <span>Final</span>
                    <strong style={{ color: 'var(--shell-primary, #4f46e5)' }}>{decision.finalScore || '0'}/100</strong>
                  </div>
                </div>

                {decision.finalEvaluation && (
                  <div className="hr-validation-box">
                    <div className="hr-validation-header">
                      📋 Validated final evaluation
                    </div>
                    {decision.finalEvaluation.rating_label && (
                      <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--shell-primary, #4f46e5)' }}>
                        Rating: {decision.finalEvaluation.rating_label.replace(/_/g, ' ')}
                      </div>
                    )}
                    
                    {(decision.finalEvaluation.objective_breakdown || []).length > 0 && (
                      <ul className="hr-objectives-list">
                        {(decision.finalEvaluation.objective_breakdown || []).map((item, idx) => (
                          <li key={idx}>
                            <span>{item.title}</span>
                            <strong>{item.weighted_points} pts</strong>
                          </li>
                        ))}
                      </ul>
                    )}
                    
                    <Link to={`/final-evaluations/${decision.cycle?._id}/${decision.user?._id}/report`} className="hr-report-link">
                      Open final report
                    </Link>
                  </div>
                )}

                {canEdit && (
                  <div className="hr-action-area">
                    <label>Decision / Follow-up Action</label>
                    <select
                      value={decision.action || ''}
                      onChange={(event) => handleActionChange(decision._id, event.target.value)}
                      className="hr-action-select"
                    >
                      <option value="" disabled>Select decision...</option>
                      {ACTION_OPTIONS.map((action) => (
                        <option key={action} value={action}>{action.replace(/_/g, ' ')}</option>
                      ))}
                    </select>
                  </div>
                )}

                {decision.notes && (
                  <div className="hr-notes">
                    {decision.notes}
                  </div>
                )}

                <div className="hr-card-footer">
                  <div>
                    {decision.decidedBy && <span>Decided by {decision.decidedBy.name} • </span>}
                    {decision.decidedAt && <span>{new Date(decision.decidedAt).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}</span>}
                  </div>
                  {user?.role === 'ADMIN' && (
                    <button className="hr-delete-btn" onClick={() => handleDelete(decision._id)}>
                      Delete
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default HRDecisions;
