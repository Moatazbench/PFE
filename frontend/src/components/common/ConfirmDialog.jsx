import React from 'react';

/**
 * ConfirmDialog — replaces browser confirm() calls
 * Usage:
 *   const [confirm, setConfirm] = useState(null);
 *   <ConfirmDialog
 *     open={!!confirm}
 *     title="Delete Task?"
 *     message="This cannot be undone."
 *     onConfirm={() => { doDelete(); setConfirm(null); }}
 *     onCancel={() => setConfirm(null)}
 *   />
 */
function ConfirmDialog({ open, title = 'Are you sure?', message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', danger = false, onConfirm, onCancel }) {
  if (!open) return null;

  return (
    <div className="confirm-overlay" onClick={onCancel}>
      <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="confirm-dialog__icon">{danger ? '⚠️' : '❓'}</div>
        <h3 className="confirm-dialog__title">{title}</h3>
        {message && <p className="confirm-dialog__message">{message}</p>}
        <div className="confirm-dialog__actions">
          <button className="btn btn--secondary" onClick={onCancel}>{cancelLabel}</button>
          <button className={`btn ${danger ? 'btn--danger' : 'btn--primary'}`} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmDialog;
