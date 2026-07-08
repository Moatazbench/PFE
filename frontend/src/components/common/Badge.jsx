import React from 'react';

const Badge = ({ variant = 'neutral', children, className = '' }) => {
  const getColors = () => {
    switch (variant) {
      case 'success':
      case 'completed':
      case 'approved':
        return { bg: 'rgba(16, 185, 129, 0.15)', text: 'var(--shell-success)', border: 'rgba(16, 185, 129, 0.3)' };
      case 'warning':
      case 'pending':
        return { bg: 'rgba(245, 158, 11, 0.15)', text: 'var(--shell-warning)', border: 'rgba(245, 158, 11, 0.3)' };
      case 'danger':
      case 'rejected':
      case 'overdue':
        return { bg: 'rgba(239, 68, 68, 0.15)', text: 'var(--shell-danger)', border: 'rgba(239, 68, 68, 0.3)' };
      case 'info':
      case 'active':
        return { bg: 'var(--shell-primary-subtle)', text: 'var(--shell-primary)', border: 'var(--shell-primary-light)' };
      case 'ai':
      case 'career':
      case 'purple':
        return { bg: 'var(--shell-purple-subtle)', text: 'var(--shell-purple)', border: 'rgba(139, 92, 246, 0.3)' };
      case 'neutral':
      default:
        return { bg: 'var(--shell-neutral-subtle)', text: 'var(--shell-neutral)', border: 'rgba(100, 116, 139, 0.3)' };
    }
  };

  const colors = getColors();

  return (
    <span 
      className={`ent-badge ${className}`}
      style={{
        backgroundColor: colors.bg,
        color: colors.text,
        border: `1px solid ${colors.border}`,
        padding: '2px 8px',
        borderRadius: '12px',
        fontSize: '0.75rem',
        fontWeight: 600,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        whiteSpace: 'nowrap',
        lineHeight: 1.5,
      }}
    >
      {children}
    </span>
  );
};

export default Badge;
