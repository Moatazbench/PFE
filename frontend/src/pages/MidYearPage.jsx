import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { useAuth } from '../components/AuthContext';
import { useToast } from '../components/common/Toast';
import AIDraftModal from '../components/ai/AIDraftModal';
import AIGenerateButton from '../components/ai/AIGenerateButton';

function MidYearPage() {
  const { user } = useAuth();
  const toast = useToast();

  const [cycles, setCycles] = useState([]);
  const [selectedCycleId, setSelectedCycleId] = useState('');
  const [activeCycle, setActiveCycle] = useState(null);
  const [viewMode, setViewMode] = useState('self');
  const [myObjectives, setMyObjectives] = useState([]);
  const [teamObjectives, setTeamObjectives] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showAssessmentModal, setShowAssessmentModal] = useState(false);
  const [selectedObjective, setSelectedObjective] = useState(null);
  const [formData, setFormData] = useState({
    comment: '',
    progressPercentage: 0,
    status: 'on_track',
    blockers: '',
    supportRequired: '',
  });
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiDraft, setAiDraft] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');

  const midyearDraftFields = [
    { key: 'overall_summary', label: 'Overall Summary', placeholder: 'Summarize the current objective status and progress.' },
    { key: 'key_achievements', label: 'Key Achievements', placeholder: 'List the most important achievements so far.' },
    { key: 'blockers', label: 'Blockers', placeholder: 'Identify any obstacles affecting progress.' },
    { key: 'support_needed', label: 'Support Needed', placeholder: 'Describe help or resources needed to stay on track.' },
    { key: 'suggested_manager_talking_points', label: 'Suggested Manager Talking Points', placeholder: 'Offer suggested discussion points for the next review.' },
  ];

  const isManagerRole = ['TEAM_LEADER', 'ADMIN', 'HR'].includes(user?.role);

  useEffect(function () { fetchCycles(); }, []);
  useEffect(function () {
    if (selectedCycleId) fetchObjectives();
  }, [selectedCycleId]);

  async function fetchCycles() {
    try {
      const res = await api.get('/api/cycles');
      const data = res.data.filter(function (cycle) {
        return ['phase2', 'phase3', 'closed'].includes(cycle.currentPhase) && cycle.status !== 'draft';
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

  function openAssessmentForm(objective) {
    if (activeCycle?.currentPhase !== 'phase2') {
      toast.error('Assessments can only be submitted during Mid-Year Execution.');
      return;
    }

    setSelectedObjective(objective);
    setFormData({
      comment: viewMode === 'self' ? (objective.selfAssessment || '') : (objective.managerComments || ''),
      progressPercentage: viewMode === 'self'
        ? (objective.achievementPercent || 0)
        : (objective.managerAdjustedPercent ?? objective.achievementPercent ?? 0),
      status: 'on_track',
      blockers: '',
      supportRequired: '',
    });
    setAiDraft(null);
    setAiError('');
    setShowAssessmentModal(true);
  }

  function getObjectiveEmployeeId(objective) {
    return objective?.owner?._id || objective?.owner || user?._id;
  }

  async function fetchAiDraft() {
    if (!selectedObjective || !selectedCycleId) return;

    setAiError('');
    setAiLoading(true);

    try {
      const employeeId = getObjectiveEmployeeId(selectedObjective);
      const res = await api.post('/api/ai/review/midyear', {
        employeeId,
        cycleId: selectedCycleId,
        objectiveId: selectedObjective._id,
      });

      setAiDraft(res.data.review || null);
      setShowAiModal(true);
    } catch (err) {
      setAiError(err.response?.data?.message || 'Failed to generate AI summary');
    } finally {
      setAiLoading(false);
    }
  }

  function handleInsertAiDraft(draft) {
    const summaryParts = [];
    if (draft.overall_summary) summaryParts.push(draft.overall_summary);
    if (draft.key_achievements) summaryParts.push(draft.key_achievements);

    const insertionText = summaryParts.length > 0
      ? summaryParts.join('\n\n')
      : '';

    setFormData((prev) => ({
      ...prev,
      comment: prev.comment
        ? `${prev.comment}\n\n[AI draft]\n${insertionText}`
        : insertionText,
      blockers: prev.blockers || draft.blockers || '',
      supportRequired: prev.supportRequired || draft.support_needed || '',
    }));

    setShowAiModal(false);
    toast.success('AI draft inserted into the form. Please review before submitting.');
  }

  function handleRegenerateAiDraft() {
    return fetchAiDraft();
  }

  async function handleSubmitAssessment(e) {
    e.preventDefault();
    try {
      if (viewMode === 'self') {
        const commentParts = [formData.comment.trim()];
        if (formData.blockers.trim()) commentParts.push('Blockers: ' + formData.blockers.trim());
        if (formData.supportRequired.trim()) commentParts.push('Support Required: ' + formData.supportRequired.trim());

        await api.post('/api/objectives/' + selectedObjective._id + '/submit', {
          achievementPercent: formData.progressPercentage,
          selfAssessment: commentParts.join('\n'),
        });
      } else {
        await api.post('/api/objectives/' + selectedObjective._id + '/midyear-review', {
          progressPercentage: formData.progressPercentage,
          comment: formData.comment,
          status: formData.status,
          blockers: formData.blockers,
          supportRequired: formData.supportRequired,
        });
      }

      toast.success('Assessment submitted successfully');
      setShowAssessmentModal(false);
      setSelectedObjective(null);
      fetchObjectives();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit assessment');
    }
  }

  function getStatusBadge(status) {
    if (status === 'locked') return <span className="badge" style={{ background: '#1e293b', color: '#fff' }}>Locked</span>;
    if (status === 'evaluated') return <span className="badge" style={{ background: '#6366f1', color: '#fff' }}>Evaluated</span>;
    if (status === 'approved' || status === 'validated') return <span className="badge" style={{ background: '#22c55e', color: '#fff' }}>Ready for Check-in</span>;
    return <span className="badge" style={{ background: '#64748b', color: '#fff' }}>{status}</span>;
  }

  function renderReviewBox(title, reviewText, progressValue, accentColor, emptyText, backgroundColor, borderColor) {
    return (
      <div style={{ background: backgroundColor, padding: '1rem', borderRadius: '8px', border: '1px solid ' + borderColor }}>
        <h4 style={{ margin: '0 0 0.5rem 0', color: accentColor }}>{title}</h4>
        {reviewText ? (
          <>
            <div style={{ fontWeight: 'bold', fontSize: '1.1rem', color: accentColor, marginBottom: '0.5rem' }}>
              {progressValue}% Complete
            </div>
            <p style={{ fontSize: '0.9rem', margin: 0, whiteSpace: 'pre-wrap' }}>"{reviewText}"</p>
          </>
        ) : (
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>{emptyText}</p>
        )}
      </div>
    );
  }

  function renderObjectiveList(list) {
    if (list.length === 0) {
      return (
        <div style={{ textAlign: 'center', padding: '3rem', background: 'var(--bg-main)', borderRadius: '8px', border: '1px dashed var(--border-color)' }}>
          <span style={{ fontSize: '2rem' }}>📝</span>
          <h4>No Objectives Found</h4>
          <p className="text-muted">No approved objectives are available for mid-year assessment.</p>
        </div>
      );
    }

    return (
      <div style={{ display: 'grid', gap: '1rem' }}>
        {list.map(function (objective) {
          const isManagerView = viewMode === 'team';
          const selfSubmitted = !!objective.selfAssessment;
          const managerSubmitted = !!objective.managerComments;
          const currentSubmitted = isManagerView ? managerSubmitted : selfSubmitted;
          const displayProgress = objective.achievementPercent || 0;

          return (
            <div key={objective._id} className="card shadow-sm hover-lift" style={{ borderLeft: currentSubmitted ? '4px solid #8b5cf6' : '4px solid #eab308' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
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
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1rem' }}>
                    {objective.description || 'No description'}
                  </p>

                  <div style={{ display: 'flex', gap: '1rem', fontSize: '0.85rem', flexWrap: 'wrap' }}>
                    <span style={{ background: '#f1f5f9', padding: '0.25rem 0.6rem', borderRadius: '4px' }}>
                      Weight: <strong>{objective.weight}%</strong>
                    </span>
                    <span style={{ background: '#f1f5f9', padding: '0.25rem 0.6rem', borderRadius: '4px' }}>
                      Current Progress: <strong>{displayProgress}%</strong>
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1.5rem' }}>
                    {renderReviewBox(
                      'Employee Self-Assessment',
                      objective.selfAssessment,
                      objective.achievementPercent || 0,
                      '#166534',
                      'Not submitted yet.',
                      objective.selfAssessment ? '#f0fdf4' : '#f8fafc',
                      objective.selfAssessment ? '#bbf7d0' : '#e2e8f0'
                    )}
                    {renderReviewBox(
                      'Manager Assessment',
                      objective.managerComments,
                      objective.managerAdjustedPercent ?? objective.achievementPercent ?? 0,
                      '#854d0e',
                      'Not validated yet.',
                      objective.managerComments ? '#fefce8' : '#f8fafc',
                      objective.managerComments ? '#fef08a' : '#e2e8f0'
                    )}
                  </div>
                </div>

                <div style={{ marginLeft: '2rem', display: 'flex', flexDirection: 'column', justifyContent: 'center', minWidth: '160px', gap: '0.75rem' }}>
                  {activeCycle?.currentPhase === 'phase2' ? (
                    <button className="btn btn--primary" onClick={function () { openAssessmentForm(objective); }}>
                      {currentSubmitted ? (isManagerView ? 'Update Review' : 'Update Check-In') : (isManagerView ? 'Start Validation' : 'Start Check-In')}
                    </button>
                  ) : (
                    <button className="btn btn--outline" disabled style={{ opacity: 0.7 }}>
                      Read Only
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  if (loading && !selectedCycleId) {
    return <div className="page-loading"><div className="spinner"></div><p>Loading Mid-Year Execution...</p></div>;
  }

  return (
    <div className="page" style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '2.2rem', color: 'var(--text-dark)' }}>Mid-Year Execution</h1>
          <p className="text-muted" style={{ margin: '0.5rem 0 0 0' }}>Track progress and identify blockers halfway through the cycle.</p>
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
        <div className="empty-state">No Phase 2 cycles available.</div>
      ) : (
        <>
          {activeCycle.currentPhase !== 'phase2' && (
            <div className="alert alert--warning" style={{ marginBottom: '2rem', background: '#fffbeb', color: '#92400e', padding: '1rem', borderRadius: '8px', borderLeft: '4px solid #f59e0b' }}>
              <strong>Note:</strong> This cycle is currently in Phase: {activeCycle.currentPhase}. Assessments can only be submitted during Mid-Year Execution. You are viewing in read-only mode.
            </div>
          )}

          {isManagerRole && (
            <div style={{ display: 'flex', gap: '1rem', borderBottom: '2px solid var(--border-color)', paddingBottom: '1rem', marginBottom: '2rem' }}>
              <button
                onClick={function () { setViewMode('self'); }}
                style={{ background: 'none', border: 'none', fontSize: '1.1rem', fontWeight: viewMode === 'self' ? 'bold' : 'normal', color: viewMode === 'self' ? 'var(--primary)' : 'var(--text-muted)', cursor: 'pointer', paddingBottom: '0.5rem', borderBottom: viewMode === 'self' ? '3px solid var(--primary)' : '3px solid transparent' }}
              >
                My Self-Assessments
              </button>
              <button
                onClick={function () { setViewMode('team'); }}
                style={{ background: 'none', border: 'none', fontSize: '1.1rem', fontWeight: viewMode === 'team' ? 'bold' : 'normal', color: viewMode === 'team' ? 'var(--primary)' : 'var(--text-muted)', cursor: 'pointer', paddingBottom: '0.5rem', borderBottom: viewMode === 'team' ? '3px solid var(--primary)' : '3px solid transparent' }}
              >
                Team Assessments
              </button>
            </div>
          )}

          {renderObjectiveList(viewMode === 'self' ? myObjectives : teamObjectives)}
        </>
      )}

      {showAssessmentModal && (
        <>
          <div className="modal-overlay">
            <div className="modal form-card" style={{ maxWidth: '650px', width: '90%' }}>
              <div className="modal-header" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
                <h2 style={{ margin: 0 }}>{viewMode === 'self' ? 'Self Check-in' : 'Manager Validation'}</h2>
                <button onClick={function () { setShowAssessmentModal(false); }} className="close-btn" style={{ background: 'transparent', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>X</button>
              </div>

              <div style={{ background: '#f1f5f9', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem' }}>
                <div style={{ fontWeight: 'bold', marginBottom: '0.25rem', color: '#334155' }}>Objective:</div>
                <div style={{ fontSize: '1.1rem' }}>{selectedObjective?.title}</div>
              </div>

              <form onSubmit={handleSubmitAssessment}>
              <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1.5rem' }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem' }}>Current Progress (%) <span style={{ color: 'red' }}>*</span></label>
                  <input type="number" className="form-control" style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1' }} value={formData.progressPercentage} onChange={function (e) { setFormData({ ...formData, progressPercentage: parseInt(e.target.value, 10) || 0 }); }} min="0" max="100" required />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem' }}>Status Track</label>
                  <select className="form-control" style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1' }} value={formData.status} onChange={function (e) { setFormData({ ...formData, status: e.target.value }); }}>
                    <option value="on_track">On Track</option>
                    <option value="at_risk">At Risk</option>
                    <option value="off_track">Off Track</option>
                    <option value="completed">Early Completion</option>
                  </select>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', gap: '1rem', flexWrap: 'wrap' }}>
                  <label style={{ display: 'block', fontWeight: 'bold', margin: 0 }}>Progress Summary / Comments <span style={{ color: 'red' }}>*</span></label>
                  {activeCycle?.currentPhase === 'phase2' && selectedObjective && (
                    <AIGenerateButton
                      onClick={fetchAiDraft}
                      loading={aiLoading}
                      disabled={!selectedObjective}
                    />
                  )}
                </div>
                <textarea className="form-control" style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', minHeight: '100px', resize: 'vertical' }} value={formData.comment} onChange={function (e) { setFormData({ ...formData, comment: e.target.value }); }} required />
              </div>

              <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1.5rem' }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem' }}>Any Blockers?</label>
                  <input type="text" className="form-control" style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1' }} value={formData.blockers} onChange={function (e) { setFormData({ ...formData, blockers: e.target.value }); }} placeholder="e.g., waiting on IT access..." />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem' }}>Support Required?</label>
                  <input type="text" className="form-control" style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1' }} value={formData.supportRequired} onChange={function (e) { setFormData({ ...formData, supportRequired: e.target.value }); }} placeholder="e.g., budget approval..." />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }}>
                <button type="button" className="btn btn--secondary" onClick={function () { setShowAssessmentModal(false); }}>Cancel</button>
                <button type="submit" className="btn btn--primary" style={{ background: '#8b5cf6', borderColor: '#8b5cf6', padding: '0.75rem 2rem', fontWeight: 'bold' }}>Submit Assessment</button>
              </div>
            </form>
          </div>
        </div>
        </>
      )}

      <AIDraftModal
        open={showAiModal}
        title="AI Mid-Year Draft"
        description="This AI draft is based on the selected objective and cycle data. Review before inserting."
        fields={midyearDraftFields}
        draft={aiDraft}
        loading={aiLoading}
        error={aiError}
        onClose={function () { setShowAiModal(false); }}
        onInsert={handleInsertAiDraft}
        onRegenerate={handleRegenerateAiDraft}
      />
    </div>
  );
}

export default MidYearPage;
