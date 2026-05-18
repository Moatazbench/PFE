import React from 'react';

function ViewSwitcher({ activeView, onChange }) {
    var views = [
        { key: 'list', label: 'List' },
        { key: 'feed', label: 'Feed' },
        { key: 'user', label: 'By User' },
    ];

    return (
        <div className="goals-view-switcher" role="tablist" aria-label="Objective views">
            {views.map(function (view) {
                return (
                    <button
                        type="button"
                        key={view.key}
                        className={'goals-view-switcher__btn' + (activeView === view.key ? ' goals-view-switcher__btn--active' : '')}
                        aria-pressed={activeView === view.key}
                        onClick={function () { onChange(view.key); }}
                    >
                        {view.label}
                    </button>
                );
            })}
        </div>
    );
}

export default ViewSwitcher;
