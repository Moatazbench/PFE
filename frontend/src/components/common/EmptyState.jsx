import React from 'react';
import { motion } from 'framer-motion';

const EmptyState = ({ title, description, icon, action, className = '' }) => {
  return (
    <motion.div 
      className={"ds-empty " + className}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="ds-empty__icon">
        {icon || (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: '32px', height: '32px' }}>
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <line x1="9" y1="9" x2="15" y2="15" />
            <line x1="15" y1="9" x2="9" y2="15" />
          </svg>
        )}
      </div>
      <h3 className="ds-empty__title">
        {title || 'No Data Available'}
      </h3>
      {description && (
        <p className="ds-empty__text" style={{ marginBottom: action ? 24 : 0 }}>
          {description}
        </p>
      )}
      {action && (
        <div>{action}</div>
      )}
    </motion.div>
  );
};

export default EmptyState;

