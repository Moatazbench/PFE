import React, { useState } from 'react';
import api from '../../services/api';
import { useToast, ToastContainer } from '../common/Toast';

function DevelopmentPlanGenerator({ userId, evaluationId = null }) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState(null);
  const [error, setError] = useState(null);
  const [editingMap, setEditingMap] = useState({});

  async function handleGenerate() {
    setLoading(true);
    setPlan(null);
    setError(null);
    setEditingMap({});

    try {
      const response = await api.post('/api/ai/development-plan', { userId, evaluationId });
      setPlan(response.data.plan || null);
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  function handleEdit(index) {
    setEditingMap(function (prev) {
      return {
        ...prev,
        [index]: { ...(plan?.recommended_actions?.[index] || {}) },
      };
    });
  }

  function handleEditChange(index, field, value) {
    setEditingMap(function (prev) {
      return {
        ...prev,
        [index]: {
          ...(prev[index] || {}),
          [field]: value,
        },
      };
    });
  }

  function handleDone(index) {
    setPlan(function (prev) {
      if (!prev || !prev.recommended_actions) return prev;
      const nextActions = prev.recommended_actions.map(function (action, actionIndex) {
        if (actionIndex !== index) return action;
        return {
          ...action,
          ...(editingMap[index] || {}),
        };
      });
      return {
        ...prev,
        recommended_actions: nextActions,
      };
    });

    setEditingMap(function (prev) {
      const next = { ...prev };
      delete next[index];
      return next;
    });
  }

  function handleSavePlan() {
    console.log('Saved:', plan);
    toast.success('Development plan saved locally.');
  }

  return (
    <div className="card shadow-sm" style={{ marginTop: '2rem', padding: '1.5rem' }}>
      <ToastContainer toasts={toast.toasts} removeToast={toast.removeToast} />
      {plan === null && !loading && !error && (
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          <button type="button" className="btn btn--primary" onClick={handleGenerate} style={{ width: 'fit-content' }}>
            ✨ Generate Development Plan
          </button>
          <p className="text-muted" style={{ margin: 0 }}>
            AI-generated suggestions based on your evaluation data.
          </p>
          {evaluationId == null && (
            <p className="text-muted" style={{ margin: 0, fontSize: '0.9rem' }}>
              Complete an evaluation first for best results.
            </p>
          )}
        </div>
      )}

      {loading && (
        <div style={{ display: 'grid', gap: '1rem' }}>
          <button type="button" className="btn btn--primary" disabled style={{ width: 'fit-content', display: 'inline-flex', alignItems: 'center', gap: '0.75rem' }}>
            <div className="spinner" />
            Generating Development Plan
          </button>
          <div style={{ display: 'grid', gap: '1rem' }}>
            {[0, 1, 2].map(function (item) {
              return (
                <div key={item} className="card" style={{ padding: '1.25rem', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                  <div style={{ height: '18px', width: '40%', background: '#e2e8f0', borderRadius: '999px', marginBottom: '1rem' }} />
                  <div style={{ height: '12px', width: '100%', background: '#e2e8f0', borderRadius: '999px', marginBottom: '0.75rem' }} />
                  <div style={{ height: '12px', width: '85%', background: '#e2e8f0', borderRadius: '999px', marginBottom: '0.75rem' }} />
                  <div style={{ height: '12px', width: '55%', background: '#e2e8f0', borderRadius: '999px' }} />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {error && !loading && (
        <div style={{ display: 'grid', gap: '1rem' }}>
          <div style={{ background: '#fee2e2', color: '#991b1b', padding: '1rem', borderRadius: '10px' }}>
            <strong>Error:</strong> {error}
          </div>
          <button type="button" className="btn btn--primary" onClick={handleGenerate} style={{ width: 'fit-content' }}>
            Try Again
          </button>
        </div>
      )}

      {plan && !loading && !error && (
        <div style={{ display: 'grid', gap: '1.5rem' }}>
          <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '10px', padding: '1rem' }}>
            <div style={{ fontWeight: 'bold', marginBottom: '0.5rem', color: '#1d4ed8' }}>Overall Assessment</div>
            <div style={{ color: '#334155', lineHeight: 1.6 }}>{plan.summary}</div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '1rem' }}>
              <h3 style={{ marginTop: 0 }}>Strengths</h3>
              <div style={{ display: 'grid', gap: '0.75rem' }}>
                {(plan.strengths || []).map(function (item, index) {
                  return (
                    <div key={index} style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', color: '#166534' }}>
                      <span>✓</span>
                      <span>{item}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '1rem' }}>
              <h3 style={{ marginTop: 0 }}>Areas to Develop</h3>
              <div style={{ display: 'grid', gap: '0.75rem' }}>
                {(plan.gap_areas || []).map(function (item, index) {
                  return (
                    <div key={index} style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', color: '#b45309' }}>
                      <span>•</span>
                      <span>{item}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gap: '1rem' }}>
            {(plan.recommended_actions || []).map(function (action, index) {
              const isEditing = !!editingMap[index];
              const editingAction = editingMap[index] || {};

              return (
                <div key={index} className="card" style={{ padding: '1.25rem', border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', marginBottom: '1rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                      {isEditing ? (
                        <input
                          type="text"
                          className="form-control"
                          value={editingAction.action_title || ''}
                          onChange={function (e) { handleEditChange(index, 'action_title', e.target.value); }}
                          style={{ padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', minWidth: '220px' }}
                        />
                      ) : (
                        <h3 style={{ margin: 0 }}>{action.action_title}</h3>
                      )}
                      {isEditing ? (
                        <input
                          type="text"
                          className="form-control"
                          value={editingAction.suggested_timeline || ''}
                          onChange={function (e) { handleEditChange(index, 'suggested_timeline', e.target.value); }}
                          style={{ padding: '0.55rem 0.75rem', borderRadius: '999px', border: '1px solid #cbd5e1' }}
                        />
                      ) : (
                        <span className="badge" style={{ background: '#e2e8f0', color: '#334155' }}>{action.suggested_timeline}</span>
                      )}
                    </div>

                    <button
                      type="button"
                      className={isEditing ? 'btn btn--primary' : 'btn btn--outline'}
                      onClick={function () { isEditing ? handleDone(index) : handleEdit(index); }}
                    >
                      {isEditing ? 'Done' : 'Edit'}
                    </button>
                  </div>

                  <div style={{ display: 'grid', gap: '0.75rem' }}>
                    {isEditing ? (
                      <textarea
                        className="form-control"
                        value={editingAction.description || ''}
                        onChange={function (e) { handleEditChange(index, 'description', e.target.value); }}
                        style={{ width: '100%', minHeight: '100px', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '0.75rem' }}
                      />
                    ) : (
                      <p style={{ margin: 0, color: '#334155', lineHeight: 1.6 }}>{action.description}</p>
                    )}

                    <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '0.75rem' }}>
                      <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#64748b', marginBottom: '0.35rem' }}>Why this?</div>
                      {isEditing ? (
                        <textarea
                          className="form-control"
                          value={editingAction.rationale || ''}
                          onChange={function (e) { handleEditChange(index, 'rationale', e.target.value); }}
                          style={{ width: '100%', minHeight: '90px', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '0.75rem' }}
                        />
                      ) : (
                        <div style={{ color: '#64748b', fontStyle: 'italic', lineHeight: 1.6 }}>{action.rationale}</div>
                      )}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                        <strong style={{ fontSize: '0.9rem' }}>Success Metric:</strong>
                        {isEditing ? (
                          <input
                            type="text"
                            className="form-control"
                            value={editingAction.success_metric || ''}
                            onChange={function (e) { handleEditChange(index, 'success_metric', e.target.value); }}
                            style={{ padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', minWidth: '240px' }}
                          />
                        ) : (
                          <span>{action.success_metric}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <button type="button" className="btn btn--outline" onClick={handleGenerate} disabled={loading}>
              Regenerate
            </button>
            <button type="button" className="btn btn--primary" onClick={handleSavePlan} disabled={loading}>
              Save Plan
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default DevelopmentPlanGenerator;
