import React, { useEffect, useRef, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import UserAvatar from './UserAvatar';

const NOTIFICATION_LIST_TTL_MS = 20000;
const UNREAD_COUNT_TTL_MS = 20000;

let notificationCache = {
    items: [],
    unreadCount: 0,
    listFetchedAt: 0,
    unreadFetchedAt: 0,
};
let notificationListRequest = null;
let unreadCountRequest = null;

function normalizeNotificationsPayload(payload) {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.notifications)) return payload.notifications;
    if (Array.isArray(payload?.data)) return payload.data;
    if (Array.isArray(payload?.items)) return payload.items;
    return [];
}

function getNotificationLink(link) {
    if (!link) return '';
    if (link === '/objectives') return '/goals';
    if (link === '/evaluation-list') return '/evaluations';
    return link;
}

function getTypeAccent(type) {
    switch (type) {
        case 'DEADLINE':
        case 'DEADLINE_REMINDER':
        case 'OVERDUE_ALERT':
            return { bg: '#fff7ed', fg: '#c2410c', border: '#fdba74', label: 'Deadline' };
        case 'KPI_DROP':
            return { bg: '#fef2f2', fg: '#b91c1c', border: '#fca5a5', label: 'Alert' };
        case 'COMMENT':
        case 'MENTION':
        case 'FEEDBACK':
            return { bg: '#eff6ff', fg: '#1d4ed8', border: '#93c5fd', label: 'Conversation' };
        case 'PHASE_OPENED':
        case 'PHASE_CLOSED':
            return { bg: '#f5f3ff', fg: '#6d28d9', border: '#c4b5fd', label: 'Cycle' };
        default:
            return { bg: '#f0fdf4', fg: '#166534', border: '#86efac', label: 'Update' };
    }
}

function formatNotificationTime(value) {
    if (!value) return 'Just now';
    var parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return 'Just now';
    return formatDistanceToNow(parsed, { addSuffix: true });
}

function countUnreadNotifications(items) {
    return (Array.isArray(items) ? items : []).filter(function (notification) {
        return !notification.isRead;
    }).length;
}

function hasFreshNotificationList() {
    return Date.now() - notificationCache.listFetchedAt < NOTIFICATION_LIST_TTL_MS;
}

function hasFreshUnreadCount() {
    return Date.now() - notificationCache.unreadFetchedAt < UNREAD_COUNT_TTL_MS;
}

function updateNotificationCache(items) {
    var nextItems = Array.isArray(items) ? items : [];
    notificationCache = {
        items: nextItems,
        unreadCount: countUnreadNotifications(nextItems),
        listFetchedAt: Date.now(),
        unreadFetchedAt: Date.now(),
    };
    return notificationCache;
}

function updateUnreadCountCache(count) {
    notificationCache = {
        items: notificationCache.items,
        unreadCount: Math.max(0, Number(count) || 0),
        listFetchedAt: notificationCache.listFetchedAt,
        unreadFetchedAt: Date.now(),
    };
    return notificationCache;
}

async function requestNotificationList(force) {
    if (!force && hasFreshNotificationList()) {
        return notificationCache;
    }

    if (!force && notificationListRequest) {
        return notificationListRequest;
    }

    notificationListRequest = api.get('/notifications')
        .then(function (response) {
            return updateNotificationCache(normalizeNotificationsPayload(response.data));
        })
        .finally(function () {
            notificationListRequest = null;
        });

    return notificationListRequest;
}

async function requestUnreadCount(force) {
    if (!force && hasFreshUnreadCount()) {
        return notificationCache.unreadCount;
    }

    if (!force && unreadCountRequest) {
        return unreadCountRequest;
    }

    unreadCountRequest = api.get('/notifications/unread-count')
        .then(function (response) {
            return updateUnreadCountCache(response.data?.count).unreadCount;
        })
        .finally(function () {
            unreadCountRequest = null;
        });

    return unreadCountRequest;
}

