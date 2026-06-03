import React from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../AuthContext';
import UserAvatar from '../UserAvatar';
import { getScopeLabel } from './dashboardUtils';

function DashboardHeader({ activeTab, onTabChange, activeCycle, summary, onRefresh, loading }) {
  var auth = useAuth();
  var user = auth.user;

  var tabs = [
    { key: 'me', label: 'Me' },
    { key: 'team', label: 'My team' },
  ];

  if (user && (user.role === 'ADMIN' || user.role === 'HR')) {
    tabs.push({ key: 'org', label: 'Organization' });
  }

  return (
    <motion.div
      className="dash-hero"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: 'easeOut' }}
    >
      <div className="dash-hero__left">
        <UserAvatar user={user} size={58} />
        <div className="dash-hero__copy">
          <div className="dash-hero__eyebrow">{getScopeLabel(activeTab)} workspace</div>
          <h1>{user?.name || 'User'} dashboard</h1>
          <p>
            {activeCycle?.name ? activeCycle.name : 'Current cycle'}{' '}
            {activeCycle?.currentPhase ? '- ' + String(activeCycle.currentPhase).replace('phase', 'Phase ') : ''}
          </p>
        </div>
      </div>

      <div className="dash-hero__right">
        <div className="dash-hero__tabs">
          {tabs.map(function (tab) {
            return (
              <motion.button
                key={tab.key}
                type="button"
                className={'dash-hero__tab' + (activeTab === tab.key ? ' dash-hero__tab--active' : '')}
                onClick={function () { onTabChange(tab.key); }}
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.98 }}
                transition={{ duration: 0.12 }}
              >
                {tab.label}
              </motion.button>
            );
          })}
        </div>

        <div className="dash-hero__meta">
          <div className="dash-hero__meta-item">
            <span>Progress</span>
            <strong>{summary?.averageProgress || 0}%</strong>
          </div>
          <div className="dash-hero__meta-item">
            <span>Completed</span>
            <strong>{summary?.completed || 0}</strong>
          </div>
          <motion.button
            type="button"
            className="dash-hero__refresh"
            onClick={onRefresh}
            disabled={loading}
            whileHover={!loading ? { y: -2 } : {}}
            whileTap={!loading ? { scale: 0.96 } : {}}
            transition={{ duration: 0.12 }}
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}

export default React.memo(DashboardHeader);
