import React from 'react';

/**
 * LoadingSkeleton — animated placeholder rows for list views
 * Usage: <LoadingSkeleton rows={4} />
 */
function LoadingSkeleton({ rows = 3, height = 72 }) {
  return (
    <div className="skeleton-list" aria-busy="true" aria-label="Loading content">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton-item" style={{ height: `${height}px` }}>
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
