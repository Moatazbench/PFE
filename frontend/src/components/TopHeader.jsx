import React from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { useTheme } from './ThemeContext';
import Notifications from './Notifications';

var pageTitles = {
    '/dashboard': 'Dashboard',
    '/goals': 'Objectives',
    '/tasks': 'Tasks',
    '/meetings': 'Meetings',
    '/feed': 'Team Feed',
    '/cycles': 'Annual Cycles',
    '/midyear-assessments': 'Mid-Year Execution',
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
    var { user } = useAuth();
    var { darkMode, toggleDarkMode } = useTheme();

    var title = pageTitles[location.pathname] || 'Page';
    var section = pageSections[location.pathname] || '';

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
                </div>
            </div>

            <div className="ent-header__right">
                {/* Search */}
                <div className="ent-header__search">
                    <span className="ent-header__search-icon">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                        </svg>
                    </span>
                    <input type="text" placeholder="Search..." />
                </div>

                {/* Notifications */}
                <Notifications />

                {/* Theme Toggle */}
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
            </div>
        </header>
    );
}

export default TopHeader;
