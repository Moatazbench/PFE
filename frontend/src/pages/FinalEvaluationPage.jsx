import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { useAuth } from '../components/AuthContext';
import { useToast } from '../components/common/Toast';
import ConfirmDialog from '../components/common/ConfirmDialog';
import AIDraftModal from '../components/ai/AIDraftModal';
import AIGenerateButton from '../components/ai/AIGenerateButton';
import DevelopmentPlanGenerator from '../components/ai/DevelopmentPlanGenerator';

function FinalEvaluationPage() {
  const { user } = useAuth();
  const toast = useToast();

  const [cycles, setCycles] = useState([]);
  const [selectedCycleId, setSelectedCycleId] = useState('');
  const [activeCycle, setActiveCycle] = useState(null);
  const [viewMode, setViewMode] = useState('self');
  const [myObjectives, setMyObjectives] = useState([]);
  const [teamObjectives, setTeamObjectives] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showSelfModal, setShowSelfModal] = useState(false);
  const [showManagerModal, setShowManagerModal] = useState(false);
  const [selectedObjective, setSelectedObjective] = useState(null);
  const [confirmLockData, setConfirmLockData] = useState(null);
  const [formData, setFormData] = useState({
    comment: '',
    progressPercentage: 100,
    rating: 3,
    finalCompletion: 100,
    evidence: '',
  });

  const isManagerRole = ['TEAM_LEADER', 'ADMIN', 'HR'].includes(user?.role);

  const [showSelfAIDraft, setShowSelfAIDraft] = useState(false);
  const [showManagerAIDraft, setShowManagerAIDraft] = useState(false);
  const [aiDraft, setAiDraft] = useState(null);
  const [aiMode, setAiMode] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');

  const selfDraftFields = [
    { key: 'summary', label: 'Summary', placeholder: 'Summarize your final performance against this objective.' },
    { key: 'top_achievements', label: 'Top Achievements', placeholder: 'Highlight the most important outcomes achieved.' },
    { key: 'challenges', label: 'Challenges', placeholder: 'Describe the main obstacles you faced.' },
    { key: 'lessons_learned', label: 'Lessons Learned', placeholder: 'What did you learn from this objective?' },
    { key: 'next_growth_focus', label: 'Next Growth Focus', placeholder: 'Describe the next area for skill growth or focus.' },
  ];

  const managerDraftFields = [
    { key: 'performance_summary', label: 'Performance Summary', placeholder: 'Summarize the employee performance for this objective.' },
    { key: 'strengths', label: 'Strengths', placeholder: 'List the main strengths observed.' },
    { key: 'areas_for_improvement', label: 'Areas for Improvement', placeholder: 'Note where the employee can improve next.' },
    { key: 'recommended_rating_rationale', label: 'Recommended Rating Rationale', placeholder: 'Explain the recommended rating clearly and objectively.' },
    { key: 'development_actions', label: 'Development Actions', placeholder: 'Suggest next actions the employee should take.' },
  ];

  useEffect(function () { fetchCycles(); }, []);
  useEffect(function () {
    if (selectedCycleId) fetchObjectives();
  }, [selectedCycleId]);

  async function fetchCycles() {
    try {
      const res = await api.get('/api/cycles');
      const data = res.data.filter(function (cycle) {
        return ['phase3', 'closed'].includes(cycle.currentPhase) && cycle.status !== 'draft';
      });
      setCycles(data);
      if (data.length > 0) {
        setSelectedCycleId(data[0]._id);
        setActiveCycle(data[0]);
      } else {
        setLoading(false);
      }
    } catch (err) {
      toast.error('Failed to load cycles');
      setLoading(false);
    }
  }

  async function fetchObjectives() {
    setLoading(true);
    try {
      const cycle = cycles.find(function (item) { return item._id === selectedCycleId; });
      if (cycle) setActiveCycle(cycle);

      const myRes = await api.get('/api/objectives/user/' + user._id + '/cycle/' + selectedCycleId);
      const myList = []
        .concat(myRes.data.individualObjectives || [])
        .concat(myRes.data.teamObjectives || [])
        .filter(function (objective) {
          return ['approved', 'validated', 'evaluated', 'locked'].includes(objective.status);
        });
      setMyObjectives(myList);

      if (isManagerRole) {
        const teamRes = await api.get('/api/objectives', { params: { cycle: selectedCycleId } });
        const allObjectives = teamRes.data.objectives || [];
        const filteredTeam = allObjectives.filter(function (objective) {
          const ownerId = objective.owner?._id || objective.owner;
          return String(ownerId) !== String(user._id) && ['approved', 'validated', 'evaluated', 'locked'].includes(objective.status);
        });
        setTeamObjectives(filteredTeam);
      } else {
        setTeamObjectives([]);
      }
    } catch (err) {
      toast.error('Failed to load objectives');
    } finally {
      setLoading(false);
    }
  }

  function openSelfForm(objective) {
    if (activeCycle?.currentPhase !== 'phase3') {
      toast.error('Self-assessments can only be submitted during Phase 3.');
      return;
    }
    setSelectedObjective(objective);
    setFormData({
      comment: objective.finalSelfAssessment || '',
      progressPercentage: objective.finalSelfPercent ?? objective.achievementPercent ?? 100,
      rating: objective.finalSelfRating || 3,
      finalCompletion: objective.managerAdjustedPercent ?? objective.achievementPercent ?? 100,
      evidence: objective.evaluationEvidence || '',
    });
    setShowSelfModal(true);
  }

  function openManagerForm(objective) {
    if (activeCycle?.currentPhase !== 'phase3') {
      toast.error('Evaluations can only be submitted during Phase 3.');
      return;
    }
    setSelectedObjective(objective);
    setFormData({
      comment: objective.evaluationComment || '',
      progressPercentage: objective.finalSelfPercent ?? objective.achievementPercent ?? 100,
      rating: objective.evaluationNumericRating || 3,
      finalCompletion: objective.managerAdjustedPercent ?? objective.achievementPercent ?? 100,
      evidence: objective.evaluationEvidence || '',
    });
    setShowManagerModal(true);
  }

  async function handleSubmitSelf(e) {
    e.preventDefault();
    try {
      await api.post('/api/objectives/' + selectedObjective._id + '/final-self-assessment', {
        comment: formData.comment,
        progressPercentage: formData.progressPercentage,
        rating: formData.rating,
      });
      toast.success('Self-assessment submitted successfully');
      setShowSelfModal(false);
      setSelectedObjective(null);
      fetchObjectives();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit self-assessment');
    }
  }

  async function handleSubmitManager(e) {
    e.preventDefault();
    try {
      const finalCompletion = formData.finalCompletion;
      let evaluationRating = 'not_met';
      if (finalCompletion >= 100) evaluationRating = 'exceeded';
      else if (finalCompletion >= 75) evaluationRating = 'met';
      else if (finalCompletion >= 50) evaluationRating = 'partially_met';

      await api.post('/api/objectives/' + selectedObjective._id + '/evaluate', {
        evaluationRating: evaluationRating,
        evaluationComment: formData.comment,
        managerAdjustedPercent: finalCompletion,
        numericRating: formData.rating,
        evidence: formData.evidence,
      });
      toast.success('Evaluation submitted successfully');
      setShowManagerModal(false);
      setSelectedObjective(null);
      fetchObjectives();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit evaluation');
    }
  }

  function closeAIDraft() {
    setShowSelfAIDraft(false);
    setShowManagerAIDraft(false);
    setAiMode(null);
    setAiDraft(null);
    setAiError('');
    setAiLoading(false);
  }

  function formatAIDraftText(draft, mode) {
    if (!draft) return '';

    const lines = [];
    if (mode === 'final_self') {
      if (draft.summary) lines.push(`Summary:\n${draft.summary}`);
      if (draft.top_achievements) lines.push(`Top Achievements:\n${draft.top_achievements}`);
      if (draft.challenges) lines.push(`Challenges:\n${draft.challenges}`);
      if (draft.lessons_learned) lines.push(`Lessons Learned:\n${draft.lessons_learned}`);
      if (draft.next_growth_focus) lines.push(`Next Growth Focus:\n${draft.next_growth_focus}`);
    } else if (mode === 'manager_review') {
      if (draft.performance_summary) lines.push(`Performance Summary:\n${draft.performance_summary}`);
      if (draft.strengths) lines.push(`Strengths:\n${draft.strengths}`);
      if (draft.areas_for_improvement) lines.push(`Areas for Improvement:\n${draft.areas_for_improvement}`);
      if (draft.recommended_rating_rationale) lines.push(`Recommended Rating Rationale:\n${draft.recommended_rating_rationale}`);
      if (draft.development_actions) lines.push(`Development Actions:\n${draft.development_actions}`);
    }

    return lines.filter(Boolean).join('\n\n');
  }

  function handleInsertAiDraft(draft) {
    const draftText = formatAIDraftText(draft, aiMode);
    if (!draftText) {
      toast.error('No AI draft content was available to insert.');
      return;
    }

    setFormData(function (prev) {
      const existingComment = String(prev.comment || '').trim();
      return {
        ...prev,
        comment: existingComment ? `${existingComment}\n\n${draftText}` : draftText,
      };
    });

    closeAIDraft();
  }

  async function handleRegenerateAiDraft() {
    if (!aiMode) {
      return;
    }
    await fetchAiDraft(aiMode);
  }

  async function fetchAiDraft(mode) {
    if (!selectedObjective || !selectedCycleId) {
      setAiError('Please select an objective and a cycle before generating a draft.');
      return;
    }

    const employeeId = mode === 'final_self'
      ? user._id
      : selectedObjective.owner?._id || selectedObjective.owner;

    if (!employeeId) {
      setAiError('Unable to locate the employee for this draft.');
      return;
    }

    setAiError('');
    setAiLoading(true);
    setAiMode(mode);

    try {
      const endpoint = mode === 'final_self' ? '/api/ai/review/final-self' : '/api/ai/review/manager';
      const response = await api.post(endpoint, {
        employeeId,
        cycleId: selectedCycleId,
        objectiveId: selectedObjective._id,
      });

      setAiDraft(response.data.review || {});
      setShowSelfAIDraft(mode === 'final_self');
      setShowManagerAIDraft(mode === 'manager_review');
    } catch (err) {
      setAiError(err.response?.data?.message || 'AI draft generation failed. Please try again.');
    } finally {
      setAiLoading(false);
    }
  }

  async function handleLockObjectiveConfirm() {
    try {
      await api.post('/api/objectives/' + confirmLockData._id + '/lock', {});
      toast.success('Objective locked successfully');
      setConfirmLockData(null);
      fetchObjectives();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to lock objective');
      setConfirmLockData(null);
    }
  }

  function getStatusBadge(status) {
    if (status === 'locked') return <span className="badge" style={{ background: '#1e293b', color: '#fff' }}>Locked</span>;
    if (status === 'evaluated') return <span className="badge" style={{ background: '#6366f1', color: '#fff' }}>Evaluated</span>;
    return <span className="badge" style={{ background: '#64748b', color: '#fff' }}>Pending End-Year</span>;
  }

  function renderObjectiveList(list) {
    if (list.length === 0) {
      return (
        <div style={{ textAlign: 'center', padding: '3rem', background: 'var(--bg-main)', borderRadius: '8px', border: '1px dashed var(--border-color)' }}>
          <span style={{ fontSize: '2rem' }}>📝</span>
          <h4>No Objectives Found</h4>
          <p className="text-muted">No eligible objectives are available for end-year evaluation.</p>
        </div>
      );
    }

    return (
      <div style={{ display: 'grid', gap: '1.5rem' }}>
        {list.map(function (objective) {
          const isManagerView = viewMode === 'team';
          const selfReviewExists = !!objective.finalSelfAssessment;
          const managerReviewExists = !!objective.evaluationRating;
          const finalProgress = objective.managerAdjustedPercent ?? objective.finalSelfPercent ?? objective.achievementPercent ?? 0;

          return (
            <div key={objective._id} className="card shadow-sm" style={{ borderLeft: objective.status === 'locked' ? '4px solid #1e293b' : '4px solid #6366f1' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <div style={{ flex: 1 }}>
                  {isManagerView && (
                    <div style={{ fontWeight: 'bold', color: 'var(--primary)', marginBottom: '0.5rem' }}>
                      {objective.owner?.name || 'Unknown'}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                    <h3 style={{ margin: 0 }}>{objective.title}</h3>
                    {getStatusBadge(objective.status)}
                  </div>
                  <div style={{ display: 'flex', gap: '1rem', fontSize: '0.85rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                    <span style={{ background: '#f1f5f9', padding: '0.25rem 0.6rem', borderRadius: '4px' }}>Weight: <strong>{objective.weight}%</strong></span>
                    <span style={{ background: '#f1f5f9', padding: '0.25rem 0.6rem', borderRadius: '4px' }}>Mid-Year Progress: <strong>{objective.achievementPercent || 0}%</strong></span>
                    <span style={{ background: '#f1f5f9', padding: '0.25rem 0.6rem', borderRadius: '4px' }}>Final Completion: <strong>{finalProgress}%</strong></span>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', minWidth: '160px', alignItems: 'flex-end' }}>
                  {objective.status !== 'locked' && activeCycle?.currentPhase === 'phase3' && (
                    <>
                      {!isManagerView && (
                        <button className="btn btn--primary" onClick={function () { openSelfForm(objective); }}>
                          {selfReviewExists ? 'Update Self-Review' : 'Start Self-Review'}
                        </button>
                      )}

                      {isManagerView && (
                        <button className="btn btn--primary" style={{ background: '#4f46e5', borderColor: '#4f46e5' }} onClick={function () { openManagerForm(objective); }}>
                          {managerReviewExists ? 'Update Evaluation' : 'Evaluate Objective'}
                        </button>
                      )}

                      {isManagerView && managerReviewExists && (
                        <button className="btn btn--outline" style={{ color: '#1e293b', borderColor: '#1e293b' }} onClick={function () { setConfirmLockData(objective); }}>
                          Lock Objective
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px' }}>
                  <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-dark)' }}>Self-Assessment</h4>
                  {selfReviewExists ? (
                    <>
                      <div style={{ fontWeight: 'bold', fontSize: '1.1rem', color: '#3b82f6', marginBottom: '0.5rem' }}>
                        Claimed {objective.finalSelfPercent ?? 0}% | Rating: {objective.finalSelfRating || '-'} / 5
                      </div>
                      <p style={{ fontSize: '0.9rem', margin: 0, whiteSpace: 'pre-wrap' }}>"{objective.finalSelfAssessment}"</p>
                    </>
                  ) : <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>Not submitted.</p>}
                </div>

                <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px' }}>
                  <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-dark)' }}>Manager Evaluation</h4>
                  {managerReviewExists ? (
                    <>
                      <div style={{ fontWeight: 'bold', fontSize: '1.1rem', color: '#4f46e5', marginBottom: '0.5rem' }}>
                        Final {objective.managerAdjustedPercent ?? 0}% | Rating: {objective.evaluationNumericRating || '-'} / 5
                      </div>
                      <p style={{ fontSize: '0.9rem', margin: 0, whiteSpace: 'pre-wrap' }}>"{objective.evaluationComment}"</p>
                      {objective.evaluationEvidence && (
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                          Evidence: {objective.evaluationEvidence}
                        </p>
                      )}
                    </>
                  ) : <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>Not evaluated yet.</p>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  if (loading && !selectedCycleId) {
    return <div className="page-loading"><div className="spinner"></div><p>Loading End-Year phase...</p></div>;
  }

  return (
    <div className="page" style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '2.2rem', color: 'var(--text-dark)' }}>End-Year Evaluations</h1>
          <p className="text-muted" style={{ margin: '0.5rem 0 0 0' }}>Final performance measurement and scoring for Phase 3.</p>
        </div>
        <select
          value={selectedCycleId}
          onChange={function (e) {
            setSelectedCycleId(e.target.value);
            const cycle = cycles.find(function (item) { return item._id === e.target.value; });
            if (cycle) setActiveCycle(cycle);
          }}
          className="form-control hover-lift"
          style={{ padding: '0.75rem', borderRadius: '8px', minWidth: '200px', fontWeight: 'bold' }}
        >
          {cycles.map(function (cycle) {
            return <option key={cycle._id} value={cycle._id}>{cycle.name}</option>;
          })}
        </select>
      </div>

      {!activeCycle ? (
        <div className="empty-state">No Phase 3 cycles available.</div>
      ) : (
        <>
          {activeCycle.currentPhase !== 'phase3' && (
            <div className="alert alert--warning" style={{ marginBottom: '2rem', background: '#f8fafc', color: '#475569', padding: '1rem', borderRadius: '8px', borderLeft: '4px solid #64748b' }}>
              <strong>Note:</strong> This cycle is currently {activeCycle.currentPhase}. End-year evaluations can only be submitted during Phase 3.
            </div>
          )}

          {isManagerRole && (
            <div style={{ display: 'flex', gap: '1rem', borderBottom: '2px solid var(--border-color)', paddingBottom: '1rem', marginBottom: '2rem' }}>
              <button onClick={function () { setViewMode('self'); }} style={{ background: 'none', border: 'none', fontSize: '1.1rem', fontWeight: viewMode === 'self' ? 'bold' : 'normal', color: viewMode === 'self' ? 'var(--primary)' : 'var(--text-muted)', cursor: 'pointer', paddingBottom: '0.5rem', borderBottom: viewMode === 'self' ? '3px solid var(--primary)' : '3px solid transparent' }}>
                My End-Year Review
              </button>
              <button onClick={function () { setViewMode('team'); }} style={{ background: 'none', border: 'none', fontSize: '1.1rem', fontWeight: viewMode === 'team' ? 'bold' : 'normal', color: viewMode === 'team' ? 'var(--primary)' : 'var(--text-muted)', cursor: 'pointer', paddingBottom: '0.5rem', borderBottom: viewMode === 'team' ? '3px solid var(--primary)' : '3px solid transparent' }}>
                Team Evaluations
              </button>
            </div>
          )}

          {renderObjectiveList(viewMode === 'self' ? myObjectives : teamObjectives)}
        </>
      )}

      {showSelfModal && (
        <div className="modal-overlay">
          <div className="modal form-card" style={{ maxWidth: '600px', width: '90%' }}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
              <div>
                <h3>Final Self-Assessment</h3>
                <p style={{ margin: '0.5rem 0 0 0', color: '#475569', lineHeight: 1.4 }}>Use AI to generate a self-assessment draft and edit it before submitting.</p>
              </div>
              <button onClick={function () { setShowSelfModal(false); }} className="close-btn" style={{ background: 'transparent', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>X</button>
            </div>
            <form onSubmit={handleSubmitSelf}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginTop: '1rem', marginBottom: '1rem' }}>
                <div style={{ flex: 1 }} />
                <AIGenerateButton
                  onClick={function () { fetchAiDraft('final_self'); }}
                  loading={aiLoading && aiMode === 'final_self'}
                  disabled={!selectedObjective || activeCycle?.currentPhase !== 'phase3'}
                  label="Generate Self-Assessment Draft"
                />
              </div>
              <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1.5rem', marginTop: '1rem' }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem' }}>Final Claimed Progress (%) <span style={{ color: 'red' }}>*</span></label>
                  <input type="number" className="form-control" style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1' }} value={formData.progressPercentage} onChange={function (e) { setFormData({ ...formData, progressPercentage: parseInt(e.target.value, 10) || 0 }); }} min="0" max="100" required />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem' }}>Self Rating (1-5)</label>
                  <input type="number" className="form-control" style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1' }} value={formData.rating} onChange={function (e) { setFormData({ ...formData, rating: parseInt(e.target.value, 10) || 1 }); }} min="1" max="5" required />
                </div>
              </div>
              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem' }}>Achievements and Reflections <span style={{ color: 'red' }}>*</span></label>
                <textarea className="form-control" style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', minHeight: '120px' }} value={formData.comment} onChange={function (e) { setFormData({ ...formData, comment: e.target.value }); }} placeholder="Summarize what you achieved against this objective..." required />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                <button type="button" className="btn btn--secondary" onClick={function () { setShowSelfModal(false); }}>Cancel</button>
                <button type="submit" className="btn btn--primary" style={{ padding: '0.75rem 2rem' }}>Submit Self-Assessment</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showManagerModal && (
        <div className="modal-overlay">
          <div className="modal form-card" style={{ maxWidth: '600px', width: '90%' }}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
              <div>
                <h3>Manager Final Evaluation</h3>
                <p style={{ margin: '0.5rem 0 0 0', color: '#475569', lineHeight: 1.4 }}>Generate manager review guidance and refine it before adding it to your evaluation comments.</p>
              </div>
              <button onClick={function () { setShowManagerModal(false); }} className="close-btn" style={{ background: 'transparent', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>X</button>
            </div>
            <form onSubmit={handleSubmitManager}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginTop: '1rem', marginBottom: '1rem' }}>
                <div style={{ flex: 1 }} />
                <AIGenerateButton
                  onClick={function () { fetchAiDraft('manager_review'); }}
                  loading={aiLoading && aiMode === 'manager_review'}
                  disabled={!selectedObjective || activeCycle?.currentPhase !== 'phase3'}
                  label="Generate Manager Review Draft"
                />
              </div>
              <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1.5rem', marginTop: '1rem' }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem' }}>Validated Final Completion (%) <span style={{ color: 'red' }}>*</span></label>
                  <input type="number" className="form-control" style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1' }} value={formData.finalCompletion} onChange={function (e) { setFormData({ ...formData, finalCompletion: parseInt(e.target.value, 10) || 0 }); }} min="0" max="100" required />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem' }}>Manager Rating (1-5)</label>
                  <input type="number" className="form-control" style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1' }} value={formData.rating} onChange={function (e) { setFormData({ ...formData, rating: parseInt(e.target.value, 10) || 1 }); }} min="1" max="5" required />
                </div>
              </div>
              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem' }}>Evidence / Justification</label>
                <input type="text" className="form-control" style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1' }} value={formData.evidence} onChange={function (e) { setFormData({ ...formData, evidence: e.target.value }); }} placeholder="Links, deliverables, quick notes..." />
              </div>
              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem' }}>Final Evaluation Comments <span style={{ color: 'red' }}>*</span></label>
                <textarea className="form-control" style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', minHeight: '120px' }} value={formData.comment} onChange={function (e) { setFormData({ ...formData, comment: e.target.value }); }} placeholder="Provide final constructive feedback for this objective..." required />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                <button type="button" className="btn btn--secondary" onClick={function () { setShowManagerModal(false); }}>Cancel</button>
                <button type="submit" className="btn btn--primary" style={{ background: '#4f46e5', borderColor: '#4f46e5', padding: '0.75rem 2rem' }}>Submit Evaluation</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <AIDraftModal
        open={(aiMode === 'final_self' && showSelfAIDraft) || (aiMode === 'manager_review' && showManagerAIDraft)}
        title={aiMode === 'manager_review' ? 'AI Manager Review Draft' : 'AI Self-Assessment Draft'}
        description={aiMode === 'manager_review'
          ? 'Review and edit the AI manager review draft before inserting it as evaluation comments.'
          : 'Review and edit the AI self-assessment draft before inserting it into your final self-assessment form.'}
        fields={aiMode === 'manager_review' ? managerDraftFields : selfDraftFields}
        draft={aiDraft}
        loading={aiLoading}
        error={aiError}
        onClose={closeAIDraft}
        onInsert={handleInsertAiDraft}
        onRegenerate={handleRegenerateAiDraft}
      />

      <ConfirmDialog
        open={!!confirmLockData}
        title="Lock Objective"
        message="Are you sure you want to lock this objective? This freezes the final evaluation."
        confirmLabel="Lock Objective"
        danger={false}
        onConfirm={handleLockObjectiveConfirm}
        onCancel={function () { setConfirmLockData(null); }}
      />
      <DevelopmentPlanGenerator userId={user?._id} evaluationId={null} />
    </div>
  );
}

export default FinalEvaluationPage;
