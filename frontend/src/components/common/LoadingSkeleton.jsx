import React from 'react';

/**
 * LoadingSkeleton — animated placeholder for various views
 * Variants: 'list' (default), 'card', 'text'
 */
function LoadingSkeleton({ variant = 'list', rows = 3, height = 72, className = '' }) {
  if (variant === 'card') {
    return (
      <div className={"skeleton-item " + className} style={{ height: height + 'px', borderRadius: 'var(--shell-radius-lg)' }} aria-busy="true">
        <div style={{ padding: 24, height: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="skeleton-line skeleton-line--wide" />
          <div className="skeleton-line skeleton-line--narrow" />
          <div style={{ flexGrow: 1 }} />
          <div className="skeleton-line" style={{ width: '40%' }} />
        </div>
      </div>
    );
  }

  if (variant === 'text') {
    return (
      <div className={"skeleton-item " + className} style={{ height: 'auto', background: 'transparent', animation: 'none' }} aria-busy="true">
        <div className="skeleton-lines">
          <div className="skeleton-line skeleton-line--wide" />
          <div className="skeleton-line skeleton-line--narrow" />
        </div>
      </div>
    );
  }

  return (
    <div className={"skeleton-list " + className} aria-busy="true" aria-label="Loading content">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton-item" style={{ height: height + 'px' }}>
          <div className="skeleton-avatar" />
          <div className="skeleton-lines">
            <div className="skeleton-line skeleton-line--wide" />
            <div className="skeleton-line skeleton-line--narrow" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default LoadingSkeleton;

