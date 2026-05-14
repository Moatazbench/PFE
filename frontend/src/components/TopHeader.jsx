import React, { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { useTheme } from './ThemeContext';
import Notifications from './Notifications';
import useActiveCycle from '../hooks/useActiveCycle';
import UserAvatar from './UserAvatar';

var pageTitles = {
    '/dashboard': 'Dashboard',
    '/goals': 'Objectives',
    '/tasks': 'Tasks',
    '/meetings': 'Meetings',
    '/feed': 'Team Feed',
    '/cycles': 'Annual Cycles',
    '/midyear-assessments': 'Mid-Year Assessment',
    '/final-evaluations': 'End-Year Review',
    '/performance': 'Performance',
    '/my-team': 'My Team',
    '/feedback': 'Feedback',
    '/career': 'Career Development',
    '/evaluations': 'Assessments',
    '/validation': 'Validation',
    '/hr-decisions': 'HR Decisions',
    '/teams': 'Teams',
    '/users': 'Users',
    '/analytics': 'Analytics',
    '/audit-logs': 'Audit Logs',
    '/settings': 'Settings'
};

var pageSections = {
    '/dashboard': 'Main',
    '/goals': 'Main',
    '/tasks': 'Main',
    '/meetings': 'Main',
    '/feed': 'Main',
    '/cycles': 'Annual Cycle',
    '/midyear-assessments': 'Annual Cycle',
    '/final-evaluations': 'Annual Cycle',
    '/performance': 'Annual Cycle',
    '/my-team': 'People',
    '/feedback': 'People',
    '/career': 'Development',
    '/evaluations': 'Development',
    '/validation': 'Management',
    '/hr-decisions': 'Management',
    '/teams': 'Management',
    '/users': 'Management',
    '/analytics': 'Management',
    '/audit-logs': 'Management',
    '/settings': 'Management'
};

function TopHeader({ onMobileToggle }) {
    var location = useLocation();
    var { user, logout } = useAuth();
    var { darkMode, toggleDarkMode } = useTheme();
    var { activeCycle, currentPhase } = useActiveCycle();
    var [profileOpen, setProfileOpen] = useState(false);
    var profileRef = useRef(null);

    var title = pageTitles[location.pathname] || 'Page';
    var section = pageSections[location.pathname] || '';
    var phaseLabel = currentPhase === 'phase1' ? 'Phase 1' :
        currentPhase === 'phase2' ? 'Phase 2' :
        currentPhase === 'phase3' ? 'Phase 3' :
        currentPhase === 'closed' ? 'Closed' : '';

    useEffect(function () {
        function handleClickOutside(event) {
            if (profileRef.current && !profileRef.current.contains(event.target)) {
                setProfileOpen(false);
            }
        }

        document.addEventListener('mousedown', handleClickOutside);
        return function () {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    function formatRole(role) {
        return String(role || 'User').replace(/_/g, ' ');
    }

    return (
        <header className="ent-header">
            <div className="ent-header__left">
                <button className="ent-mobile-toggle" onClick={onMobileToggle} aria-label="Toggle menu">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/>
                    </svg>
                </button>
                <div>
                    {section && <span className="ent-header__breadcrumb">{section} /</span>}
                    <h1 className="ent-header__page-title">{title}</h1>
                    {phaseLabel && (
                        <div style={{ marginTop: '0.3rem', fontSize: '0.8rem', color: '#64748b' }}>
                            <strong>{phaseLabel}</strong>
                            {activeCycle?.name ? ' · ' + activeCycle.name : ''}
                        </div>
                    )}
                </div>
            </div>

            <div className="ent-header__right">
                <div className="ent-header__search">
                    <span className="ent-header__search-icon">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                        </svg>
                    </span>
                    <input type="text" placeholder="Search..." />
                </div>

                <Notifications />

                <button className="ent-header__icon-btn" onClick={toggleDarkMode} title={darkMode ? 'Light Mode' : 'Dark Mode'}>
                    {darkMode ? (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                        </svg>
                    ) : (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                        </svg>
                    )}
                </button>

                <div className="ent-header__profile" ref={profileRef}>
                    <button className="ent-header__profile-trigger" onClick={function () { setProfileOpen(!profileOpen); }}>
                        <UserAvatar user={user} size={40} />
                        <div className="ent-header__profile-meta">
                            <span className="ent-header__profile-name">{user?.name || 'User'}</span>
                            <span className="ent-header__profile-role">{formatRole(user?.role)}</span>
                        </div>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="6 9 12 15 18 9"/>
                        </svg>
                    </button>

                    {profileOpen && (
                        <div className="ent-header__profile-menu">
                            <a href="/settings" className="ent-header__profile-menu-item">Profile Settings</a>
                            <button className="ent-header__profile-menu-item" onClick={logout}>Sign Out</button>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
}

export default TopHeader;
