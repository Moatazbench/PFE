import React, { useEffect } from 'react';

function ToastItem({ message, type, onClose, duration }) {
  useEffect(function () {
    if (duration > 0) {
      var timer = window.setTimeout(onClose, duration);
      return function () {
        window.clearTimeout(timer);
      };
    }

    return undefined;
  }, [duration, onClose]);

  var icon = {
    success: 'OK',
    error: '!',
    warning: '!',
    info: 'i',
  }[type] || 'i';

  return (
    <div className={'toast toast--' + type} role="status" aria-live="polite">
      <span className="toast__icon" aria-hidden="true">{icon}</span>
      <span className="toast__message">{message}</span>
      <button type="button" className="toast__close" onClick={onClose} aria-label="Dismiss notification">
        x
      </button>
    </div>
  );
}

export function ToastContainer({ toasts, removeToast }) {
  if (!toasts || toasts.length === 0) return null;

  return (
    <div className="toast-container">
      {toasts.map(function (toast) {
        return (
          <ToastItem
            key={toast.id}
            message={toast.message}
            type={toast.type}
            onClose={function () { removeToast(toast.id); }}
            duration={toast.duration}
          />
        );
      })}
    </div>
  );
}

export function useToast() {
  var [toasts, setToasts] = React.useState([]);

  function addToast(message, type, duration) {
    var id = Date.now() + Math.random();
    setToasts(function (currentToasts) {
      return currentToasts.concat([{ id: id, message: message, type: type || 'info', duration: duration || 4000 }]);
    });
    return id;
  }

  function removeToast(id) {
    setToasts(function (currentToasts) {
      return currentToasts.filter(function (toast) { return toast.id !== id; });
    });
  }

  function showSuccess(message) {
    return addToast(message, 'success');
  }

  function showError(message) {
    return addToast(message, 'error');
  }

  function showWarning(message) {
    return addToast(message, 'warning');
  }

  function showInfo(message) {
    return addToast(message, 'info');
  }

  return {
    toasts: toasts,
    addToast: addToast,
    removeToast: removeToast,
    showSuccess: showSuccess,
    showError: showError,
    showWarning: showWarning,
    showInfo: showInfo,
    success: showSuccess,
    error: showError,
    warning: showWarning,
    info: showInfo,
  };
}

export default ToastContainer;
