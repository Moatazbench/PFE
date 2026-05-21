import React, { Suspense, useEffect } from 'react';
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider } from './components/AuthContext';
import { ThemeProvider } from './components/ThemeContext';
import { ActiveCycleProvider } from './components/ActiveCycleContext';
import RouteGuard from './components/RouteGuard';
import DashboardLayout from './components/DashboardLayout';
import ErrorBoundary from './components/common/ErrorBoundary';
import LoadingSkeleton from './components/common/LoadingSkeleton';
import { APP_ROUTES, PUBLIC_ROUTES, preloadPrimaryAppRoutes } from './routes/routeConfig';

function PublicRouteLoader() {
  return (
    <div className="page-loading" aria-live="polite">
      <div className="spinner"></div>
      <p>Loading page...</p>
    </div>
  );
}

function AppRouteLoader() {
  return (
    <div className="ds-main__inner" aria-live="polite">
      <div className="dash-loading-state">
        <LoadingSkeleton rows={2} height={112} />
        <LoadingSkeleton rows={2} height={132} />
        <LoadingSkeleton rows={3} height={118} />
      </div>
    </div>
  );
}

function AppShell() {
  return (
    <DashboardLayout>
      <Suspense fallback={<AppRouteLoader />}>
        <Outlet />
      </Suspense>
    </DashboardLayout>
  );
}

function GuardedAppRoute({ route }) {
  var Component = route.component;

  return (
    <RouteGuard route={route}>
      <Component />
    </RouteGuard>
  );
}

function getWarmRouteLimit() {
  if (typeof navigator === 'undefined') {
    return 2;
  }

  var connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (!connection) {
    return 2;
  }

  if (connection.saveData) {
    return 0;
  }

  var effectiveType = String(connection.effectiveType || '').toLowerCase();
  if (effectiveType === 'slow-2g' || effectiveType === '2g') {
    return 0;
  }

  if (effectiveType === '3g') {
    return 1;
  }

  return 2;
}

function App() {
  useEffect(function () {
    var cleanup;

    function warmRoutes() {
      var warmLimit = getWarmRouteLimit();
      if (warmLimit > 0) {
        preloadPrimaryAppRoutes(warmLimit);
      }
    }

    if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
      var idleId = window.requestIdleCallback(warmRoutes, { timeout: 1200 });
      cleanup = function () {
        window.cancelIdleCallback(idleId);
      };
    } else {
      var timeoutId = window.setTimeout(warmRoutes, 300);
      cleanup = function () {
        window.clearTimeout(timeoutId);
      };
    }

    return cleanup;
  }, []);

  return (
    <AuthProvider>
      <ThemeProvider>
        <ActiveCycleProvider>
          <ErrorBoundary>
            <Routes>
              {PUBLIC_ROUTES.map(function (route) {
                var Component = route.component;
                return (
                  <Route
                    key={route.path}
                    path={route.path}
                    element={
                      <Suspense fallback={<PublicRouteLoader />}>
                        <Component />
                      </Suspense>
                    }
                  />
                );
              })}

              <Route element={<AppShell />}>
                {APP_ROUTES.map(function (route) {
                  return (
                    <Route
                      key={route.path}
                      path={route.path}
                      element={<GuardedAppRoute route={route} />}
                    />
                  );
                })}
              </Route>

              <Route path="/" element={<Navigate to="/login" replace />} />
              <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
          </ErrorBoundary>
        </ActiveCycleProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}

export default App;
