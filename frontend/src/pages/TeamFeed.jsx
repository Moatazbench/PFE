import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import UserAvatar from '../components/UserAvatar';
import api from '../services/api';

var FEED_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'tasks', label: 'Tasks' },
  { key: 'activity', label: 'Activity' },
  { key: 'status', label: 'Status' },
  { key: 'comments', label: 'Comments' },
  { key: 'reports', label: 'Reports' },
  { key: 'system', label: 'System' },
];

function normalizeActivitiesPayload(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.activities)) return payload.activities;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

function toSafeTimestamp(value) {
  if (!value) return null;
  var parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function normalizeActivity(activity, index) {
  if (!activity || typeof activity !== 'object') return null;

  var timestamp = toSafeTimestamp(activity.timestamp || activity.createdAt || activity.updatedAt);
  if (!timestamp) return null;

  return {
    id: String(activity.id || activity._id || 'activity-' + index),
    type: activity.type || 'activity',
    category: activity.category || 'activity',
    title: activity.title || activity.goalTitle || activity.targetLabel || 'Team activity',
    targetLabel: activity.targetLabel || activity.goalTitle || '',
    message: String(activity.message || '').trim() || 'Updated team activity',
    timestamp: timestamp,
    meta: activity.meta || '',
    user: activity.user && typeof activity.user === 'object'
      ? {
          _id: activity.user._id || activity.user.id || '',
          name: activity.user.name || 'System',
          profileImage: activity.user.profileImage || '',
          role: activity.user.role || '',
        }
      : null,
  };
}

function formatActivityTime(value) {
  if (!value) return 'Unknown time';
  try {
    return formatDistanceToNow(new Date(value), { addSuffix: true });
  } catch {
    return 'Unknown time';
  }
}

function getCategoryTone(category) {
  return {
    tasks: { color: '#1d4ed8', background: 'rgba(59, 130, 246, 0.12)' },
    activity: { color: '#0f766e', background: 'rgba(20, 184, 166, 0.12)' },
    status: { color: '#b45309', background: 'rgba(245, 158, 11, 0.14)' },
    comments: { color: '#7c3aed', background: 'rgba(124, 58, 237, 0.12)' },
    reports: { color: '#be123c', background: 'rgba(244, 63, 94, 0.12)' },
    system: { color: '#475569', background: 'rgba(100, 116, 139, 0.14)' },
  }[category] || { color: '#0f172a', background: 'rgba(15, 23, 42, 0.08)' };
}

function TeamFeed() {
  var [activities, setActivities] = useState([]);
  var [warnings, setWarnings] = useState([]);
  var [loading, setLoading] = useState(true);
  var [refreshing, setRefreshing] = useState(false);
  var [error, setError] = useState('');
  var [filter, setFilter] = useState('all');

  var fetchFeed = useCallback(async function (options) {
    var silent = Boolean(options?.silent);

    try {
      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError('');
      var response = await api.get('/feed');
      var nextActivities = normalizeActivitiesPayload(response.data)
        .map(normalizeActivity)
        .filter(Boolean)
        .sort(function (left, right) {
          return new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime();
        });

      setActivities(nextActivities);
      setWarnings(Array.isArray(response.data?.warnings) ? response.data.warnings : []);
    } catch (err) {
      console.error('Error fetching team feed:', err);
      var message = err.response?.data?.message || 'Team activity is temporarily unavailable.';
      setError(message);
      setWarnings([]);

      if (!silent) {
        setActivities([]);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(function () {
    fetchFeed();

    var interval = window.setInterval(function () {
      fetchFeed({ silent: true });
    }, 30000);

    return function () {
      window.clearInterval(interval);
    };
  }, [fetchFeed]);

  var filteredActivities = useMemo(function () {
    return activities.filter(function (activity) {
      return filter === 'all' ? true : activity.category === filter;
    });
  }, [activities, filter]);

  return (
    <div className="feed-page">
      <header className="feed-header" style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: 0 }}>Team Feed</h1>
          <p className="text-muted" style={{ marginTop: '0.35rem' }}>Live team activity across tasks, updates, comments, reports, and system events.</p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div className="feed-filters" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {FEED_FILTERS.map(function (item) {
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={function () { setFilter(item.key); }}
                  className={'btn btn--sm ' + (filter === item.key ? 'btn--primary' : 'btn--outline')}
                >
                  {item.label}
                </button>
              );
            })}
          </div>

          <button type="button" className="btn btn--secondary btn--sm" onClick={function () { fetchFeed(); }} disabled={loading || refreshing}>
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </header>

      {warnings.length > 0 ? (
        <div className="card" style={{ padding: '0.9rem 1rem', marginBottom: '1rem', border: '1px solid rgba(245, 158, 11, 0.25)', background: 'rgba(255, 251, 235, 0.95)' }}>
          <strong style={{ display: 'block', color: '#92400e', marginBottom: '0.2rem' }}>Some feed sources are degraded</strong>
          <p style={{ margin: 0, color: '#92400e', fontSize: '0.9rem' }}>{warnings.join(' ')}</p>
        </div>
      ) : null}

      {error ? (
        <div className="card" style={{ padding: '1rem', marginBottom: '1rem', border: '1px solid rgba(239, 68, 68, 0.2)', background: 'rgba(254, 242, 242, 0.96)' }}>
          <strong style={{ display: 'block', color: '#b91c1c', marginBottom: '0.25rem' }}>Unable to load the team feed</strong>
          <p style={{ margin: 0, color: '#b91c1c' }}>{error}</p>
        </div>
      ) : null}

      {loading ? (
        <div className="loading-state card" style={{ padding: '2rem', textAlign: 'center' }}>Loading activities...</div>
      ) : filteredActivities.length === 0 ? (
        <div className="empty-state card" style={{ padding: '3rem', textAlign: 'center' }}>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.75rem' }}>No activity yet</div>
          <p className="text-muted" style={{ marginBottom: 0 }}>As your team updates work, comments, reports, and status changes, they will appear here.</p>
        </div>
      ) : (
        <div className="activity-timeline" style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
          {filteredActivities.map(function (activity) {
            var tone = getCategoryTone(activity.category);
            return (
              <div key={activity.id} className="activity-card card" style={{ padding: '1rem 1.1rem', display: 'flex', gap: '0.85rem', alignItems: 'flex-start' }}>
                <UserAvatar user={activity.user} size={38} />

                <div className="activity-content" style={{ flex: 1, minWidth: 0 }}>
                  <div className="activity-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.35rem' }}>
                        <span style={{ fontWeight: 700, color: '#0f172a' }}>{activity.user?.name || 'System'}</span>
                        <span style={{ padding: '0.22rem 0.55rem', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: tone.color, background: tone.background }}>
                          {activity.category}
                        </span>
                      </div>
                      <strong style={{ display: 'block', color: '#0f172a', fontSize: '0.96rem', lineHeight: 1.35 }}>{activity.title}</strong>
                    </div>

                    <div style={{ fontSize: '0.8rem', color: '#64748b', whiteSpace: 'nowrap' }}>
                      {formatActivityTime(activity.timestamp)}
                    </div>
                  </div>

                  <p style={{ margin: '0.45rem 0 0', color: '#334155', lineHeight: 1.5 }}>
                    {activity.message}
                  </p>

                  {activity.targetLabel && activity.targetLabel !== activity.title ? (
                    <div style={{ marginTop: '0.55rem', fontSize: '0.82rem', color: '#64748b' }}>
                      Related to <strong style={{ color: '#334155' }}>{activity.targetLabel}</strong>
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default TeamFeed;
