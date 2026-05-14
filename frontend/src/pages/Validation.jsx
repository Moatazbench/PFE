import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../components/AuthContext';

function Validation() {
  const { user } = useAuth();
  const [objectives, setObjectives] = useState([]);
  const [selectedObjective, setSelectedObjective] = useState(null);
  const [adjustedPercent, setAdjustedPercent] = useState(0);
  const [managerComments, setManagerComments] = useState('');
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [bulkAction, setBulkAction] = useState(null);
  const [bulkComment, setBulkComment] = useState('');

  var API = '/api';

  async function fetchObjectives() {
    try {
      var res = await axios.get(API + '/objectives/pending-validation');
      setObjectives(res.data);
    } catch (err) {
      console.error('Fetch objectives error:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(function() { 
    fetchObjectives(); 
  }, []);

  function selectObjective(obj) {
    setSelectedObjective(obj);
    setAdjustedPercent(obj.achievementPercent || 0);
    setManagerComments('');
    setError('');
    setSuccess('');
  }

  async function handleValidate(approved) {
    setError('');
    setSuccess('');
    setProcessing(true);
    
    try {
      await axios.post(API + '/objectives/' + selectedObjective._id + '/validate', {
        status: approved ? 'approved' : 'rejected',
        managerAdjustedPercent: adjustedPercent,
        managerComments: managerComments,
        rejectionReason: !approved ? managerComments : undefined,
      });
      
      setSuccess(approved ? '✅ Objective approved!' : '❌ Objective rejected');
      setSelectedObjective(null);
      fetchObjectives();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to validate');
    } finally {
      setProcessing(false);
    }
  }

  async function handleBulkValidate() {
    if (!bulkComment.trim()) {
      setError('Comment is mandatory.');
      return;
    }
    setError('');
    setSuccess('');
    setProcessing(true);
    try {
      await axios.post(API + '/objectives/validate-all', {
        status: bulkAction,
        managerComments: bulkComment
      });
      setSuccess(`✅ All objectives ${bulkAction}`);
      setBulkAction(null);
      setBulkComment('');
      fetchObjectives();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to validate all');
    } finally {
      setProcessing(false);
    }
  }

  function getWeightedScore() {
    if (!selectedObjective) return 0;
    return ((selectedObjective.weight * adjustedPercent) / 100).toFixed(2);
  }

  function formatDate(dateStr) {
    return new Date(dateStr).toLocaleString();
  }

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>✅ Validate Objectives</h1>
      </div>

      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}

      {!selectedObjective ? (
        <div>
          <h2>📋 Pending Objectives ({objectives.length})</h2>
          
          {bulkAction ? (
            <div style={{ background: '#f3f4f6', padding: '16px', borderRadius: '8px', marginBottom: '16px', border: '1px solid #e5e7eb' }}>
              <h3>{bulkAction === 'approved' ? '✅ Accept All' : '❌ Reject All'}</h3>
              <div style={{ marginTop: '12px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>Comment (required):</label>
                <textarea value={bulkComment} onChange={e => setBulkComment(e.target.value)} placeholder="Add your feedback..." rows={4} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #d1d5db', fontFamily: 'inherit' }} />
              </div>
              <div style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
                <button onClick={handleBulkValidate} disabled={processing || !bulkComment.trim()} style={{ padding: '8px 16px', borderRadius: '4px', background: bulkAction === 'approved' ? '#10b981' : '#ef4444', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                  {processing ? 'Processing...' : `${bulkAction === 'approved' ? 'Accept' : 'Reject'} All`}
                </button>
                <button onClick={() => { setBulkAction(null); setBulkComment(''); }} style={{ padding: '8px 16px', borderRadius: '4px', background: '#e5e7eb', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                  Cancel
                </button>
              </div>
            </div>
          ) : objectives.length > 0 && (
            <div style={{ marginBottom: '16px', display: 'flex', gap: '8px' }}>
              <button onClick={() => setBulkAction('approved')} style={{ padding: '8px 16px', borderRadius: '4px', background: '#10b981', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                ✅ Accept All
              </button>
              <button onClick={() => setBulkAction('rejected')} style={{ padding: '8px 16px', borderRadius: '4px', background: '#ef4444', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                ❌ Reject All
              </button>
            </div>
          )}
          
          {objectives.length === 0 ? (
            <div className="empty-state">
              <h2>✅ All Caught Up!</h2>
              <p>No objectives pending validation.</p>
            </div>
          ) : (
            <div className="objectives-grid">
              {objectives.map(function(obj) {
                return (
                  <div key={obj._id} className="objective-card validation-card" onClick={function() { selectObjective(obj); }}>
                    <div className="objective-header">
                      <h3>🎯 {obj.title}</h3>
                      <span className="weight-badge">{obj.weight}</span>
                    </div>
                    <p className="employee-name">👤 {obj.owner?.name}</p>
                    <p className="employee-email">{obj.owner?.email}</p>
                    <p className="cycle-name">📅 {obj.cycle?.name}</p>
                    <div className="achievement-display">
                      <span>Self-Assessment: {obj.achievementPercent}%</span>
                    </div>
                    <p className="submitted-date">Submitted: {formatDate(obj.submittedAt)}</p>
                    <button className="review-btn">Review →</button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="validation-detail">
          <button onClick={function() { setSelectedObjective(null); }} className="back-btn">← Back</button>
          
          <div className="validation-header">
            <h2>🎯 {selectedObjective.title}</h2>
            <span className="weight-badge large">{selectedObjective.weight}</span>
          </div>
          
          <div className="employee-info">
            <p><strong>Employee:</strong> {selectedObjective.owner?.name}</p>
            <p><strong>Email:</strong> {selectedObjective.owner?.email}</p>
            <p><strong>Cycle:</strong> {selectedObjective.cycle?.name}</p>
          </div>
          
          <div className="objective-details">
            <h3>📋 Details</h3>
            <p><strong>Description:</strong> {selectedObjective.description || 'No description'}</p>
            {selectedObjective.deadline && (
              <p><strong>Deadline:</strong> {formatDate(selectedObjective.deadline)}</p>
            )}
          </div>
          
          {selectedObjective.selfAssessment && (
            <div className="self-assessment-box">
              <h3>📝 Employee's Self-Assessment</h3>
              <p>{selectedObjective.selfAssessment}</p>
              <p className="employee-score">Employee's Score: <strong>{selectedObjective.achievementPercent}%</strong></p>
            </div>
          )}
          
          
          <div className="validation-form">
            <h3>⚖️ Your Validation</h3>
            
            <div className="score-comparison">
              <div className="score-box">
                <span className="score-label">Employee Score</span>
                <span className="score-value">{selectedObjective.achievementPercent}%</span>
              </div>
              <div className="score-arrow">→</div>
              <div className="score-box adjusted">
                <span className="score-label">Your Adjustment</span>
                <span className="score-value">{adjustedPercent}%</span>
              </div>
            </div>
            
            <div className="form-group">
              <label>Adjust Achievement: {adjustedPercent}%</label>
              <input
                type="range"
                min="0"
                max="100"
                value={adjustedPercent}
                onChange={function(e) { setAdjustedPercent(parseInt(e.target.value)); }}
                className="achievement-slider"
              />
              <p className="weighted-score">Weighted Score: {getWeightedScore()} / {selectedObjective.weight}</p>
            </div>
            
            <div className="form-group">
              <label>Manager Comments:</label>
              <textarea
                value={managerComments}
                onChange={function(e) { setManagerComments(e.target.value); }}
                placeholder="Add your feedback..."
                rows={4}
              />
            </div>
            
            <div className="validation-actions">
              <button onClick={function() { handleValidate(false); }} className="reject-btn" disabled={processing}>
                ❌ Reject
              </button>
              <button onClick={function() { handleValidate(true); }} className="approve-btn" disabled={processing}>
                {processing ? 'Processing...' : '✅ Validate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Validation;