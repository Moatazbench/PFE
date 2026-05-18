import React from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import useActiveCycle from '../hooks/useActiveCycle';

function GuardState({ title, description, ctaLabel = 'Go to dashboard', ctaHref = '/dashboard' }) {
  return (
    <div className="ds-main__inner">
      <div
        className="dash-card"
        style={{
          maxWidth: '720px',
          margin: '3rem auto',
          padding: '1.5rem',
          display: 'grid',
          gap: '0.75rem',
        }}
      >
        <strong style={{ fontSize: '1.1rem', color: 'var(--text-dark, #0f172a)' }}>{title}</strong>
        <p style={{ margin: 0, color: 'var(--text-muted, #475569)', lineHeight: 1.6 }}>{description}</p>
        <div>
          <Link to={ctaHref} className="btn btn--primary">
            {ctaLabel}
          </Link>
        </div>
      </div>
    </div>
  );
}

function LoadingState({ text }) {
  return (
    <div className="ds-main__inner">
      <div className="page-loading" aria-live="polite">
        <div className="spinner"></div>
        <p>{text}</p>
      </div>
    </div>
  );
}

function RouteGuard({ route, children }) {
  var auth = useAuth();
  var user = auth.user;
  var authLoading = auth.loading;
  var needsCycleCheck = Array.isArray(route?.allowedPhases) && route.allowedPhases.length > 0;
  var cycleState = useActiveCycle();

  if (authLoading) {
    return <LoadingState text="Checking your workspace access..." />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (route?.allowedRoles && route.allowedRoles.indexOf(user.role) === -1) {
    return (
      <GuardState
        title={route.accessDeniedTitle || 'This page is not available for your role'}
        description={route.accessDeniedDescription || 'Your account can stay signed in, but this workflow is only available to a different role.'}
      />
    );
  }

  if (needsCycleCheck && cycleState.loading) {
    return <LoadingState text="Checking the active performance cycle..." />;
  }

  if (needsCycleCheck && route.allowedPhases.indexOf(cycleState.currentPhase) === -1) {
    var phaseList = route.allowedPhases.join(', ');
    var currentPhase = cycleState.currentPhase || 'no active phase';

    return (
      <GuardState
        title={route.phaseUnavailableTitle || 'This workflow is not available right now'}
        description={
          route.phaseUnavailableDescription ||
          ('This page is available during ' + phaseList + '. The current cycle is in ' + currentPhase + '.')
        }
      />
    );
  }

  return children;
}

export default RouteGuard;

