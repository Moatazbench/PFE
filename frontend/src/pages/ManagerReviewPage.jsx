import React, { useEffect, useState, useMemo } from 'react';
import api from '../services/api';
import { useAuth } from '../components/AuthContext';
import { useToast } from '../components/common/Toast';

const API_BASE_URL = api.defaults.baseURL || import.meta.env.VITE_API_BASE_URL || '/api';

/* ── Deadline badge helper ── */
function getDeadlineBadge(dueDate) {
  if (!dueDate) return null;
  const days = Math.ceil((new Date(dueDate) - new Date()) / 86400000);
  if (days < 0) return { label: '🔴 Overdue', color: '#dc2626', bg: '#fef2f2', status: 'overdue' };
  if (days <= 7) return { label: '🟡 At Risk', color: '#d97706', bg: '#fffbeb', status: 'at_risk' };
  return { label: '🟢 On Track', color: '#16a34a', bg: '#f0fdf4', status: 'on_track' };
}

/* ── KPI progress calculation ── */
function calcKpiProgress(kpis) {
  if (!kpis || kpis.length === 0) return 0;
  let total = 0;
  kpis.forEach(k => {
    if (k.metricType === 'boolean') {
      total += k.currentValue >= 1 ? 100 : 0;
    } else {
      const range = Math.abs(k.targetValue - k.initialValue);
      if (range === 0) { total += k.currentValue >= k.targetValue ? 100 : 0; }
      else {
        const prog = k.targetValue > k.initialValue
          ? ((k.currentValue - k.initialValue) / range) * 100
          : ((k.initialValue - k.currentValue) / range) * 100;
        total += Math.min(100, Math.max(0, prog));
      }
    }
  });
  return Math.round(total / kpis.length);
}