function getIcon(type) {
    switch (type) {
        case 'MENTION':
            return '@';
        case 'DEADLINE':
        case 'DEADLINE_REMINDER':
        case 'OVERDUE_ALERT':
            return 'DL';
        case 'KPI_DROP':
            return '!';
        case 'COMMENT':
        case 'FEEDBACK':
            return 'CM';
        case 'GOAL_SUBMITTED':
        case 'GOAL_APPROVED':
        case 'GOAL_REJECTED':
        case 'GOAL_REVISION_REQUESTED':
            return 'OK';
        case 'MIDYEAR_REVIEW_COMPLETED':
        case 'FINAL_EVALUATION_COMPLETED':
            return 'EV';
        case 'PHASE_OPENED':
        case 'PHASE_CLOSED':
            return 'CY';
        default:
            return 'UP';
    }
}

function BellIcon() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M18 8a6 6 0 0 0-12 0c0 7-3 8-3 8h18s-3-1-3-8" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
    );
}

function Notifications() {
    const [notifications, setNotifications] = useState(function () {
        return notificationCache.items;
    });
    const [showDropdown, setShowDropdown] = useState(false);
    const [unreadCount, setUnreadCount] = useState(function () {
        return notificationCache.unreadCount;
    });
    const [loading, setLoading] = useState(false);
    const [loadError, setLoadError] = useState('');
    const dropdownRef = useRef(null);
    const navigate = useNavigate();

    async function fetchNotifications(options) {
        if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
            return;
        }

        try {
            if (!options?.silent) {
                setLoading(true);
            }
            setLoadError('');

            const snapshot = await requestNotificationList(Boolean(options?.force));
            setNotifications(snapshot.items);
            setUnreadCount(snapshot.unreadCount);
        } catch (err) {
            console.error('Error fetching notifications:', err);
            setNotifications([]);
            setUnreadCount(0);
            setLoadError(err.response?.data?.message || 'Notifications are temporarily unavailable.');
        } finally {
            if (!options?.silent) {
                setLoading(false);
            }
        }
    }

    useEffect(function () {
        var cancelScheduledWarmup = function () {};
        var intervalId;

        if (showDropdown) {
            fetchNotifications();
            intervalId = setInterval(function () {
                fetchNotifications({ force: true, silent: true });
            }, 15000);
        } else {
            function warmUnreadCount() {
                requestUnreadCount(false)
                    .then(function (count) {
                        setUnreadCount(count);
                    })
                    .catch(function (err) {
                        console.error('Error fetching unread notification count:', err);
                    });
            }

            if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
                var idleId = window.requestIdleCallback(warmUnreadCount, { timeout: 1000 });
                cancelScheduledWarmup = function () {
                    window.cancelIdleCallback(idleId);
                };
            } else {
                var timeoutId = window.setTimeout(warmUnreadCount, 250);
                cancelScheduledWarmup = function () {
                    window.clearTimeout(timeoutId);
                };
            }

            intervalId = setInterval(function () {
                requestUnreadCount(true)
                    .then(function (count) {
                        setUnreadCount(count);
                    })
                    .catch(function (err) {
                        console.error('Error refreshing unread notification count:', err);
                    });
            }, 60000);
        }

        return function () {
            cancelScheduledWarmup();
            clearInterval(intervalId);
        };
    }, [showDropdown]);

    useEffect(function () {
        function handleClickOutside(event) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setShowDropdown(false);
            }
        }

        document.addEventListener('mousedown', handleClickOutside);

        return function () {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    async function markAsRead(id) {
        try {
            await api.post('/notifications/' + id + '/read');

            var nextSnapshot = updateNotificationCache(notifications.map(function (notification) {
                return notification._id === id ? Object.assign({}, notification, { isRead: true }) : notification;
            }));

            setNotifications(nextSnapshot.items);
            setUnreadCount(nextSnapshot.unreadCount);
        } catch (err) {
            console.error('Error marking as read:', err);
        }
    }

    async function markAllRead() {
        try {
            await api.post('/notifications/read-all');

            var nextSnapshot = updateNotificationCache(notifications.map(function (notification) {
                return Object.assign({}, notification, { isRead: true });
            }));

            setNotifications(nextSnapshot.items);
            setUnreadCount(nextSnapshot.unreadCount);
        } catch (err) {
            console.error('Error marking all as read:', err);
        }
    }

    async function handleNotificationClick(notification) {
        const nextLink = getNotificationLink(notification?.link);

        if (!notification?.isRead && notification?._id) {
            await markAsRead(notification._id);
        }

        setShowDropdown(false);

        if (nextLink) {
            navigate(nextLink);
        }
    }

    return (
        <div className="notifications-container notifications-container--modern" ref={dropdownRef}>
            <button
                type="button"
                className="notification-trigger"
                onClick={function () { setShowDropdown(!showDropdown); }}
                aria-label="Open notifications"
                aria-expanded={showDropdown}
            >
                <span className="notification-trigger__icon" aria-hidden="true">
                    <BellIcon />
                </span>
                {unreadCount > 0 ? (
                    <span className="badge badge--error notification-trigger__badge">
                        {unreadCount}
                    </span>
                ) : null}
            </button>

            {showDropdown ? (
                <div className="notification-dropdown notification-dropdown--modern card shadow-lg">
                    <div className="dropdown-header notification-dropdown__header">
                        <div>
                            <h4 className="notification-dropdown__title">Notifications</h4>
                            <p className="notification-dropdown__subtitle">
                                {unreadCount > 0
                                    ? unreadCount + ' unread update' + (unreadCount > 1 ? 's' : '')
                                    : 'Everything is caught up'}
                            </p>
                        </div>

                        {unreadCount > 0 ? (
                            <button
                                type="button"
                                className="btn btn--link btn--sm notification-dropdown__action"
                                onClick={markAllRead}
                            >
                                Mark all as read
                            </button>
                        ) : null}
                    </div>

                    <div className="dropdown-body notification-dropdown__body">
                        {loading ? (
                            <div className="notification-empty-state">
                                <div className="notification-empty-state__icon">...</div>
                                <p>Loading notifications...</p>
                            </div>
                        ) : loadError ? (
                            <div className="notification-empty-state notification-empty-state--error">
                                <div className="notification-empty-state__icon">!</div>
                                <p>{loadError}</p>
                                <button type="button" className="btn btn--secondary btn--sm" onClick={function () { fetchNotifications({ force: true }); }}>
                                    Retry
                                </button>
                            </div>
                        ) : notifications.length === 0 ? (
                            <div className="notification-empty-state">
                                <div className="notification-empty-state__icon">-</div>
                                <p>No notifications yet</p>
                                <span>New mentions, deadlines, and workflow updates will appear here.</span>
                            </div>
                        ) : (
                            notifications.map(function (notification) {
                                var accent = getTypeAccent(notification.type);
                                var resolvedLink = getNotificationLink(notification.link);

                                return (
                                    <button
                                        type="button"
                                        key={notification._id}
                                        className={'notification-item notification-item--modern ' + (!notification.isRead ? 'unread' : 'read')}
                                        onClick={function () { handleNotificationClick(notification); }}
                                    >
                                        <div className="notif-avatar notification-item__avatar">
                                            {notification.sender ? (
                                                <UserAvatar user={notification.sender} size={40} />
                                            ) : (
                                                <div
                                                    className="notification-item__icon-fallback"
                                                    style={{
                                                        background: accent.bg,
                                                        color: accent.fg,
                                                        borderColor: accent.border,
                                                    }}
                                                >
                                                    {getIcon(notification.type)}
                                                </div>
                                            )}
                                        </div>

                                        <div className="notif-content notification-item__content">
                                            <div className="notification-item__topline">
                                                <div className="notification-item__title-wrap">
                                                    <div className="notification-item__title">
                                                        {notification.title || 'Notification'}
                                                    </div>
                                                    <span
                                                        className="notification-item__type"
                                                        style={{
                                                            background: accent.bg,
                                                            color: accent.fg,
                                                            borderColor: accent.border,
                                                        }}
                                                    >
                                                        {accent.label}
                                                    </span>
                                                </div>

                                                <div className="notification-item__time">
                                                    {formatNotificationTime(notification.createdAt)}
                                                </div>
                                            </div>

                                            <div className="notification-item__message">
                                                {notification.message || 'No additional details.'}
                                            </div>

                                            {resolvedLink ? (
                                                <div className="notification-item__footer">Open related page</div>
                                            ) : null}
                                        </div>

                                        {!notification.isRead ? (
                                            <div className="unread-indicator notification-item__unread-indicator" />
                                        ) : null}
                                    </button>
                                );
                            })
                        )}
                    </div>
                </div>
            ) : null}
        </div>
    );
}

export default Notifications;
