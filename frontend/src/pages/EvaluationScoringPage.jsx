import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../components/AuthContext';
import { useToast, ToastContainer } from '../components/common/Toast';
import ConfirmDialog from '../components/common/ConfirmDialog';

function EvaluationScoringPage() {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const evaluationId = searchParams.get('id');

  const [evaluation, setEvaluation] = useState(null);
  const [rubric, setRubric] = useState([]);
  const [rubricBand, setRubricBand] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandedGoals, setExpandedGoals] = useState({});
  const [confirmSubmit, setConfirmSubmit] = useState(false);

  // Form state for feedback sections
  const [feedback, setFeedback] = useState({
    overallComments: '',
    strengths: '',
    areasForImprovement: '',
    developmentRecommendations: '',
    nextSteps: '',
  });
  const [finalScoreInput, setFinalScoreInput] = useState('');
  const [scoringMethod, setScoringMethod] = useState('weighted_average');

  const fetchEvaluation = useCallback(async () => {
    if (!evaluationId) { setLoading(false); return; }
    try {
      const res = await api.get(`/api/evaluations/${evaluationId}`);
      const ev = res.data.evaluation;
      setEvaluation(ev);
      setRubric(res.data.rubric || []);
      setRubricBand(res.data.rubricBand);
      setFeedback({
        overallComments: ev.overallComments || '',
        strengths: ev.strengths || '',
        areasForImprovement: ev.areasForImprovement || '',
        developmentRecommendations: ev.developmentRecommendations || '',
        nextSteps: ev.nextSteps || '',
      });
      setFinalScoreInput(ev.finalScore != null ? String(ev.finalScore) : '');
      setScoringMethod(ev.scoringMethod || 'weighted_average');
    } catch (err) {
      toast.error('Failed to load evaluation');
    } finally {
      setLoading(false);
    }
  }, [evaluationId]);

  useEffect(() => { fetchEvaluation(); }, [fetchEvaluation]);

  // Computed values
  const reviewedCount = evaluation?.goalAssessments?.filter(a => a.reviewed).length || 0;
  const totalGoals = evaluation?.goalAssessments?.length || 0;
  const isEditable = evaluation && ['draft', 'in_progress', 'rejected'].includes(evaluation.status);
  const isEvaluator = evaluation && String(evaluation.evaluatorId?._id) === String(user?.id);
  const isEmployee = evaluation && String(evaluation.employeeId?._id) === String(user?.id);
  const canEdit = isEditable && (isEvaluator || user?.role === 'ADMIN');

  // Group goals by category
  const goalsByCategory = {};
  evaluation?.goalAssessments?.forEach(a => {
    const cat = a.goalId?.category || 'Uncategorized';
    if (!goalsByCategory[cat]) goalsByCategory[cat] = [];
    goalsByCategory[cat].push(a);
  });

  function toggleGoal(goalId) {
    setExpandedGoals(prev => ({ ...prev, [goalId]: !prev[goalId] }));
  }

  // Get achievement color
  function getAchievementColor(pct) {
    if (pct >= 90) return '#8b5cf6';
    if (pct >= 75) return '#22c55e';
    if (pct >= 50) return '#eab308';
    if (pct >= 30) return '#f97316';
    return '#ef4444';
  }

  function getStatusIcon(status) {
    switch (status) {
      case 'exceeded': return '🌟';
      case 'completed': return '✅';
      case 'in_progress': return '🔄';
      default: return '⏸️';
    }
  }

  function getStatusLabel(status) {
    switch (status) {
      case 'exceeded': return 'Exceeded';
      case 'completed': return 'Completed';
      case 'in_progress': return 'In Progress';
      default: return 'Not Started';
    }
  }

  function getEvalStatusStyle(status) {
    const styles = {
      draft: { bg: '#64748b', label: 'Draft' },
      in_progress: { bg: '#3b82f6', label: 'In Progress' },
      submitted: { bg: '#f59e0b', label: 'Submitted' },
      approved: { bg: '#22c55e', label: 'Approved' },
      rejected: { bg: '#ef4444', label: 'Rejected' },
      completed: { bg: '#8b5cf6', label: 'Completed' },
    };
    return styles[status] || styles.draft;
  }

  // Get rubric band for a score value in real-time
  function getLiveBand(score) {
    if (score == null || isNaN(score)) return null;
    const s = parseFloat(score);
    if (s < 3) return rubric[0];
    if (s < 5) return rubric[1];
    if (s < 6) return rubric[2];
    if (s < 8) return rubric[3];
    return rubric[4];
  }

  // ===== HANDLERS =====

  async function handleGoalAssessmentUpdate(goalId, field, value) {
    if (!canEdit) return;
    try {
      const body = {};
      body[field] = value;
      const res = await api.patch(`/api/evaluations/${evaluationId}/goal/${goalId}`, body);
      setEvaluation(res.data.evaluation);
      setRubricBand(res.data.rubricBand);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update goal assessment');
    }
  }

  async function handleSaveDraft() {
    if (!canEdit) return;
    setSaving(true);
    try {
      const body = {
        ...feedback,
        scoringMethod,
      };
      if (finalScoreInput && !isNaN(parseFloat(finalScoreInput))) {
        body.finalScore = parseFloat(finalScoreInput);
      }
      const res = await api.put(`/api/evaluations/${evaluationId}`, body);
      setEvaluation(res.data.evaluation);
      setRubricBand(res.data.rubricBand);
      toast.success('Evaluation saved as draft');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmit() {
    setSaving(true);
    try {
      // Save first
      const saveBody = { ...feedback, scoringMethod };
      if (finalScoreInput && !isNaN(parseFloat(finalScoreInput))) {
        saveBody.finalScore = parseFloat(finalScoreInput);
      }
      await api.put(`/api/evaluations/${evaluationId}`, saveBody);
      // Then submit
      await api.post(`/api/evaluations/${evaluationId}/submit`);
      toast.success('Evaluation submitted successfully!');
      setConfirmSubmit(false);
      fetchEvaluation();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit');
    } finally {
      setSaving(false);
    }
  }

  async function handleApprove() {
    try {
      await api.post(`/api/evaluations/${evaluationId}/approve`, { comments: '' });
      toast.success('Evaluation approved');
      fetchEvaluation();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to approve');
    }
  }

  async function handleReject() {
    const reason = prompt('Rejection reason:');
    if (!reason) return;
    try {
      await api.post(`/api/evaluations/${evaluationId}/reject`, { comments: reason });
      toast.success('Evaluation rejected');
      fetchEvaluation();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reject');
    }
  }

  async function handleAcknowledge() {
    try {
      await api.post(`/api/evaluations/${evaluationId}/acknowledge`);
      toast.success('Evaluation acknowledged');
      fetchEvaluation();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to acknowledge');
    }
  }

  // Current live band
  const liveScore = finalScoreInput ? parseFloat(finalScoreInput) : (evaluation?.suggestedScore || null);
  const liveBand = getLiveBand(liveScore);

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
        <span style={{ fontSize: '3rem' }}>📋</span>
        <h2>Evaluation Not Found</h2>
        <p>The requested evaluation could not be loaded.</p>
        <button className="btn btn--primary" onClick={() => navigate('/evaluation-list')}>Back to Evaluations</button>
      </div>
    );
  }

  const statusInfo = getEvalStatusStyle(evaluation.status);

  return (
    <div className="eval-scoring-page">
      <ToastContainer toasts={toast.toasts} removeToast={toast.removeToast} />

      {/* ===== HEADER ===== */}
      <div className="eval-header">
        <div className="eval-header-left">
          <div className="eval-header-avatar">
            {evaluation.employeeId?.name?.charAt(0)?.toUpperCase() || '?'}
          </div>
          <div className="eval-header-info">
            <h1 className="eval-header-title">{evaluation.employeeId?.name || 'Employee'}</h1>
            <div className="eval-header-meta">
              <span className="eval-meta-item">📅 {evaluation.period}</span>
              <span className="eval-meta-item">👔 Evaluator: {evaluation.evaluatorId?.name}</span>
              <span className="eval-meta-item">🔄 Cycle: {evaluation.cycleId?.name} {evaluation.cycleId?.year}</span>
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
              <button className="btn eval-btn-draft" onClick={handleSaveDraft} disabled={saving}>
                {saving ? 'Saving...' : '💾 Save Draft'}
              </button>
              <button className="btn eval-btn-submit" onClick={() => setConfirmSubmit(true)} disabled={saving || reviewedCount < totalGoals}>
                📤 Submit Evaluation
              </button>
            </div>
          )}
          {evaluation.status === 'submitted' && ['ADMIN', 'HR'].includes(user?.role) && (
            <div className="eval-header-actions">
              <button className="btn eval-btn-approve" onClick={handleApprove}>✅ Approve</button>
              <button className="btn eval-btn-reject" onClick={handleReject}>❌ Reject</button>
            </div>
          )}
          {isEmployee && ['submitted', 'approved', 'completed'].includes(evaluation.status) && !evaluation.employeeAcknowledgment?.acknowledged && (
            <button className="btn eval-btn-ack" onClick={handleAcknowledge}>✋ Acknowledge</button>
          )}
        </div>
      </div>

      {/* ===== GOALS SECTION ===== */}
      <div className="eval-section">
        <div className="eval-section-header">
          <h2>🎯 Employee Goals</h2>
          <span className="eval-goals-counter">
            {reviewedCount} of {totalGoals} goals reviewed
          </span>
        </div>

        {/* Scoring method toggle */}
        {canEdit && (
          <div className="eval-scoring-method">
            <label>Scoring Method:</label>
            <div className="eval-method-toggle">
              <button
                className={`eval-method-btn ${scoringMethod === 'simple_average' ? 'active' : ''}`}
                onClick={() => setScoringMethod('simple_average')}
              >Simple Average</button>
              <button
                className={`eval-method-btn ${scoringMethod === 'weighted_average' ? 'active' : ''}`}
                onClick={() => setScoringMethod('weighted_average')}
              >Weighted Average</button>
            </div>
          </div>
        )}

        {Object.entries(goalsByCategory).map(([category, assessments]) => (
          <div key={category} className="eval-goal-category">
            <h3 className="eval-category-title">
              <span className="eval-category-icon">
                {category === 'individual' ? '👤' : category === 'team' ? '👥' : category === 'strategic' ? '🏢' : '📌'}
              </span>
              {category.charAt(0).toUpperCase() + category.slice(1)} Goals
              <span className="eval-category-count">({assessments.length})</span>
            </h3>

            {assessments.map(assessment => {
              const goal = assessment.goalId;
              if (!goal) return null;
              const goalId = goal._id;
              const isExpanded = expandedGoals[goalId];

              return (
                <div key={goalId} className={`eval-goal-card ${assessment.reviewed ? 'reviewed' : ''}`}>
                  {/* Goal header - always visible */}
                  <div className="eval-goal-header" onClick={() => toggleGoal(goalId)}>
                    <div className="eval-goal-header-left">
                      <span className="eval-goal-expand">{isExpanded ? '▾' : '▸'}</span>
                      <div>
                        <h4 className="eval-goal-title">{goal.title}</h4>
                        <div className="eval-goal-tags">
                          <span className="eval-tag eval-tag-weight">Weight: {goal.weight}%</span>
                          <span className="eval-tag eval-tag-target">Target: {goal.targetValue} {goal.metric}</span>
                          {goal.priority && <span className={`eval-tag eval-tag-priority eval-tag-${goal.priority}`}>{goal.priority}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="eval-goal-header-right">
                      <div className="eval-goal-achievement-preview" style={{ color: getAchievementColor(assessment.achievementPercent) }}>
                        {assessment.achievementPercent}%
                      </div>
                      <span className="eval-goal-status-icon">{getStatusIcon(assessment.goalStatus)}</span>
                      {assessment.reviewed && <span className="eval-reviewed-check">✓</span>}
                    </div>
                  </div>

                  {/* Expanded assessment form */}
                  {isExpanded && (
                    <div className="eval-goal-assessment">
                      {goal.description && (
                        <p className="eval-goal-description">{goal.description}</p>
                      )}

                      {/* Progress info from existing data */}
                      <div className="eval-goal-progress-info">
                        <div className="eval-progress-item">
                          <span className="eval-progress-label">Mid-Year Progress</span>
                          <div className="eval-progress-bar-container">
                            <div className="eval-progress-bar" style={{ width: `${goal.currentProgress || 0}%`, background: getAchievementColor(goal.currentProgress || 0) }}></div>
                          </div>
                          <span className="eval-progress-value">{goal.currentProgress || 0}%</span>
                        </div>
                        {goal.finalCompletion != null && (
                          <div className="eval-progress-item">
                            <span className="eval-progress-label">End-Year Completion</span>
                            <div className="eval-progress-bar-container">
                              <div className="eval-progress-bar" style={{ width: `${goal.finalCompletion}%`, background: getAchievementColor(goal.finalCompletion) }}></div>
                            </div>
                            <span className="eval-progress-value">{goal.finalCompletion}%</span>
                          </div>
                        )}
                      </div>

                      {/* Assessment inputs */}
                      <div className="eval-assessment-inputs">
                        <div className="eval-input-group">
                          <label className="eval-input-label">Achievement % <span className="required">*</span></label>
                          <div className="eval-slider-group">
                            <input
                              type="range"
                              min="0" max="100" step="1"
                              value={assessment.achievementPercent}
                              onChange={e => handleGoalAssessmentUpdate(goalId, 'achievementPercent', parseInt(e.target.value))}
                              disabled={!canEdit}
                              className="eval-slider"
                              style={{ '--slider-color': getAchievementColor(assessment.achievementPercent) }}
                            />
                            <input
                              type="number"
                              min="0" max="100"
                              value={assessment.achievementPercent}
                              onChange={e => handleGoalAssessmentUpdate(goalId, 'achievementPercent', parseInt(e.target.value) || 0)}
                              disabled={!canEdit}
                              className="eval-number-input"
                            />
                          </div>
                          {/* Achievement progress bar */}
                          <div className="eval-achievement-bar">
                            <div className="eval-achievement-fill" style={{
                              width: `${assessment.achievementPercent}%`,
                              background: `linear-gradient(90deg, ${getAchievementColor(0)}, ${getAchievementColor(assessment.achievementPercent)})`
                            }}></div>
                          </div>
                        </div>

                        <div className="eval-input-group">
                          <label className="eval-input-label">Goal Status</label>
                          <select
                            value={assessment.goalStatus}
                            onChange={e => handleGoalAssessmentUpdate(goalId, 'goalStatus', e.target.value)}
                            disabled={!canEdit}
                            className="eval-select"
                          >
                            <option value="not_started">⏸️ Not Started</option>
                            <option value="in_progress">🔄 In Progress</option>
                            <option value="completed">✅ Completed</option>
                            <option value="exceeded">🌟 Exceeded</option>
                          </select>
                        </div>

                        <div className="eval-input-group eval-input-full">
                          <label className="eval-input-label">Comments</label>
                          <textarea
                            value={assessment.comments}
                            onChange={e => handleGoalAssessmentUpdate(goalId, 'comments', e.target.value)}
                            disabled={!canEdit}
                            className="eval-textarea"
                            placeholder="Add your assessment comments for this goal..."
                            rows="3"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* ===== SCORING RUBRIC ===== */}
      <div className="eval-section">
        <div className="eval-section-header">
          <h2>📊 Final Score</h2>
        </div>

        <div className="eval-score-panel">
          {/* Rubric table */}
          <div className="eval-rubric-table">
            <h3 className="eval-rubric-title">Scoring Rubric (1-10 Scale)</h3>
            <div className="eval-rubric-bands">
              {rubric.map((band, idx) => {
                const isActive = liveBand && band.label === liveBand.label;
                return (
                  <div key={idx} className={`eval-rubric-band ${isActive ? 'eval-rubric-active' : ''}`}>
                    <div className="eval-rubric-score" style={{ backgroundColor: band.color }}>
                      {band.min}-{band.max}
                    </div>
                    <div className="eval-rubric-info">
                      <strong>{band.label}</strong>
                      <span className="eval-rubric-range">({band.range})</span>
                      <p className="eval-rubric-desc">{band.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Score display */}
          <div className="eval-score-display">
            {evaluation.suggestedScore != null && (
              <div className="eval-suggested-score">
                <span className="eval-score-label">Suggested Score</span>
                <span className="eval-score-value" style={{ color: getLiveBand(evaluation.suggestedScore)?.color || '#64748b' }}>
                  {evaluation.suggestedScore}
                </span>
                <span className="eval-score-band" style={{ backgroundColor: getLiveBand(evaluation.suggestedScore)?.color || '#64748b' }}>
                  {getLiveBand(evaluation.suggestedScore)?.label || 'N/A'}
                </span>
              </div>
            )}

            <div className="eval-final-score">
              <span className="eval-score-label">Final Score (Manual Override)</span>
              <input
                type="number"
                min="1" max="10" step="0.1"
                value={finalScoreInput}
                onChange={e => setFinalScoreInput(e.target.value)}
                disabled={!canEdit}
                className="eval-score-input"
                placeholder={evaluation.suggestedScore ? String(evaluation.suggestedScore) : '—'}
              />
              {liveBand && (
                <div className="eval-live-band" style={{ borderColor: liveBand.color, backgroundColor: liveBand.color + '15' }}>
                  <span className="eval-live-band-dot" style={{ backgroundColor: liveBand.color }}></span>
                  <span style={{ color: liveBand.color, fontWeight: 700 }}>{liveBand.label}</span>
                  <span className="eval-live-band-range">{liveBand.range}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ===== OVERALL COMMENTS ===== */}
      <div className="eval-section">
        <div className="eval-section-header">
          <h2>💬 Overall Feedback</h2>
        </div>

        <div className="eval-feedback-grid">
          <div className="eval-feedback-item eval-feedback-full">
            <label className="eval-feedback-label">Overall Comments</label>
            <textarea
              value={feedback.overallComments}
              onChange={e => setFeedback(f => ({ ...f, overallComments: e.target.value }))}
              disabled={!canEdit}
              className="eval-feedback-textarea"
              placeholder="Provide overall evaluation feedback..."
              rows="4"
            />
            <span className="eval-char-count">{feedback.overallComments.length} characters</span>
          </div>

          <div className="eval-feedback-item">
            <label className="eval-feedback-label">🌟 Strengths</label>
            <textarea
              value={feedback.strengths}
              onChange={e => setFeedback(f => ({ ...f, strengths: e.target.value }))}
              disabled={!canEdit}
              className="eval-feedback-textarea"
              placeholder="Key strengths demonstrated..."
              rows="3"
            />
          </div>

          <div className="eval-feedback-item">
            <label className="eval-feedback-label">📈 Areas for Improvement</label>
            <textarea
              value={feedback.areasForImprovement}
              onChange={e => setFeedback(f => ({ ...f, areasForImprovement: e.target.value }))}
              disabled={!canEdit}
              className="eval-feedback-textarea"
              placeholder="Areas where improvement is needed..."
              rows="3"
            />
          </div>

          <div className="eval-feedback-item">
            <label className="eval-feedback-label">🎓 Development Recommendations</label>
            <textarea
              value={feedback.developmentRecommendations}
              onChange={e => setFeedback(f => ({ ...f, developmentRecommendations: e.target.value }))}
              disabled={!canEdit}
              className="eval-feedback-textarea"
              placeholder="Training, mentoring, or development opportunities..."
              rows="3"
            />
          </div>

          <div className="eval-feedback-item">
            <label className="eval-feedback-label">🚀 Next Steps</label>
            <textarea
              value={feedback.nextSteps}
              onChange={e => setFeedback(f => ({ ...f, nextSteps: e.target.value }))}
              disabled={!canEdit}
              className="eval-feedback-textarea"
              placeholder="Action items and next steps..."
              rows="3"
            />
          </div>
        </div>
      </div>

      {/* ===== SIGNATURES & APPROVAL ===== */}
      <div className="eval-section">
        <div className="eval-section-header">
          <h2>✍️ Signatures & Approval</h2>
        </div>

        <div className="eval-approval-chain">
          {/* Evaluator */}
          <div className="eval-approval-step eval-approval-done">
            <div className="eval-approval-icon">👔</div>
            <div className="eval-approval-info">
              <strong>Evaluator</strong>
              <span>{evaluation.evaluatorId?.name}</span>
              {evaluation.submittedAt && <span className="eval-approval-date">Submitted: {new Date(evaluation.submittedAt).toLocaleDateString()}</span>}
            </div>
            <span className="eval-approval-check">{evaluation.submittedAt ? '✅' : '⏳'}</span>
          </div>

          {/* HR/Admin Approval */}
          {evaluation.approvals?.map((approval, idx) => (
            <div key={idx} className={`eval-approval-step ${approval.status === 'approved' ? 'eval-approval-done' : approval.status === 'rejected' ? 'eval-approval-rejected' : ''}`}>
              <div className="eval-approval-icon">⚖️</div>
              <div className="eval-approval-info">
                <strong>{approval.status === 'approved' ? 'Approved by' : 'Rejected by'}</strong>
                <span>{approval.approverId?.name || 'HR/Admin'}</span>
                {approval.date && <span className="eval-approval-date">{new Date(approval.date).toLocaleDateString()}</span>}
                {approval.comments && <span className="eval-approval-comments">"{approval.comments}"</span>}
              </div>
              <span className="eval-approval-check">{approval.status === 'approved' ? '✅' : '❌'}</span>
            </div>
          ))}

          {evaluation.status === 'submitted' && evaluation.approvals?.length === 0 && (
            <div className="eval-approval-step eval-approval-pending">
              <div className="eval-approval-icon">⚖️</div>
              <div className="eval-approval-info">
                <strong>Pending HR/Admin Approval</strong>
                <span>Awaiting review...</span>
              </div>
              <span className="eval-approval-check">⏳</span>
            </div>
          )}

          {/* Employee Acknowledgment */}
          <div className={`eval-approval-step ${evaluation.employeeAcknowledgment?.acknowledged ? 'eval-approval-done' : ''}`}>
            <div className="eval-approval-icon">👤</div>
            <div className="eval-approval-info">
              <strong>Employee Acknowledgment</strong>
              <span>{evaluation.employeeId?.name}</span>
              {evaluation.employeeAcknowledgment?.date && (
                <span className="eval-approval-date">Acknowledged: {new Date(evaluation.employeeAcknowledgment.date).toLocaleDateString()}</span>
              )}
            </div>
            <span className="eval-approval-check">{evaluation.employeeAcknowledgment?.acknowledged ? '✅' : '⏳'}</span>
          </div>
        </div>
      </div>

      {/* Score History */}
      {evaluation.scoreHistory?.length > 0 && (
        <div className="eval-section">
          <div className="eval-section-header">
            <h2>📜 Score History</h2>
          </div>
          <div className="eval-score-history">
            {evaluation.scoreHistory.map((entry, idx) => (
              <div key={idx} className="eval-history-entry">
                <span className="eval-history-date">{new Date(entry.changedAt).toLocaleString()}</span>
                <span className="eval-history-change">
                  {entry.previousScore != null ? entry.previousScore : '—'} → {entry.newScore}
                </span>
                <span className="eval-history-by">{entry.changedBy?.name || 'System'}</span>
                {entry.reason && <span className="eval-history-reason">"{entry.reason}"</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmSubmit}
        title="📤 Submit Evaluation"
        message={`Are you sure you want to submit this evaluation? Score: ${finalScoreInput || evaluation.suggestedScore || 'Not set'}. This will send it for HR approval.`}
        confirmLabel="Submit Evaluation"
        danger={false}
        onConfirm={handleSubmit}
        onCancel={() => setConfirmSubmit(false)}
      />
    </div>
  );
}

export default EvaluationScoringPage;
