// src/components/common/Toast.jsx
// Simple toast notification component

import React, { useEffect } from 'react';

const toastStyles = {
  container: {
    position: 'fixed',
    top: '20px',
    right: '20px',
    zIndex: 10000,
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  toast: {
    padding: '12px 20px',
    borderRadius: '6px',
    color: 'white',
    fontSize: '14px',
    fontWeight: '500',
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    minWidth: '280px',
    maxWidth: '400px',
    animation: 'slideIn 0.3s ease-out',
  },
  success: {
    backgroundColor: '#10b981',
  },
  error: {
    backgroundColor: '#ef4444',
  },
  warning: {
    backgroundColor: '#f59e0b',
  },
  info: {
    backgroundColor: '#3b82f6',
  },
  closeBtn: {
    marginLeft: 'auto',
    background: 'none',
    border: 'none',
    color: 'white',
    cursor: 'pointer',
    fontSize: '18px',
    padding: '0 4px',
  },
};

// Add keyframe animation via style tag
const styleSheet = document.createElement('style');
styleSheet.textContent = `
  @keyframes slideIn {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
  @keyframes slideOut {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(100%);
      opacity: 0;
    }
  }
`;
if (!document.querySelector('#toast-styles')) {
  styleSheet.id = 'toast-styles';
  document.head.appendChild(styleSheet);
}

const Toast = ({ message, type = 'info', onClose, duration = 4000 }) => {
  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(onClose, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  const icon = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ',
  }[type];

  return (
    <div style={{ ...toastStyles.toast, ...toastStyles[type] }}>
      <span>{icon}</span>
      <span>{message}</span>
      <button style={toastStyles.closeBtn} onClick={onClose}>
        ×
      </button>
    </div>
  );
};

// Toast container that manages multiple toasts
export const ToastContainer = ({ toasts, removeToast }) => {
  if (!toasts || toasts.length === 0) return null;

  return (
    <div style={toastStyles.container}>
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          onClose={() => removeToast(toast.id)}
          duration={toast.duration}
        />
      ))}
    </div>
  );
};

// Hook for managing toasts
export const useToast = () => {
  const [toasts, setToasts] = React.useState([]);

  const addToast = (message, type = 'info', duration = 4000) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type, duration }]);
    return id;
  };

  const removeToast = (id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const showSuccess = (message) => addToast(message, 'success');
  const showError = (message) => addToast(message, 'error');
  const showWarning = (message) => addToast(message, 'warning');
  const showInfo = (message) => addToast(message, 'info');

  return {
    toasts,
    addToast,
    removeToast,
    showSuccess,
    showError,
    showWarning,
    showInfo,
    // Shorthand aliases (toast.success / toast.error / etc.)
    success: showSuccess,
    error: showError,
    warning: showWarning,
    info: showInfo,
  };
};

export default Toast;