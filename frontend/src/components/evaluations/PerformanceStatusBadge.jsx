import React from 'react';
import { getPerformanceStatusMeta } from './workflowOptions';

function PerformanceStatusBadge({ status }) {
  const meta = getPerformanceStatusMeta(status);

  if (!meta) {
    return (
      <span className="badge" style={{ background: '#e2e8f0', color: '#475569' }}>
        No HR Status
      </span>
    );
  }

  return (
    <span className="badge" style={{ background: meta.background, color: meta.color }}>
      {meta.label}
    </span>
  );
}

export default PerformanceStatusBadge;
