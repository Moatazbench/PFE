import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../components/AuthContext';
import { useToast, ToastContainer } from '../components/common/Toast';
import ConfirmDialog from '../components/common/ConfirmDialog';

function EvaluationScoringPage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const evaluationId = searchParams.get('id');

  const [evaluation, setEvaluation] = useState(null);
  const [rubric, setRubric] = useState([]);
  const [rubricBand, setRubricBand] = useState(null);
  const [feedback, setFeedback] = useState({
    overallComments: '',
    strengths: '',
    areasForImprovement: '',
    developmentRecommendations: '',
    nextSteps: '',
  });
  const [finalScoreInput, setFinalScoreInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmSubmit, setConfirmSubmit] = useState(false);

  useEffect(() => {
    fetchEvaluation();
  }, [evaluationId]);

  async function fetchEvaluation() {
    if (!evaluationId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const res = await api.get(`/api/evaluations/${evaluationId}`);
      const record = res.data.evaluation;
      setEvaluation(record);
      setRubric(res.data.rubric || []);
      setRubricBand(res.data.rubricBand || null);
      setFeedback({
        overallComments: record.overallComments || '',
        strengths: record.strengths || '',
        areasForImprovement: record.areasForImprovement || '',
        developmentRecommendations: record.developmentRecommendations || '',
        nextSteps: record.nextSteps || '',
      });
      setFinalScoreInput(record.finalScore != null ? String(record.finalScore) : '');
    } catch (err) {
      toast.error('Failed to load evaluation.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!evaluation) return;
    setSaving(true);
    try {
      const payload = { ...feedback };
      if (finalScoreInput !== '') {
        payload.finalScore = Number(finalScoreInput);
      }
      const res = await api.put(`/api/evaluations/${evaluation._id}`, payload);
      setEvaluation(res.data.evaluation);
      setRubricBand(res.data.rubricBand || null);
      toast.success('Evaluation saved.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save evaluation.');
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmit() {
    if (!evaluation) return;
    setSaving(true);
    try {
      const payload = { ...feedback };
      if (finalScoreInput !== '') {
        payload.finalScore = Number(finalScoreInput);
      }
      await api.put(`/api/evaluations/${evaluation._id}`, payload);
      await api.post(`/api/evaluations/${evaluation._id}/submit`);
      setConfirmSubmit(false);
      toast.success('Evaluation submitted.');
      fetchEvaluation();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit evaluation.');
    } finally {
      setSaving(false);
    }
  }

  async function handleApprove() {
    try {
      await api.post(`/api/evaluations/${evaluation._id}/approve`, { comments: '' });
      toast.success('Evaluation approved.');
      fetchEvaluation();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to approve evaluation.');
    }
  }

  async function handleReject() {
    const comments = window.prompt('Reason for rejection:');
    if (!comments) return;

    try {
      await api.post(`/api/evaluations/${evaluation._id}/reject`, { comments });
      toast.success('Evaluation rejected.');
      fetchEvaluation();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reject evaluation.');
    }
  }

  async function handleAcknowledge() {
    try {
      await api.post(`/api/evaluations/${evaluation._id}/acknowledge`);
      toast.success('Evaluation acknowledged.');
      fetchEvaluation();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to acknowledge evaluation.');
    }
  }

  function getStatusStyle(status) {
    const styles = {
      draft: { bg: '#64748b', label: 'Draft' },
      in_progress: { bg: '#2563eb', label: 'In Progress' },
      submitted: { bg: '#d97706', label: 'Submitted' },
      approved: { bg: '#16a34a', label: 'Approved' },
      rejected: { bg: '#dc2626', label: 'Rejected' },
      completed: { bg: '#7c3aed', label: 'Completed' },
    };
    return styles[status] || styles.draft;
  }

  function getScoreColor(score) {
    if (score >= 90) return '#7c3aed';
    if (score >= 75) return '#16a34a';
    if (score >= 50) return '#ca8a04';
    return '#dc2626';
  }

  const isEditable = evaluation && ['draft', 'in_progress', 'rejected'].includes(evaluation.status);
  const canEdit = evaluation && (String(evaluation.evaluatorId?._id) === String(user?.id) || user?.role === 'ADMIN') && isEditable;
  const isEmployee = evaluation && String(evaluation.employeeId?._id) === String(user?.id);
  const statusInfo = getStatusStyle(evaluation?.status);
  const liveScore = finalScoreInput !== '' ? Number(finalScoreInput) : (evaluation?.finalScore ?? evaluation?.suggestedScore ?? 0);

  if (loading) {
    return (
      <div className="eval-loading">
        <div className="spinner"></div>
        <p>Loading evaluation...</p>
      </div>
    );
  }

  if (!evaluation) {
    return (
      <div className="eval-empty-state">
        <h2>Evaluation Not Found</h2>
        <button className="btn btn--primary" onClick={() => navigate('/final-evaluations')}>Back to Reviews</button>
      </div>
    );
  }

  return (
    <div className="eval-scoring-page">
      <ToastContainer toasts={toast.toasts} removeToast={toast.removeToast} />

      <div className="eval-header">
        <div className="eval-header-left">
          <div className="eval-header-avatar">
            {evaluation.employeeId?.name?.charAt(0)?.toUpperCase() || '?'}
          </div>
          <div className="eval-header-info">
            <h1 className="eval-header-title">{evaluation.employeeId?.name || 'Employee'}</h1>
            <div className="eval-header-meta">
              <span className="eval-meta-item">{evaluation.period}</span>
              <span className="eval-meta-item">Evaluator: {evaluation.evaluatorId?.name}</span>
              <span className="eval-meta-item">Cycle: {evaluation.cycleId?.name} {evaluation.cycleId?.year}</span>
            </div>
            <div className="eval-header-dates">
              {evaluation.createdAt && <span>Created: {new Date(evaluation.createdAt).toLocaleDateString()}</span>}
              {evaluation.submittedAt && <span>Submitted: {new Date(evaluation.submittedAt).toLocaleDateString()}</span>}
              {evaluation.completedAt && <span>Completed: {new Date(evaluation.completedAt).toLocaleDateString()}</span>}
            </div>
          </div>
        </div>
        <div className="eval-header-right">
          <span className="eval-status-badge" style={{ backgroundColor: statusInfo.bg }}>
            {statusInfo.label}
          </span>
          {canEdit && (
            <div className="eval-header-actions">
              <button className="btn eval-btn-draft" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save Draft'}</button>
              <button className="btn eval-btn-submit" onClick={() => setConfirmSubmit(true)} disabled={saving}>Submit Evaluation</button>
            </div>
          )}
          {evaluation.status === 'submitted' && ['ADMIN', 'HR'].includes(user?.role) && (
            <div className="eval-header-actions">
              <button className="btn eval-btn-approve" onClick={handleApprove}>Approve</button>
              <button className="btn eval-btn-reject" onClick={handleReject}>Reject</button>
            </div>
          )}
          {isEmployee && ['submitted', 'approved', 'completed'].includes(evaluation.status) && !evaluation.employeeAcknowledgment?.acknowledged && (
            <button className="btn eval-btn-ack" onClick={handleAcknowledge}>Acknowledge</button>
          )}
        </div>
      </div>

      <div className="eval-section">
        <div className="eval-section-header">
          <h2>Objective Scope</h2>
          <span className="eval-goals-counter">{evaluation.objectiveAssessments?.length || 0} objective(s)</span>
        </div>

        <div style={{ display: 'grid', gap: '1rem' }}>
          {(evaluation.objectiveAssessments || []).map((assessment) => (
            <div key={assessment.objectiveId} className="eval-goal-card reviewed">
              <div className="eval-goal-header">
                <div className="eval-goal-header-left">
                  <div>
                    <h4 className="eval-goal-title">{assessment.objective?.title}</h4>
                    <div className="eval-goal-tags">
                      <span className="eval-tag eval-tag-weight">Weight: {assessment.objective?.weight}%</span>
                      <span className="eval-tag eval-tag-target">Progress: {assessment.achievementPercent}%</span>
                      <span className="eval-tag eval-tag-priority">Status: {assessment.workflowStatus}</span>
                    </div>
                  </div>
                </div>
                <div className="eval-goal-header-right">
                  <div className="eval-goal-achievement-preview" style={{ color: getScoreColor(assessment.weightedScore) }}>
                    {assessment.weightedScore}
                  </div>
                </div>
              </div>

              {assessment.objective?.description && (
                <div className="eval-goal-assessment">
                  <p className="eval-goal-description">{assessment.objective.description}</p>
                  {assessment.objective?.managerComments && (
                    <p className="eval-goal-description"><strong>Manager note:</strong> {assessment.objective.managerComments}</p>
                  )}
                  {assessment.objective?.evaluationComment && (
                    <p className="eval-goal-description"><strong>Evaluation note:</strong> {assessment.objective.evaluationComment}</p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="eval-section">
        <div className="eval-section-header">
          <h2>Objective Score</h2>
        </div>

        <div className="eval-score-panel">
          <div className="eval-rubric-table">
            <h3 className="eval-rubric-title">Rubric</h3>
            <div className="eval-rubric-bands">
              {rubric.map((band) => {
                const active = rubricBand && rubricBand.label === band.label;
                return (
                  <div key={band.label} className={`eval-rubric-band ${active ? 'eval-rubric-active' : ''}`}>
                    <div className="eval-rubric-score" style={{ backgroundColor: band.color }}>{band.range}</div>
                    <div className="eval-rubric-info">
                      <strong>{band.label}</strong>
                      <p className="eval-rubric-desc">{band.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="eval-score-display">
            <div className="eval-suggested-score">
              <span className="eval-score-label">Suggested Score</span>
              <span className="eval-score-value" style={{ color: getScoreColor(evaluation.suggestedScore || 0) }}>
                {evaluation.suggestedScore ?? 0}
              </span>
              <span className="eval-score-band" style={{ backgroundColor: getScoreColor(evaluation.suggestedScore || 0) }}>
                {rubricBand?.label || 'Live Objective Score'}
              </span>
            </div>

            <div className="eval-final-score">
              <span className="eval-score-label">Final Score Override</span>
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={finalScoreInput}
                onChange={(event) => setFinalScoreInput(event.target.value)}
                disabled={!canEdit}
                className="eval-score-input"
                placeholder={String(evaluation.suggestedScore ?? 0)}
              />
              <div className="eval-live-band" style={{ borderColor: getScoreColor(liveScore), backgroundColor: `${getScoreColor(liveScore)}15` }}>
                <span className="eval-live-band-dot" style={{ backgroundColor: getScoreColor(liveScore) }}></span>
                <span style={{ color: getScoreColor(liveScore), fontWeight: 700 }}>{liveScore}/100</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="eval-section">
        <div className="eval-section-header">
          <h2>Overall Feedback</h2>
        </div>

        <div className="eval-feedback-grid">
          <div className="eval-feedback-item eval-feedback-full">
            <label className="eval-feedback-label">Overall Comments</label>
            <textarea value={feedback.overallComments} onChange={(event) => setFeedback((current) => ({ ...current, overallComments: event.target.value }))} disabled={!canEdit} className="eval-feedback-textarea" rows="4" />
          </div>
          <div className="eval-feedback-item">
            <label className="eval-feedback-label">Strengths</label>
            <textarea value={feedback.strengths} onChange={(event) => setFeedback((current) => ({ ...current, strengths: event.target.value }))} disabled={!canEdit} className="eval-feedback-textarea" rows="3" />
          </div>
          <div className="eval-feedback-item">
            <label className="eval-feedback-label">Areas for Improvement</label>
            <textarea value={feedback.areasForImprovement} onChange={(event) => setFeedback((current) => ({ ...current, areasForImprovement: event.target.value }))} disabled={!canEdit} className="eval-feedback-textarea" rows="3" />
          </div>
          <div className="eval-feedback-item">
            <label className="eval-feedback-label">Development Recommendations</label>
            <textarea value={feedback.developmentRecommendations} onChange={(event) => setFeedback((current) => ({ ...current, developmentRecommendations: event.target.value }))} disabled={!canEdit} className="eval-feedback-textarea" rows="3" />
          </div>
          <div className="eval-feedback-item">
            <label className="eval-feedback-label">Next Steps</label>
            <textarea value={feedback.nextSteps} onChange={(event) => setFeedback((current) => ({ ...current, nextSteps: event.target.value }))} disabled={!canEdit} className="eval-feedback-textarea" rows="3" />
          </div>
        </div>
      </div>

      {evaluation.scoreHistory?.length > 0 && (
        <div className="eval-section">
          <div className="eval-section-header">
            <h2>Score History</h2>
          </div>
          <div className="eval-score-history">
            {evaluation.scoreHistory.map((entry, index) => (
              <div key={`${entry.changedAt}-${index}`} className="eval-history-entry">
                <span className="eval-history-date">{new Date(entry.changedAt).toLocaleString()}</span>
                <span className="eval-history-change">{entry.previousScore ?? '-'} to {entry.newScore}</span>
                <span className="eval-history-by">{entry.changedBy?.name || 'System'}</span>
                {entry.reason && <span className="eval-history-reason">{entry.reason}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmSubmit}
        title="Submit Evaluation"
        message={`Submit this evaluation with a score of ${finalScoreInput || evaluation.finalScore || evaluation.suggestedScore || 0}/100? Objectives will lock after submission.`}
        confirmLabel="Submit"
        onConfirm={handleSubmit}
        onCancel={() => setConfirmSubmit(false)}
      />
    </div>
  );
}

export default EvaluationScoringPage;
