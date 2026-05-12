import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import useActiveCycle from '../hooks/useActiveCycle';

function CyclePhaseRoute({ allowedRoles, allowedPhases, children }) {
    var { user } = useAuth();
    var { currentPhase, loading } = useActiveCycle();

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}>
                Loading...
            </div>
        );
    }

    if (allowedRoles && allowedRoles.indexOf(user.role) === -1) {
        return <Navigate to="/dashboard" replace />;
    }

    if (allowedPhases && allowedPhases.length > 0 && allowedPhases.indexOf(currentPhase) === -1) {
        return <Navigate to="/dashboard" replace />;
    }

    return children;
}

export default CyclePhaseRoute;
