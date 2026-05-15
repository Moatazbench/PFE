import React, { useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import { useToast } from '../components/common/Toast';
import { Pie } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip as ChartTooltip, Legend } from 'chart.js';

ChartJS.register(ArcElement, ChartTooltip, Legend);

function isEvaluationObjectiveStatus(status) {
  return !['draft', 'rejected', 'cancelled', 'archived'].includes(status);
}

function FinalEvaluationManager({ cycleId, activeCycle }) {
  const toast = useToast();
  const canEditCycle = activeCycle?.currentPhase === 'phase3';

  const [evaluations, setEvaluations] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  const [groupFilter, setGroupFilter] = useState('all');
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [selectedEvaluation, setSelectedEvaluation] = useState(null);
  const [employeeObjectives, setEmployeeObjectives] = useState([]);
  const [careerRec, setCareerRec] = useState({ suggested_path: '', skills_to_develop: '' });

  const [formData, setFormData] = useState({
    manager_score: '',
    rating_label: 'meets_expectations',
    recommendation: 'no_action',
    strengths: '',
    weaknesses: '',
    improvement_suggestions: '',
    manager_comments: ''
  });

  useEffect(() => {
    if (cycleId) fetchTeamData();
  }, [cycleId]);

  async function fetchTeamData() {
    setLoading(true);
    try {
      const res = await api.get(`/final-evaluations/team/${cycleId}`);
      setEvaluations(res.data.evaluations || []);
      setTeamMembers(res.data.teamMembers || []);
    } catch (err) {
      toast.error('Failed to load team evaluations');
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerateEvaluation(employee) {
    try {
      await api.post(`/final-evaluations/generate/${cycleId}/${employee._id}`);
      toast.success('Evaluation drafted and auto-scored successfully.');
      fetchTeamData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to generate evaluation');
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
      manager_comments: evaluation.manager_comments || ''
    });

    try {
      const objRes = await api.get(`/objectives/user/${employee._id}/cycle/${cycleId}`);
      const list = [...(objRes.data.individualObjectives || []), ...(objRes.data.teamObjectives || [])]
        .filter((objective) => isEvaluationObjectiveStatus(objective.status));
      setEmployeeObjectives(list);
    } catch (err) {
      toast.error('Failed to load employee objectives');
    }

    setCareerRec({ suggested_path: '', skills_to_develop: '' });
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
    } catch (err) {
      toast.error('Failed to generate career suggestions');
    }
  }

  async function handleSave(submitToHR = false) {
    try {
      const payload = {
        manager_score: formData.manager_score ? Number(formData.manager_score) : selectedEvaluation.auto_score,
        rating_label: formData.rating_label,
        strengths: formData.strengths.split('\n').map((item) => item.trim()).filter(Boolean),
        weaknesses: formData.weaknesses.split('\n').map((item) => item.trim()).filter(Boolean),
        improvement_suggestions: formData.improvement_suggestions.split('\n').map((item) => item.trim()).filter(Boolean),
        manager_comments: formData.manager_comments,
        recommendation: formData.recommendation,
        status: submitToHR ? 'pending_hr' : 'draft'
      };

      await api.put(`/final-evaluations/${selectedEvaluation._id}`, payload);

      if (careerRec.suggested_path) {
        await api.post('/career/recommendations', {
          employee_id: selectedEmployee._id,
          cycle_id: cycleId,
          suggested_path: careerRec.suggested_path,
          skills_to_develop: careerRec.skills_to_develop.split('\n').map((item) => item.trim()).filter(Boolean),
          basis: 'Manager assessment'
        });
      }

      toast.success(submitToHR ? 'Evaluation submitted to HR.' : 'Draft saved successfully.');
      setSelectedEmployee(null);
      fetchTeamData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save evaluation');
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
    } catch (err) {
      toast.error('Failed to export PDF');
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
            {processedTeam.map(({ employee, evaluation, score }, index) => (
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
                      <button className="btn btn--primary" onClick={() => handleGenerateEvaluation(employee)} disabled={!canEditCycle}>Generate Final Report</button>
                    ) : (
                      <button className="btn btn--outline" onClick={() => openEditor(employee, evaluation)}>
                        {['validated', 'closed'].includes(evaluation.status) ? 'View Final Report' : 'Review Final Report'}
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

  const readOnly = ['validated', 'closed'].includes(selectedEvaluation.status) || !canEditCycle;

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
        <button className="btn btn--secondary" onClick={() => setSelectedEmployee(null)}>[BACK] Back to Team List</button>
        <button className="btn btn--outline" onClick={handleExportPDF}>Export Final Evaluation PDF</button>
      </div>

      {!canEditCycle && (
        <div className="alert alert--warning" style={{ marginBottom: '1.5rem', background: '#f8fafc', color: '#475569', padding: '1rem', borderRadius: '8px', borderLeft: '4px solid #64748b' }}>
          <strong>Note:</strong> This cycle is {activeCycle?.currentPhase || 'not in Phase 3'}. Evaluation data is view-only.
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
                <div className="text-muted" style={{ fontSize: '0.85rem' }}>Auto Score</div>
                <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--primary)' }}>{selectedEvaluation.auto_score?.toFixed(1)}%</div>
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
            <div style={{ height: '140px', display: 'flex', justifyContent: 'center' }}>
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
              {employeeObjectives.map((obj) => (
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
                  {obj.finalSelfAttachment && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
                      <span>📎</span>
                      <a href={obj.finalSelfAttachment.url} target="_blank" rel="noreferrer" style={{ color: '#1d4ed8', fontWeight: 600, textDecoration: 'underline', fontSize: '0.88rem' }}>
                        {obj.finalSelfAttachment.name || 'View Attachment'}
                      </a>
                      <button type="button" onClick={async () => {
                        try {
                          const response = await fetch(obj.finalSelfAttachment.url);
                          if (!response.ok) throw new Error('Download failed');
                          const blob = await response.blob();
                          const blobUrl = window.URL.createObjectURL(blob);
                          const link = document.createElement('a');
                          link.href = blobUrl;
                          link.download = obj.finalSelfAttachment.name || 'attachment';
                          document.body.appendChild(link);
                          link.click();
                          document.body.removeChild(link);
                          window.URL.revokeObjectURL(blobUrl);
                        } catch { toast.error('Failed to download attachment'); }
                      }} style={{ background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: '6px', padding: '0.3rem 0.6rem', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}>
                        Download
                      </button>
                    </div>
                  )}
                  {!obj.finalSelfSubmittedAt && (
                    <div className="text-muted" style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>Self-assessment not submitted yet.</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <form id="evalForm">
          <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '220px' }}>
              <label className="ent-label">Manager Final Rating Score (%)</label>
              <input type="number" className="ent-input" value={formData.manager_score} onChange={(e) => setFormData({ ...formData, manager_score: e.target.value })} disabled={readOnly} placeholder={selectedEvaluation.auto_score?.toFixed(1)} />
            </div>
            <div style={{ flex: 1, minWidth: '220px' }}>
              <label className="ent-label">Final Rating</label>
              <select className="ent-select" value={formData.rating_label} onChange={(e) => setFormData({ ...formData, rating_label: e.target.value })} disabled={readOnly}>
                <option value="exceptional">Exceptional</option>
                <option value="strong">Strong</option>
                <option value="meets_expectations">Meets Expectations</option>
                <option value="needs_improvement">Needs Improvement</option>
                <option value="unsatisfactory">Unsatisfactory</option>
              </select>
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
            <label className="ent-label">Manager Final Comments</label>
            <textarea className="ent-input" style={{ minHeight: '120px' }} value={formData.manager_comments} onChange={(e) => setFormData({ ...formData, manager_comments: e.target.value })} disabled={readOnly} />
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
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1.5rem' }}>
          <button type="button" className="btn btn--outline" onClick={() => handleSave(false)}>Save Draft</button>
          <button type="button" className="btn btn--primary" onClick={() => handleSave(true)}>Submit for HR Validation</button>
        </div>
      )}
    </div>
  );
}

export default FinalEvaluationManager;
