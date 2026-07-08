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

function buildReviewChecklist(evaluation) {
  const differenceIsDocumented = Math.abs(Number(evaluation.score_difference || 0)) < 10
    || Boolean(String(evaluation.manager_adjustment_justification || '').trim());

  return [
    { label: 'Correct employee and cycle linked', pass: Boolean(evaluation.employee_id?._id && evaluation.cycle_id?._id) },
    { label: 'Final score recorded', pass: evaluation.final_score != null },
    { label: 'Rating recorded and score-aligned', pass: Boolean(evaluation.rating_label) && !(evaluation.consistency_warnings || []).some((warning) => warning.includes('Rating does not match')) },
    { label: 'Manager comments completed', pass: Boolean(String(evaluation.manager_comments || '').trim()) },
    { label: 'Strengths completed', pass: Array.isArray(evaluation.strengths) && evaluation.strengths.length > 0 },
    { label: 'Areas for improvement completed', pass: Array.isArray(evaluation.weaknesses) && evaluation.weaknesses.length > 0 },
    { label: 'Objective contribution breakdown visible', pass: Array.isArray(evaluation.objective_breakdown) && evaluation.objective_breakdown.length > 0 },
    { label: 'Significant score difference documented', pass: differenceIsDocumented },
    { label: 'AI draft reviewed by manager when used', pass: !evaluation.ai_assisted || evaluation.ai_reviewed_by_manager },
  ];
}

