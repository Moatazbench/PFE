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
        <div className="dash-header">
            <div className="dash-header__greeting" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <UserAvatar user={user} size={48} />
                <div>
                    <h1>Hello, {user?.name || 'User'} <span className="dash-header__wave">👋</span></h1>
                    <p className="dash-header__subtitle" style={{ margin: '4px 0 0 0' }}>Welcome back! Here's your performance overview.</p>
                </div>
            </div>
            <div className="dash-header__tabs">
                {tabs.map(tab => (
                    <button
                        key={tab.key}
                        className={'dash-header__tab' + (activeTab === tab.key ? ' dash-header__tab--active' : '')}
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
