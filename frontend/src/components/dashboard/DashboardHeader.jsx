import React from 'react';
import { useAuth } from '../AuthContext';
import UserAvatar from '../UserAvatar';

function DashboardHeader({ activeTab, onTabChange }) {
    const { user } = useAuth();

    const tabs = [
        { key: 'me', label: 'Me' },
        { key: 'team', label: 'My Team' },
        { key: 'org', label: 'My Organization' },
    ];

    return (
        <div className="ds-page-header" style={{ marginBottom: '32px' }}>
            <div className="ds-page-header__left" style={{ flexDirection: 'row', alignItems: 'center', gap: '16px' }}>
                <UserAvatar user={user} size={48} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <h1 className="ds-page-header__title">Hello, {user?.name || 'User'}</h1>
                    <p className="ds-page-header__subtitle">Welcome back! Here's your performance overview.</p>
                </div>
            </div>
            <div style={{ display: 'flex', background: 'var(--ds-bg-card)', padding: '4px', borderRadius: 'var(--ds-radius-md)', border: '1px solid var(--ds-border)' }}>
                {tabs.map(tab => (
                    <button
                        key={tab.key}
                        style={{
                            background: activeTab === tab.key ? 'var(--ds-bg-hover)' : 'transparent',
                            color: activeTab === tab.key ? 'var(--ds-text)' : 'var(--ds-text-secondary)',
                            fontWeight: activeTab === tab.key ? '600' : '500',
                            border: 'none',
                            padding: '6px 16px',
                            borderRadius: 'var(--ds-radius-sm)',
                            cursor: 'pointer',
                            fontSize: '13px',
                            transition: 'all var(--ds-transition)'
                        }}
                        onClick={() => onTabChange(tab.key)}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>
        </div>
    );
}

export default DashboardHeader;
