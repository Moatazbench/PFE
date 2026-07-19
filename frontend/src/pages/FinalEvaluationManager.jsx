import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useToast } from '../components/common/Toast';
import { Pie } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip as ChartTooltip, Legend } from 'chart.js';

ChartJS.register(ArcElement, ChartTooltip, Legend);

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

function ratingForScore(score) {
  const value = Math.max(0, Math.min(100, Number(score) || 0));
  if (value >= 90) return 'exceptional';
  if (value >= 75) return 'strong';
  if (value >= 50) return 'meets_expectations';
  if (value >= 30) return 'needs_improvement';
  return 'unsatisfactory';
}

function evaluationRatingForPercent(percent) {
  const value = Number(percent) || 0;
  if (value >= 100) return 'exceeded';
  if (value >= 75) return 'met';
  if (value >= 40) return 'partially_met';
  return 'not_met';
}

function FinalEvaluationManager({ cycleId, activeCycle, reportEmployeeId = '' }) {
  const toast = useToast();
  const navigate = useNavigate();
  const canEditCycle = activeCycle?.currentPhase === 'phase3';

  const [evaluations, setEvaluations] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  const [groupFilter, setGroupFilter] = useState('all');
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [selectedEvaluation, setSelectedEvaluation] = useState(null);
  const [employeeObjectives, setEmployeeObjectives] = useState([]);
  const [objectiveAssessments, setObjectiveAssessments] = useState({});
  const [savingObjectiveId, setSavingObjectiveId] = useState('');
  const [careerRec, setCareerRec] = useState({ suggested_path: '', skills_to_develop: '' });

  const [formData, setFormData] = useState({
    manager_score: '',
    rating_label: 'meets_expectations',
    recommendation: 'no_action',
    strengths: '',
    weaknesses: '',
    improvement_suggestions: '',
    manager_comments: '',
    manager_adjustment_justification: ''
  });
  const [aiDraftLoading, setAiDraftLoading] = useState(false);
  const [generatingEvaluation, setGeneratingEvaluation] = useState(false);
  const [generationError, setGenerationError] = useState('');
  const [saving, setSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState([]);

  useEffect(() => {
    if (cycleId) fetchTeamData();
  }, [cycleId]);

  async function fetchTeamData() {
    setLoading(true);
    try {
      const res = await api.get(`/final-evaluations/team/${cycleId}`);
      const nextEvaluations = res.data.evaluations || [];
      const nextTeamMembers = res.data.teamMembers || [];
      setEvaluations(nextEvaluations);
      setTeamMembers(nextTeamMembers);
      if (reportEmployeeId) {
        const employee = nextTeamMembers.find((item) => String(item._id) === String(reportEmployeeId));
        if (!employee) {
          toast.error('This employee is not available in your report scope.');
        } else {
          const evaluation = nextEvaluations.find((item) => String(item.employee_id?._id || item.employee_id) === String(reportEmployeeId));
          if (evaluation) {
            await openEditor(employee, evaluation);
          } else {
            setSelectedEmployee(employee);
            setSelectedEvaluation(null);
            setEmployeeObjectives([]);
          }
        }
      }
    } catch {
      toast.error('Failed to load team evaluations');
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerateEvaluation(employee) {
    if (!employee || generatingEvaluation) return;
    setGenerationError('');
    try {
      setGeneratingEvaluation(true);
      const res = await api.post(`/final-evaluations/generate/${cycleId}/${employee._id}`);
      const generatedEvaluation = res.data?.evaluation;

      if (res.data?.aiGenerated) {
        toast.success(res.data?.message || 'AI-assisted evaluation draft generated successfully.');
      } else {
        toast.success(res.data?.message || 'Final report draft generated successfully.');
      }

      await fetchTeamData();

      if (generatedEvaluation && !reportEmployeeId) {
        await openEditor(employee, generatedEvaluation);
      }
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to generate evaluation';
      setGenerationError(message);
      toast.error(message);
    } finally {
      setGeneratingEvaluation(false);
    }
  }

  async function openEditor(employee, evaluation) {
    setSelectedEmployee(employee);
    setSelectedEvaluation(evaluation);
    setFormData({
      manager_score: evaluation.manager_score ?? evaluation.auto_score ?? '',
      rating_label: evaluation.rating_label || 'meets_expectations',
      recommendation: evaluation.recommendation || 'no_action',
      strengths: (evaluation.strengths || []).join('\n'),
      weaknesses: (evaluation.weaknesses || []).join('\n'),
      improvement_suggestions: (evaluation.improvement_suggestions || []).join('\n'),
      manager_comments: evaluation.manager_comments || '',
      manager_adjustment_justification: evaluation.manager_adjustment_justification || ''
    });

    try {
      const objRes = await api.get(`/objectives/user/${employee._id}/cycle/${cycleId}`);
      const list = [...(objRes.data.individualObjectives || []), ...(objRes.data.teamObjectives || [])]
        .filter((objective) => isEvaluationObjectiveStatus(objective.status));
      setEmployeeObjectives(list);
      setObjectiveAssessments(list.reduce((result, objective) => {
        result[objective._id] = {
          percent: objective.managerAdjustedPercent ?? objective.finalSelfPercent ?? objective.achievementPercent ?? 0,
          comment: objective.evaluationComment || objective.managerComments || ''
        };
        return result;
      }, {}));
    } catch {
      toast.error('Failed to load employee objectives');
    }

    setCareerRec({ suggested_path: '', skills_to_develop: '' });
  }

  async function handleConfirmObjective(objective) {
    const assessment = objectiveAssessments[objective._id] || {};
    const percent = Number(assessment.percent);
    if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
      toast.error('Manager-confirmed achievement must be between 0 and 100.');
      return;
    }

    try {
      setSavingObjectiveId(objective._id);
      const objectiveResponse = await api.post(`/objectives/${objective._id}/evaluate`, {
        evaluationRating: evaluationRatingForPercent(percent),
        evaluationComment: String(assessment.comment || '').trim(),
        managerAdjustedPercent: percent,
        evidence: 'Reviewed during end-year evaluation'
      });

      setEmployeeObjectives((current) => current.map((item) => (
        item._id === objective._id ? objectiveResponse.data.objective : item
      )));

      const previousAutoScore = Number(selectedEvaluation.auto_score || 0);
      const recalculateResponse = await api.post(`/final-evaluations/${selectedEvaluation._id}/recalculate`);
      const recalculated = recalculateResponse.data.evaluation;
      setSelectedEvaluation(recalculated);
      setFormData((current) => {
        const currentManagerScore = Number(current.manager_score);
        const followsSuggestedScore = !Number.isFinite(currentManagerScore) || Math.abs(currentManagerScore - previousAutoScore) < 0.01;
        const nextManagerScore = followsSuggestedScore ? recalculated.auto_score : current.manager_score;
        return {
          ...current,
          manager_score: String(nextManagerScore),
          rating_label: ratingForScore(nextManagerScore)
        };
      });
      toast.success('Objective achievement confirmed and suggested score recalculated.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to confirm objective achievement.');
    } finally {
      setSavingObjectiveId('');
    }
  }

  async function handleGenerateAIDraft() {
    if (!selectedEmployee || !selectedEvaluation) return;
    setAiDraftLoading(true);
    try {
      const res = await api.post('/ai/generate-evaluation', {
        employee_name: selectedEmployee.name,
        objectives: employeeObjectives.map(function (o) {
          return {
            title: o.title,
            weight: o.weight || 0,
            category: o.category || 'individual',
            employeeAchievement: o.finalSelfPercent ?? o.achievementPercent ?? 0,
            managerConfirmedAchievement: o.managerAdjustedPercent ?? null,
            achievementPercent: o.managerAdjustedPercent ?? o.finalSelfPercent ?? o.achievementPercent ?? 0,
            selfAssessment: o.finalSelfAssessment || '',
            managerComment: o.evaluationComment || '',
            status: o.status
          };
        }),
        existing_score: Number(formData.manager_score || selectedEvaluation.auto_score || 0),
        rating_label: ratingForScore(formData.manager_score || selectedEvaluation.auto_score)
      });
      const draft = res.data.draft;
      if (draft) {
        setFormData(function (prev) {
          return {
            ...prev,
            strengths: Array.isArray(draft.strengths) ? draft.strengths.join('\n') : (draft.strengths || ''),
            weaknesses: Array.isArray(draft.weaknesses) ? draft.weaknesses.join('\n') : (draft.weaknesses || ''),
            improvement_suggestions: Array.isArray(draft.improvement_suggestions) ? draft.improvement_suggestions.join('\n') : (draft.improvement_suggestions || ''),
            manager_comments: draft.manager_comments || prev.manager_comments,
          };
        });
        toast.success('AI draft generated! Review and adjust before saving.');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to generate AI draft');
    } finally {
      setAiDraftLoading(false);
    }
  }

  async function handleGenerateCareerRec() {
    try {
      const res = await api.post('/career/recommendations/generate', {
        employee_id: selectedEmployee._id,
        cycle_id: cycleId
      });

      if (res.data.success && res.data.recommendation) {
        setCareerRec({
          suggested_path: res.data.recommendation.suggested_path,
          skills_to_develop: (res.data.recommendation.skills_to_develop || []).join('\n')
        });
        toast.success('Career suggestions generated.');
      }
    } catch {
      toast.error('Failed to generate career suggestions');
    }
  }

  async function handleSave(submitToHR = false) {
    if (saving) return;
    setValidationErrors([]);
    setSaving(true);
    try {
      if (submitToHR) {
        const errors = [];
        const score = formData.manager_score === '' ? Number(selectedEvaluation.auto_score) : Number(formData.manager_score);
        const difference = Math.abs(score - Number(selectedEvaluation.auto_score || 0));
        const requiredObjectives = employeeObjectives.filter((objective) => {
          const ownerId = objective.owner?._id || objective.owner;
          return String(ownerId) === String(selectedEmployee?._id);
        });

        if (!String(formData.manager_comments || '').trim()) errors.push('Add final manager comments.');
        if (!String(formData.strengths || '').trim()) errors.push('Add at least one strength.');
        if (!String(formData.weaknesses || '').trim()) errors.push('Add at least one area for improvement.');
        if (difference >= 10 && !String(formData.manager_adjustment_justification || '').trim()) {
          errors.push('Explain the manager score adjustment of 10 points or more.');
        }
        requiredObjectives.forEach((objective) => {
          if (!objective.finalSelfSubmittedAt) errors.push(`${objective.title}: employee self-assessment is missing.`);
          if (objective.managerAdjustedPercent == null) errors.push(`${objective.title}: manager achievement confirmation is missing.`);
        });
        if (errors.length) {
          setValidationErrors(errors);
          toast.error('Complete the highlighted report requirements before HR submission.');
          return;
        }
      }

      const payload = {
        manager_score: formData.manager_score === '' ? selectedEvaluation.auto_score : Number(formData.manager_score),
        manager_adjustment_justification: formData.manager_adjustment_justification,
        strengths: formData.strengths.split('\n').map((item) => item.trim()).filter(Boolean),
        weaknesses: formData.weaknesses.split('\n').map((item) => item.trim()).filter(Boolean),
        improvement_suggestions: formData.improvement_suggestions.split('\n').map((item) => item.trim()).filter(Boolean),
        manager_comments: formData.manager_comments,
        recommendation: formData.recommendation,
        status: submitToHR ? 'pending_hr' : 'draft'
      };

      const evaluationResponse = await api.put(`/final-evaluations/${selectedEvaluation._id}`, payload);
      const updatedEvaluation = evaluationResponse.data?.evaluation;

      if (submitToHR && updatedEvaluation?.status !== 'pending_hr') {
        throw new Error('The backend did not confirm HR submission.');
      }

      if (careerRec.suggested_path) {
        try {
          await api.post('/career/recommendations', {
            employee_id: selectedEmployee._id,
            cycle_id: cycleId,
            suggested_path: careerRec.suggested_path,
            skills_to_develop: careerRec.skills_to_develop.split('\n').map((item) => item.trim()).filter(Boolean),
            basis: 'Manager assessment'
          });
        } catch (careerErr) {
          if (!submitToHR) throw careerErr;
          toast.error(careerErr.response?.data?.message || 'Evaluation submitted, but career recommendation could not be saved.');
        }
      }

      setSelectedEvaluation(updatedEvaluation || selectedEvaluation);
      toast.success(submitToHR ? 'Evaluation submitted to HR.' : 'Draft saved successfully.');
      if (!reportEmployeeId) setSelectedEmployee(null);
      await fetchTeamData();
    } catch (err) {
      const backendErrors = (err.response?.data?.errors || []).map((item) => item.message).filter(Boolean);
      setValidationErrors(backendErrors);
      toast.error(err.response?.data?.message || err.message || 'Failed to save evaluation');
    } finally {
      setSaving(false);
    }
  }

  async function handleExportPDF() {
    if (!selectedEvaluation) return;
    try {
      const res = await api.get(`/final-evaluations/export/${selectedEvaluation._id}`, {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${selectedEmployee.name.replace(/\s+/g, '_')}_Evaluation.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch {
      toast.error('Failed to export PDF');
    }
  }

  async function handleDownloadAttachment(attachment) {
    try {
      const response = await fetch(attachment.url);
      if (!response.ok) throw new Error('Download failed');
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = attachment.name || 'attachment';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch {
      toast.error('Failed to download attachment');
    }
  }

  const renderRatingLabel = (label) => (label || '').replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

  const getStatusBadge = (status) => {
    switch (status) {
      case 'draft': return <span className="badge" style={{ background: '#94a3b8', color: '#fff' }}>Draft</span>;
      case 'pending_hr': return <span className="badge" style={{ background: '#eab308', color: '#fff' }}>Pending HR</span>;
      case 'validated': return <span className="badge" style={{ background: '#22c55e', color: '#fff' }}>Validated</span>;
      case 'closed': return <span className="badge" style={{ background: '#1e293b', color: '#fff' }}>Closed</span>;
      default: return <span className="badge" style={{ background: '#94a3b8', color: '#fff' }}>Not Started</span>;
    }
  };

  const processedTeam = useMemo(() => {
    let list = teamMembers.map((employee) => {
      const evaluation = evaluations.find((item) => String(item.employee_id?._id || item.employee_id) === String(employee._id));
      return {
        employee,
        evaluation,
        score: evaluation?.final_score || 0,
        recommendation: evaluation?.recommendation || 'no_action'
      };
    });

    list.sort((a, b) => b.score - a.score);

    if (groupFilter === 'high') list = list.filter((item) => item.score > 80);
    if (groupFilter === 'average') list = list.filter((item) => item.score >= 50 && item.score <= 80);
    if (groupFilter === 'needs_improvement') list = list.filter((item) => item.score > 0 && item.score < 50);

    return list;
  }, [teamMembers, evaluations, groupFilter]);

  const teamSummary = useMemo(() => {
    const completed = evaluations.filter((item) => ['draft', 'pending_hr', 'validated', 'closed'].includes(item.status)).length;
    const scored = evaluations.filter((item) => typeof item.final_score === 'number');
    const averageScore = scored.length > 0
      ? (scored.reduce((sum, item) => sum + (item.final_score || 0), 0) / scored.length).toFixed(1)
      : '0.0';
    const highPerformers = processedTeam.filter((item) => item.score > 80).length;
    const needsAttention = processedTeam.filter((item) => item.score > 0 && item.score < 50).length;
    const promotions = evaluations.filter((item) => item.recommendation === 'promotion').length;
    const warnings = evaluations.filter((item) => item.recommendation === 'performance_improvement_plan').length;

    return {
      totalPeople: teamMembers.length,
      completed,
      averageScore,
      highPerformers,
      needsAttention,
      promotions,
      warnings
    };
  }, [evaluations, processedTeam, teamMembers.length]);

  const teamDecisionGroups = useMemo(() => ([
    {
      label: 'Strong Performers',
      description: 'Employees with strong scores and positive action signals.',
      items: processedTeam.filter((item) => item.score > 80 || item.recommendation === 'promotion')
    },
    {
      label: 'Steady / Average',
      description: 'Employees delivering expected outcomes without major intervention flags.',
      items: processedTeam.filter((item) => item.score >= 50 && item.score <= 80 && item.recommendation === 'no_action')
    },
    {
      label: 'Needs Manager Attention',
      description: 'Employees with low scores or improvement-plan signals.',
      items: processedTeam.filter((item) => item.score < 50 || item.recommendation === 'performance_improvement_plan')
    }
  ]), [processedTeam]);

  if (loading) {
    return <div className="page-loading"><div className="spinner"></div><p>Loading team data...</p></div>;
  }

  if (!selectedEmployee) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
          <div className="card shadow-sm" style={{ padding: '1.2rem' }}>
            <div className="text-muted" style={{ fontSize: '0.8rem', textTransform: 'uppercase', fontWeight: 700 }}>Team Size</div>
            <div style={{ fontSize: '1.9rem', fontWeight: 800 }}>{teamSummary.totalPeople}</div>
          </div>
          <div className="card shadow-sm" style={{ padding: '1.2rem' }}>
            <div className="text-muted" style={{ fontSize: '0.8rem', textTransform: 'uppercase', fontWeight: 700 }}>Average Final Score</div>
            <div style={{ fontSize: '1.9rem', fontWeight: 800, color: 'var(--primary)' }}>{teamSummary.averageScore}%</div>
          </div>
          <div className="card shadow-sm" style={{ padding: '1.2rem' }}>
            <div className="text-muted" style={{ fontSize: '0.8rem', textTransform: 'uppercase', fontWeight: 700 }}>High Performers</div>
            <div style={{ fontSize: '1.9rem', fontWeight: 800, color: '#16a34a' }}>{teamSummary.highPerformers}</div>
          </div>
          <div className="card shadow-sm" style={{ padding: '1.2rem' }}>
            <div className="text-muted" style={{ fontSize: '0.8rem', textTransform: 'uppercase', fontWeight: 700 }}>Needs Attention</div>
            <div style={{ fontSize: '1.9rem', fontWeight: 800, color: '#dc2626' }}>{teamSummary.needsAttention}</div>
          </div>
          <div className="card shadow-sm" style={{ padding: '1.2rem' }}>
            <div className="text-muted" style={{ fontSize: '0.8rem', textTransform: 'uppercase', fontWeight: 700 }}>Promotion Signals</div>
            <div style={{ fontSize: '1.9rem', fontWeight: 800, color: '#15803d' }}>{teamSummary.promotions}</div>
          </div>
          <div className="card shadow-sm" style={{ padding: '1.2rem' }}>
            <div className="text-muted" style={{ fontSize: '0.8rem', textTransform: 'uppercase', fontWeight: 700 }}>Warning Signals</div>
            <div style={{ fontSize: '1.9rem', fontWeight: 800, color: '#b91c1c' }}>{teamSummary.warnings}</div>
          </div>
        </div>

        <div className="card shadow-sm" style={{ padding: '1.25rem' }}>
          <h3 style={{ margin: '0 0 1rem 0' }}>Decision Support Dashboard</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
            {teamDecisionGroups.map((group) => (
              <div key={group.label} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '1rem' }}>
                <div style={{ fontWeight: 700, marginBottom: '0.25rem' }}>{group.label}</div>
                <div className="text-muted" style={{ fontSize: '0.88rem', marginBottom: '0.75rem' }}>{group.description}</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--primary)' }}>{group.items.length}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.5rem', background: 'var(--shell-bg-inset)', padding: '0.75rem', borderRadius: '8px', flexWrap: 'wrap' }}>
          <button className={`btn btn--${groupFilter === 'all' ? 'primary' : 'outline'}`} onClick={() => setGroupFilter('all')}>All Team</button>
          <button className={`btn btn--${groupFilter === 'high' ? 'primary' : 'outline'}`} onClick={() => setGroupFilter('high')}>High Performers (&gt;80)</button>
          <button className={`btn btn--${groupFilter === 'average' ? 'primary' : 'outline'}`} onClick={() => setGroupFilter('average')}>Average (50-80)</button>
          <button className={`btn btn--${groupFilter === 'needs_improvement' ? 'primary' : 'outline'}`} onClick={() => setGroupFilter('needs_improvement')}>Needs Improvement (&lt;50)</button>
        </div>

        <div className="card shadow-sm" style={{ padding: '1.25rem' }}>
          <h3 style={{ margin: '0 0 1rem 0' }}>Team Performance Summary</h3>
          <div style={{ display: 'grid', gap: '1rem' }}>
            {processedTeam.map(({ employee, evaluation }, index) => (
              <div key={employee._id} className="hover-lift" style={{ borderLeft: evaluation?.status === 'validated' ? '4px solid #22c55e' : '4px solid #6366f1', background: '#fff', borderRadius: '10px', padding: '1rem 1.25rem', borderTop: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                  <div>
                    <h3 style={{ margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>#{index + 1}</span>
                      {employee.name}
                      {evaluation?.recommendation === 'promotion' && <span title="Promotion signal">[PROMOTE]</span>}
                      {evaluation?.recommendation === 'performance_improvement_plan' && <span title="Warning signal">[PIP]</span>}
                    </h3>
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                      {getStatusBadge(evaluation?.status)}
                      {evaluation ? (
                        <span className="text-muted" style={{ fontSize: '0.9rem' }}>
                          Auto: <strong>{evaluation.auto_score?.toFixed(1)}%</strong> | Manager: <strong>{evaluation.manager_score ?? '-'}</strong> | Final: <strong style={{ color: 'var(--primary)' }}>{evaluation.final_score?.toFixed(1)}%</strong> | {renderRatingLabel(evaluation.rating_label)}
                        </span>
                      ) : (
                        <span className="text-muted" style={{ fontSize: '0.9rem' }}>No final evaluation drafted yet.</span>
                      )}
                    </div>
                  </div>

                  <div>
                    {!evaluation ? (
                      <button className="btn btn--primary" onClick={() => navigate(`/final-evaluations/${cycleId}/${employee._id}/report`)}>Prepare Final Report</button>
                    ) : (
                      <button className="btn btn--outline" onClick={() => navigate(`/final-evaluations/${cycleId}/${employee._id}/report`)}>
                        Open Report
                      </button>
                    )}
                  </div>
                </div>
                {evaluation?.recommendation && evaluation.recommendation !== 'no_action' && (
                  <div style={{ marginTop: '0.9rem', background: '#f8fafc', borderRadius: '8px', padding: '0.75rem', border: '1px solid #e2e8f0', fontSize: '0.9rem' }}>
                    Decision signal: <strong>{renderRatingLabel(evaluation.recommendation)}</strong>
                  </div>
                )}
              </div>
            ))}
            {processedTeam.length === 0 && <p className="text-muted">No team members found in this category.</p>}
          </div>
        </div>
      </div>
    );
  }

  if (!selectedEvaluation) {
    return (
      <div className="card shadow-sm" style={{ padding: '2rem', animation: 'reportReveal 260ms ease-out' }}>
        <button className="btn btn--secondary" onClick={() => navigate('/final-evaluations')} style={{ marginBottom: '1.5rem' }}>
          Back to Team List
        </button>
        <div style={{ maxWidth: '760px' }}>
          <div className="badge" style={{ background: '#eef2ff', color: '#4338ca', marginBottom: '1rem' }}>Report workspace</div>
          <h2 style={{ margin: '0 0 0.65rem' }}>No final report generated yet.</h2>
          <p className="text-muted" style={{ lineHeight: 1.65 }}>
            Review the evaluation data, then generate an AI-assisted draft report.
          </p>
          <div style={{ margin: '1.25rem 0', padding: '1rem', borderRadius: '8px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
            <div style={{ fontWeight: 700, marginBottom: '0.35rem' }}>Prepared report page for {selectedEmployee.name}</div>
            <div className="text-muted" style={{ lineHeight: 1.55 }}>
              The draft will use objectives, task evidence, check-ins, self-assessment details, and the built-in fallback summary if the AI provider is unavailable.
            </div>
          </div>
          {!canEditCycle && (
            <div className="alert alert--warning">Report generation is only available during Phase 3.</div>
          )}
          {generationError && (
            <div className="alert alert--danger" role="alert" style={{ marginBottom: '1rem' }}>
              {generationError}
            </div>
          )}
          <button
            className="btn btn--primary"
            onClick={() => handleGenerateEvaluation(selectedEmployee)}
            disabled={!canEditCycle || generatingEvaluation}
          >
            {generatingEvaluation ? 'Generating report...' : 'Generate AI-Assisted Report'}
          </button>
        </div>
      </div>
    );
  }

  const readOnly = ['pending_hr', 'validated', 'closed'].includes(selectedEvaluation.status) || !canEditCycle;
  const displayedManagerScore = formData.manager_score === '' ? selectedEvaluation.auto_score : Number(formData.manager_score);
  const scoreDifference = Number((displayedManagerScore - Number(selectedEvaluation.auto_score || 0)).toFixed(1));
  const requiresAdjustmentJustification = Math.abs(scoreDifference) >= 10;

  let completedObjs = 0;
  let partialObjs = 0;
  let failedObjs = 0;
  employeeObjectives.forEach((objective) => {
    if ((objective.achievementPercent || 0) >= 90) completedObjs += 1;
    else if ((objective.achievementPercent || 0) >= 50) partialObjs += 1;
    else failedObjs += 1;
  });

  const completionChartData = {
    labels: ['Completed (>=90%)', 'Partial (50-89%)', 'Failed (<50%)'],
    datasets: [{
      data: [completedObjs, partialObjs, failedObjs],
      backgroundColor: ['#22c55e', '#eab308', '#ef4444'],
      borderWidth: 0
    }]
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button className="btn btn--secondary" onClick={() => reportEmployeeId ? navigate('/final-evaluations') : setSelectedEmployee(null)}>Back to Team List</button>
        </div>
        <button className="btn btn--outline" onClick={handleExportPDF}>Export Final Evaluation PDF</button>
      </div>

      {!canEditCycle && (
        <div className="alert alert--warning" style={{ marginBottom: '1.5rem', background: '#f8fafc', color: '#475569', padding: '1rem', borderRadius: '8px', borderLeft: '4px solid #64748b' }}>
          <strong>Note:</strong> This cycle is {activeCycle?.currentPhase || 'not in Phase 3'}. Evaluation data is view-only.
        </div>
      )}

      {selectedEvaluation.status === 'pending_hr' && (
        <div
          className="alert alert--success"
          role="status"
          style={{ marginBottom: '1.5rem', padding: '1rem 1.25rem', borderRadius: '10px', background: '#ecfdf5', color: '#166534', border: '1px solid #86efac' }}
        >
          <strong>Submitted to HR successfully.</strong>
          <div style={{ marginTop: '0.3rem' }}>This final-year report is locked while it awaits HR validation.</div>
        </div>
      )}
      {selectedEvaluation.status === 'draft' && selectedEvaluation.hr_return_reason && (
        <div className="alert alert--danger" role="alert" style={{ marginBottom: '1.5rem' }}>
          <strong>HR returned this report for revision.</strong>
          <div style={{ marginTop: '0.35rem', whiteSpace: 'pre-wrap' }}>{selectedEvaluation.hr_return_reason}</div>
        </div>
      )}

      <div style={{ background: '#fff', padding: '2rem', borderRadius: '8px', border: '1px solid var(--shell-border)' }}>
        <h2 style={{ margin: '0 0 1.5rem 0', color: 'var(--text-dark)', borderBottom: '2px solid var(--primary)', paddingBottom: '0.5rem' }}>
          Final Evaluation: {selectedEmployee.name}
        </h2>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
          <div>
            <h4 style={{ margin: '0 0 1rem 0' }}>Scoring System</h4>
            <div style={{ display: 'flex', gap: '2rem', background: '#f8fafc', padding: '1.5rem', borderRadius: '8px', flexWrap: 'wrap' }}>
              <div>
                <div className="text-muted" style={{ fontSize: '0.85rem' }}>Weighted Suggested Score</div>
                <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--primary)' }}>{selectedEvaluation.auto_score?.toFixed(1)}%</div>
                <div className="text-muted" style={{ fontSize: '0.78rem' }}>
                  {selectedEvaluation.objective_weight_total ?? 0}% objective weight
                  {selectedEvaluation.objective_score_normalized ? ' (normalized)' : ''}
                </div>
              </div>
              <div>
                <div className="text-muted" style={{ fontSize: '0.85rem' }}>Final Score</div>
                <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#0284c7' }}>{selectedEvaluation.final_score?.toFixed(1)}%</div>
              </div>
              <div>
                <div className="text-muted" style={{ fontSize: '0.85rem' }}>Current Rating</div>
                <div style={{ fontSize: '1.2rem', marginTop: '0.5rem', fontWeight: 'bold' }}>{renderRatingLabel(selectedEvaluation.rating_label || 'Calculated')}</div>
              </div>
            </div>
          </div>
          <div>
            <h4 style={{ margin: '0 0 1rem 0' }}>Goal Completion Analysis</h4>
            <div style={{ width: '100%', minWidth: '200px', height: '140px', minHeight: '140px', display: 'flex', justifyContent: 'center' }}>
              <Pie data={completionChartData} options={{ maintainAspectRatio: false, plugins: { legend: { position: 'right' } } }} />
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
          <div className="card shadow-sm" style={{ padding: '1rem' }}>
            <div className="text-muted" style={{ fontSize: '0.78rem', textTransform: 'uppercase', fontWeight: 700 }}>Completed Objectives</div>
            <div style={{ fontSize: '1.7rem', fontWeight: 800, color: '#16a34a' }}>{completedObjs}</div>
          </div>
          <div className="card shadow-sm" style={{ padding: '1rem' }}>
            <div className="text-muted" style={{ fontSize: '0.78rem', textTransform: 'uppercase', fontWeight: 700 }}>Partially Met</div>
            <div style={{ fontSize: '1.7rem', fontWeight: 800, color: '#d97706' }}>{partialObjs}</div>
          </div>
          <div className="card shadow-sm" style={{ padding: '1rem' }}>
            <div className="text-muted" style={{ fontSize: '0.78rem', textTransform: 'uppercase', fontWeight: 700 }}>Failed / Low Completion</div>
            <div style={{ fontSize: '1.7rem', fontWeight: 800, color: '#dc2626' }}>{failedObjs}</div>
          </div>
          <div className="card shadow-sm" style={{ padding: '1rem' }}>
            <div className="text-muted" style={{ fontSize: '0.78rem', textTransform: 'uppercase', fontWeight: 700 }}>Cycle Phase</div>
            <div style={{ fontSize: '1.05rem', fontWeight: 800 }}>{activeCycle?.currentPhase || 'phase3'}</div>
          </div>
        </div>

        {employeeObjectives.length > 0 && (
          <div className="card shadow-sm" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
            <h4 style={{ margin: '0 0 1rem 0' }}>Employee Self-Assessment Details</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {employeeObjectives.map((obj) => {
                const objectiveAttachments = getFinalObjectiveAttachments(obj);

                return (
                  <div key={obj._id} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <span style={{ fontWeight: 700 }}>{obj.title}</span>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        Weight: {obj.weight}% | Progress: {obj.finalSelfPercent ?? obj.achievementPercent ?? 0}%
                        {obj.finalSelfRating ? ` | Self-Rating: ${obj.finalSelfRating}/5` : ''}
                      </span>
                    </div>
                    {obj.finalSelfAssessment && (
                      <p style={{ margin: '0.25rem 0 0.5rem 0', fontSize: '0.9rem', color: 'var(--text-dark)', lineHeight: '1.5', fontStyle: 'italic' }}>
                        "{obj.finalSelfAssessment}"
                      </p>
                    )}
                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(150px, 0.5fr) minmax(240px, 1.5fr) auto', gap: '0.75rem', alignItems: 'end', marginTop: '1rem' }}>
                      <div>
                        <label className="ent-label">Manager-confirmed achievement</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          className="ent-input"
                          value={objectiveAssessments[obj._id]?.percent ?? 0}
                          disabled={readOnly || savingObjectiveId === obj._id}
                          onChange={(event) => setObjectiveAssessments((current) => ({
                            ...current,
                            [obj._id]: { ...current[obj._id], percent: event.target.value }
                          }))}
                        />
                      </div>
                      <div>
                        <label className="ent-label">Manager objective comment</label>
                        <input
                          type="text"
                          className="ent-input"
                          value={objectiveAssessments[obj._id]?.comment ?? ''}
                          disabled={readOnly || savingObjectiveId === obj._id}
                          placeholder="Explain the confirmed achievement using the available evidence."
                          onChange={(event) => setObjectiveAssessments((current) => ({
                            ...current,
                            [obj._id]: { ...current[obj._id], comment: event.target.value }
                          }))}
                        />
                      </div>
                      {!readOnly && (
                        <button
                          type="button"
                          className="btn btn--secondary"
                          disabled={savingObjectiveId === obj._id}
                          onClick={() => handleConfirmObjective(obj)}
                        >
                          {savingObjectiveId === obj._id ? 'Saving...' : 'Confirm'}
                        </button>
                      )}
                    </div>
                    {objectiveAttachments.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
                        {objectiveAttachments.map((attachment, index) => (
                          <div key={`${attachment.url || attachment.name || 'attachment'}-${index}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', background: '#fff', border: '1px solid #dbe4ef', borderRadius: '8px', padding: '0.6rem 0.75rem', flexWrap: 'wrap' }}>
                            <a href={attachment.url} target="_blank" rel="noreferrer" style={{ color: '#1d4ed8', fontWeight: 600, textDecoration: 'underline', fontSize: '0.88rem', wordBreak: 'break-word' }}>
                              {attachment.name || `View Attachment ${index + 1}`}
                            </a>
                            <button type="button" onClick={() => handleDownloadAttachment(attachment)} style={{ background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: '6px', padding: '0.3rem 0.6rem', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}>
                              Download
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    {!obj.finalSelfSubmittedAt && (
                      <div className="text-muted" style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>Self-assessment not submitted yet.</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <form id="evalForm">
          {!readOnly && (
            <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={handleGenerateAIDraft}
                disabled={aiDraftLoading}
                style={{
                  background: aiDraftLoading ? '#94a3b8' : 'linear-gradient(135deg, #7C3AED, #4F46E5)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 12,
                  padding: '11px 22px',
                  fontWeight: 700,
                  fontSize: '0.92rem',
                  cursor: aiDraftLoading ? 'not-allowed' : 'pointer',
                  boxShadow: aiDraftLoading ? 'none' : '0 4px 18px rgba(124,58,237,0.35)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  transition: 'all 0.2s',
                }}
              >
                {aiDraftLoading ? 'Generating...' : 'Generate AI-Assisted Evaluation Draft'}
              </button>
            </div>
          )}
          <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '220px' }}>
              <label className="ent-label">Manager Final Rating Score (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                className="ent-input"
                value={formData.manager_score}
                onChange={(e) => {
                  const nextScore = e.target.value;
                  setFormData({ ...formData, manager_score: nextScore, rating_label: ratingForScore(nextScore) });
                }}
                disabled={readOnly}
                placeholder={selectedEvaluation.auto_score?.toFixed(1)}
              />
              <div className="text-muted" style={{ fontSize: '0.82rem', marginTop: '0.4rem' }}>
                Difference from suggested score: <strong>{scoreDifference > 0 ? '+' : ''}{scoreDifference} points</strong>
              </div>
            </div>
            <div style={{ flex: 1, minWidth: '220px' }}>
              <label className="ent-label">Final Rating (automatic)</label>
              <input className="ent-input" value={renderRatingLabel(ratingForScore(displayedManagerScore))} readOnly />
            </div>
            <div style={{ flex: 1, minWidth: '220px' }}>
              <label className="ent-label">Promotion / Warning Suggestion</label>
              <select className="ent-select" value={formData.recommendation} onChange={(e) => setFormData({ ...formData, recommendation: e.target.value })} disabled={readOnly}>
                <option value="no_action">No Action</option>
                <option value="promotion">Promotion</option>
                <option value="bonus_eligible">Bonus Eligible</option>
                <option value="department_transfer">Department Transfer</option>
                <option value="performance_improvement_plan">Performance Improvement Plan</option>
              </select>
            </div>
          </div>

          {requiresAdjustmentJustification && (
            <div style={{ marginBottom: '1.5rem', padding: '1rem', borderRadius: '8px', background: '#fffbeb', border: '1px solid #fbbf24' }}>
              <label className="ent-label">Score Adjustment Justification *</label>
              <textarea
                className="ent-input"
                style={{ minHeight: '90px' }}
                value={formData.manager_adjustment_justification}
                onChange={(e) => setFormData({ ...formData, manager_adjustment_justification: e.target.value })}
                disabled={readOnly}
                placeholder={`Explain the ${Math.abs(scoreDifference)}-point difference using objective evidence, tasks, check-ins, quality, or documented blockers.`}
              />
            </div>
          )}

          {selectedEvaluation.evidence_summary && (
            <div style={{ marginBottom: '1.5rem', padding: '1rem', borderRadius: '8px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <strong>Supporting evidence (not separately scored)</strong>
              <div className="text-muted" style={{ marginTop: '0.45rem' }}>
                Tasks: {selectedEvaluation.evidence_summary.tasks?.completed || 0}/{selectedEvaluation.evidence_summary.tasks?.total || 0} completed
                {' | '}Check-ins: {selectedEvaluation.evidence_summary.checkins?.approved || 0}/{selectedEvaluation.evidence_summary.checkins?.total || 0} approved
                {' | '}Average check-in progress: {selectedEvaluation.evidence_summary.checkins?.average_progress ?? 'N/A'}%
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
            <div>
              <label className="ent-label">Strengths (1 per line)</label>
              <textarea className="ent-input" style={{ minHeight: '100px' }} value={formData.strengths} onChange={(e) => setFormData({ ...formData, strengths: e.target.value })} disabled={readOnly} />
            </div>
            <div>
              <label className="ent-label">Areas for Improvement (1 per line)</label>
              <textarea className="ent-input" style={{ minHeight: '100px' }} value={formData.weaknesses} onChange={(e) => setFormData({ ...formData, weaknesses: e.target.value })} disabled={readOnly} />
            </div>
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label className="ent-label">Improvement Suggestions For Next Cycle (1 per line)</label>
            <textarea className="ent-input" style={{ minHeight: '90px' }} value={formData.improvement_suggestions} onChange={(e) => setFormData({ ...formData, improvement_suggestions: e.target.value })} disabled={readOnly} />
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label className="ent-label" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              Final Comments
              {selectedEvaluation.status === 'draft' && <span className="ds-badge ds-badge--ai">AI-Assisted Draft</span>}
            </label>
            <textarea className="ent-input" style={{ minHeight: '120px' }} value={formData.manager_comments} onChange={(e) => setFormData({ ...formData, manager_comments: e.target.value })} disabled={readOnly} />
            <div className="text-muted" style={{ fontSize: '0.82rem', marginTop: '0.4rem' }}>
              AI provides an editable draft only. The manager remains responsible for the submitted report.
            </div>
          </div>

          <div style={{ padding: '1.5rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid var(--border-color)', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', gap: '1rem', flexWrap: 'wrap' }}>
              <h4 style={{ margin: 0 }}>Automatic Performance Report Generation</h4>
              {!readOnly && (
                <button type="button" className="btn btn--outline btn--sm" onClick={handleGenerateCareerRec}>Generate Career Suggestions</button>
              )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
              <div>
                <label className="ent-label">Suggested Path</label>
                <input type="text" className="ent-input" value={careerRec.suggested_path} onChange={(e) => setCareerRec({ ...careerRec, suggested_path: e.target.value })} disabled={readOnly} placeholder="e.g. Senior Developer" />
              </div>
              <div>
                <label className="ent-label">Skills to Develop (1 per line)</label>
                <textarea className="ent-input" style={{ minHeight: '80px' }} value={careerRec.skills_to_develop} onChange={(e) => setCareerRec({ ...careerRec, skills_to_develop: e.target.value })} disabled={readOnly} placeholder="e.g. Cloud Architecture" />
              </div>
            </div>
          </div>
        </form>
      </div>

      {!readOnly && (
        <>
          {validationErrors.length > 0 && (
            <div className="alert alert--danger" role="alert" style={{ marginTop: '1.5rem' }}>
              <strong>Report cannot be submitted yet:</strong>
              <ul style={{ marginBottom: 0 }}>
                {validationErrors.map((message, index) => <li key={`${message}-${index}`}>{message}</li>)}
              </ul>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1.5rem' }}>
            <button type="button" className="btn btn--outline" onClick={() => handleSave(false)} disabled={saving}>
              {saving ? 'Saving…' : 'Save Draft'}
            </button>
            <button type="button" className="btn btn--primary" onClick={() => handleSave(true)} disabled={saving}>
              {saving ? 'Submitting…' : 'Submit for HR Review'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default FinalEvaluationManager;
