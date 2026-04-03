import React from 'react';

const API = 'http://localhost:5000';

function UserAvatar({ user, size = 32, style = {}, className = '' }) {
    if (!user) {
        return (
            <div 
                className={`user-avatar ${className}`}
                style={{ 
                    ...style,
                    width: `${size}px`, 
                    height: `${size}px`, 
                    borderRadius: '50%', 
                    background: '#cbd5e1', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    color: 'white',
                    fontWeight: 600,
                    fontSize: `${size * 0.4}px`,
                    flexShrink: 0
                }}
            >
                ?
            </div>
        );
    }

    if (user.profileImage) {
        return (
            <img 
                className={`user-avatar ${className}`}
                src={`${API}${user.profileImage}`} 
                alt={user.name || 'User'} 
                style={{ 
                    ...style,
                    width: `${size}px`, 
                    height: `${size}px`, 
                    borderRadius: '50%', 
                    objectFit: 'cover',
                    flexShrink: 0
                }} 
            />
        );
    }

    const n = user.name || 'User';
    const init = n.split(' ').map(part => part[0]).join('').substring(0, 2).toUpperCase();

    // Generate a consistent background color based on the name length to make it colorful
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];
    const color = colors[n.length % colors.length];

    return (
        <div 
            className={`user-avatar ${className}`}
            style={{ 
                ...style,
                width: `${size}px`, 
                height: `${size}px`, 
                borderRadius: '50%', 
                background: color, 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                color: 'white',
                fontWeight: 600,
                fontSize: `${size * 0.4}px`,
                flexShrink: 0
            }}
            title={user.name}
        >
            {init}
        </div>
    );
}

export default UserAvatar;
