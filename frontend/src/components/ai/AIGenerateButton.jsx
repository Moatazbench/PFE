import React from 'react';

export default function AIGenerateButton({ onClick, loading, disabled, label = 'Generate AI Draft' }) {
  const loadingLabel = label.startsWith('Generate') ? label.replace('Generate', 'Generating') : 'Generating...';

  return (
    <button
      type="button"
      className="btn btn--secondary"
      disabled={disabled || loading}
      style={{ minWidth: '220px', padding: '0.85rem 1rem', fontWeight: '600' }}
      onClick={onClick}
    >
      {loading ? loadingLabel : label}
    </button>
  );
}
