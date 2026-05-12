import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { useToast } from '../components/common/Toast';

function HRValidation() {
  const toast = useToast();
  const [evaluations, setEvaluations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPendingEvaluations();
  }, []);

  async function fetchPendingEvaluations() {
    setLoading(true);
    try {
      const res = await api.get('/api/final-evaluations/hr/pending');
      setEvaluations(res.data.evaluations || []);
    } catch (err) {
      toast.error('Failed to load pending evaluations');
    } finally {
      setLoading(false);
    }
  }

  async function handleAction(evaluation, action) {
    if (!window.confirm(`Are you sure you want to ${action === 'validate' ? 'validate' : 'send back'} this evaluation?`)) {
      return;
    }
    
    try {
      await api.put(`/api/final-evaluations/${evaluation._id}/hr-validate`, { action });
      toast.success(action === 'validate' ? 'Evaluation Validated' : 'Evaluation Sent Back to Manager');
      fetchPendingEvaluations();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to process evaluation');
    }
  }

  if (loading) return <div className="page-loading"><div className="spinner"></div><p>Loading pending evaluations...</p></div>;

  function renderRoleLabel(label) {
    return (label || '').replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  return (
    <div className="page" style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ margin: 0, fontSize: '2.2rem', color: 'var(--text-dark)' }}>Pending Final Evaluations</h1>
        <p className="text-muted" style={{ margin: '0.5rem 0 0 0' }}>Review and validate manager submissions.</p>
      </div>

      {evaluations.length === 0 ? (
        <div className="ent-empty" style={{ padding: '4rem 2rem' }}>
          <span style={{ fontSize: '3rem' }}>✅</span>
          <h3 style={{ margin: '1rem 0 0.5rem 0' }}>All Caught Up</h3>
          <p className="text-muted">No final evaluations are currently pending HR validation.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '1.5rem' }}>
          {evaluations.map(ev => (
            <div key={ev._id} className="card shadow-sm" style={{ borderLeft: '4px solid #eab308' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h3 style={{ margin: '0 0 0.5rem 0' }}>{ev.employee_id?.name || 'Unknown Employee'}</h3>
                  <div className="text-muted" style={{ fontSize: '0.9rem', marginBottom: '1rem' }}>
                    Cycle: <strong>{ev.cycle_id?.name}</strong> | Email: {ev.employee_id?.email}
                  </div>
                  <div className="text-muted" style={{ fontSize: '0.9rem', marginBottom: '1rem' }}>
                    Submitted by: <strong>{ev.evaluator_id?.name || 'Unknown'}</strong>
                    {ev.evaluator_role ? ` (${renderRoleLabel(ev.evaluator_role)})` : ''}
                  </div>
                  
                  <div style={{ display: 'flex', gap: '2rem', background: '#f8fafc', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' }}>
                    <div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Auto Score</div>
                      <div style={{ fontWeight: 'bold' }}>{ev.auto_score?.toFixed(1)}%</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Manager Score</div>
                      <div style={{ fontWeight: 'bold' }}>{ev.manager_score ?? '-'}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Final Rating</div>
                      <div style={{ fontWeight: 'bold', textTransform: 'capitalize' }}>{(ev.rating_label || '').replace(/_/g, ' ')}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>HR Recommendation</div>
                      <div style={{ fontWeight: 'bold', textTransform: 'capitalize', color: 'var(--primary)' }}>{(ev.recommendation || '').replace(/_/g, ' ')}</div>
                    </div>
                  </div>

                  <div style={{ marginBottom: '1rem' }}>
                    <h4 style={{ margin: '0 0 0.5rem 0' }}>Manager Comments:</h4>
                    <p style={{ margin: 0, whiteSpace: 'pre-wrap', background: 'var(--shell-bg-inset)', padding: '0.75rem', borderRadius: '4px' }}>{ev.manager_comments}</p>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', minWidth: '150px' }}>
                  <button className="btn btn--primary" style={{ background: '#22c55e', borderColor: '#22c55e' }} onClick={() => handleAction(ev, 'validate')}>
                    ✅ Validate
                  </button>
                  <button className="btn btn--outline" onClick={() => handleAction(ev, 'send_back')}>
                    ↩️ Send Back
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default HRValidation;
