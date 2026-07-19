import React, { useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import EnterpriseSidebar from './EnterpriseSidebar';
import TopHeader from './TopHeader';
import useScrollReveal from '../hooks/useScrollReveal';

function DashboardLayout({ children }) {
    var { user } = useAuth();
    var location = useLocation();
    var pageRef = useRef(null);
    var [sidebarCollapsed, setSidebarCollapsed] = useState(function() {
        return localStorage.getItem('sidebarCollapsed') === 'true';
    });
    var [mobileOpen, setMobileOpen] = useState(false);

    useScrollReveal(pageRef, location.pathname);

    function handleToggleSidebar(collapsed) {
        setSidebarCollapsed(collapsed);
        localStorage.setItem('sidebarCollapsed', collapsed);
    }

    if (!user) {
        return <>{children}</>;
    }

    var sidebarWidth = sidebarCollapsed ? '64px' : '260px';

    return (
        <div className="app-shell" style={{ display: 'flex', height: '100dvh', minHeight: '100dvh', width: '100%', backgroundColor: 'var(--shell-bg, #F8FAFC)', overflow: 'hidden' }}>
            {mobileOpen && (
                <div
                    style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9998 }}
                    onClick={function () { setMobileOpen(false); }}
                    aria-hidden="true"
                ></div>
            )}

            <EnterpriseSidebar
                collapsed={sidebarCollapsed}
                setCollapsed={handleToggleSidebar}
                onNavigate={function () { setMobileOpen(false); }}
            />

            <div className="app-shell__workspace" style={{
                flex: 1,
                marginLeft: sidebarWidth,
                width: `calc(100% - ${sidebarWidth})`,
                display: 'flex',
                flexDirection: 'column',
                height: '100dvh',
                minHeight: 0,
                minWidth: 0,
                overflow: 'hidden',
                transition: 'margin-left 0.3s ease, width 0.3s ease'
            }}>
                <TopHeader onMobileToggle={function () { setMobileOpen(!mobileOpen); }} />
                <main className="app-shell__main">
                    <div className="app-shell__page" ref={pageRef}>{children}</div>
                </main>
            </div>
        </div>
    );
}

export default DashboardLayout;
