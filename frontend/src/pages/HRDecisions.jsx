import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../components/AuthContext';

function HRDecisions() {
  const { user } = useAuth();
  const [decisions, setDecisions] = useState([]);
  const [stats, setStats] = useState(null);
  const [thresholds, setThresholds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  var API = 'http://localhost:5000';

  async function fetchData() {
    try {
      var [decisionsRes, statsRes, thresholdsRes] = await Promise.all([
        axios.get(API + '/api/hr-decisions'),
        axios.get(API + '/api/hr-decisions/stats/summary'),
        axios.get(API + '/api/hr-decisions/config/thresholds')
      ]);
      
      setDecisions(decisionsRes.data);
      setStats(statsRes.data);
      setThresholds(thresholdsRes.data.thresholds);
    } catch (err) {
      console.error('Fetch data error:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(function() { 
    fetchData(); 
  }, []);

  async function handleExecute(id) {
    if (!window.confirm('Execute this HR action? This cannot be undone.')) return;
    
    setError('');
    setSuccess('');
    
    try {
      await axios.post(API + '/api/hr-decisions/' + id + '/execute', {
        executionNotes: 'Executed by ' + user.name + ' on ' + new Date().toLocaleString()
      });
      
      setSuccess('✅ HR action executed successfully!');
      fetchData();
    } catch (err) {
      setError('Failed to execute action');
    }
  }

  async function handleUpdateAction(id, newAction) {
    try {
      var threshold = thresholds.find(function(t) { return t.action === newAction; });
      
      await axios.put(API + '/api/hr-decisions/' + id, { 
        action: newAction,
        actionLabel: threshold ? threshold.label : newAction
      });
      
      fetchData();
    } catch (err) {
      console.error('Update action error:', err);
    }
  }

  function getActionStyle(action) {
    var threshold = thresholds.find(function(t) { return t.action === action; });
    return threshold ? { backgroundColor: threshold.color } : { backgroundColor: '#666' };
  }

  function getActionLabel(action) {
    var threshold = thresholds.find(function(t) { return t.action === action; });
    return threshold ? threshold.label : action;
  }

  function formatDate(dateStr) {
    return new Date(dateStr).toLocaleString();
  }

  var filteredDecisions = decisions.filter(function(d) {
    if (filter === 'all') return true;
    return d.status === filter;
  });

  if (loading) {
    return <div className="loading">Loading HR decisions...</div>;
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>⚖️ HR Decisions</h1>
        <select 
          value={filter} 
          onChange={function(e) { setFilter(e.target.value); }}
          className="filter-select"
        >
          <option value="all">All Decisions</option>
          <option value="pending">Pending</option>
          <option value="executed">Executed</option>
        </select>
      </div>

      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}

      {/* Thresholds Reference */}
      <div className="thresholds-panel">
        <h3>📊 Score Thresholds & Actions</h3>
        <div className="thresholds-grid">
          {thresholds.map(function(t) {
            return (
              <div key={t.action} className="threshold-item" style={{ borderLeftColor: t.color }}>
                <span className="threshold-range">{t.min}-{t.max}</span>
                <span className="threshold-label">{t.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon">📊</div>
            <h4>Total Decisions</h4>
            <p className="stat-number">{stats.total}</p>
          </div>
          <div className="stat-card">
            <div className="stat-icon">📈</div>
            <h4>Average Score</h4>
            <p className="stat-number">{stats.averageScore}/70</p>
          </div>
          <div className="stat-card">
            <div className="stat-icon">⏳</div>
            <h4>Pending</h4>
            <p className="stat-number">{stats.byStatus.pending || 0}</p>
          </div>
          <div className="stat-card">
            <div className="stat-icon">✅</div>
            <h4>Executed</h4>
            <p className="stat-number">{stats.byStatus.executed || 0}</p>
          </div>
        </div>
      )}

      {/* Decisions List */}
      {filteredDecisions.length === 0 ? (
        <div className="empty-state">
          <h2>📋 No HR Decisions</h2>
          <p>HR decisions will appear here after submissions are validated.</p>
        </div>
      ) : (
        <div className="decisions-grid">
          {filteredDecisions.map(function(d) {
            return (
              <div key={d._id} className="decision-card">
                <div className="decision-header">
                  <h3>👤 {d.user?.name || 'Unknown'}</h3>
                  <span className="score-badge" style={getActionStyle(d.action)}>
                    {d.finalScore}/70
                  </span>
                </div>
                
                <p className="decision-email">{d.user?.email}</p>
                <p className="decision-cycle">📅 {d.cycle?.name}</p>
                
                <div className="action-display" style={getActionStyle(d.action)}>
                  {d.actionLabel || getActionLabel(d.action)}
                </div>
                
                <div className="decision-meta">
                  <p>Status: <strong className={'status-' + d.status}>{d.status.toUpperCase()}</strong></p>
                  {d.decidedBy && <p>Decided by: {d.decidedBy.name}</p>}
                  {d.executedBy && <p>Executed by: {d.executedBy.name}</p>}
                  {d.executedAt && <p>Executed: {formatDate(d.executedAt)}</p>}
                </div>
                
                {d.hrComments && (
                  <div className="hr-comments">
                    <strong>Comments:</strong>
                    <p>{d.hrComments}</p>
                  </div>
                )}
                
                {d.status === 'pending' && (user.role === 'admin' || user.role === 'manager') && (
                  <div className="decision-actions">
                    <select 
                      value={d.action} 
                      onChange={function(e) { handleUpdateAction(d._id, e.target.value); }}
                      className="action-select"
                    >
                      {thresholds.map(function(t) {
                        return <option key={t.action} value={t.action}>{t.label}</option>;
                      })}
                    </select>
                    <button onClick={function() { handleExecute(d._id); }} className="execute-btn">
                      ✅ Execute
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default HRDecisions;