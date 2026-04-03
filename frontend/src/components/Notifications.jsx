import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { formatDistanceToNow } from 'date-fns';
import UserAvatar from './UserAvatar';

function Notifications() {
    const [notifications, setNotifications] = useState([]);
    const [showDropdown, setShowDropdown] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const dropdownRef = useRef(null);

    useEffect(() => {
        fetchNotifications();
        const interval = setInterval(fetchNotifications, 5000); // Poll every 5 seconds for real-time alerts
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setShowDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const fetchNotifications = async () => {
        try {
            const res = await axios.get('/api/notifications', { params: { t: Date.now() } });
            setNotifications(res.data);
            setUnreadCount(res.data.filter(n => !n.isRead).length);
        } catch (err) {
            console.error('Error fetching notifications:', err);
        }
    };

    const markAsRead = async (id) => {
        try {
            await axios.post(`/api/notifications/${id}/read`);
            setNotifications(prev => prev.map(n => n._id === id ? { ...n, isRead: true } : n));
            setUnreadCount(prev => Math.max(0, prev - 1));
        } catch (err) {
            console.error('Error marking as read:', err);
        }
    };

    const markAllRead = async () => {
        try {
            await axios.post('/api/notifications/read-all');
            setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
            setUnreadCount(0);
        } catch (err) {
            console.error('Error marking all as read:', err);
        }
    };

    const getIcon = (type) => {
        switch (type) {
            case 'MENTION': return '👤';
            case 'DEADLINE': 
            case 'DEADLINE_REMINDER':
            case 'OVERDUE_ALERT': return '⏰';
            case 'KPI_DROP': return '⚠️';
            case 'COMMENT': return '💬';
            case 'GOAL_SUBMITTED':
            case 'GOAL_APPROVED':
            case 'GOAL_REJECTED':
            case 'GOAL_REVISION_REQUESTED': return '🎯';
            case 'MIDYEAR_REVIEW_COMPLETED':
            case 'FINAL_EVALUATION_COMPLETED': return '📝';
            case 'PHASE_OPENED':
            case 'PHASE_CLOSED': return '🔄';
            default: return '🔔';
        }
    };

    return (
        <div className="notifications-container" style={{ position: 'relative' }} ref={dropdownRef}>
            <button 
                className="notification-trigger" 
                onClick={() => setShowDropdown(!showDropdown)}
                style={{
                    background: 'transparent',
                    border: 'none',
                    fontSize: '1.4rem',
                    cursor: 'pointer',
                    position: 'relative',
                    padding: '8px',
                    display: 'flex',
                    alignItems: 'center'
                }}
            >
                {unreadCount > 0 ? '🔔' : '🔕'}
                {unreadCount > 0 && (
                    <span className="badge badge--error" style={{
                        position: 'absolute',
                        top: '4px',
                        right: '4px',
                        fontSize: '0.65rem',
                        minWidth: '18px',
                        height: '18px',
                        padding: '0 4px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: '50%',
                        border: '2px solid white'
                    }}>
                        {unreadCount}
                    </span>
                )}
            </button>

            {showDropdown && (
                <div className="notification-dropdown card shadow-lg" style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    width: '350px',
                    maxHeight: '450px',
                    zIndex: 1000,
                    overflowY: 'auto',
                    marginTop: '0.5rem',
                    padding: 0
                }}>
                    <div className="dropdown-header" style={{
                        padding: '1rem',
                        borderBottom: '1px solid var(--border-color)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        position: 'sticky',
                        top: 0,
                        background: 'inherit',
                        zIndex: 10
                    }}>
                        <h4 style={{ margin: 0 }}>Notifications</h4>
                        {unreadCount > 0 && (
                            <button className="btn btn--link btn--sm" onClick={markAllRead}>
                                Mark all as read
                            </button>
                        )}
                    </div>

                    <div className="dropdown-body">
                        {notifications.length === 0 ? (
                            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                <div style={{ fontSize: '2rem' }}>📭</div>
                                <p>No notifications yet</p>
                            </div>
                        ) : (
                            notifications.map(n => (
                                <div 
                                    key={n._id} 
                                    className={`notification-item ${!n.isRead ? 'unread' : ''}`}
                                    onClick={() => !n.isRead && markAsRead(n._id)}
                                    style={{
                                        padding: '1rem',
                                        borderBottom: '1px solid var(--border-color)',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        gap: '0.75rem',
                                        background: !n.isRead ? 'var(--primary-light)' : 'transparent',
                                        transition: 'background 0.2s'
                                    }}
                                >
                                    <div className="notif-avatar">
                                        {n.sender ? (
                                            <UserAvatar user={n.sender} size={32} />
                                        ) : (
                                            <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--bg-main)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                {getIcon(n.type)}
                                            </div>
                                        )}
                                    </div>
                                    <div className="notif-content" style={{ flex: 1 }}>
                                        <div style={{ fontWeight: '600', fontSize: '0.9rem', marginBottom: '2px' }}>{n.title}</div>
                                        <div style={{ fontSize: '0.85rem', color: 'var(--text-dark)', marginBottom: '4px' }}>{n.message}</div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                            {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                                        </div>
                                    </div>
                                    {!n.isRead && (
                                        <div className="unread-indicator" style={{
                                            width: '8px',
                                            height: '8px',
                                            borderRadius: '50%',
                                            background: 'var(--secondary)',
                                            marginTop: '6px'
                                        }} />
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

export default Notifications;