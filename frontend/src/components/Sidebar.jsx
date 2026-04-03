import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { useTheme } from './ThemeContext';
import UserAvatar from './UserAvatar';

function Sidebar({ collapsed, setCollapsed }) {
    const location = useLocation();
    const { user } = useAuth();
    const { darkMode, toggleDarkMode } = useTheme();

    if (!user) return null;

    function isActive(path) {
        return location.pathname === path;
    }

    const navSections = [
        {
            label: 'Main',
            items: [
                { path: '/dashboard', label: 'Home', icon: '🏠', roles: null },
                { path: '/feed', label: 'Feed', icon: '📡', roles: null },
                { path: '/ai-assistant', label: 'AI Assistant', icon: '✨', roles: null },
                { path: '/goals', label: 'Objectives', icon: '🎯', roles: null },
                { path: '/tasks', label: 'Tasks', icon: '✅', roles: null },
                { path: '/meetings', label: 'Meetings', icon: '📅', roles: null },
            ],
        },
        {
            label: 'Annual Cycle',
            items: [
                { path: '/admin-dashboard', label: 'Cycle Dashboard', icon: '📊', roles: ['ADMIN', 'HR'] },
                { path: '/cycles', label: 'Manage Cycles', icon: '🔄', roles: ['ADMIN', 'HR'] },
                { path: '/annual-goals', label: 'My Goals (P1)', icon: '🎯', roles: null },
                { path: '/goal-approvals', label: 'Goal Approvals', icon: '📋', roles: ['ADMIN', 'HR', 'TEAM_LEADER', 'MANAGER'] },
                { path: '/midyear-assessments', label: 'Mid-Year (P2)', icon: '⚖️', roles: null },
                { path: '/final-evaluations', label: 'End-Year (P3)', icon: '📝', roles: null },
                { path: '/evaluation-list', label: 'Evaluations', icon: '⭐', roles: null },
                { path: '/performance', label: 'Performance', icon: '🏆', roles: null },
            ],
        },
        {
            label: 'People',
            items: [
                { path: '/my-team', label: 'Team Dashboard', icon: '👥', roles: null },
                { path: '/feedback', label: 'Feedback', icon: '💬', roles: null },
            ],
        },
        {
            label: 'Development',
            items: [
                { path: '/career', label: 'Career', icon: '🚀', roles: null },
                { path: '/evaluations', label: 'Evaluations', icon: '📝', roles: null },
            ],
        },
        {
            label: 'Management',
            items: [
                { path: '/validation', label: 'Validation', icon: '✔️', roles: ['ADMIN', 'TEAM_LEADER'] },
                { path: '/hr-decisions', label: 'HR Decisions', icon: '⚖️', roles: ['ADMIN', 'TEAM_LEADER', 'HR'] },
                { path: '/teams', label: 'Teams', icon: '👥', roles: ['ADMIN', 'HR', 'TEAM_LEADER'] },
                { path: '/users', label: 'Users', icon: '👤', roles: ['ADMIN', 'HR'] },
                { path: '/analytics', label: 'Analytics', icon: '📈', roles: ['ADMIN', 'HR', 'TEAM_LEADER'] },
                { path: '/audit-logs', label: 'Audit Logs', icon: '🛡️', roles: ['ADMIN', 'HR'] },
                { path: '/settings', label: 'Settings', icon: '⚙️', roles: null },
            ],
        },
    ];

    return (
        <aside className="apple-sidebar" data-collapsed={collapsed}>
            {/* Toggle Button for Desktop */}
            <div style={{ padding: '0 12px', display: 'flex', justifyContent: collapsed ? 'center' : 'flex-end', marginBottom: '8px' }}>
                <button
                    onClick={() => setCollapsed(!collapsed)}
                    title={collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--apple-text-secondary)', padding: '4px' }}
                >
                    {collapsed ? '▶' : '◀'}
                </button>
            </div>

            {/* Navigation */}
            <nav style={{ flex: 1 }}>
                {navSections.map(function (section, index) {
                    const visibleItems = section.items.filter(function (item) {
                        if (!item.roles) return true;
                        return item.roles.includes(user.role);
                    });
                    if (visibleItems.length === 0) return null;

                    return (
                        <div key={section.label}>
                            <div className="sidebar-section-title">
                                <span>{section.label}</span>
                            </div>
                            
                            {visibleItems.map(item => (
                                <Link
                                    key={item.path}
                                    to={item.path}
                                    className={'sidebar-nav-item' + (isActive(item.path) ? ' active' : '')}
                                    title={collapsed ? item.label : ''}
                                >
                                    <span className="sidebar-nav-icon">{item.icon}</span>
                                    {!collapsed && <span>{item.label}</span>}
                                </Link>
                            ))}
                            {index < navSections.length - 1 && <div className="sidebar-divider"></div>}
                        </div>
                    );
                })}
            </nav>

            {/* Bottom Actions */}
            <div style={{ marginTop: 'auto', paddingTop: '16px' }}>
                <div className="sidebar-divider"></div>
                
                {/* Theme Toggle */}
                <button 
                    onClick={toggleDarkMode}
                    className="sidebar-nav-item"
                    style={{ width: '100%', background: 'transparent', border: 'none', cursor: 'pointer', marginBottom: '8px', padding: '10px 12px' }}
                >
                    <span className="sidebar-nav-icon">{darkMode ? '🌙' : '☀️'}</span>
                    {!collapsed && <span>{darkMode ? 'Dark Mode' : 'Light Mode'}</span>}
                </button>

                {/* User Info */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', borderRadius: '8px', backgroundColor: 'var(--apple-bg)' }}>
                    <UserAvatar user={user} size={32} />
                    {!collapsed && (
                        <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                            <span style={{ fontWeight: '600', fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.name}</span>
                            <span style={{ fontSize: '12px', color: 'var(--apple-text-secondary)' }}>{user.role}</span>
                        </div>
                    )}
                </div>
            </div>
        </aside>
    );
}

export default Sidebar;
