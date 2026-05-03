import React, { useEffect, useState } from 'react';

function TextBlock({ label, value, onChange, placeholder }) {
  return (
    <div style={{ marginBottom: '1rem' }}>
      <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.5rem' }}>{label}</label>
      <textarea
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ width: '100%', minHeight: '100px', borderRadius: '10px', border: '1px solid #cbd5e1', padding: '0.85rem', fontSize: '0.95rem', resize: 'vertical' }}
      />
    </div>
  );
}

export default function AIDraftModal({ open, title, description, fields = [], draft = {}, onClose, onInsert, onRegenerate, loading, error }) {
  const [localDraft, setLocalDraft] = useState({});

  useEffect(() => {
    const initial = fields.reduce(function (acc, field) {
      acc[field.key] = draft?.[field.key] || '';
      return acc;
    }, {});
    setLocalDraft(initial);
  }, [draft, fields, open]);

  if (!open) return null;

  const hasDraftContent = Object.values(localDraft).some(function (value) {
    return String(value || '').trim().length > 0;
  });

  return (
    <div className="modal-overlay" style={{ zIndex: 1200 }}>
      <div className="modal form-card" style={{ maxWidth: '760px', width: '95%', maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '1rem', marginBottom: '1.25rem' }}>
          <div>
            <h2 style={{ margin: 0 }}>{title || 'AI-generated draft'}</h2>
            <p style={{ margin: '0.5rem 0 0 0', color: '#475569', lineHeight: 1.5 }}>
              {description || 'Review before inserting. This draft is based on the selected objective and available cycle information.'}
            </p>
          </div>
          <button type="button" className="close-btn" style={{ background: 'transparent', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }} onClick={onClose}>×</button>
        </div>

        {loading ? (
          <div style={{ padding: '3rem 0', textAlign: 'center', color: '#475569' }}>
            <div className="spinner" style={{ margin: '0 auto 1rem auto' }} />
            <div>Generating AI draft…</div>
          </div>
        ) : (
          <>
            {error ? (
              <div style={{ marginBottom: '1rem', background: '#fee2e2', color: '#991b1b', padding: '1rem', borderRadius: '10px' }}>
                <strong>Error:</strong> {error}
              </div>
            ) : null}

            <div style={{ display: 'grid', gap: '1rem' }}>
              {fields.map(function (field) {
                return (
                  <TextBlock
                    key={field.key}
                    label={field.label}
                    value={localDraft[field.key]}
                    onChange={(value) => setLocalDraft({ ...localDraft, [field.key]: value })}
                    placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}...`}
                  />
                );
              })}
            </div>
          </>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem', flexWrap: 'wrap' }}>
          <button type="button" className="btn btn--outline" onClick={onRegenerate} disabled={loading}>
            Regenerate
          </button>
          <button type="button" className="btn btn--secondary" onClick={() => onInsert(localDraft)} disabled={loading || !hasDraftContent}>
            Insert into Form
          </button>
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
