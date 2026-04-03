import React, { useState } from 'react';
import { useAuth } from './AuthContext';
import Sidebar from './Sidebar';
import Notifications from './Notifications';

function DashboardLayout({ children }) {
    const { user, logout } = useAuth();
    
    // We pass this collapse state down to Sidebar if we want to manage it globally,
    // or we can let Sidebar manage its own collapse state.
    // However, since app-main grid layout depends on sidebar collapse in our CSS,
    // let's pass a function to sync the state.
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

    if (!user) {
        return <>{children}</>;
    }

    return (
        <div className="app-container">
            <header className="app-header">
                <div style={{ display: 'flex', alignItem: 'center', gap: '8px' }}>
                    <div className="sidebar__brand-text" style={{ fontSize: '18px', fontWeight: 'bold' }}>PerfManager</div>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ position: 'relative', display: 'none' }} className="search-container-desktop">
                        <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--apple-text-secondary)', fontSize: '14px' }}>🔍</span>
                        <input 
                            type="text" 
                            style={{ 
                                backgroundColor: 'var(--apple-bg-secondary)', 
                                border: 'none', 
                                borderRadius: '16px', 
                                padding: '8px 16px 8px 36px', 
                                fontSize: '14px',
                                outline: 'none'
                            }} 
                            placeholder="Search..."
                        />
                    </div>
                    <Notifications />
                    <button 
                        onClick={logout} 
                        style={{
                            background: 'transparent', 
                            border: '1px solid var(--apple-bg-tertiary)', 
                            borderRadius: '50%', 
                            width: '36px', 
                            height: '36px', 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center', 
                            cursor: 'pointer',
                            color: 'var(--apple-text-secondary)'
                        }}
                        title="Logout"
                    >
                        🚪
                    </button>
                </div>
            </header>

            <div className="app-main" style={{ gridTemplateColumns: sidebarCollapsed ? '60px 1fr' : '260px 1fr' }}>
                <Sidebar collapsed={sidebarCollapsed} setCollapsed={setSidebarCollapsed} />
                
                <main style={{ flex: 1, overflowY: 'auto', backgroundColor: 'var(--apple-bg)', position: 'relative' }}>
                    {children}
                </main>
            </div>
        </div>
    );
}

export default DashboardLayout;
