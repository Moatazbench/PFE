// src/components/teams/ConfirmDeleteModal.jsx
// Confirmation modal for deleting a team

import React, { useEffect } from 'react';

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
    maxWidth: '420px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
  },
  iconContainer: {
    width: '48px',
    height: '48px',
    borderRadius: '50%',
    backgroundColor: '#fef2f2',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '16px',
  },
  icon: {
    fontSize: '24px',
    color: '#ef4444',
  },
  title: {
    margin: '0 0 8px 0',
    fontSize: '18px',
    fontWeight: '600',
    color: '#111827',
  },
  message: {
    margin: '0 0 8px 0',
    fontSize: '14px',
    color: '#6b7280',
    lineHeight: '1.5',
  },
  teamInfo: {
    backgroundColor: '#f9fafb',
    borderRadius: '6px',
    padding: '12px',
    marginTop: '12px',
    marginBottom: '20px',
  },
  teamName: {
    fontWeight: '600',
    color: '#111827',
    marginBottom: '4px',
  },
  teamStats: {
    fontSize: '13px',
    color: '#6b7280',
  },
  actions: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'flex-end',
  },
  btnDanger: {
    padding: '10px 20px',
    backgroundColor: '#ef4444',
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
};

const ConfirmDeleteModal = ({ isOpen, onClose, onConfirm, team, isLoading = false }) => {
  // Handle overlay click
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

  if (!isOpen || !team) return null;

  const collaboratorCount = team.collaborators?.length || 0;
  const memberCount = collaboratorCount + 1; // +1 for manager

  return (
    <div style={modalStyles.overlay} onClick={handleOverlayClick}>
      <div style={modalStyles.modal} role="dialog" aria-modal="true">
        {/* Warning Icon */}
        <div style={modalStyles.iconContainer}>
          <span style={modalStyles.icon}>⚠</span>
        </div>

        {/* Title */}
        <h2 style={modalStyles.title}>Delete Team</h2>

        {/* Message */}
        <p style={modalStyles.message}>
          Are you sure you want to delete this team? This action cannot be undone.
        </p>

        {/* Team Info */}
        <div style={modalStyles.teamInfo}>
          <div style={modalStyles.teamName}>{team.name}</div>
          <div style={modalStyles.teamStats}>
            {memberCount} member{memberCount !== 1 ? 's' : ''} (
            {team.manager?.name || 'No manager'} + {collaboratorCount} collaborator
            {collaboratorCount !== 1 ? 's' : ''})
          </div>
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
            type="button"
            style={{
              ...modalStyles.btnDanger,
              ...(isLoading ? modalStyles.btnDisabled : {}),
            }}
            onClick={onConfirm}
            disabled={isLoading}
          >
            {isLoading && <span style={modalStyles.loadingSpinner}></span>}
            {isLoading ? 'Deleting...' : 'Delete Team'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDeleteModal;