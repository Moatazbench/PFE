import React from 'react';

function ProgressDonut({ percent = 0, size = 80, strokeWidth = 8, color = '#7C3AED', label = '' }) {
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const safePercent = Math.min(100, Math.max(0, percent || 0));
    const offset = circumference - (safePercent / 100) * circumference;
    const center = size / 2;

    return (
        <div className="progress-donut" style={{ width: size, height: size, position: 'relative' }}>
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                {/* Background circle */}
                <circle
                    cx={center}
                    cy={center}
                    r={radius}
                    fill="none"
                    stroke="#e8e8f0"
                    strokeWidth={strokeWidth}
                />
                {/* Progress circle */}
                <circle
                    cx={center}
                    cy={center}
                    r={radius}
                    fill="none"
                    stroke={color}
                    strokeWidth={strokeWidth}
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    strokeLinecap="round"
                    style={{
                        transform: 'rotate(-90deg)',
                        transformOrigin: '50% 50%',
                        transition: 'stroke-dashoffset 0.8s ease'
                    }}
                />
            </svg>
            <div className="progress-donut__value">
                <span className="progress-donut__percent">{Math.round(safePercent)}%</span>
                {label && <span className="progress-donut__label">{label}</span>}
            </div>
        </div>
    );
}

export default ProgressDonut;