function HRValidation() {
  const toast = useToast();
  const [pendingEvaluations, setPendingEvaluations] = useState([]);
  const [reviewedEvaluations, setReviewedEvaluations] = useState([]);
  const [statusSelections, setStatusSelections] = useState({});
  const [plansByEvaluation, setPlansByEvaluation] = useState({});
  const [planEditors, setPlanEditors] = useState({});
  const [savingMap, setSavingMap] = useState({});
  const [reviewNotes, setReviewNotes] = useState({});
  const [sendBackTarget, setSendBackTarget] = useState(null);
  const [returnReason, setReturnReason] = useState('');
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
      setReviewNotes(() => {
        const next = {};
        [...pending, ...reviewed].forEach((evaluation) => {
          next[evaluation._id] = evaluation.hr_review_notes || '';
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
    } catch {
      toast.error('Failed to load HR validation data');
    } finally {
      setLoading(false);
    }
  }

  async function refreshPlans(evaluationId) {
    try {
      const res = await api.get(`/improvement-plans/evaluation/${evaluationId}`);
      setPlansByEvaluation((prev) => ({ ...prev, [evaluationId]: res.data.plans || [] }));
    } catch {
      toast.error('Failed to refresh improvement plans');
    }
  }

  function setSaving(key, value) {
    setSavingMap((prev) => ({ ...prev, [key]: value }));
  }

  async function handleAction(evaluation, action) {
    if (action === 'send_back') {
      setSendBackTarget(evaluation);
      setReturnReason('');
      return;
    }
    if (!window.confirm('Mark this evaluation as reviewed? This confirms process completeness, not a replacement of the manager judgment.')) {
      return;
    }

    const key = `${action}-${evaluation._id}`;
    setSaving(key, true);

    try {
      await api.put(`/final-evaluations/${evaluation._id}/hr-validate`, {
        action,
        performance_status: statusSelections[evaluation._id] || null,
        hr_review_notes: reviewNotes[evaluation._id] || ''
      });
      toast.success(action === 'validate' ? 'Evaluation marked as reviewed.' : 'Evaluation sent back to manager for correction.');
      await fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to process evaluation');
    } finally {
      setSaving(key, false);
    }
  }

  async function submitSendBack() {
    if (!sendBackTarget || !returnReason.trim()) {
      toast.error('A correction reason is required.');
      return;
    }
    const key = `send_back-${sendBackTarget._id}`;
    setSaving(key, true);
    try {
      await api.put(`/final-evaluations/${sendBackTarget._id}/hr-validate`, {
        action: 'send_back',
        return_reason: returnReason.trim(),
        hr_review_notes: reviewNotes[sendBackTarget._id] || ''
      });
      toast.success('Evaluation sent back to the manager for correction.');
      setSendBackTarget(null);
      setReturnReason('');
      await fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send the evaluation back');
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
        performance_status: statusSelections[evaluation._id] || null,
        hr_review_notes: reviewNotes[evaluation._id] || ''
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
        <h1 style={{ margin: 0, fontSize: '2.2rem', color: 'var(--text-dark)' }}>HR Review Workspace</h1>
        <p className="text-muted" style={{ margin: '0.5rem 0 0 0' }}>
          Review completeness, governance, follow-up actions, and documentation after the manager submits the final evaluation.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
        <div className="card shadow-sm" style={{ padding: '1.1rem' }}>
          <div className="text-muted" style={{ fontSize: '0.8rem', textTransform: 'uppercase', fontWeight: 700 }}>Pending HR Review</div>
          <div style={{ fontSize: '1.9rem', fontWeight: 800, color: '#d97706' }}>{pendingEvaluations.length}</div>
        </div>
        <div className="card shadow-sm" style={{ padding: '1.1rem' }}>
          <div className="text-muted" style={{ fontSize: '0.8rem', textTransform: 'uppercase', fontWeight: 700 }}>Recently Reviewed</div>
          <div style={{ fontSize: '1.9rem', fontWeight: 800, color: '#16a34a' }}>{reviewedSummary.total}</div>
        </div>
        <div className="card shadow-sm" style={{ padding: '1.1rem' }}>
          <div className="text-muted" style={{ fontSize: '0.8rem', textTransform: 'uppercase', fontWeight: 700 }}>With Follow-up Status</div>
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
              Review manager-submitted reports for completeness, consistency, documentation, and people-development follow-up.
            </p>
          </div>
        </div>

        {pendingEvaluations.length === 0 ? (
          <div className="ent-empty" style={{ padding: '3rem 2rem' }}>
            <span style={{ fontSize: '2.4rem' }}>OK</span>
            <h3 style={{ margin: '1rem 0 0.5rem 0' }}>All caught up</h3>
            <p className="text-muted">No evaluations pending HR review. Manager-submitted evaluations will appear here.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '1.25rem' }}>
            {pendingEvaluations.map((evaluation) => {
              const checklist = buildReviewChecklist(evaluation);
              const blockingItems = checklist.filter((item) => !item.pass);
              return (
              <div key={evaluation._id} className="card shadow-sm" style={{ borderLeft: '4px solid #eab308', padding: '1.35rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1.5rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: '260px' }}>
                    <h3 style={{ margin: '0 0 0.5rem 0' }}>{evaluation.employee_id?.name || 'Unknown Employee'}</h3>
                    <div className="text-muted" style={{ fontSize: '0.92rem', marginBottom: '0.85rem' }}>
                      Cycle: <strong>{evaluation.cycle_id?.name}</strong> | Email: {evaluation.employee_id?.email || 'N/A'}
                    </div>
                    <div className="text-muted" style={{ fontSize: '0.92rem', marginBottom: '1rem' }}>
                      Manager submission: <strong>{evaluation.evaluator_id?.name || 'Unknown'}</strong>
                      {evaluation.evaluator_role ? ` (${humanizeWorkflowLabel(evaluation.evaluator_role)})` : ''}
                    </div>

                    <div style={{ display: 'flex', gap: '1rem', background: '#f8fafc', padding: '1rem', borderRadius: '8px', marginBottom: '1rem', flexWrap: 'wrap' }}>
                      <div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Weighted Suggested Score</div>
                        <div style={{ fontWeight: 700 }}>{evaluation.auto_score?.toFixed(1)}%</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Manager Score</div>
                        <div style={{ fontWeight: 700 }}>{evaluation.manager_score ?? '-'}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Difference</div>
                        <div style={{ fontWeight: 700, color: Math.abs(evaluation.score_difference || 0) >= 10 ? '#b45309' : 'inherit' }}>
                          {(evaluation.score_difference || 0) > 0 ? '+' : ''}{evaluation.score_difference || 0} points
                        </div>
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

                    {evaluation.manager_adjustment_justification && (
                      <div style={{ marginBottom: '1rem' }}>
                        <h4 style={{ margin: '0 0 0.5rem 0' }}>Manager Score Adjustment Justification</h4>
                        <p style={{ margin: 0, whiteSpace: 'pre-wrap', background: '#fffbeb', border: '1px solid #fde68a', padding: '0.75rem', borderRadius: '6px' }}>
                          {evaluation.manager_adjustment_justification}
                        </p>
                      </div>
                    )}

                    {evaluation.consistency_warnings?.length > 0 && (
                      <div role="alert" style={{ marginBottom: '1rem', background: '#fff7ed', border: '1px solid #fdba74', borderRadius: '8px', padding: '0.9rem', color: '#9a3412' }}>
                        <strong>Review checks</strong>
                        <ul style={{ margin: '0.45rem 0 0', paddingLeft: '1.2rem' }}>
                          {evaluation.consistency_warnings.map((warning, index) => <li key={index}>{warning}</li>)}
                        </ul>
                      </div>
                    )}

                    <div style={{ marginBottom: '1rem', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '10px', padding: '1rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', marginBottom: '0.7rem', flexWrap: 'wrap' }}>
                        <strong>HR Process Review Checklist</strong>
                        <span className="badge" style={{ background: blockingItems.length ? '#fef3c7' : '#dcfce7', color: blockingItems.length ? '#92400e' : '#166534' }}>
                          {checklist.length - blockingItems.length}/{checklist.length} complete
                        </span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.55rem' }}>
                        {checklist.map((item) => (
                          <div key={item.label} style={{ color: item.pass ? '#166534' : '#b45309', fontSize: '0.9rem', fontWeight: 600 }}>
                            <span aria-hidden="true">{item.pass ? '✓' : '!'}</span> {item.label}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div style={{ marginBottom: '1rem' }}>
                      <h4 style={{ margin: '0 0 0.6rem 0' }}>Objective Contribution Breakdown</h4>
                      {(evaluation.objective_breakdown || []).length === 0 ? (
                        <p className="text-muted">No objective contribution breakdown was submitted.</p>
                      ) : (
                        <div style={{ display: 'grid', gap: '0.45rem' }}>
                          {evaluation.objective_breakdown.map((objective) => (
                            <div key={objective.objective_id || objective.title} style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', padding: '0.65rem 0.75rem', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                              <span>{objective.title} <small className="text-muted">({objective.weight}% weight)</small></span>
                              <strong>{objective.weighted_points ?? 0} pts</strong>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div style={{ marginBottom: '1rem' }}>
                      <h4 style={{ margin: '0 0 0.5rem 0' }}>
                        {evaluation.ai_assisted ? 'AI-Assisted Draft / Manager Final Report' : 'Manager Final Report'}
                      </h4>
                      <p style={{ margin: 0, whiteSpace: 'pre-wrap', background: 'var(--shell-bg-inset)', padding: '0.75rem', borderRadius: '6px' }}>
                        {evaluation.manager_comments || 'No manager comments provided.'}
                      </p>
                    </div>

                    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '1rem' }}>
                      <div style={{ fontWeight: 700, marginBottom: '0.6rem' }}>HR Process Review</div>
                      <label className="ent-label">Follow-up Status</label>
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
                      <label className="ent-label" style={{ marginTop: '0.8rem' }}>HR Review Notes</label>
                      <textarea
                        className="ent-input"
                        style={{ minHeight: '82px' }}
                        value={reviewNotes[evaluation._id] || ''}
                        onChange={(event) => setReviewNotes((previous) => ({ ...previous, [evaluation._id]: event.target.value }))}
                        placeholder="Document process checks, follow-up needs, or records reviewed. Do not rewrite the manager assessment."
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', minWidth: '190px' }}>
                    <button
                      className="btn btn--primary"
                      style={{ background: '#22c55e', borderColor: '#22c55e' }}
                      onClick={() => handleAction(evaluation, 'validate')}
                      disabled={savingMap[`validate-${evaluation._id}`] || blockingItems.length > 0}
                      title={blockingItems.length > 0 ? 'Manager corrections are required before this evaluation can be marked as reviewed.' : ''}
                    >
                      {savingMap[`validate-${evaluation._id}`] ? 'Saving...' : 'Mark as Reviewed'}
                    </button>
                    <button
                      className="btn btn--outline"
                      onClick={() => handleAction(evaluation, 'send_back')}
                      disabled={savingMap[`send_back-${evaluation._id}`]}
                    >
                      {savingMap[`send_back-${evaluation._id}`] ? 'Sending...' : 'Send Back for Correction'}
                    </button>
                    <div className="text-muted" style={{ fontSize: '0.8rem', lineHeight: 1.45 }}>
                      Marking as reviewed confirms that the process is complete, documented, and consistent. It does not replace the manager’s performance judgment.
                    </div>
                  </div>
                </div>
              </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="card shadow-sm" style={{ padding: '1.5rem' }}>
        <h2 style={{ margin: '0 0 0.4rem 0', fontSize: '1.35rem' }}>Reviewed Evaluations</h2>
        <p className="text-muted" style={{ margin: '0 0 1rem 0' }}>
          Maintain employee records, follow-up classifications, acknowledgment, and improvement plans after process review.
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
                        {evaluation.hr_validated_at ? ` | Reviewed on ${new Date(evaluation.hr_validated_at).toLocaleDateString()}` : ''}
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
                      <div style={{ fontWeight: 700, marginBottom: '0.5rem' }}>Development Follow-up</div>
                      <label className="ent-label">Follow-up Status</label>
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
                      <label className="ent-label" style={{ marginTop: '0.75rem' }}>HR Review Notes</label>
                      <textarea
                        className="ent-input"
                        style={{ minHeight: '72px' }}
                        value={reviewNotes[evaluation._id] || ''}
                        onChange={(event) => setReviewNotes((previous) => ({ ...previous, [evaluation._id]: event.target.value }))}
                        placeholder="Record governance and follow-up notes."
                      />
                      <button
                        type="button"
                        className="btn btn--outline"
                        style={{ marginTop: '0.75rem' }}
                        onClick={() => handleSavePerformanceStatus(evaluation)}
                        disabled={savingMap[`status-${evaluation._id}`]}
                      >
                        {savingMap[`status-${evaluation._id}`] ? 'Saving...' : 'Save Follow-up'}
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

                  {(evaluation.workflow_history || []).length > 0 && (
                    <div style={{ marginBottom: '1rem', borderLeft: '2px solid #cbd5e1', paddingLeft: '1rem' }}>
                      <div style={{ fontWeight: 700, marginBottom: '0.6rem' }}>Process Review Timeline</div>
                      <div style={{ display: 'grid', gap: '0.65rem' }}>
                        {evaluation.workflow_history.map((entry, index) => (
                          <div key={`${entry.action}-${entry.performed_at}-${index}`}>
                            <strong>{humanizeWorkflowLabel(entry.action)}</strong>
                            <span className="text-muted"> by {entry.performed_by?.name || 'Authorized reviewer'} · {entry.performed_at ? new Date(entry.performed_at).toLocaleString() : 'Date unavailable'}</span>
                            {entry.reason && <div style={{ marginTop: '0.2rem' }}>{entry.reason}</div>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

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

      {sendBackTarget && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="send-back-title"
          style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15, 23, 42, 0.56)', display: 'grid', placeItems: 'center', padding: '1rem', backdropFilter: 'blur(3px)' }}
        >
          <div className="card shadow-lg" style={{ width: 'min(560px, 100%)', padding: '1.5rem', borderRadius: '14px' }}>
            <h2 id="send-back-title" style={{ margin: '0 0 0.45rem' }}>Send Back for Correction</h2>
            <p className="text-muted" style={{ margin: '0 0 1rem', lineHeight: 1.55 }}>
              Explain what is incomplete or inconsistent so the manager can correct and resubmit the evaluation. This is a process correction, not a replacement of the manager’s judgment.
            </p>
            <label className="ent-label">Required correction reason</label>
            <textarea
              autoFocus
              className="ent-input"
              style={{ minHeight: '130px' }}
              value={returnReason}
              onChange={(event) => setReturnReason(event.target.value)}
              placeholder="Example: The score adjustment exceeds 10 points but no objective-based justification was provided."
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
              <button type="button" className="btn btn--outline" onClick={() => { setSendBackTarget(null); setReturnReason(''); }}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn--primary"
                style={{ background: '#dc2626', borderColor: '#dc2626' }}
                disabled={!returnReason.trim() || savingMap[`send_back-${sendBackTarget._id}`]}
                onClick={submitSendBack}
              >
                {savingMap[`send_back-${sendBackTarget._id}`] ? 'Sending...' : 'Send Back for Correction'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default HRValidation;
