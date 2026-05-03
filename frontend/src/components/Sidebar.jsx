import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { useTheme } from './ThemeContext';

function Sidebar({ collapsed, setCollapsed }) {
    var location = useLocation();
    var { user, logout } = useAuth();
    var { darkMode, toggleDarkMode } = useTheme();

    if (!user) return null;

    function isActive(path) {
        return location.pathname === path;
    }

    var navSections = [
        {
            label: 'Main',
            items: [
                { path: '/dashboard', label: 'Dashboard', icon: 'grid' },
                { path: '/goals', label: 'Objectives', icon: 'target' },
                { path: '/tasks', label: 'Tasks', icon: 'check-square' },
                { path: '/meetings', label: 'Meetings', icon: 'calendar' },
                { path: '/feed', label: 'Feed', icon: 'activity' },
            ],
        },
        {
            label: 'Annual Cycle',
            items: [
                { path: '/cycles', label: 'Manage Cycles', icon: 'refresh', roles: ['ADMIN', 'HR'] },
                { path: '/midyear-assessments', label: 'Mid-Year Execution', icon: 'bar-chart' },
                { path: '/final-evaluations', label: 'End-Year Review', icon: 'clipboard' },
                { path: '/performance', label: 'Performance', icon: 'trending-up' },
            ],
        },
        {
            label: 'People',
            items: [
                { path: '/my-team', label: 'My Team', icon: 'users' },
                { path: '/feedback', label: 'Feedback', icon: 'message-circle' },
            ],
        },
        {
            label: 'Development',
            items: [
                { path: '/career', label: 'Career', icon: 'compass' },
                { path: '/evaluations', label: 'Assessments', icon: 'file-text' },
            ],
        },
        {
            label: 'Management',
            items: [
                { path: '/validation', label: 'Validation', icon: 'check-circle', roles: ['ADMIN', 'TEAM_LEADER'] },
                { path: '/hr-decisions', label: 'HR Decisions', icon: 'briefcase', roles: ['ADMIN', 'TEAM_LEADER', 'HR'] },
                { path: '/teams', label: 'Teams', icon: 'layers', roles: ['ADMIN', 'HR', 'TEAM_LEADER'] },
                { path: '/users', label: 'Users', icon: 'user', roles: ['ADMIN', 'HR'] },
                { path: '/analytics', label: 'Analytics', icon: 'pie-chart', roles: ['ADMIN', 'HR', 'TEAM_LEADER'] },
                { path: '/audit-logs', label: 'Audit Logs', icon: 'shield', roles: ['ADMIN', 'HR'] },
                { path: '/settings', label: 'Settings', icon: 'settings' },
            ],
        },
    ];

    function getIcon(name) {
        var icons = {
            'grid': <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>,
            'target': <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>,
            'check-square': <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>,
            'calendar': <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
            'activity': <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
            'refresh': <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>,
            'bar-chart': <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg>,
            'clipboard': <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>,
            'star': <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
            'trending-up': <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>,
            'users': <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
            'message-circle': <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>,
            'compass': <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>,
            'file-text': <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
            'check-circle': <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>,
            'briefcase': <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>,
            'layers': <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>,
            'user': <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
            'pie-chart': <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/></svg>,
            'shield': <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
            'settings': <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
            'sun': <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>,
            'moon': <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>,
            'log-out': <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
            'chevron-left': <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>,
            'chevron-right': <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>,
        };
        return icons[name] || <span style={{width:18,height:18,display:'inline-block'}}></span>;
    }

    var initials = user.name ? user.name.split(' ').map(function(n){return n[0];}).join('').substring(0,2).toUpperCase() : '?';

    return (
        <aside className="ds-sidebar" data-collapsed={collapsed}>
            {/* Brand */}
            <div className="ds-sidebar__brand">
                <div className="ds-sidebar__brand-logo">PM</div>
                <span className="ds-sidebar__brand-name">PerfManager</span>
                <button className="ds-sidebar__collapse-btn" onClick={function(){setCollapsed(!collapsed);}} title={collapsed ? 'Expand' : 'Collapse'}>
                    {getIcon(collapsed ? 'chevron-right' : 'chevron-left')}
                </button>
            </div>

            {/* Navigation */}
            <nav className="ds-sidebar__nav">
                {navSections.map(function(section, sIndex) {
                    var visibleItems = section.items.filter(function(item) {
                        if (!item.roles) return true;
                        return item.roles.includes(user.role);
                    });
                    if (visibleItems.length === 0) return null;

                    return (
                        <div key={section.label} className="ds-sidebar__group">
                            <div className="ds-sidebar__group-label">{section.label}</div>
                            {visibleItems.map(function(item) {
                                return (
                                    <Link
                                        key={item.path}
                                        to={item.path}
                                        className={'ds-sidebar__item' + (isActive(item.path) ? ' active' : '')}
                                        title={collapsed ? item.label : ''}
                                    >
                                        <span className="ds-sidebar__item-icon">{getIcon(item.icon)}</span>
                                        <span>{item.label}</span>
                                    </Link>
                                );
                            })}
                            {sIndex < navSections.length - 1 && <div className="ds-sidebar__divider"></div>}
                        </div>
                    );
                })}
            </nav>

            {/* Footer */}
            <div className="ds-sidebar__footer">
                {/* Theme toggle */}
                <button className="ds-sidebar__item" onClick={toggleDarkMode} title={darkMode ? 'Light Mode' : 'Dark Mode'}>
                    <span className="ds-sidebar__item-icon">{getIcon(darkMode ? 'sun' : 'moon')}</span>
                    <span className="ds-sidebar__theme-label">{darkMode ? 'Light Mode' : 'Dark Mode'}</span>
                </button>

                {/* Logout */}
                <button className="ds-sidebar__item" onClick={logout} title="Sign Out">
                    <span className="ds-sidebar__item-icon">{getIcon('log-out')}</span>
                    <span className="ds-sidebar__theme-label">Sign Out</span>
                </button>

                {/* User */}
                <div className="ds-sidebar__user">
                    <div className="ds-sidebar__user-avatar">{initials}</div>
                    <div className="ds-sidebar__user-info">
                        <span className="ds-sidebar__user-name">{user.name}</span>
                        <span className="ds-sidebar__user-role">{user.role}</span>
                    </div>
                </div>
            </div>
        </aside>
    );
}

export default Sidebar;
