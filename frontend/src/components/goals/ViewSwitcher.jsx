import React from 'react';

function ViewSwitcher({ activeView, onChange }) {
    var views = [
        { key: 'list', icon: '☰', label: 'List' },
        { key: 'feed', icon: '📰', label: 'Feed' },
        { key: 'user', icon: '👤', label: 'User' },
    ];

    return (
        <div className="goals-view-switcher">
            {views.map(function (v) {
                return (
                    <button
                        key={v.key}
                        className={'goals-view-switcher__btn' + (activeView === v.key ? ' goals-view-switcher__btn--active' : '')}
                        onClick={function () { onChange(v.key); }}
                    >
                        <span>{v.icon}</span> {v.label}
                    </button>
                );
            })}
        </div>
    );
}

export default ViewSwitcher;
