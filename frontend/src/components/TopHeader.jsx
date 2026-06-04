import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { useTheme } from './ThemeContext';
import Notifications from './Notifications';
import useActiveCycle from '../hooks/useActiveCycle';
import UserAvatar from './UserAvatar';
import { APP_ROUTES, getRouteMeta, preloadRoute } from '../routes/routeConfig';

function TopHeader({ onMobileToggle }) {
    var location = useLocation();
    var navigate = useNavigate();
    var { user, logout } = useAuth();
    var { darkMode, toggleDarkMode } = useTheme();
    var { activeCycle, currentPhase } = useActiveCycle();
    var [profileOpen, setProfileOpen] = useState(false);
    var profileRef = useRef(null);
    var [searchQuery, setSearchQuery] = useState('');
    var [searchResults, setSearchResults] = useState([]);
    var [searchOpen, setSearchOpen] = useState(false);
    var searchRef = useRef(null);
    var debounceRef = useRef(null);

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
            if (searchRef.current && !searchRef.current.contains(event.target)) {
                setSearchOpen(false);
            }
        }

        document.addEventListener('mousedown', handleClickOutside);
        return function () {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    var handleSearchChange = useCallback(function (e) {
        var value = e.target.value;
        setSearchQuery(value);

        if (debounceRef.current) clearTimeout(debounceRef.current);

        if (!value.trim()) {
            setSearchResults([]);
            setSearchOpen(false);
            return;
        }

        debounceRef.current = setTimeout(async function () {
            var path = location.pathname;
            var term = value.trim();
            var token = localStorage.getItem('token');
            var headers = { Authorization: 'Bearer ' + token };

            try {
                var results = [];
                if (path.startsWith('/goals') || path.startsWith('/objectives')) {
                    var res = await fetch('/api/objectives?search=' + encodeURIComponent(term), { headers: headers });
                    var data = await res.json();
                    results = (data.objectives || data.individualObjectives || []).slice(0, 8).map(function (o) {
                        return { _id: o._id, label: o.title, sub: o.status || '', path: '/goals' };
                    });
                } else if (path.startsWith('/users')) {
                    var res = await fetch('/api/users?search=' + encodeURIComponent(term), { headers: headers });
                    var data = await res.json();
                    results = (data.users || []).slice(0, 8).map(function (u) {
                        return { _id: u._id, label: u.name, sub: u.email || u.role || '', path: '/users' };
                    });
                } else if (path.startsWith('/tasks')) {
                    var res = await fetch('/api/tasks/my?search=' + encodeURIComponent(term), { headers: headers });
                    var data = await res.json();
                    results = (data.tasks || []).slice(0, 8).map(function (t) {
                        return { _id: t._id, label: t.title, sub: t.status || '', path: '/tasks' };
                    });
                } else if (path.startsWith('/teams')) {
                    var res = await fetch('/api/teams', { headers: headers });
                    var data = await res.json();
                    var list = Array.isArray(data) ? data : [];
                    results = list.filter(function (t) {
                        return t.name && t.name.toLowerCase().includes(term.toLowerCase());
                    }).slice(0, 8).map(function (t) {
                        return { _id: t._id, label: t.name, sub: '', path: '/teams' };
                    });
                } else {
                    results = APP_ROUTES.filter(function (route) {
                        if (!route.showInSidebar) return false;
                        if (route.roles && user && !route.roles.includes(user.role)) return false;
                        return route.label.toLowerCase().includes(term.toLowerCase());
                    }).slice(0, 8).map(function (route) {
                        return { _id: route.path, label: route.label, sub: route.section, path: route.path };
                    });
                }
                setSearchResults(results);
                setSearchOpen(results.length > 0);
            } catch (_err) {
                setSearchResults([]);
                setSearchOpen(false);
            }
        }, 300);
    }, [user, location.pathname]);

    useEffect(function () {
        setSearchQuery('');
        setSearchResults([]);
        setSearchOpen(false);
    }, [location.pathname]);

    function handleSearchSelect(path) {
        setSearchQuery('');
        setSearchResults([]);
        setSearchOpen(false);
        navigate(path);
    }


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
                <div className="ent-header__search" ref={searchRef} style={{ position: 'relative' }}>
                    <span className="ent-header__search-icon">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="11" cy="11" r="8" />
                            <line x1="21" y1="21" x2="16.65" y2="16.65" />
                        </svg>
                    </span>
                    <input
                        type="text"
                        placeholder={
                            location.pathname.startsWith('/goals') || location.pathname.startsWith('/objectives') ? 'Search objectives...' :
                            location.pathname.startsWith('/users') ? 'Search users...' :
                            location.pathname.startsWith('/tasks') ? 'Search tasks...' :
                            location.pathname.startsWith('/teams') ? 'Search teams...' :
                            'Search pages...'
                        }
                        value={searchQuery}
                        onChange={handleSearchChange}
                        onFocus={function () { if (searchResults.length > 0) setSearchOpen(true); }}
                    />
                    {searchOpen && searchResults.length > 0 ? (
                        <div style={{
                            position: 'absolute',
                            top: 'calc(100% + 6px)',
                            left: 0,
                            right: 0,
                            minWidth: 220,
                            background: 'var(--shell-bg-card, #fff)',
                            border: '1px solid var(--shell-border, #e2e8f0)',
                            borderRadius: 14,
                            boxShadow: '0 16px 40px rgba(15, 23, 42, 0.14)',
                            padding: 6,
                            zIndex: 120,
                            animation: 'ent-slideUp 0.16s ease',
                        }}>
                    {searchResults.map(function (result) {
                                return (
                                    <button
                                        key={result._id || result.path}
                                        type="button"
                                        onClick={function () { handleSearchSelect(result.path); }}
                                        style={{
                                            display: 'block',
                                            width: '100%',
                                            textAlign: 'left',
                                            background: 'transparent',
                                            border: 'none',
                                            padding: '10px 12px',
                                            borderRadius: 10,
                                            cursor: 'pointer',
                                            fontSize: 13,
                                            fontWeight: 600,
                                            color: 'var(--shell-text, #0f172a)',
                                            transition: 'background 120ms',
                                        }}
                                        onMouseOver={function (e) { e.currentTarget.style.background = 'var(--shell-bg-hover, #f1f5f9)'; }}
                                        onMouseOut={function (e) { e.currentTarget.style.background = 'transparent'; }}
                                    >
                                        <span style={{ display: 'block' }}>{result.label}</span>
                                        {result.sub ? <span style={{ display: 'block', fontSize: 11, color: 'var(--shell-text-secondary, #64748b)', fontWeight: 400 }}>{result.sub}</span> : null}
                                    </button>
                                );
                            })}
                        </div>
                    ) : null}
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

