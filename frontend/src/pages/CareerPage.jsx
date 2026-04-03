import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../components/AuthContext';

var API = 'http://localhost:5000';

function CareerPage() {
  var { user } = useAuth();
  var [tab, setTab] = useState('my-path');
  var [careerPaths, setCareerPaths] = useState([]);
  var [competencies, setCompetencies] = useState([]);
  var [loading, setLoading] = useState(true);
  var [showPathForm, setShowPathForm] = useState(false);
  var [showCompForm, setShowCompForm] = useState(false);
  var [pathForm, setPathForm] = useState({ currentRole: '', targetRole: '', targetDate: '', notes: '' });
  var [compForm, setCompForm] = useState({ name: '', description: '', category: 'other', level: 'beginner', skills: '' });
  var [sending, setSending] = useState(false);

  var token = localStorage.getItem('token');
  var headers = { Authorization: 'Bearer ' + token };
  var isAdmin = user.role === 'ADMIN' || user.role === 'HR';

  var categories = ['technical', 'leadership', 'communication', 'problem_solving', 'teamwork', 'domain', 'management', 'other'];
  var levels = ['beginner', 'intermediate', 'advanced', 'expert'];
  var levelColors = { beginner: '#6b7280', intermediate: '#3b82f6', advanced: '#f59e0b', expert: '#10b981' };

  useEffect(function () { loadData(); }, [tab]);

  function loadData() {
    setLoading(true);
    var pathUrl = tab === 'my-path' ? '/api/career/paths/my' : '/api/career/paths/all';
    Promise.all([
      axios.get(API + pathUrl, { headers: headers }),
      axios.get(API + '/api/career/competencies', { headers: headers })
    ]).then(function (res) {
      setCareerPaths(res[0].data.careerPaths || []);
      setCompetencies(res[1].data.competencies || []);
    }).catch(function () {}).finally(function () { setLoading(false); });
  }

  function handleCreatePath() {
    if (!pathForm.currentRole) return;
    setSending(true);
    axios.post(API + '/api/career/paths', pathForm, { headers: headers })
      .then(function () { setShowPathForm(false); setPathForm({ currentRole: '', targetRole: '', targetDate: '', notes: '' }); loadData(); })
      .catch(function (e) { alert(e.response?.data?.message || 'Error'); })
      .finally(function () { setSending(false); });
  }

  function handleCreateComp() {
    if (!compForm.name) return;
    setSending(true);
    var data = Object.assign({}, compForm, { skills: compForm.skills ? compForm.skills.split(',').map(function (s) { return s.trim(); }) : [] });
    axios.post(API + '/api/career/competencies', data, { headers: headers })
      .then(function () { setShowCompForm(false); setCompForm({ name: '', description: '', category: 'other', level: 'beginner', skills: '' }); loadData(); })
      .catch(function (e) { alert(e.response?.data?.message || 'Error'); })
      .finally(function () { setSending(false); });
  }

  function handleDeleteComp(id) {
    if (!confirm('Delete this competency?')) return;
    axios.delete(API + '/api/career/competencies/' + id, { headers: headers }).then(function () { loadData(); });
  }

  var tabs = [{ key: 'my-path', label: 'My Career Path' }, { key: 'competencies', label: 'Competencies' }];
  if (isAdmin || user.role === 'TEAM_LEADER') tabs.splice(1, 0, { key: 'all-paths', label: 'All Paths' });

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="page-header__left">
          <h1 className="page-title">🚀 Career Development</h1>
          <p className="page-subtitle">Plan your career growth and develop competencies</p>
        </div>
        <div className="page-header__actions">
          {isAdmin && tab === 'competencies' && <button className="btn btn--secondary" onClick={function () { setShowCompForm(!showCompForm); }}>{showCompForm ? 'Cancel' : '+ Competency'}</button>}
          {(tab === 'my-path' || tab === 'all-paths') && <button className="btn btn--primary" onClick={function () { setShowPathForm(!showPathForm); }}>{showPathForm ? 'Cancel' : '+ Career Path'}</button>}
        </div>
      </div>

      {showPathForm && (
        <div className="form-card">
          <h3 className="form-card__title">Create Career Path</h3>
          <div className="form-grid">
            <div className="form-group"><label>Current Role</label><input className="form-input" placeholder="e.g. Junior Developer" value={pathForm.currentRole} onChange={function (e) { setPathForm(Object.assign({}, pathForm, { currentRole: e.target.value })); }} /></div>
            <div className="form-group"><label>Target Role</label><input className="form-input" placeholder="e.g. Senior Developer" value={pathForm.targetRole} onChange={function (e) { setPathForm(Object.assign({}, pathForm, { targetRole: e.target.value })); }} /></div>
            <div className="form-group"><label>Target Date</label><input type="date" className="form-input" value={pathForm.targetDate} onChange={function (e) { setPathForm(Object.assign({}, pathForm, { targetDate: e.target.value })); }} /></div>
            <div className="form-group form-group--full"><label>Notes</label><textarea className="form-textarea" rows={2} value={pathForm.notes} onChange={function (e) { setPathForm(Object.assign({}, pathForm, { notes: e.target.value })); }} /></div>
          </div>
          <div className="form-actions"><button className="btn btn--secondary" onClick={function () { setShowPathForm(false); }}>Cancel</button><button className="btn btn--primary" onClick={handleCreatePath} disabled={sending}>{sending ? 'Creating...' : 'Create Path'}</button></div>
        </div>
      )}

      {showCompForm && (
        <div className="form-card">
          <h3 className="form-card__title">Add Competency</h3>
          <div className="form-grid">
            <div className="form-group"><label>Name</label><input className="form-input" placeholder="e.g. React.js" value={compForm.name} onChange={function (e) { setCompForm(Object.assign({}, compForm, { name: e.target.value })); }} /></div>
            <div className="form-group"><label>Category</label><select className="form-select" value={compForm.category} onChange={function (e) { setCompForm(Object.assign({}, compForm, { category: e.target.value })); }}>{categories.map(function (c) { return <option key={c} value={c}>{c.replace(/_/g, ' ').replace(/\b\w/g, function (l) { return l.toUpperCase(); })}</option>; })}</select></div>
            <div className="form-group"><label>Level</label><select className="form-select" value={compForm.level} onChange={function (e) { setCompForm(Object.assign({}, compForm, { level: e.target.value })); }}>{levels.map(function (l) { return <option key={l} value={l}>{l.charAt(0).toUpperCase() + l.slice(1)}</option>; })}</select></div>
            <div className="form-group"><label>Skills (comma-separated)</label><input className="form-input" placeholder="e.g. hooks, context, redux" value={compForm.skills} onChange={function (e) { setCompForm(Object.assign({}, compForm, { skills: e.target.value })); }} /></div>
            <div className="form-group form-group--full"><label>Description</label><textarea className="form-textarea" rows={2} value={compForm.description} onChange={function (e) { setCompForm(Object.assign({}, compForm, { description: e.target.value })); }} /></div>
          </div>
          <div className="form-actions"><button className="btn btn--secondary" onClick={function () { setShowCompForm(false); }}>Cancel</button><button className="btn btn--primary" onClick={handleCreateComp} disabled={sending}>{sending ? 'Creating...' : 'Add Competency'}</button></div>
        </div>
      )}

      <div className="tab-bar">{tabs.map(function (t) { return <button key={t.key} className={'tab-btn' + (tab === t.key ? ' tab-btn--active' : '')} onClick={function () { setTab(t.key); }}>{t.label}</button>; })}</div>

      {loading ? (
        <div className="loading-state"><div className="spinner"></div><p>Loading...</p></div>
      ) : tab === 'competencies' ? (
        competencies.length === 0 ? (
          <div className="empty-state"><div className="empty-state__icon">📚</div><h3>No competencies defined</h3><p>Admins can add competencies to build the framework.</p></div>
        ) : (
          <div className="competency-grid">
            {competencies.map(function (c) {
              return (
                <div key={c._id} className="competency-card">
                  <div className="competency-card__header">
                    <h3>{c.name}</h3>
                    <span className="status-chip" style={{ background: (levelColors[c.level] || '#6b7280') + '18', color: levelColors[c.level] }}>{c.level}</span>
                  </div>
                  <p className="competency-card__desc">{c.description || 'No description'}</p>
                  <div className="competency-card__meta">
                    <span className="meta-tag">{c.category.replace(/_/g, ' ')}</span>
                    {c.skills && c.skills.map(function (s) { return <span key={s} className="meta-tag meta-tag--skill">{s}</span>; })}
                  </div>
                  {isAdmin && <button className="btn btn--ghost btn--sm" onClick={function () { handleDeleteComp(c._id); }}>Delete</button>}
                </div>
              );
            })}
          </div>
        )
      ) : (
        careerPaths.length === 0 ? (
          <div className="empty-state"><div className="empty-state__icon">🚀</div><h3>No career path yet</h3><p>Create a career path to plan your professional growth.</p></div>
        ) : (
          <div className="career-list">
            {careerPaths.map(function (p) {
              var devCompleted = p.developmentPlan ? p.developmentPlan.filter(function (a) { return a.status === 'completed'; }).length : 0;
              var devTotal = p.developmentPlan ? p.developmentPlan.length : 0;
              return (
                <div key={p._id} className="career-item">
                  <div className="career-item__header">
                    <div className="career-item__journey">
                      <span className="career-item__current">{p.currentRole}</span>
                      <span className="career-item__arrow">→</span>
                      <span className="career-item__target">{p.targetRole || 'TBD'}</span>
                    </div>
                    <span className="status-chip" style={{ background: p.status === 'active' ? '#10b98118' : '#6b728018', color: p.status === 'active' ? '#10b981' : '#6b7280' }}>{p.status}</span>
                  </div>
                  {p.user && tab === 'all-paths' && <p className="career-item__user">👤 {p.user.name} ({p.user.role})</p>}
                  {p.targetDate && <p className="career-item__date">Target: {new Date(p.targetDate).toLocaleDateString()}</p>}
                  {devTotal > 0 && (
                    <div className="career-item__progress"><div className="progress-bar"><div className="progress-bar__fill" style={{ width: (devTotal ? (devCompleted / devTotal) * 100 : 0) + '%' }}></div></div><span className="career-item__progress-text">{devCompleted}/{devTotal} actions completed</span></div>
                  )}
                  {p.notes && <p className="career-item__notes">{p.notes}</p>}
                </div>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}

export default CareerPage;
