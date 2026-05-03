import React, { useState } from 'react';
import { useAuth } from './AuthContext';
import EnterpriseSidebar from './EnterpriseSidebar';
import TopHeader from './TopHeader';

function DashboardLayout({ children }) {
    var { user } = useAuth();
    var [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    var [mobileOpen, setMobileOpen] = useState(false);

    if (!user) {
        return <>{children}</>;
    }

    var shellClass = 'ent-shell';
    if (sidebarCollapsed) shellClass += ' ent-shell--collapsed';
    if (mobileOpen) shellClass += ' ent-shell--mobile-open';

    return (
        <div className={shellClass}>
            {/* Mobile overlay */}
            <div className="ent-sidebar-overlay" onClick={function(){ setMobileOpen(false); }}></div>

            {/* Sidebar */}
            <EnterpriseSidebar collapsed={sidebarCollapsed} setCollapsed={setSidebarCollapsed} />

            {/* Content wrapper */}
            <div className="ent-shell__content-wrapper">
                <TopHeader onMobileToggle={function(){ setMobileOpen(!mobileOpen); }} />
                <main className="ent-main">
                    {children}
                </main>
            </div>
        </div>
    );
}

export default DashboardLayout;
