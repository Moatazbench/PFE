// src/components/evaluations/CycleModal.jsx
// Modal for creating/editing evaluation cycles

import React, { useState, useEffect } from 'react';

const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modal: {
    backgroundColor: 'white',
    borderRadius: '12px',
    padding: '24px',
    width: '100%',
    maxWidth: '500px',
    maxHeight: '90vh',
    overflow: 'auto',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
  },
  title: {
    fontSize: '20px',
    fontWeight: '600',
    margin: 0,
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    fontSize: '24px',
    cursor: 'pointer',
    color: '#6b7280',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  label: {
    fontSize: '14px',
    fontWeight: '500',
    color: '#374151',
  },
  input: {
    padding: '10px 12px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '14px',
  },
  select: {
    padding: '10px 12px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '14px',
  },
  textarea: {
    padding: '10px 12px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '14px',
    minHeight: '80px',
    resize: 'vertical',
  },
  row: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '12px',
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
    marginTop: '8px',
  },
  btnPrimary: {
    padding: '10px 20px',
    backgroundColor: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
  },
  btnSecondary: {
    padding: '10px 20px',
    backgroundColor: 'white',
    color: '#374151',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
  },
  error: {
    padding: '10px',
    backgroundColor: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: '6px',
    color: '#b91c1c',
    fontSize: '14px',
  },
};

export default function CycleModal({ isOpen, onClose, onSubmit, cycle, defaultYear }) {
  const [name, setName] = useState('');
  const [type, setType] = useState('mid-year');
  const [year, setYear] = useState(defaultYear || new Date().getFullYear());
  const [submissionStart, setSubmissionStart] = useState('');
  const [submissionEnd, setSubmissionEnd] = useState('');
  const [reviewDeadline, setReviewDeadline] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Format date for input
  const formatDateForInput = (date) => {
    if (!date) return '';
    try {
      const d = new Date(date);
      return d.toISOString().split('T')[0];
    } catch (e) {
      return '';
    }
  };

  // Reset form when modal opens/closes or cycle changes
  useEffect(() => {
    if (isOpen) {
      if (cycle) {
        setName(cycle.name || '');
        setType(cycle.type || 'mid-year');
        setYear(cycle.year || defaultYear || new Date().getFullYear());
        setSubmissionStart(formatDateForInput(cycle.submissionStart));
        setSubmissionEnd(formatDateForInput(cycle.submissionEnd));
        setReviewDeadline(formatDateForInput(cycle.reviewDeadline));
        setDescription(cycle.description || '');
      } else {
        setName('');
        setType('mid-year');
        setYear(defaultYear || new Date().getFullYear());
        setSubmissionStart('');
        setSubmissionEnd('');
        setReviewDeadline('');
        setDescription('');
      }
      setError('');
      setLoading(false);
    }
  }, [isOpen, cycle, defaultYear]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    if (!submissionStart || !submissionEnd) {
      setError('Submission start and end dates are required');
      return;
    }
    if (new Date(submissionEnd) <= new Date(submissionStart)) {
      setError('End date must be after start date');
      return;
    }

    setLoading(true);

    try {
      const cycleData = {
        name: name.trim(),
        type,
        year: parseInt(year),
        submissionStart,
        submissionEnd,
        reviewDeadline: reviewDeadline || null,
        description: description.trim(),
      };

      // Call the onSubmit function passed from parent
      if (typeof onSubmit === 'function') {
        await onSubmit(cycleData);
      } else {
        console.error('onSubmit is not a function:', onSubmit);
        setError('Internal error: onSubmit is not a function');
      }
    } catch (err) {
      console.error('Submit error:', err);
      setError(err.message || 'Failed to save cycle');
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading && typeof onClose === 'function') {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div style={styles.overlay} onClick={handleClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <h2 style={styles.title}>
            {cycle ? 'Edit Evaluation Cycle' : 'Create Evaluation Cycle'}
          </h2>
          <button 
            style={styles.closeBtn} 
            onClick={handleClose}
            disabled={loading}
            type="button"
          >
            ×
          </button>
        </div>

        {error && <div style={styles.error}>{error}</div>}

        <form style={styles.form} onSubmit={handleSubmit}>
          <div style={styles.field}>
            <label style={styles.label}>Cycle Name *</label>
            <input
              style={styles.input}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Mid-Year Evaluation 2025"
              disabled={loading}
            />
          </div>

          <div style={styles.row}>
            <div style={styles.field}>
              <label style={styles.label}>Type *</label>
              <select
                style={styles.select}
                value={type}
                onChange={(e) => setType(e.target.value)}
                disabled={loading}
              >
                <option value="mid-year">Mid-Year</option>
                <option value="end-year">End-Year</option>
              </select>
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Year *</label>
              <input
                style={styles.input}
                type="number"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                min="2020"
                max="2100"
                disabled={loading}
              />
            </div>
          </div>

          <div style={styles.row}>
            <div style={styles.field}>
              <label style={styles.label}>Submission Start *</label>
              <input
                style={styles.input}
                type="date"
                value={submissionStart}
                onChange={(e) => setSubmissionStart(e.target.value)}
                disabled={loading}
              />
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Submission End *</label>
              <input
                style={styles.input}
                type="date"
                value={submissionEnd}
                onChange={(e) => setSubmissionEnd(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Manager Review Deadline (optional)</label>
            <input
              style={styles.input}
              type="date"
              value={reviewDeadline}
              onChange={(e) => setReviewDeadline(e.target.value)}
              disabled={loading}
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Description (optional)</label>
            <textarea
              style={styles.textarea}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description for this cycle..."
              disabled={loading}
            />
          </div>

          <div style={styles.actions}>
            <button 
              type="button" 
              style={styles.btnSecondary} 
              onClick={handleClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              style={{
                ...styles.btnPrimary,
                opacity: loading ? 0.6 : 1,
                cursor: loading ? 'not-allowed' : 'pointer',
              }} 
              disabled={loading}
            >
              {loading ? 'Saving...' : cycle ? 'Update Cycle' : 'Create Cycle'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}