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
      <div className="modal form-card ai-draft-modal" style={{ maxWidth: '760px', width: '95%' }}>
        <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '1rem', marginBottom: '1.25rem' }}>
          <div>
            <h2 style={{ margin: 0 }}>{title || 'AI-generated draft'}</h2>
            <p style={{ margin: '0.5rem 0 0 0', color: '#475569', lineHeight: 1.5 }}>
              {description || 'Review before inserting. This draft is based on the selected objective and available cycle information.'}
            </p>
          </div>
          <button type="button" className="close-btn" style={{ background: 'transparent', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }} onClick={onClose}>×</button>
        </div>

        <div className="ai-draft-modal__body">
        {loading ? (
          <div style={{ padding: '3rem 0', textAlign: 'center', color: '#475569' }}>
            <div className="spinner" style={{ margin: '0 auto 1rem auto' }} />
            <div>Generating AI draft…</div>
          </div>
        ) : (
          <>
            {error ? (
              <div style={{ marginBottom: '1rem', background: 'var(--shell-warning)', color: '#fff', padding: '1rem', borderRadius: 'var(--shell-radius-md)', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                  <line x1="12" y1="9" x2="12" y2="13"></line>
                  <line x1="12" y1="17" x2="12.01" y2="17"></line>
                </svg>
                <div>
                  <strong style={{ display: 'block', marginBottom: '4px' }}>AI service is currently unavailable.</strong>
                  <span style={{ fontSize: '0.9rem' }}>A rule-based draft was generated using your objectives, tasks, check-ins, and evaluation data. You can review and edit it below.</span>
                </div>
              </div>
            ) : null}
            
            <div style={{ marginBottom: '1.25rem' }}>
              <span className="ent-badge" style={{ backgroundColor: 'var(--shell-purple-subtle)', color: 'var(--shell-purple)', border: '1px solid rgba(139, 92, 246, 0.3)', padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600 }}>✨ AI-Assisted Draft</span>
            </div>

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
        </div>

        <div className="ai-draft-modal__footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem', flexWrap: 'wrap' }}>
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
