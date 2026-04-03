import React from 'react';

function GoalProgressBar({ percent, size }) {
    var pct = Math.min(100, Math.max(0, percent || 0));
    var color = pct >= 70 ? '#059669' : pct >= 40 ? '#D97706' : '#DC2626';
    var height = size === 'small' ? '4px' : '8px';

    return (
        <div className="goal-progress-bar">
            <div className="goal-progress-bar__track" style={{ height: height }}>
                <div className="goal-progress-bar__fill" style={{ width: pct + '%', backgroundColor: color }}></div>
            </div>
            <span className="goal-progress-bar__label">{pct.toFixed(1)}%</span>
        </div>
    );
}

export default GoalProgressBar;
