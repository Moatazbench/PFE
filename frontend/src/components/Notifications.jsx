import React, { useEffect, useRef, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import UserAvatar from './UserAvatar';

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

function getIcon(type) {
    switch (type) {
        case 'MENTION':
            return '👤';
        case 'DEADLINE':
        case 'DEADLINE_REMINDER':
        case 'OVERDUE_ALERT':
            return '⏰';
        case 'KPI_DROP':
            return '⚠️';
        case 'COMMENT':
        case 'FEEDBACK':
            return '💬';
        case 'GOAL_SUBMITTED':
        case 'GOAL_APPROVED':
        case 'GOAL_REJECTED':
        case 'GOAL_REVISION_REQUESTED':
            return '🎯';
        case 'MIDYEAR_REVIEW_COMPLETED':
        case 'FINAL_EVALUATION_COMPLETED':
            return '📝';
        case 'PHASE_OPENED':
        case 'PHASE_CLOSED':
            return '🔄';
        default:
            return '🔔';
    }
}

function Notifications() {
    const [notifications, setNotifications] = useState([]);
    const [showDropdown, setShowDropdown] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(false);
    const [loadError, setLoadError] = useState('');
    const dropdownRef = useRef(null);
    const navigate = useNavigate();

    async function fetchNotifications() {
        if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
            return;
        }

        try {
            setLoading(true);
            setLoadError('');

            const res = await api.get('/notifications');
            const nextNotifications = normalizeNotificationsPayload(res.data);

            setNotifications(nextNotifications);
            setUnreadCount(nextNotifications.filter(function (notification) {
                return !notification.isRead;
            }).length);
        } catch (err) {
            console.error('Error fetching notifications:', err);
            setNotifications([]);
            setUnreadCount(0);
            setLoadError(err.response?.data?.message || 'Notifications are temporarily unavailable.');
        } finally {
            setLoading(false);
        }
    }

    useEffect(function () {
        fetchNotifications();
        const interval = setInterval(fetchNotifications, showDropdown ? 15000 : 60000);
        return function () {
            clearInterval(interval);
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
            setNotifications(function (prev) {
                return prev.map(function (notification) {
                    return notification._id === id ? Object.assign({}, notification, { isRead: true }) : notification;
                });
            });
            setUnreadCount(function (prev) {
                return Math.max(0, prev - 1);
            });
        } catch (err) {
            console.error('Error marking as read:', err);
        }
    }

    async function markAllRead() {
        try {
            await api.post('/notifications/read-all');
            setNotifications(function (prev) {
                return prev.map(function (notification) {
                    return Object.assign({}, notification, { isRead: true });
                });
            });
            setUnreadCount(0);
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
                    {unreadCount > 0 ? '🔔' : '🔕'}
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
                                <div className="notification-empty-state__icon">⏳</div>
                                <p>Loading notifications...</p>
                            </div>
                        ) : loadError ? (
                            <div className="notification-empty-state notification-empty-state--error">
                                <div className="notification-empty-state__icon">⚠️</div>
                                <p>{loadError}</p>
                                <button type="button" className="btn btn--secondary btn--sm" onClick={fetchNotifications}>
                                    Retry
                                </button>
                            </div>
                        ) : notifications.length === 0 ? (
                            <div className="notification-empty-state">
                                <div className="notification-empty-state__icon">📭</div>
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
