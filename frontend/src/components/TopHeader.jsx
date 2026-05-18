import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { useTheme } from './ThemeContext';
import Notifications from './Notifications';
import useActiveCycle from '../hooks/useActiveCycle';
import UserAvatar from './UserAvatar';
import { getRouteMeta, preloadRoute } from '../routes/routeConfig';

function TopHeader({ onMobileToggle }) {
    var location = useLocation();
    var { user, logout } = useAuth();
    var { darkMode, toggleDarkMode } = useTheme();
    var { activeCycle, currentPhase } = useActiveCycle();
    var [profileOpen, setProfileOpen] = useState(false);
    var profileRef = useRef(null);

    var routeMeta = getRouteMeta(location.pathname);
    var title = routeMeta?.label || 'Page';
    var section = routeMeta?.section || '';
    var phaseLabel = currentPhase === 'phase1'
        ? 'Phase 1'
        : currentPhase === 'phase2'
            ? 'Phase 2'
            : currentPhase === 'phase3'
                ? 'Phase 3'
                : currentPhase === 'closed'
                    ? 'Closed'
                    : '';

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
                <button type="button" className="ent-mobile-toggle" onClick={onMobileToggle} aria-label="Toggle menu">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="3" y1="12" x2="21" y2="12" />
                        <line x1="3" y1="6" x2="21" y2="6" />
                        <line x1="3" y1="18" x2="21" y2="18" />
                    </svg>
                </button>
                <div>
                    {section ? <span className="ent-header__breadcrumb">{section} /</span> : null}
                    <h1 className="ent-header__page-title">{title}</h1>
                    {phaseLabel ? (
                        <div className="ent-header__phase">
                            <strong>{phaseLabel}</strong>
                            {activeCycle?.name ? ' - ' + activeCycle.name : ''}
                        </div>
                    ) : null}
                </div>
            </div>

            <div className="ent-header__right">
                <div className="ent-header__search">
                    <span className="ent-header__search-icon">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="11" cy="11" r="8" />
                            <line x1="21" y1="21" x2="16.65" y2="16.65" />
                        </svg>
                    </span>
                    <input type="text" placeholder="Search..." />
                </div>

                <Notifications />

                <button type="button" className="ent-header__icon-btn" onClick={toggleDarkMode} title={darkMode ? 'Light Mode' : 'Dark Mode'}>
                    {darkMode ? (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="5" />
                            <line x1="12" y1="1" x2="12" y2="3" />
                            <line x1="12" y1="21" x2="12" y2="23" />
                            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                            <line x1="1" y1="12" x2="3" y2="12" />
                            <line x1="21" y1="12" x2="23" y2="12" />
                            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                        </svg>
                    ) : (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                        </svg>
                    )}
                </button>

                <div className="ent-header__profile" ref={profileRef}>
                    <button type="button" className="ent-header__profile-trigger" onClick={function () { setProfileOpen(!profileOpen); }}>
                        <UserAvatar user={user} size={48} />
                        <div className="ent-header__profile-meta">
                            <span className="ent-header__profile-name">{user?.name || 'User'}</span>
                            <span className="ent-header__profile-role">{formatRole(user?.role)}</span>
                        </div>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="6 9 12 15 18 9" />
                        </svg>
                    </button>

                    {profileOpen ? (
                        <div className="ent-header__profile-menu">
                            <Link
                                to="/settings"
                                className="ent-header__profile-menu-item"
                                onMouseEnter={function () { preloadRoute('/settings'); }}
                                onFocus={function () { preloadRoute('/settings'); }}
                                onClick={function () { setProfileOpen(false); }}
                            >
                                Profile Settings
                            </Link>
                            <button type="button" className="ent-header__profile-menu-item" onClick={logout}>Sign Out</button>
                        </div>
                    ) : null}
                </div>
            </div>
        </header>
    );
}

export default TopHeader;
