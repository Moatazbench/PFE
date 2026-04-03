// src/components/teams/TeamModal.jsx
// Modal for creating and editing teams

import React, { useState, useEffect } from 'react';
import { fetchManagers, fetchCollaborators } from '../../api/users';

const modalStyles = {
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
    borderRadius: '8px',
    padding: '24px',
    width: '100%',
    maxWidth: '500px',
    maxHeight: '90vh',
    overflow: 'auto',
    boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
    paddingBottom: '12px',
    borderBottom: '1px solid #e5e7eb',
  },
  title: {
    margin: 0,
    fontSize: '20px',
    fontWeight: '600',
    color: '#111827',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    fontSize: '24px',
    cursor: 'pointer',
    color: '#6b7280',
    padding: '0',
    lineHeight: '1',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  label: {
    fontSize: '14px',
    fontWeight: '500',
    color: '#374151',
  },
  required: {
    color: '#ef4444',
  },
  input: {
    padding: '10px 12px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '14px',
    outline: 'none',
    transition: 'border-color 0.2s',
  },
  inputError: {
    borderColor: '#ef4444',
  },
  select: {
    padding: '10px 12px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '14px',
    outline: 'none',
    backgroundColor: 'white',
  },
  multiSelect: {
    padding: '10px 12px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '14px',
    outline: 'none',
    backgroundColor: 'white',
    minHeight: '120px',
  },
  helpText: {
    fontSize: '12px',
    color: '#6b7280',
  },
  errorText: {
    fontSize: '12px',
    color: '#ef4444',
  },
  actions: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'flex-end',
    marginTop: '8px',
    paddingTop: '16px',
    borderTop: '1px solid #e5e7eb',
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
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
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
  btnDisabled: {
    opacity: 0.6,
    cursor: 'not-allowed',
  },
  loadingSpinner: {
    width: '16px',
    height: '16px',
    border: '2px solid #ffffff',
    borderTop: '2px solid transparent',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  alert: {
    padding: '12px',
    borderRadius: '6px',
    fontSize: '14px',
  },
  alertError: {
    backgroundColor: '#fef2f2',
    color: '#b91c1c',
    border: '1px solid #fecaca',
  },
  alertInfo: {
    backgroundColor: '#eff6ff',
    color: '#1e40af',
    border: '1px solid #bfdbfe',
  },
};

// Add spinner animation
const spinnerStyle = document.createElement('style');
spinnerStyle.textContent = `
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
`;
if (!document.querySelector('#spinner-style')) {
  spinnerStyle.id = 'spinner-style';
  document.head.appendChild(spinnerStyle);
}

const TeamModal = ({ isOpen, onClose, onSubmit, team = null, isLoading = false }) => {
  const isEditMode = !!team;

  // Form state
  const [name, setName] = useState('');
  const [managerId, setManagerId] = useState('');
  const [collaboratorIds, setCollaboratorIds] = useState([]);

  // Data state
  const [managers, setManagers] = useState([]);
  const [collaborators, setCollaborators] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [dataError, setDataError] = useState('');

  // Validation state
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});

  // Load managers and collaborators
  useEffect(() => {
    if (!isOpen) return;

    const loadData = async () => {
      setLoadingData(true);
      setDataError('');

      try {
        const [managersRes, collaboratorsRes] = await Promise.all([
          fetchManagers(),
          fetchCollaborators(),
        ]);

        setManagers(managersRes.users || []);
        setCollaborators(collaboratorsRes.users || []);
      } catch (err) {
        console.error('Error loading users:', err);
        setDataError('Failed to load users. Please try again.');
      } finally {
        setLoadingData(false);
      }
    };

    loadData();
  }, [isOpen]);

  // Initialize form when team changes (edit mode)
  useEffect(() => {
    if (team) {
      setName(team.name || '');
      setManagerId(team.manager?._id || team.manager || '');
      setCollaboratorIds(
        team.collaborators?.map((c) => c._id || c) || []
      );
    } else {
      setName('');
      setManagerId('');
      setCollaboratorIds([]);
    }
    setErrors({});
    setTouched({});
  }, [team, isOpen]);

  // Validation
  const validate = () => {
    const newErrors = {};

    if (!name.trim()) {
      newErrors.name = 'Team name is required';
    } else if (name.trim().length < 2) {
      newErrors.name = 'Team name must be at least 2 characters';
    } else if (name.trim().length > 100) {
      newErrors.name = 'Team name must be less than 100 characters';
    }

    if (!managerId) {
      newErrors.manager = 'Manager is required';
    } else {
      // Validate manager exists in the list
      const managerExists = managers.some((m) => m._id === managerId);
      if (!managerExists && managers.length > 0) {
        newErrors.manager = 'Please select a valid manager';
      }
    }

    // Validate collaborators exist in the list
    if (collaboratorIds.length > 0 && collaborators.length > 0) {
      const validCollabIds = collaborators.map((c) => c._id);
      const invalidIds = collaboratorIds.filter(
        (id) => !validCollabIds.includes(id)
      );
      if (invalidIds.length > 0) {
        newErrors.collaborators = 'Some selected collaborators are invalid';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle blur for touched state
  const handleBlur = (field) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  // Handle collaborator multi-select
  const handleCollaboratorChange = (e) => {
    const selected = Array.from(e.target.selectedOptions, (opt) => opt.value);
    setCollaboratorIds(selected);
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();

    // Mark all fields as touched
    setTouched({ name: true, manager: true, collaborators: true });

    if (!validate()) return;

    const teamData = {
      name: name.trim(),
      manager: managerId,
      collaborators: collaboratorIds,
    };

    await onSubmit(teamData);
  };

  // Handle overlay click (close modal)
  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget && !isLoading) {
      onClose();
    }
  };

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && !isLoading) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, isLoading, onClose]);

  if (!isOpen) return null;

  return (
    <div style={modalStyles.overlay} onClick={handleOverlayClick}>
      <div style={modalStyles.modal} role="dialog" aria-modal="true">
        {/* Header */}
        <div style={modalStyles.header}>
          <h2 style={modalStyles.title}>
            {isEditMode ? 'Edit Team' : 'Create New Team'}
          </h2>
          <button
            style={modalStyles.closeBtn}
            onClick={onClose}
            disabled={isLoading}
            aria-label="Close modal"
          >
            ×
          </button>
        </div>

        {/* Loading state for data */}
        {loadingData ? (
          <div style={{ ...modalStyles.alert, ...modalStyles.alertInfo }}>
            Loading users...
          </div>
        ) : dataError ? (
          <div style={{ ...modalStyles.alert, ...modalStyles.alertError }}>
            {dataError}
          </div>
        ) : (
          <form style={modalStyles.form} onSubmit={handleSubmit}>
            {/* Team Name */}
            <div style={modalStyles.formGroup}>
              <label style={modalStyles.label}>
                Team Name <span style={modalStyles.required}>*</span>
              </label>
              <input
                type="text"
                style={{
                  ...modalStyles.input,
                  ...(touched.name && errors.name ? modalStyles.inputError : {}),
                }}
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={() => handleBlur('name')}
                placeholder="Enter team name"
                disabled={isLoading}
                autoFocus
              />
              {touched.name && errors.name && (
                <span style={modalStyles.errorText}>{errors.name}</span>
              )}
            </div>

            {/* Manager */}
            <div style={modalStyles.formGroup}>
              <label style={modalStyles.label}>
                Manager <span style={modalStyles.required}>*</span>
              </label>
              <select
                style={{
                  ...modalStyles.select,
                  ...(touched.manager && errors.manager
                    ? modalStyles.inputError
                    : {}),
                }}
                value={managerId}
                onChange={(e) => setManagerId(e.target.value)}
                onBlur={() => handleBlur('manager')}
                disabled={isLoading}
              >
                <option value="">Select a manager</option>
                {managers.map((manager) => (
                  <option key={manager._id} value={manager._id}>
                    {manager.name} ({manager.email})
                  </option>
                ))}
              </select>
              {touched.manager && errors.manager && (
                <span style={modalStyles.errorText}>{errors.manager}</span>
              )}
              {managers.length === 0 && (
                <span style={modalStyles.helpText}>
                  No managers available. Create users with Manager role first.
                </span>
              )}
            </div>

            {/* Collaborators */}
            <div style={modalStyles.formGroup}>
              <label style={modalStyles.label}>Collaborators</label>
              <select
                multiple
                style={modalStyles.multiSelect}
                value={collaboratorIds}
                onChange={handleCollaboratorChange}
                disabled={isLoading}
              >
                {collaborators.map((collab) => (
                  <option key={collab._id} value={collab._id}>
                    {collab.name} ({collab.email})
                  </option>
                ))}
              </select>
              <span style={modalStyles.helpText}>
                Hold Ctrl/Cmd to select multiple collaborators
              </span>
              {errors.collaborators && (
                <span style={modalStyles.errorText}>{errors.collaborators}</span>
              )}
              {collaborators.length === 0 && (
                <span style={modalStyles.helpText}>
                  No collaborators available. Create users with Collaborator role
                  first.
                </span>
              )}
            </div>

            {/* Actions */}
            <div style={modalStyles.actions}>
              <button
                type="button"
                style={modalStyles.btnSecondary}
                onClick={onClose}
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                type="submit"
                style={{
                  ...modalStyles.btnPrimary,
                  ...(isLoading ? modalStyles.btnDisabled : {}),
                }}
                disabled={isLoading}
              >
                {isLoading && <span style={modalStyles.loadingSpinner}></span>}
                {isLoading
                  ? 'Saving...'
                  : isEditMode
                  ? 'Update Team'
                  : 'Create Team'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default TeamModal;