function ManagerReviewPage() {
  const { user } = useAuth();
  const toast = useToast();

  const getAttachmentUrl = (attachment) => {
    if (!attachment?.url) return '#';
    return attachment.url.startsWith('http') ? attachment.url : `${API_BASE_URL}${attachment.url}`;
  };

  async function handleDownloadAttachment(attachment) {
    const fileUrl = getAttachmentUrl(attachment);
    if (fileUrl === '#') {
      toast.error('Attachment is unavailable');
      return;
    }

    try {
      const response = await fetch(fileUrl);
      if (!response.ok) throw new Error('Download failed');

      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = attachment?.name || 'attachment';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      toast.error('Failed to download attachment');
    }
  }

  const [cycles, setCycles] = useState([]);
  const [selectedCycleId, setSelectedCycleId] = useState('');
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);

  // Per-goal state maps
  const [noteTexts, setNoteTexts] = useState({});       // { goalId: string }
  const [savingNote, setSavingNote] = useState({});      // { goalId: bool }
  const [expandedCheckIns, setExpandedCheckIns] = useState({}); // { goalId: bool }
  const [checkInsData, setCheckInsData] = useState({});  // { goalId: [] }
  const [loadingCheckIns, setLoadingCheckIns] = useState({}); // { goalId: bool }

  /* ── Fetch cycles ── */
  useEffect(() => { fetchCycles(); }, []);

  useEffect(() => {
    if (selectedCycleId) fetchGoals();
  }, [selectedCycleId]);

  async function fetchCycles() {
    try {
      const res = await api.get('/api/cycles');
      const data = (Array.isArray(res.data) ? res.data : [])
        .filter(c => (c.currentPhase === 'phase2' || c.currentPhase === 'phase3') && c.status !== 'draft');
      setCycles(data);
      // Auto-select the first active/in-progress cycle
      const active = data.find(c => c.status === 'in_progress' || c.status === 'active') || data[0];
      if (active) setSelectedCycleId(active._id);
      else setLoading(false);
    } catch {
      toast.error('Failed to load cycles');
      setLoading(false);
    }
  }

  async function fetchGoals() {
    setLoading(true);
    try {
      const res = await api.get('/api/objectives/team-goals', { params: { cycle_id: selectedCycleId } });
      setGoals(res.data.goals || []);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load team goals');
    } finally {
      setLoading(false);
    }
  }

  /* ── FIX 4: Summary bar calculations ── */
  const summary = useMemo(() => {
    let onTrack = 0, atRisk = 0, overdue = 0;
    goals.forEach(g => {
      const badge = getDeadlineBadge(g.dueDate);
      if (!badge || badge.status === 'on_track') onTrack++;
      else if (badge.status === 'at_risk') atRisk++;
      else if (badge.status === 'overdue') overdue++;
    });
    return { total: goals.length, onTrack, atRisk, overdue };
  }, [goals]);

  /* ── FIX 2: Save manager note ── */
  async function handleSaveNote(goalId) {
    const text = (noteTexts[goalId] || '').trim();
    if (!text) { toast.error('Please enter a note.'); return; }
    setSavingNote(prev => ({ ...prev, [goalId]: true }));
    try {
      await api.put('/api/objectives/' + goalId + '/note', { note: text });
      toast.success('Note saved');
      setNoteTexts(prev => ({ ...prev, [goalId]: '' }));
      fetchGoals(); // refresh to show new note
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save note');
    } finally {
      setSavingNote(prev => ({ ...prev, [goalId]: false }));
    }
  }

  /* ── FIX 3: Toggle check-in details ── */
  async function toggleCheckIns(goalId) {
    if (expandedCheckIns[goalId]) {
      setExpandedCheckIns(prev => ({ ...prev, [goalId]: false }));
      return;
    }
    setExpandedCheckIns(prev => ({ ...prev, [goalId]: true }));
    if (checkInsData[goalId]) return; // already loaded
    setLoadingCheckIns(prev => ({ ...prev, [goalId]: true }));
    try {
      const res = await api.get('/api/checkins/by-objective', { params: { objective_id: goalId } });
      setCheckInsData(prev => ({ ...prev, [goalId]: res.data.checkIns || [] }));
    } catch {
      toast.error('Failed to load check-ins');
    } finally {
      setLoadingCheckIns(prev => ({ ...prev, [goalId]: false }));
    }
  }

  /* ── Group goals by employee ── */
  const goalsByEmployee = useMemo(() => {
    const map = {};
    goals.forEach(g => {
      const empId = g.owner?._id || g.owner;
      const empName = g.owner?.name || 'Unknown';
      if (!map[empId]) map[empId] = { name: empName, email: g.owner?.email || '', goals: [] };
      map[empId].goals.push(g);
    });
    return Object.entries(map);
  }, [goals]);

  /* ── Progress bar color ── */
  function progressColor(pct) {
    if (pct >= 75) return '#16a34a';
    if (pct >= 40) return '#d97706';
    return '#dc2626';
  }

  /* ────────── RENDER ────────── */
  if (loading && !selectedCycleId) {
    return <div className="page-loading"><div className="spinner"></div><p>Loading Goal Check-up...</p></div>;
  }

  return (
    <div className="page" style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '2.2rem', color: 'var(--text-dark)' }}>
            🎯 Goal Check-up
          </h1>
          <p className="text-muted" style={{ margin: '0.5rem 0 0 0' }}>
            Review your team's goal progress during Phase 2 and Phase 3, and leave advice or notes.
          </p>
        </div>
        <select
          id="manager-review-cycle-select"
          value={selectedCycleId}
          onChange={e => setSelectedCycleId(e.target.value)}
          className="form-control hover-lift"
          style={{ padding: '0.75rem', borderRadius: '8px', minWidth: '200px', fontWeight: 'bold' }}
        >
          {cycles.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
        </select>
      </div>

      {/* ── FIX 4: Summary Bar ── */}
      <div id="manager-review-summary-bar" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '1rem',
        marginBottom: '2rem',
      }}>
        <div className="card shadow-sm" style={{ padding: '1.25rem', borderRadius: '12px', textAlign: 'center', borderTop: '4px solid var(--primary)' }}>
          <div style={{ fontSize: '2rem', fontWeight: '800', color: 'var(--primary)' }}>{summary.total}</div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '600' }}>Total Goals</div>
        </div>
        <div className="card shadow-sm" style={{ padding: '1.25rem', borderRadius: '12px', textAlign: 'center', borderTop: '4px solid #16a34a' }}>
          <div style={{ fontSize: '2rem', fontWeight: '800', color: '#16a34a' }}>{summary.onTrack}</div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '600' }}>On Track</div>
        </div>
        <div className="card shadow-sm" style={{ padding: '1.25rem', borderRadius: '12px', textAlign: 'center', borderTop: '4px solid #d97706' }}>
          <div style={{ fontSize: '2rem', fontWeight: '800', color: '#d97706' }}>{summary.atRisk}</div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '600' }}>At Risk</div>
        </div>
        <div className="card shadow-sm" style={{ padding: '1.25rem', borderRadius: '12px', textAlign: 'center', borderTop: '4px solid #dc2626' }}>
          <div style={{ fontSize: '2rem', fontWeight: '800', color: '#dc2626' }}>{summary.overdue}</div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '600' }}>Overdue</div>
        </div>
      </div>

      {/* ── Loading / Empty ── */}
      {loading ? (
        <div className="page-loading"><div className="spinner"></div><p>Loading team goals...</p></div>
      ) : goals.length === 0 ? (
        <div className="ent-empty" style={{ padding: '4rem', textAlign: 'center' }}>
          <span style={{ fontSize: '3rem' }}>📋</span>
          <h3>No Active Goals</h3>
          <p className="text-muted">No approved goals found for your team in this cycle.</p>
        </div>
      ) : (
        /* ── Goal cards grouped by employee ── */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {goalsByEmployee.map(([empId, emp]) => (
            <div key={empId}>
              {/* Employee header */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: '0.75rem',
                marginBottom: '1rem', paddingBottom: '0.75rem',
                borderBottom: '2px solid var(--shell-border, #e2e8f0)'
              }}>
                <div style={{
                  width: '40px', height: '40px', borderRadius: '50%',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontWeight: '700', fontSize: '0.9rem'
                }}>
                  {emp.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontWeight: '700', fontSize: '1.1rem', color: 'var(--text-dark)' }}>{emp.name}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{emp.email} · {emp.goals.length} goal{emp.goals.length !== 1 ? 's' : ''}</div>
                </div>
              </div>

              {/* Goal cards for this employee */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', paddingLeft: '0.5rem' }}>
                {emp.goals.map(goal => {
                  const progress = goal.achievementPercent || 0;
                  const badge = getDeadlineBadge(goal.dueDate);
                  const kpiProg = calcKpiProgress(goal.kpis);
                  const isExpanded = expandedCheckIns[goal._id];

                  return (
                    <div key={goal._id} className="card shadow-sm hover-lift" id={`goal-card-${goal._id}`} style={{
                      borderRadius: '12px',
                      borderLeft: `4px solid ${badge ? (badge.status === 'overdue' ? '#dc2626' : badge.status === 'at_risk' ? '#d97706' : '#16a34a') : '#3b82f6'}`,
                      overflow: 'hidden',
                    }}>
                      {/* ── FIX 1: Goal detail header ── */}
                      <div style={{ padding: '1.25rem 1.5rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
                          <div style={{ flex: 1, minWidth: '250px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                              <h3 style={{ margin: 0, fontSize: '1.15rem' }}>{goal.title}</h3>
                              {badge && (
                                <span style={{
                                  display: 'inline-flex', alignItems: 'center', padding: '0.2rem 0.6rem',
                                  borderRadius: '20px', fontSize: '0.75rem', fontWeight: '600',
                                  background: badge.bg, color: badge.color, border: `1px solid ${badge.color}22`
                                }}>
                                  {badge.label}
                                </span>
                              )}
                              <span style={{
                                display: 'inline-flex', alignItems: 'center', padding: '0.2rem 0.6rem',
                                borderRadius: '20px', fontSize: '0.75rem', fontWeight: '600',
                                background: '#f0f9ff', color: '#0369a1', border: '1px solid #0369a122'
                              }}>
                                Weight: {goal.weight}%
                              </span>
                            </div>
                            {goal.description && (
                              <p style={{ margin: '0 0 0.75rem 0', color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: '1.5' }}>
                                {goal.description}
                              </p>
                            )}
                          </div>

                          {/* Right: stats */}
                          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                            {goal.dueDate && (
                              <div style={{ textAlign: 'center', padding: '0.5rem 0.75rem', background: 'var(--shell-bg-inset, #f9fafb)', borderRadius: '8px' }}>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase' }}>Due</div>
                                <div style={{ fontWeight: '700', fontSize: '0.85rem' }}>{new Date(goal.dueDate).toLocaleDateString()}</div>
                              </div>
                            )}
                            <div style={{ textAlign: 'center', padding: '0.5rem 0.75rem', background: 'var(--shell-bg-inset, #f9fafb)', borderRadius: '8px' }}>
                              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase' }}>Check-ins</div>
                              <div style={{ fontWeight: '700', fontSize: '0.85rem' }}>{goal.checkInCount} submitted</div>
                            </div>
                          </div>
                        </div>

                        {/* Progress bar */}
                        <div style={{ marginTop: '1rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.3rem' }}>
                            <span style={{ fontWeight: '600' }}>Progress</span>
                            <span style={{ fontWeight: '700', color: progressColor(progress) }}>{progress}%</span>
                          </div>
                          <div style={{ width: '100%', background: '#e2e8f0', borderRadius: '6px', height: '10px', overflow: 'hidden' }}>
                            <div style={{
                              width: `${progress}%`, background: `linear-gradient(90deg, ${progressColor(progress)}cc, ${progressColor(progress)})`,
                              height: '100%', borderRadius: '6px', transition: 'width 0.6s ease'
                            }}></div>
                          </div>
                        </div>

                        {/* KPIs */}
                        {goal.kpis && goal.kpis.length > 0 && (
                          <div style={{ marginTop: '1rem' }}>
                            <div style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                              Linked KPIs ({goal.kpis.length})
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                              {goal.kpis.map((kpi, i) => {
                                const kpiVal = kpi.targetValue > 0 ? Math.round((kpi.currentValue / kpi.targetValue) * 100) : 0;
                                return (
                                  <div key={kpi._id || i} style={{
                                    display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                                    padding: '0.35rem 0.7rem', borderRadius: '8px',
                                    background: '#f8fafc', border: '1px solid #e2e8f0', fontSize: '0.8rem'
                                  }}>
                                    <span style={{ fontWeight: '600' }}>{kpi.title}</span>
                                    <span style={{ color: 'var(--text-muted)' }}>
                                      {kpi.currentValue}{kpi.unit || ''} / {kpi.targetValue}{kpi.unit || ''}
                                    </span>
                                    <span style={{
                                      fontWeight: '700', fontSize: '0.75rem',
                                      color: kpiVal >= 75 ? '#16a34a' : kpiVal >= 40 ? '#d97706' : '#dc2626'
                                    }}>
                                      ({kpiVal}%)
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* ── FIX 3: Expandable check-ins section ── */}
                        <div style={{ marginTop: '1rem' }}>
                          <button
                            id={`toggle-checkins-${goal._id}`}
                            onClick={() => toggleCheckIns(goal._id)}
                            style={{
                              background: 'none', border: '1px solid var(--shell-border, #d1d5db)',
                              padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer',
                              fontSize: '0.85rem', fontWeight: '600', color: 'var(--primary)',
                              display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                              transition: 'all 0.2s ease',
                            }}
                          >
                            {isExpanded ? '▼' : '▶'} View Check-ins ({goal.checkInCount})
                          </button>

                          {isExpanded && (
                            <div style={{
                              marginTop: '0.75rem', background: '#f8fafc', borderRadius: '8px',
                              border: '1px solid #e2e8f0', overflow: 'hidden'
                            }}>
                              {loadingCheckIns[goal._id] ? (
                                <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                  Loading check-ins...
                                </div>
                              ) : (checkInsData[goal._id] || []).length === 0 ? (
                                <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                  No check-ins submitted yet.
                                </div>
                              ) : (
                                <div>
                                  {(checkInsData[goal._id] || []).map((ci, idx) => (
                                    <div key={ci._id || idx} style={{
                                      padding: '1rem 1.25rem',
                                      borderBottom: idx < (checkInsData[goal._id] || []).length - 1 ? '1px solid #e2e8f0' : 'none',
                                    }}>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                          <span style={{ fontWeight: '600', fontSize: '0.85rem' }}>
                                            📅 {ci.submitted_at ? new Date(ci.submitted_at).toLocaleDateString() : 'N/A'}
                                          </span>
                                          <span style={{
                                            padding: '0.15rem 0.5rem', borderRadius: '12px', fontSize: '0.72rem', fontWeight: '600',
                                            background: ci.status === 'approved' ? '#dcfce7' : ci.status === 'pending_review' ? '#fef3c7' : ci.status === 'revision_requested' ? '#ffedd5' : '#f1f5f9',
                                            color: ci.status === 'approved' ? '#166534' : ci.status === 'pending_review' ? '#92400e' : ci.status === 'revision_requested' ? '#9a3412' : '#475569',
                                          }}>
                                            {ci.status === 'pending_review' ? 'Pending' : ci.status === 'revision_requested' ? 'Revision' : ci.status === 'approved' ? 'Approved' : ci.status}
                                          </span>
                                        </div>
                                        <span style={{
                                          fontWeight: '700', fontSize: '0.9rem',
                                          color: progressColor(ci.progress_percent || 0)
                                        }}>
                                          {ci.progress_percent || 0}%
                                        </span>
                                      </div>
                                      {ci.notes && (
                                        <p style={{ margin: '0.25rem 0 0.5rem 0', fontSize: '0.88rem', color: 'var(--text-dark)', lineHeight: '1.5' }}>
                                          {ci.notes}
                                        </p>
                                      )}
                                      {ci.attachments && ci.attachments.length > 0 && (
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                          {ci.attachments.map((att, aIdx) => (
                                            <div
                                              key={aIdx}
                                              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}
                                            >
                                              <a
                                                href={getAttachmentUrl(att)}
                                                target="_blank" rel="noreferrer"
                                                style={{
                                                  display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                                                  padding: '0.3rem 0.6rem', borderRadius: '6px',
                                                  background: '#eff6ff', color: '#1d4ed8', fontSize: '0.8rem',
                                                  fontWeight: '500', textDecoration: 'none',
                                                  border: '1px solid #bfdbfe'
                                                }}
                                              >
                                                View {att.name || 'Attachment'}
                                              </a>
                                              <button
                                                type="button"
                                                onClick={() => handleDownloadAttachment(att)}
                                                style={{
                                                  padding: '0.3rem 0.6rem', borderRadius: '6px',
                                                  background: '#1d4ed8', color: '#fff', fontSize: '0.8rem',
                                                  fontWeight: '500', border: '1px solid #1d4ed8', cursor: 'pointer'
                                                }}
                                              >
                                                Download
                                              </button>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* ── FIX 2: Manager notes section ── */}
                        <div style={{
                          marginTop: '1.25rem', paddingTop: '1.25rem',
                          borderTop: '1px solid var(--shell-border, #e2e8f0)'
                        }}>
                          <div style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                            Leave advice or notes
                          </div>
                          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                            <textarea
                              id={`note-input-${goal._id}`}
                              className="ent-input"
                              value={noteTexts[goal._id] || ''}
                              onChange={e => setNoteTexts(prev => ({ ...prev, [goal._id]: e.target.value }))}
                              placeholder="Write advice, observations, or coaching notes..."
                              style={{ flex: 1, minHeight: '70px', resize: 'vertical', borderRadius: '8px' }}
                            />
                            <button
                              id={`save-note-${goal._id}`}
                              className="btn btn--primary"
                              onClick={() => handleSaveNote(goal._id)}
                              disabled={savingNote[goal._id] || !(noteTexts[goal._id] || '').trim()}
                              style={{ padding: '0.6rem 1.25rem', borderRadius: '8px', whiteSpace: 'nowrap', height: 'fit-content' }}
                            >
                              {savingNote[goal._id] ? 'Saving...' : 'Save Note'}
                            </button>
                          </div>

                          {/* Past notes */}
                          {goal.manager_notes && goal.manager_notes.length > 0 && (
                            <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                              {[...goal.manager_notes].reverse().map((note, idx) => (
                                <div key={idx} style={{
                                  padding: '0.6rem 0.85rem', borderRadius: '8px',
                                  background: '#fffbeb', border: '1px solid #fde68a',
                                  fontSize: '0.88rem', lineHeight: '1.4',
                                }}>
                                  <span style={{ color: '#92400e', fontWeight: '600' }}>
                                    📝 {new Date(note.created_at).toLocaleDateString()}
                                  </span>
                                  <span style={{ color: '#78716c', margin: '0 0.5rem' }}>—</span>
                                  <span style={{ color: '#44403c' }}>{note.text}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default ManagerReviewPage;
