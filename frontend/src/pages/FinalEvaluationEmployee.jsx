import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { useAuth } from '../components/AuthContext';
import { useToast } from '../components/common/Toast';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

function isEvaluationObjectiveStatus(status) {
  return !['draft', 'rejected', 'cancelled', 'archived'].includes(status);
}

function getFinalObjectiveAttachments(objective) {
  if (Array.isArray(objective?.finalSelfAttachments) && objective.finalSelfAttachments.length > 0) {
    return objective.finalSelfAttachments;
  }

  if (objective?.finalSelfAttachment) {
    return [objective.finalSelfAttachment];
  }

  return [];
}

function FinalEvaluationEmployee({ cycleId, activeCycle }) {
  const { user } = useAuth();
  const toast = useToast();

  const [evaluation, setEvaluation] = useState(null);
  const [objectives, setObjectives] = useState([]);
  const [checkins, setCheckins] = useState([]);
  const [historyEvals, setHistoryEvals] = useState([]);
  const [assessmentForms, setAssessmentForms] = useState({});
  const [savingObjectiveId, setSavingObjectiveId] = useState('');
  const [loading, setLoading] = useState(true);
  const [attachments, setAttachments] = useState({});
  const [uploading, setUploading] = useState({});
  const canEditCycle = activeCycle?.currentPhase === 'phase3';

  useEffect(() => {
    if (cycleId) {
      fetchData();
    }
  }, [cycleId]);

  async function fetchData() {
    setLoading(true);
    try {
      const [evaluationResult, objectivesResult, checkinsResult, historyResult] = await Promise.allSettled([
        api.get(`/final-evaluations/${cycleId}/${user._id}`),
        api.get(`/objectives/user/${user._id}/cycle/${cycleId}`),
        api.get('/checkins', { params: { cycle_id: cycleId } }),
        api.get(`/final-evaluations/user/${user._id}/history`)
      ]);

      if (evaluationResult.status === 'fulfilled') {
        setEvaluation(evaluationResult.value.data.evaluation || null);
      } else {
        setEvaluation(null);
      }

      if (objectivesResult.status === 'fulfilled') {
        const data = objectivesResult.value.data || {};
        const list = [...(data.individualObjectives || []), ...(data.teamObjectives || [])]
          .filter((objective) => isEvaluationObjectiveStatus(objective.status));
        setObjectives(list);
        setAssessmentForms(
          list.reduce((acc, objective) => {
            acc[objective._id] = {
              progressPercentage: objective.finalSelfPercent ?? objective.achievementPercent ?? 0,
              rating: objective.finalSelfRating ?? '',
              comment: objective.finalSelfAssessment || ''
            };
            return acc;
          }, {})
        );
      } else {
        setObjectives([]);
        setAssessmentForms({});
      }

      if (checkinsResult.status === 'fulfilled') {
        setCheckins(checkinsResult.value.data.checkIns || []);
      } else {
        setCheckins([]);
      }

      if (historyResult.status === 'fulfilled') {
        const mappedHistory = (historyResult.value.data.evaluations || []).map((item) => ({
          cycleName: item.cycle_id?.name || 'Cycle',
          year: item.cycle_id?.year || 0,
          score: item.final_score || 0,
          rating: item.rating_label || '',
          recommendation: item.recommendation || 'no_action'
        }));
        setHistoryEvals(mappedHistory);
      } else {
        setHistoryEvals([]);
      }

      if (evaluationResult.status !== 'fulfilled' && objectivesResult.status !== 'fulfilled') {
        toast.error('Failed to load evaluation data');
      }
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <div className="page-loading"><div className="spinner"></div><p>Loading evaluation...</p></div>;
  }

  async function handleSubmitAssessment(objectiveId) {
    const form = assessmentForms[objectiveId];
    if (!form) return;

    try {
      setSavingObjectiveId(objectiveId);
      const payload = {
        progressPercentage: Number(form.progressPercentage),
        rating: form.rating === '' ? null : Number(form.rating),
        comment: form.comment
      };
      if (attachments[objectiveId]?.length) {
        payload.attachments = attachments[objectiveId];
      }
      await api.post(`/objectives/${objectiveId}/final-self-assessment`, payload);
      toast.success('Final self-assessment saved.');
      await fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save final self-assessment');
    } finally {
      setSavingObjectiveId('');
    }
  }

  async function handleFileUpload(objectiveId, e) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setUploading((prev) => ({ ...prev, [objectiveId]: true }));
    try {
      const uploaded = [];

      for (const file of files) {
        const fd = new FormData();
        fd.append('file', file);
        const res = await api.post('/checkins/upload', fd);
        uploaded.push(res.data.attachment);
      }

      setAttachments((prev) => ({
        ...prev,
        [objectiveId]: (prev[objectiveId] || []).concat(uploaded),
      }));
      toast.success(`${uploaded.length} file(s) uploaded successfully.`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to upload file');
    } finally {
      setUploading((prev) => ({ ...prev, [objectiveId]: false }));
      if (e.target) {
        e.target.value = '';
      }
    }
  }

  const submittedCount = objectives.filter((objective) => objective.finalSelfSubmittedAt).length;

  if (!evaluation || evaluation.status !== 'validated') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div className="card shadow-sm" style={{ padding: '1.5rem', borderLeft: '5px solid #4f46e5' }}>
          <h2 style={{ margin: '0 0 0.5rem 0' }}>Phase 3 Self-Assessment</h2>
          <p className="text-muted" style={{ margin: 0 }}>
            Submit your final progress and comments for each objective. Your manager can prepare the final evaluation after these updates.
          </p>
        </div>

        {!canEditCycle && (
          <div className="alert alert--warning" style={{ background: '#f8fafc', color: '#475569', padding: '1rem', borderRadius: '8px', borderLeft: '4px solid #64748b' }}>
            <strong>Note:</strong> This cycle is {activeCycle?.currentPhase || 'not in Phase 3'}. Final self-assessment is now read-only.
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
          <div className="card shadow-sm" style={{ padding: '1.25rem' }}>
            <div className="text-muted" style={{ fontSize: '0.8rem', textTransform: 'uppercase', fontWeight: 700 }}>Objectives Ready</div>
            <div style={{ fontSize: '1.9rem', fontWeight: 800 }}>{objectives.length}</div>
          </div>
          <div className="card shadow-sm" style={{ padding: '1.25rem' }}>
            <div className="text-muted" style={{ fontSize: '0.8rem', textTransform: 'uppercase', fontWeight: 700 }}>Submitted</div>
            <div style={{ fontSize: '1.9rem', fontWeight: 800, color: '#16a34a' }}>{submittedCount}</div>
          </div>
          <div className="card shadow-sm" style={{ padding: '1.25rem' }}>
            <div className="text-muted" style={{ fontSize: '0.8rem', textTransform: 'uppercase', fontWeight: 700 }}>Pending</div>
            <div style={{ fontSize: '1.9rem', fontWeight: 800, color: '#d97706' }}>{Math.max(objectives.length - submittedCount, 0)}</div>
          </div>
        </div>

        {objectives.length === 0 ? (
          <div className="ent-empty" style={{ padding: '3rem 2rem' }}>
            <h3 style={{ margin: '0 0 0.5rem 0' }}>No active objectives found</h3>
            <p className="text-muted">Approved objectives from this cycle will appear here for final self-assessment.</p>
          </div>
        ) : (
          objectives.map((objective) => {
            const form = assessmentForms[objective._id] || { progressPercentage: 0, rating: '', comment: '' };
            const isSaving = savingObjectiveId === objective._id;
            const pendingAttachments = attachments[objective._id] || [];
            const visibleAttachments = pendingAttachments.length > 0
              ? pendingAttachments
              : getFinalObjectiveAttachments(objective);

            return (
              <div key={objective._id} className="card shadow-sm" style={{ padding: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start', marginBottom: '1rem', flexWrap: 'wrap' }}>
                  <div>
                    <h3 style={{ margin: '0 0 0.4rem 0' }}>{objective.title}</h3>
                    <div className="text-muted" style={{ fontSize: '0.9rem' }}>
                      Weight: <strong>{objective.weight}%</strong>
                      {' '}| Current progress: <strong>{objective.achievementPercent || 0}%</strong>
                    </div>
                  </div>
                  <span className="badge" style={{ background: objective.finalSelfSubmittedAt ? '#dcfce7' : '#fef3c7', color: objective.finalSelfSubmittedAt ? '#166534' : '#92400e' }}>
                    {objective.finalSelfSubmittedAt ? 'Submitted' : 'Pending'}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                  <div>
                    <label className="ent-label">Final Progress (%)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      className="ent-input"
                      value={form.progressPercentage}
                      disabled={!canEditCycle || isSaving}
                      onChange={(e) => setAssessmentForms((prev) => ({
                        ...prev,
                        [objective._id]: { ...prev[objective._id], progressPercentage: e.target.value }
                      }))}
                    />
                  </div>
                  <div>
                    <label className="ent-label">Self Rating (1-5)</label>
                    <select
                      className="ent-select"
                      value={form.rating}
                      disabled={!canEditCycle || isSaving}
                      onChange={(e) => setAssessmentForms((prev) => ({
                        ...prev,
                        [objective._id]: { ...prev[objective._id], rating: e.target.value }
                      }))}
                    >
                      <option value="">Optional</option>
                      <option value="1">1 - Low</option>
                      <option value="2">2 - Fair</option>
                      <option value="3">3 - Solid</option>
                      <option value="4">4 - Strong</option>
                      <option value="5">5 - Exceptional</option>
                    </select>
                  </div>
                </div>

                <div style={{ marginBottom: '1rem' }}>
                  <label className="ent-label">Final Self-Assessment Comment</label>
                  <textarea
                    className="ent-input"
                    style={{ minHeight: '110px' }}
                    value={form.comment}
                    disabled={!canEditCycle || isSaving}
                    onChange={(e) => setAssessmentForms((prev) => ({
                      ...prev,
                      [objective._id]: { ...prev[objective._id], comment: e.target.value }
                    }))}
                    placeholder="Summarize what you delivered, the impact, and any end-of-cycle context."
                  />
                </div>

                <div style={{ marginBottom: '1rem' }}>
                  <label className="ent-label">Evidence / Attachments</label>
                  <div style={{ border: '2px dashed var(--shell-border, #d1d5db)', borderRadius: '8px', padding: '1rem', textAlign: 'center', background: 'var(--shell-bg-inset, #f9fafb)' }}>
                    {uploading[objective._id] ? (
                      <div style={{ color: 'var(--primary)', fontWeight: 600 }}>Uploading...</div>
                    ) : visibleAttachments.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', alignItems: 'stretch', textAlign: 'left' }}>
                        {visibleAttachments.map((attachment, index) => (
                          <div
                            key={`${attachment.url || attachment.name || 'attachment'}-${index}`}
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.75rem' }}
                          >
                            <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                              <a
                                href={attachment.url}
                                target="_blank"
                                rel="noreferrer"
                                style={{ color: 'var(--primary)', fontWeight: 600, textDecoration: 'underline', wordBreak: 'break-word' }}
                              >
                                {attachment.name || `Attachment ${index + 1}`}
                              </a>
                              {attachment.size && (
                                <span className="text-muted" style={{ fontSize: '0.8rem' }}>
                                  {(attachment.size / (1024 * 1024)).toFixed(2)} MB
                                </span>
                              )}
                            </div>
                            {canEditCycle && pendingAttachments.length > 0 && (
                              <button
                                type="button"
                                onClick={() => setAttachments((prev) => ({
                                  ...prev,
                                  [objective._id]: (prev[objective._id] || []).filter((_, attachmentIndex) => attachmentIndex !== index),
                                }))}
                                style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.95rem', fontWeight: 700 }}
                                title="Remove"
                              >
                                Remove
                              </button>
                            )}
                          </div>
                        ))}
                        {canEditCycle && (
                          <div>
                            <input
                              type="file"
                              id={`final-file-${objective._id}`}
                              style={{ display: 'none' }}
                              onChange={(e) => handleFileUpload(objective._id, e)}
                              disabled={!canEditCycle}
                              multiple
                              accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.gif,.txt,.csv,.zip"
                            />
                            <label htmlFor={`final-file-${objective._id}`} style={{ cursor: canEditCycle ? 'pointer' : 'not-allowed', color: 'var(--primary)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                              Add more files
                            </label>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div>
                        <input type="file" id={`final-file-${objective._id}`} style={{ display: 'none' }} onChange={(e) => handleFileUpload(objective._id, e)} disabled={!canEditCycle} multiple accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.gif,.txt,.csv,.zip" />
                        <label htmlFor={`final-file-${objective._id}`} style={{ cursor: canEditCycle ? 'pointer' : 'not-allowed', color: 'var(--primary)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                          Choose file(s) to upload
                        </label>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Max 10MB each - PDF, Word, Excel, Images, etc.</div>
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                  <div className="text-muted" style={{ fontSize: '0.88rem' }}>
                    {objective.finalSelfSubmittedAt
                      ? `Last submitted on ${new Date(objective.finalSelfSubmittedAt).toLocaleDateString()}`
                      : 'This objective still needs a final self-assessment.'}
                  </div>
                  <button
                    type="button"
                    className="btn btn--primary"
                    disabled={isSaving || !canEditCycle}
                    onClick={() => handleSubmitAssessment(objective._id)}
                  >
                    {isSaving ? 'Saving...' : objective.finalSelfSubmittedAt ? 'Update Self-Assessment' : 'Submit Self-Assessment'}
                  </button>
                </div>
              </div>
            );
          })
        )}

        <div className="ent-empty" style={{ padding: '2rem' }}>
          <h3 style={{ margin: '0 0 0.5rem 0' }}>Evaluation Status</h3>
          <p className="text-muted" style={{ margin: 0 }}>
            {evaluation?.status === 'pending_hr'
              ? 'Your manager submitted the final evaluation to HR. It is waiting for validation.'
              : evaluation?.status === 'draft'
                ? 'A draft final evaluation exists but has not been validated yet.'
                : 'Your final evaluation is currently being prepared and validated.'}
          </p>
        </div>
      </div>
    );
  }

  const renderRatingLabel = (label) => (label || '').replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
  const renderRoleLabel = (label) => (label || '').replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

  const getObjectiveIcon = (progress) => {
    if (progress >= 90) return '[DONE]';
    if (progress >= 50) return '[PARTIAL]';
    return '[MISS]';
  };

  const completedObjectives = objectives.filter((objective) => (objective.achievementPercent || 0) >= 90);
  const partialObjectives = objectives.filter((objective) => {
    const score = objective.achievementPercent || 0;
    return score >= 50 && score < 90;
  });
  const missedObjectives = objectives.filter((objective) => (objective.achievementPercent || 0) < 50);
  const averageAchievement = objectives.length > 0
    ? Math.round(objectives.reduce((sum, objective) => sum + (objective.achievementPercent || 0), 0) / objectives.length)
    : 0;

  const feedbackSummary = checkins
    .filter((checkin) => checkin.manager_feedback && checkin.manager_feedback.trim() !== '')
    .map((checkin) => {
      const objective = objectives.find((item) => item._id === (checkin.objective_id?._id || checkin.objective_id));
      return {
        objectiveTitle: objective ? objective.title : 'General',
        feedback: checkin.manager_feedback,
        date: checkin.updatedAt
      };
    });

  const previousEvaluation = historyEvals.length > 1 ? historyEvals[historyEvals.length - 2] : null;
  const growthDelta = previousEvaluation ? Math.round((evaluation.final_score || 0) - (previousEvaluation.score || 0)) : null;

  const feedbackHighlights = [
    ...(evaluation.strengths || []).slice(0, 2).map((item) => ({ label: 'Strength', value: item })),
    ...(evaluation.weaknesses || []).slice(0, 2).map((item) => ({ label: 'Focus Area', value: item })),
    ...(evaluation.improvement_suggestions || []).slice(0, 2).map((item) => ({ label: 'Next Cycle', value: item }))
  ];

  const chartData = {
    labels: historyEvals.map((item) => item.cycleName),
    datasets: [
      {
        label: 'Final Score',
        data: historyEvals.map((item) => item.score),
        fill: false,
        borderColor: '#4f46e5',
        tension: 0.2,
        pointBackgroundColor: '#4f46e5',
        pointRadius: 5
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    scales: { y: { min: 0, max: 100 } },
    plugins: { legend: { display: false } }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div className="card shadow-sm" style={{ padding: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderLeft: '6px solid var(--primary)' }}>
        <div>
          <h2 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-dark)' }}>Final Performance Summary</h2>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '3rem', fontWeight: 'bold', color: 'var(--primary)', lineHeight: 1 }}>{evaluation.final_score}%</span>
            <span className="badge" style={{ background: '#e0e7ff', color: '#4f46e5', fontSize: '1rem', padding: '0.5rem 1rem' }}>
              {renderRatingLabel(evaluation.rating_label)}
            </span>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="text-muted" style={{ fontSize: '0.9rem' }}>Submitted By</div>
          <div style={{ fontWeight: 'bold' }}>
            {evaluation.evaluator_id?.name
              ? `${evaluation.evaluator_id.name} (${renderRoleLabel(evaluation.evaluator_role || evaluation.evaluator_id.role)})`
              : 'Not available'}
          </div>
          <div className="text-muted" style={{ fontSize: '0.9rem' }}>HR Validation Date</div>
          <div style={{ fontWeight: 'bold' }}>{new Date(evaluation.hr_validated_at).toLocaleDateString()}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
        <div className="card shadow-sm" style={{ padding: '1.25rem' }}>
          <div className="text-muted" style={{ fontSize: '0.8rem', textTransform: 'uppercase', fontWeight: 700 }}>Final KPI Score</div>
          <div style={{ fontSize: '1.9rem', fontWeight: 800, color: '#0284c7', marginTop: '0.35rem' }}>{evaluation.final_score}%</div>
          <div style={{ fontSize: '0.9rem', marginTop: '0.35rem' }}>Global performance score for the full cycle.</div>
        </div>
        <div className="card shadow-sm" style={{ padding: '1.25rem' }}>
          <div className="text-muted" style={{ fontSize: '0.8rem', textTransform: 'uppercase', fontWeight: 700 }}>Achievement Recap</div>
          <div style={{ fontSize: '1.15rem', fontWeight: 700, marginTop: '0.35rem' }}>{completedObjectives.length} completed</div>
          <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>{partialObjectives.length} partial, {missedObjectives.length} below target</div>
        </div>
        <div className="card shadow-sm" style={{ padding: '1.25rem' }}>
          <div className="text-muted" style={{ fontSize: '0.8rem', textTransform: 'uppercase', fontWeight: 700 }}>Average Objective Achievement</div>
          <div style={{ fontSize: '1.9rem', fontWeight: 800, color: 'var(--primary)', marginTop: '0.35rem' }}>{averageAchievement}%</div>
          <div style={{ fontSize: '0.9rem', marginTop: '0.35rem' }}>Compared to your planned delivery for this cycle.</div>
        </div>
        <div className="card shadow-sm" style={{ padding: '1.25rem' }}>
          <div className="text-muted" style={{ fontSize: '0.8rem', textTransform: 'uppercase', fontWeight: 700 }}>Growth History</div>
          <div style={{ fontSize: '1.15rem', fontWeight: 700, marginTop: '0.35rem', color: growthDelta == null ? 'var(--text-dark)' : growthDelta >= 0 ? '#16a34a' : '#dc2626' }}>
            {growthDelta == null ? 'No prior cycle' : `${growthDelta >= 0 ? '+' : ''}${growthDelta} pts`}
          </div>
          <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            {previousEvaluation ? `Compared with ${previousEvaluation.cycleName}.` : 'A comparison will appear after future validated cycles.'}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
        <div className="card shadow-sm" style={{ padding: '1.5rem' }}>
          <h3 style={{ margin: '0 0 1rem 0' }}>Achievement Recap</h3>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
            <span className="badge" style={{ background: '#dcfce7', color: '#166534' }}>Completed: {completedObjectives.length}</span>
            <span className="badge" style={{ background: '#fef3c7', color: '#92400e' }}>Partial: {partialObjectives.length}</span>
            <span className="badge" style={{ background: '#fee2e2', color: '#991b1b' }}>Below Target: {missedObjectives.length}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {objectives.map((objective) => (
              <div key={objective._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--shell-bg-inset)', padding: '0.75rem', borderRadius: '6px' }}>
                <span style={{ fontWeight: 500 }}>{objective.title}</span>
                <span style={{ fontSize: '1rem' }} title={`Progress: ${objective.achievementPercent || 0}%`}>
                  {getObjectiveIcon(objective.achievementPercent || 0)} {objective.achievementPercent || 0}%
                </span>
              </div>
            ))}
            {objectives.length === 0 && <p className="text-muted">No objectives found.</p>}
          </div>
        </div>

        <div className="card shadow-sm" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div>
            <h3 style={{ margin: '0 0 0.5rem 0', color: '#16a34a' }}>Strengths</h3>
            <ul style={{ margin: 0, paddingLeft: '1.2rem' }}>
              {(evaluation.strengths || []).map((item, index) => <li key={index}>{item}</li>)}
              {(!evaluation.strengths || evaluation.strengths.length === 0) && <span className="text-muted">None listed.</span>}
            </ul>
          </div>
          <div>
            <h3 style={{ margin: '0 0 0.5rem 0', color: '#dc2626' }}>Areas for Improvement</h3>
            <ul style={{ margin: 0, paddingLeft: '1.2rem' }}>
              {(evaluation.weaknesses || []).map((item, index) => <li key={index}>{item}</li>)}
              {(!evaluation.weaknesses || evaluation.weaknesses.length === 0) && <span className="text-muted">None listed.</span>}
            </ul>
          </div>
        </div>

        <div className="card shadow-sm" style={{ padding: '1.5rem' }}>
          <h3 style={{ margin: '0 0 1rem 0', color: '#0284c7' }}>Improvement Suggestions For Next Cycle</h3>
          <ul style={{ margin: 0, paddingLeft: '1.2rem' }}>
            {(evaluation.improvement_suggestions || []).map((item, index) => <li key={index}>{item}</li>)}
            {(!evaluation.improvement_suggestions || evaluation.improvement_suggestions.length === 0) && <span className="text-muted">No specific actions suggested.</span>}
          </ul>
        </div>

        <div className="card shadow-sm" style={{ padding: '1.5rem' }}>
          <h3 style={{ margin: '0 0 1rem 0' }}>Peer / Manager Feedback View</h3>
          {feedbackHighlights.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem' }}>
              {feedbackHighlights.map((item, index) => (
                <div key={index} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.75rem' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.25rem' }}>{item.label}</div>
                  <div style={{ fontSize: '0.92rem' }}>{item.value}</div>
                </div>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '220px', overflowY: 'auto', paddingRight: '0.5rem' }}>
            {feedbackSummary.map((item, index) => (
              <div key={index} style={{ borderLeft: '3px solid #cbd5e1', paddingLeft: '0.75rem' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>{item.objectiveTitle}</div>
                <div style={{ fontSize: '0.9rem' }}>"{item.feedback}"</div>
              </div>
            ))}
            {feedbackSummary.length === 0 && <p className="text-muted">No mid-year manager feedback recorded.</p>}
          </div>
        </div>
      </div>

      {historyEvals.length > 1 && (
        <div className="card shadow-sm" style={{ padding: '1.5rem' }}>
          <h3 style={{ margin: '0 0 1rem 0' }}>Personal Growth History</h3>
          <div style={{ height: '300px' }}>
            <Line data={chartData} options={chartOptions} />
          </div>
        </div>
      )}

      <div className="card shadow-sm" style={{ padding: '1.5rem', background: '#f8fafc' }}>
        <h3 style={{ margin: '0 0 0.5rem 0' }}>Final Manager Comments</h3>
        <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{evaluation.manager_comments || 'No final manager comments provided.'}</p>
        {(evaluation.evaluator_id?.name || evaluation.evaluator_role) && (
          <div style={{ marginTop: '0.85rem', fontSize: '0.88rem', color: 'var(--text-muted)' }}>
            Submitted by {evaluation.evaluator_id?.name || 'Unknown'}{evaluation.evaluator_role ? ` (${renderRoleLabel(evaluation.evaluator_role)})` : ''}{evaluation.evaluated_at ? ` on ${new Date(evaluation.evaluated_at).toLocaleDateString()}` : ''}.
          </div>
        )}
      </div>

      <div className="card shadow-sm" style={{ padding: '1.5rem', background: '#f8fafc' }}>
        <h3 style={{ margin: '0 0 0.75rem 0' }}>End-of-Cycle Report</h3>
        <p style={{ margin: 0, lineHeight: 1.7 }}>
          You finished this cycle with a <strong>{renderRatingLabel(evaluation.rating_label)}</strong> rating and a final performance score of <strong>{evaluation.final_score}%</strong>.
          You completed <strong>{completedObjectives.length}</strong> out of <strong>{objectives.length}</strong> planned objectives, while the main improvement focus for the next cycle is
          {' '}
          <strong>{(evaluation.weaknesses || []).slice(0, 2).join(', ') || 'continued consistency and growth'}</strong>.
        </p>
      </div>
    </div>
  );
}

export default FinalEvaluationEmployee;
