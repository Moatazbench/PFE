import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import useActiveCycle from '../hooks/useActiveCycle';
import UserAvatar from './UserAvatar';
import { getSidebarSections, preloadRoute } from '../routes/routeConfig';
import { formatRoleLabel } from '../utils/roles';

function EnterpriseSidebar({ collapsed, setCollapsed, onNavigate }) {
    var location = useLocation();
    var { user, logout } = useAuth();
    var { activeCycle, currentPhase } = useActiveCycle();

    if (!user) return null;

    function isActive(path) {
        return location.pathname === path;
    }

    var navSections = getSidebarSections();

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
            'layers': <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 17 22 12"/></svg>,
            'user': <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
            'pie-chart': <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/></svg>,
            'shield': <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
            'settings': <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
            'log-out': <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
        };
        return icons[name] || <span style={{ display: 'inline-block', width: '18px', height: '18px' }}></span>;
    }

    var phaseLabel = currentPhase === 'phase1' ? 'Phase 1' :
        currentPhase === 'phase2' ? 'Phase 2' :
        currentPhase === 'phase3' ? 'Phase 3' :
        currentPhase === 'closed' ? 'Closed' : 'No active phase';

    return (
        <aside style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: collapsed ? '64px' : '260px',
            height: '100vh',
            backgroundColor: '#0f172a',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            color: 'rgba(255, 255, 255, 0.7)',
            boxSizing: 'border-box',
            fontFamily: 'Inter, sans-serif',
            transition: 'width 0.3s ease'
        }}>
            {/* Toggle Button */}
            <button
                type="button"
                onClick={function () { setCollapsed(!collapsed); }}
                style={{
                    position: 'absolute',
                    top: '24px',
                    right: '-14px',
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    backgroundColor: '#fff',
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    zIndex: 10000,
                    color: '#64748b'
                }}
            >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    {collapsed
                        ? <polyline points="9 18 15 12 9 6"/>
                        : <polyline points="15 18 9 12 15 6"/>
                    }
                </svg>
            </button>

            {/* 1. Logo area */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                padding: collapsed ? '20px 14px' : '20px 16px',
                borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                flexShrink: 0,
                overflow: 'hidden'
            }}>
                <div style={{
                    width: '34px',
                    minWidth: '34px',
                    height: '34px',
                    background: 'linear-gradient(135deg, #818CF8, #4F46E5)',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: '13px'
                }}>PT</div>
                <span style={{ 
                    fontSize: '15px', 
                    fontWeight: 700, 
                    color: '#fff',
                    marginLeft: '12px',
                    opacity: collapsed ? 0 : 1,
                    width: collapsed ? 0 : '100%',
                    transition: 'opacity 0.3s ease, width 0.3s ease',
                    overflow: 'hidden',
                    whiteSpace: 'nowrap'
                }}>Perf Track</span>
            </div>

            {/* 2. Active Phase card */}
            {!collapsed && (
                <div style={{ padding: '16px 16px 12px 16px', flexShrink: 0 }}>
                    <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'rgba(255, 255, 255, 0.4)', marginBottom: '4px' }}>Active phase</div>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#fff', marginBottom: '2px' }}>{phaseLabel}</div>
                    <div style={{
                        fontSize: '13px',
                        color: 'rgba(255, 255, 255, 0.6)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                    }}>
                        {activeCycle?.name || 'No active cycle selected'}
                    </div>
                </div>
            )}

            {/* 3. Nav items */}
            <nav style={{
                flex: 1,
                overflowY: 'auto',
                overflowX: 'hidden',
                padding: collapsed ? '12px 12px' : '12px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '20px',
                marginTop: collapsed ? '8px' : '0'
            }}>
                {navSections.map(function(section) {
                    var visibleItems = section.items.filter(function(item) {
                        if (item.roles && !item.roles.includes(user.role)) return false;
                        if (item.phases && item.phases.indexOf(currentPhase) === -1) return false;
                        return true;
                    });
                    if (visibleItems.length === 0) return null;

                    return (
                        <div key={section.label} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {!collapsed && (
                                <div style={{
                                    fontSize: '11px',
                                    fontWeight: 600,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.8px',
                                    color: 'rgba(255, 255, 255, 0.35)',
                                    padding: '0 12px',
                                    marginBottom: '4px'
                                }}>
                                    {section.label}
                                </div>
                            )}
                            {visibleItems.map(function(item) {
                                var active = isActive(item.path);
                                return (
                                    <Link
                                        key={item.path}
                                        to={item.path}
                                        onClick={onNavigate}
                                        onMouseEnter={function () { preloadRoute(item.path); }}
                                        onFocus={function () { preloadRoute(item.path); }}
                                        title={collapsed ? item.label : undefined}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            padding: collapsed ? '10px' : '10px 12px',
                                            borderRadius: '8px',
                                            textDecoration: 'none',
                                            fontSize: '13.5px',
                                            fontWeight: 500,
                                            color: active ? '#fff' : 'rgba(255, 255, 255, 0.7)',
                                            backgroundColor: active ? 'rgba(79, 70, 229, 0.15)' : 'transparent',
                                            borderLeft: active ? '3px solid #818CF8' : '3px solid transparent',
                                            transition: 'background-color 0.2s, color 0.2s',
                                            justifyContent: collapsed ? 'center' : 'flex-start'
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '18px', minWidth: '18px' }}>
                                            {getIcon(item.icon)}
                                        </div>
                                        <span style={{ 
                                            marginLeft: '12px',
                                            opacity: collapsed ? 0 : 1,
                                            width: collapsed ? 0 : '100%',
                                            overflow: 'hidden', 
                                            textOverflow: 'ellipsis', 
                                            whiteSpace: 'nowrap',
                                            transition: 'opacity 0.3s ease, width 0.3s ease'
                                        }}>
                                            {item.label}
                                        </span>
                                    </Link>
                                );
                            })}
                        </div>
                    );
                })}
            </nav>

            {/* 4. Bottom section */}
            <div style={{
                borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                padding: collapsed ? '16px 12px' : '16px',
                flexShrink: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
            }}>
                <button
                    type="button"
                    onClick={logout}
                    title={collapsed ? "Sign Out" : undefined}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: collapsed ? '10px' : '10px 12px',
                        borderRadius: '8px',
                        backgroundColor: 'transparent',
                        border: 'none',
                        color: 'rgba(255, 255, 255, 0.7)',
                        fontSize: '13.5px',
                        fontWeight: 500,
                        cursor: 'pointer',
                        width: '100%',
                        textAlign: 'left',
                        justifyContent: collapsed ? 'center' : 'flex-start'
                    }}
                >
                    <div style={{ width: '18px', minWidth: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {getIcon('log-out')}
                    </div>
                    <span style={{
                        marginLeft: '12px',
                        opacity: collapsed ? 0 : 1,
                        width: collapsed ? 0 : '100%',
                        overflow: 'hidden',
                        whiteSpace: 'nowrap',
                        transition: 'opacity 0.3s ease, width 0.3s ease'
                    }}>
                        Sign Out
                    </span>
                </button>

                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: collapsed ? '8px' : '8px 12px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(255, 255, 255, 0.04)',
                    justifyContent: collapsed ? 'center' : 'flex-start'
                }}>
                    <UserAvatar user={user} size={collapsed ? 32 : 36} />
                    <div style={{ 
                        display: 'flex', 
                        flexDirection: 'column', 
                        overflow: 'hidden',
                        marginLeft: collapsed ? 0 : '12px',
                        opacity: collapsed ? 0 : 1,
                        width: collapsed ? 0 : '100%',
                        transition: 'opacity 0.3s ease, width 0.3s ease'
                    }}>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {user.name}
                        </span>
                        <span style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.5)', textTransform: 'capitalize' }}>
                            {formatRoleLabel(user.role)}
                        </span>
                    </div>
                </div>
            </div>
        </aside>
    );
}

export default React.memo(EnterpriseSidebar);
