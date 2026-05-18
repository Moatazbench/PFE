import React, { useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import { useToast } from '../components/common/Toast';
import PerformanceStatusBadge from '../components/evaluations/PerformanceStatusBadge';
import {
  PERFORMANCE_STATUS_OPTIONS,
  IMPROVEMENT_PROGRESS_OPTIONS,
  canHaveImprovementPlan,
  getImprovementProgressLabel,
  humanizeWorkflowLabel
} from '../components/evaluations/workflowOptions';

function formatDateInput(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

function createEmptyPlanForm() {
  return {
    id: '',
    objective_goal: '',
    deadline: '',
    expected_outcome: '',
    notes: '',
    progress_status: 'not_started'
  };
}

function HRValidation() {
  const toast = useToast();
  const [pendingEvaluations, setPendingEvaluations] = useState([]);
  const [reviewedEvaluations, setReviewedEvaluations] = useState([]);
  const [statusSelections, setStatusSelections] = useState({});
  const [plansByEvaluation, setPlansByEvaluation] = useState({});
  const [planEditors, setPlanEditors] = useState({});
  const [savingMap, setSavingMap] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const [pendingRes, reviewedRes] = await Promise.all([
        api.get('/final-evaluations/hr/pending'),
        api.get('/final-evaluations/hr/reviewed')
      ]);

      const pending = pendingRes.data.evaluations || [];
      const reviewed = reviewedRes.data.evaluations || [];

      setPendingEvaluations(pending);
      setReviewedEvaluations(reviewed);
      setStatusSelections(() => {
        const next = {};
        [...pending, ...reviewed].forEach((evaluation) => {
          next[evaluation._id] = evaluation.performance_status || '';
        });
        return next;
      });

      const reviewedPlans = await Promise.allSettled(
        reviewed.map(async (evaluation) => {
          const res = await api.get(`/improvement-plans/evaluation/${evaluation._id}`);
          return { evaluationId: evaluation._id, plans: res.data.plans || [] };
        })
      );

      const nextPlans = {};
      reviewedPlans.forEach((result) => {
        if (result.status === 'fulfilled') {
          nextPlans[result.value.evaluationId] = result.value.plans;
        }
      });
      setPlansByEvaluation(nextPlans);
    } catch (err) {
      toast.error('Failed to load HR validation data');
    } finally {
      setLoading(false);
    }
  }

  async function refreshPlans(evaluationId) {
    try {
      const res = await api.get(`/improvement-plans/evaluation/${evaluationId}`);
      setPlansByEvaluation((prev) => ({ ...prev, [evaluationId]: res.data.plans || [] }));
    } catch (err) {
      toast.error('Failed to refresh improvement plans');
    }
  }

  function setSaving(key, value) {
    setSavingMap((prev) => ({ ...prev, [key]: value }));
  }

  async function handleAction(evaluation, action) {
    const promptText = action === 'validate' ? 'validate' : 'send back';
    if (!window.confirm(`Are you sure you want to ${promptText} this evaluation?`)) {
      return;
    }

    const key = `${action}-${evaluation._id}`;
    setSaving(key, true);

    try {
      await api.put(`/final-evaluations/${evaluation._id}/hr-validate`, {
        action,
        performance_status: action === 'validate' ? statusSelections[evaluation._id] || null : undefined
      });
      toast.success(action === 'validate' ? 'Evaluation validated successfully.' : 'Evaluation sent back to manager.');
      await fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to process evaluation');
    } finally {
      setSaving(key, false);
    }
  }

  async function handleSavePerformanceStatus(evaluation) {
    const key = `status-${evaluation._id}`;
    setSaving(key, true);
    try {
      await api.put(`/final-evaluations/${evaluation._id}/hr-validate`, {
        action: 'validate',
        performance_status: statusSelections[evaluation._id] || null
      });
      toast.success('Performance status updated.');
      await fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update performance status');
    } finally {
      setSaving(key, false);
    }
  }

  function openPlanEditor(evaluationId, plan) {
    setPlanEditors((prev) => ({
      ...prev,
      [evaluationId]: plan ? {
        id: plan._id,
        objective_goal: plan.objective_goal || '',
        deadline: formatDateInput(plan.deadline),
        expected_outcome: plan.expected_outcome || '',
        notes: plan.notes || '',
        progress_status: plan.progress_status || 'not_started'
      } : createEmptyPlanForm()
    }));
  }

  function updatePlanEditor(evaluationId, field, value) {
    setPlanEditors((prev) => ({
      ...prev,
      [evaluationId]: {
        ...(prev[evaluationId] || createEmptyPlanForm()),
        [field]: value
      }
    }));
  }

  async function handleSavePlan(evaluation) {
    const editor = planEditors[evaluation._id];
    if (!editor) return;

    const key = `plan-${evaluation._id}`;
    setSaving(key, true);

    try {
      const payload = {
        objective_goal: editor.objective_goal,
        deadline: editor.deadline,
        expected_outcome: editor.expected_outcome,
        notes: editor.notes,
        progress_status: editor.progress_status
      };

      if (editor.id) {
        await api.put(`/improvement-plans/${editor.id}`, payload);
        toast.success('Improvement plan updated.');
      } else {
        await api.post(`/improvement-plans/evaluation/${evaluation._id}`, payload);
        toast.success('Improvement plan created.');
      }

      setPlanEditors((prev) => ({ ...prev, [evaluation._id]: createEmptyPlanForm() }));
      await refreshPlans(evaluation._id);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save improvement plan');
    } finally {
      setSaving(key, false);
    }
  }

  async function handleDeletePlan(evaluationId, planId) {
    if (!window.confirm('Delete this improvement plan?')) {
      return;
    }

    const key = `delete-${planId}`;
    setSaving(key, true);
    try {
      await api.delete(`/improvement-plans/${planId}`);
      toast.success('Improvement plan deleted.');
      await refreshPlans(evaluationId);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete improvement plan');
    } finally {
      setSaving(key, false);
    }
  }

  const reviewedSummary = useMemo(() => ({
    total: reviewedEvaluations.length,
    withStatus: reviewedEvaluations.filter((item) => item.performance_status).length,
    withPlans: reviewedEvaluations.filter((item) => (plansByEvaluation[item._id] || []).length > 0).length
  }), [plansByEvaluation, reviewedEvaluations]);

  if (loading) {
    return <div className="page-loading"><div className="spinner"></div><p>Loading HR validation workspace...</p></div>;
  }

  return (
    <div className="page" style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div>
        <h1 style={{ margin: 0, fontSize: '2.2rem', color: 'var(--text-dark)' }}>HR Validation</h1>
        <p className="text-muted" style={{ margin: '0.5rem 0 0 0' }}>
          Validate manager submissions, assign performance status, and manage improvement plans when follow-up is required.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
        <div className="card shadow-sm" style={{ padding: '1.1rem' }}>
          <div className="text-muted" style={{ fontSize: '0.8rem', textTransform: 'uppercase', fontWeight: 700 }}>Pending HR Review</div>
          <div style={{ fontSize: '1.9rem', fontWeight: 800, color: '#d97706' }}>{pendingEvaluations.length}</div>
        </div>
        <div className="card shadow-sm" style={{ padding: '1.1rem' }}>
          <div className="text-muted" style={{ fontSize: '0.8rem', textTransform: 'uppercase', fontWeight: 700 }}>Validated Reports</div>
          <div style={{ fontSize: '1.9rem', fontWeight: 800, color: '#16a34a' }}>{reviewedSummary.total}</div>
        </div>
        <div className="card shadow-sm" style={{ padding: '1.1rem' }}>
          <div className="text-muted" style={{ fontSize: '0.8rem', textTransform: 'uppercase', fontWeight: 700 }}>With HR Status</div>
          <div style={{ fontSize: '1.9rem', fontWeight: 800, color: 'var(--primary)' }}>{reviewedSummary.withStatus}</div>
        </div>
        <div className="card shadow-sm" style={{ padding: '1.1rem' }}>
          <div className="text-muted" style={{ fontSize: '0.8rem', textTransform: 'uppercase', fontWeight: 700 }}>Active Plan Records</div>
          <div style={{ fontSize: '1.9rem', fontWeight: 800, color: '#b45309' }}>{reviewedSummary.withPlans}</div>
        </div>
      </div>

      <div className="card shadow-sm" style={{ padding: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.35rem' }}>Pending Final Evaluations</h2>
            <p className="text-muted" style={{ margin: '0.4rem 0 0 0' }}>
              Existing validate and send-back actions remain unchanged. Performance status can now be assigned during validation.
            </p>
          </div>
        </div>

        {pendingEvaluations.length === 0 ? (
          <div className="ent-empty" style={{ padding: '3rem 2rem' }}>
            <span style={{ fontSize: '2.4rem' }}>OK</span>
            <h3 style={{ margin: '1rem 0 0.5rem 0' }}>All caught up</h3>
            <p className="text-muted">No final evaluations are currently pending HR validation.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '1.25rem' }}>
            {pendingEvaluations.map((evaluation) => (
              <div key={evaluation._id} className="card shadow-sm" style={{ borderLeft: '4px solid #eab308', padding: '1.35rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1.5rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: '260px' }}>
                    <h3 style={{ margin: '0 0 0.5rem 0' }}>{evaluation.employee_id?.name || 'Unknown Employee'}</h3>
                    <div className="text-muted" style={{ fontSize: '0.92rem', marginBottom: '0.85rem' }}>
                      Cycle: <strong>{evaluation.cycle_id?.name}</strong> | Email: {evaluation.employee_id?.email || 'N/A'}
                    </div>
                    <div className="text-muted" style={{ fontSize: '0.92rem', marginBottom: '1rem' }}>
                      Submitted by: <strong>{evaluation.evaluator_id?.name || 'Unknown'}</strong>
                      {evaluation.evaluator_role ? ` (${humanizeWorkflowLabel(evaluation.evaluator_role)})` : ''}
                    </div>

                    <div style={{ display: 'flex', gap: '1rem', background: '#f8fafc', padding: '1rem', borderRadius: '8px', marginBottom: '1rem', flexWrap: 'wrap' }}>
                      <div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Auto Score</div>
                        <div style={{ fontWeight: 700 }}>{evaluation.auto_score?.toFixed(1)}%</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Manager Score</div>
                        <div style={{ fontWeight: 700 }}>{evaluation.manager_score ?? '-'}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Final Rating</div>
                        <div style={{ fontWeight: 700 }}>{humanizeWorkflowLabel(evaluation.rating_label)}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Manager Recommendation</div>
                        <div style={{ fontWeight: 700, color: 'var(--primary)' }}>{humanizeWorkflowLabel(evaluation.recommendation)}</div>
                      </div>
                    </div>

                    <div style={{ marginBottom: '1rem' }}>
                      <h4 style={{ margin: '0 0 0.5rem 0' }}>Manager Comments</h4>
                      <p style={{ margin: 0, whiteSpace: 'pre-wrap', background: 'var(--shell-bg-inset)', padding: '0.75rem', borderRadius: '6px' }}>
                        {evaluation.manager_comments || 'No manager comments provided.'}
                      </p>
                    </div>

                    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '1rem' }}>
                      <div style={{ fontWeight: 700, marginBottom: '0.6rem' }}>HR Decision</div>
                      <label className="ent-label">Performance Status</label>
                      <select
                        className="ent-select"
                        value={statusSelections[evaluation._id] || ''}
                        onChange={(e) => setStatusSelections((prev) => ({ ...prev, [evaluation._id]: e.target.value }))}
                      >
                        <option value="">No status assigned</option>
                        {PERFORMANCE_STATUS_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                      <div className="text-muted" style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}>
                        Improvement plans become available after validation when the saved status is Needs Improvement or Critical Attention.
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', minWidth: '190px' }}>
                    <button
                      className="btn btn--primary"
                      style={{ background: '#22c55e', borderColor: '#22c55e' }}
                      onClick={() => handleAction(evaluation, 'validate')}
                      disabled={savingMap[`validate-${evaluation._id}`]}
                    >
                      {savingMap[`validate-${evaluation._id}`] ? 'Saving...' : 'Validate'}
                    </button>
                    <button
                      className="btn btn--outline"
                      onClick={() => handleAction(evaluation, 'send_back')}
                      disabled={savingMap[`send_back-${evaluation._id}`]}
                    >
                      {savingMap[`send_back-${evaluation._id}`] ? 'Sending...' : 'Send Back'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card shadow-sm" style={{ padding: '1.5rem' }}>
        <h2 style={{ margin: '0 0 0.4rem 0', fontSize: '1.35rem' }}>Reviewed Evaluations</h2>
        <p className="text-muted" style={{ margin: '0 0 1rem 0' }}>
          Manage HR performance status, monitor employee acknowledgment, and maintain improvement plans for validated reports.
        </p>

        {reviewedEvaluations.length === 0 ? (
          <div className="ent-empty" style={{ padding: '3rem 2rem' }}>
            <h3 style={{ margin: '0 0 0.5rem 0' }}>No validated evaluations yet</h3>
            <p className="text-muted">Validated reports will appear here after HR review.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '1.25rem' }}>
            {reviewedEvaluations.map((evaluation) => {
              const editor = planEditors[evaluation._id] || createEmptyPlanForm();
              const plans = plansByEvaluation[evaluation._id] || [];
              const canManagePlansForEvaluation = canHaveImprovementPlan(evaluation.performance_status);
              const employeeFeedback = evaluation.employee_feedback || {};

              return (
                <div key={evaluation._id} className="card shadow-sm" style={{ borderLeft: '4px solid #22c55e', padding: '1.35rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: '1rem' }}>
                    <div>
                      <h3 style={{ margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                        <span>{evaluation.employee_id?.name || 'Unknown Employee'}</span>
                        <PerformanceStatusBadge status={evaluation.performance_status} />
                      </h3>
                      <div className="text-muted" style={{ fontSize: '0.92rem' }}>
                        Cycle: <strong>{evaluation.cycle_id?.name}</strong>
                        {evaluation.hr_validated_at ? ` | Validated on ${new Date(evaluation.hr_validated_at).toLocaleDateString()}` : ''}
                        {evaluation.hr_validated_by?.name ? ` by ${evaluation.hr_validated_by.name}` : ''}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                      <span className="badge" style={{ background: '#e0f2fe', color: '#0f766e' }}>
                        Final Score: {evaluation.final_score?.toFixed(1)}%
                      </span>
                      <span className="badge" style={{ background: '#ede9fe', color: '#5b21b6' }}>
                        {humanizeWorkflowLabel(evaluation.rating_label)}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '1rem' }}>
                      <div style={{ fontWeight: 700, marginBottom: '0.5rem' }}>HR Decision Status</div>
                      <label className="ent-label">Performance Status</label>
                      <select
                        className="ent-select"
                        value={statusSelections[evaluation._id] || ''}
                        onChange={(e) => setStatusSelections((prev) => ({ ...prev, [evaluation._id]: e.target.value }))}
                      >
                        <option value="">No status assigned</option>
                        {PERFORMANCE_STATUS_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="btn btn--outline"
                        style={{ marginTop: '0.75rem' }}
                        onClick={() => handleSavePerformanceStatus(evaluation)}
                        disabled={savingMap[`status-${evaluation._id}`]}
                      >
                        {savingMap[`status-${evaluation._id}`] ? 'Saving...' : 'Save Status'}
                      </button>
                    </div>

                    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '1rem' }}>
                      <div style={{ fontWeight: 700, marginBottom: '0.5rem' }}>Employee Feedback</div>
                      <div style={{ marginBottom: '0.4rem' }}>
                        <strong>Acknowledged:</strong> {employeeFeedback.acknowledged ? 'Yes' : 'No'}
                      </div>
                      {employeeFeedback.acknowledged_at && (
                        <div className="text-muted" style={{ fontSize: '0.88rem', marginBottom: '0.4rem' }}>
                          {new Date(employeeFeedback.acknowledged_at).toLocaleString()}
                        </div>
                      )}
                      <div className="text-muted" style={{ fontSize: '0.9rem', whiteSpace: 'pre-wrap' }}>
                        {employeeFeedback.comment || 'No employee response submitted yet.'}
                      </div>
                    </div>
                  </div>

                  {(canManagePlansForEvaluation || plans.length > 0) && (
                    <div style={{ background: '#fcfcfd', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '1rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', marginBottom: '0.9rem' }}>
                        <div>
                          <div style={{ fontWeight: 700 }}>Improvement Plans</div>
                          <div className="text-muted" style={{ fontSize: '0.88rem' }}>
                            HR can create and maintain plans only when the saved status is Needs Improvement or Critical Attention.
                          </div>
                        </div>
                        {canManagePlansForEvaluation && (
                          <button type="button" className="btn btn--outline btn--sm" onClick={() => openPlanEditor(evaluation._id, null)}>
                            New Plan
                          </button>
                        )}
                      </div>

                      {plans.length === 0 ? (
                        <div className="text-muted" style={{ fontSize: '0.92rem', marginBottom: canManagePlansForEvaluation ? '1rem' : 0 }}>
                          No improvement plans have been created yet.
                        </div>
                      ) : (
                        <div style={{ display: 'grid', gap: '0.75rem', marginBottom: '1rem' }}>
                          {plans.map((plan) => (
                            <div key={plan._id} style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.9rem', background: '#fff' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                                <div>
                                  <div style={{ fontWeight: 700 }}>{plan.objective_goal}</div>
                                  <div className="text-muted" style={{ fontSize: '0.88rem', marginTop: '0.25rem' }}>
                                    Deadline: {new Date(plan.deadline).toLocaleDateString()} | Progress: {getImprovementProgressLabel(plan.progress_status)}
                                  </div>
                                  <div style={{ marginTop: '0.4rem' }}>
                                    <strong>Expected Outcome:</strong> {plan.expected_outcome}
                                  </div>
                                  {plan.notes && (
                                    <div style={{ marginTop: '0.35rem' }}>
                                      <strong>Notes:</strong> {plan.notes}
                                    </div>
                                  )}
                                </div>
                                {canManagePlansForEvaluation && (
                                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                    <button type="button" className="btn btn--outline btn--sm" onClick={() => openPlanEditor(evaluation._id, plan)}>
                                      Edit
                                    </button>
                                    <button
                                      type="button"
                                      className="btn btn--outline btn--sm"
                                      style={{ color: '#b91c1c', borderColor: '#fecaca' }}
                                      onClick={() => handleDeletePlan(evaluation._id, plan._id)}
                                      disabled={savingMap[`delete-${plan._id}`]}
                                    >
                                      {savingMap[`delete-${plan._id}`] ? 'Deleting...' : 'Delete'}
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {canManagePlansForEvaluation && (editor.id || editor.objective_goal || editor.expected_outcome || editor.deadline || editor.notes || editor.progress_status !== 'not_started') && (
                        <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '1rem', display: 'grid', gap: '0.85rem' }}>
                          <div style={{ fontWeight: 700 }}>{editor.id ? 'Edit Improvement Plan' : 'Create Improvement Plan'}</div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.85rem' }}>
                            <div>
                              <label className="ent-label">Objective / Goal</label>
                              <input className="ent-input" value={editor.objective_goal} onChange={(e) => updatePlanEditor(evaluation._id, 'objective_goal', e.target.value)} />
                            </div>
                            <div>
                              <label className="ent-label">Deadline</label>
                              <input type="date" className="ent-input" value={editor.deadline} onChange={(e) => updatePlanEditor(evaluation._id, 'deadline', e.target.value)} />
                            </div>
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.85rem' }}>
                            <div>
                              <label className="ent-label">Expected Outcome</label>
                              <textarea className="ent-input" style={{ minHeight: '88px' }} value={editor.expected_outcome} onChange={(e) => updatePlanEditor(evaluation._id, 'expected_outcome', e.target.value)} />
                            </div>
                            <div>
                              <label className="ent-label">Notes</label>
                              <textarea className="ent-input" style={{ minHeight: '88px' }} value={editor.notes} onChange={(e) => updatePlanEditor(evaluation._id, 'notes', e.target.value)} />
                            </div>
                          </div>
                          <div style={{ maxWidth: '260px' }}>
                            <label className="ent-label">Progress Status</label>
                            <select className="ent-select" value={editor.progress_status} onChange={(e) => updatePlanEditor(evaluation._id, 'progress_status', e.target.value)}>
                              {IMPROVEMENT_PROGRESS_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                              ))}
                            </select>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', flexWrap: 'wrap' }}>
                            <button type="button" className="btn btn--outline" onClick={() => setPlanEditors((prev) => ({ ...prev, [evaluation._id]: createEmptyPlanForm() }))}>
                              Cancel
                            </button>
                            <button
                              type="button"
                              className="btn btn--primary"
                              onClick={() => handleSavePlan(evaluation)}
                              disabled={savingMap[`plan-${evaluation._id}`]}
                            >
                              {savingMap[`plan-${evaluation._id}`] ? 'Saving...' : editor.id ? 'Update Plan' : 'Create Plan'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default HRValidation;
