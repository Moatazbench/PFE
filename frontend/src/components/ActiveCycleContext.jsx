import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from './AuthContext';
import api from '../services/api';
import { ActiveCycleContext, pickActiveCycle } from './ActiveCycleStore';

const ACTIVE_CYCLE_STORAGE_KEY = 'activeCycleSnapshot';

function readStoredActiveCycle() {
  try {
    var raw = localStorage.getItem(ACTIVE_CYCLE_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function persistStoredActiveCycle(cycle) {
  if (!cycle) {
    localStorage.removeItem(ACTIVE_CYCLE_STORAGE_KEY);
    return;
  }

  localStorage.setItem(ACTIVE_CYCLE_STORAGE_KEY, JSON.stringify(cycle));
}

export function ActiveCycleProvider({ children }) {
  var storedCycleSnapshotRef = useRef(readStoredActiveCycle());
  var auth = useAuth();
  var user = auth.user;
  var authLoading = auth.loading;
  var bootstrapCyclePresentRef = useRef(Boolean(storedCycleSnapshotRef.current));
  var [activeCycle, setActiveCycle] = useState(function () {
    return storedCycleSnapshotRef.current;
  });
  var [loading, setLoading] = useState(function () {
    return !storedCycleSnapshotRef.current;
  });

  var refreshActiveCycle = useCallback(async function (options) {
    var background = Boolean(options && options.background);

    if (!user) {
      storedCycleSnapshotRef.current = null;
      setActiveCycle(null);
      persistStoredActiveCycle(null);
      setLoading(false);
      return null;
    }

    if (!background) {
      setLoading(true);
    }

    try {
      var res = await api.getCached('/cycles', undefined, { ttl: 60000, cacheKey: 'cycles:active-list' });
      var nextActiveCycle = pickActiveCycle(Array.isArray(res.data) ? res.data : []);
      storedCycleSnapshotRef.current = nextActiveCycle;
      setActiveCycle(nextActiveCycle);
      persistStoredActiveCycle(nextActiveCycle);
      return nextActiveCycle;
    } catch {
      storedCycleSnapshotRef.current = null;
      setActiveCycle(null);
      persistStoredActiveCycle(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(function () {
    if (authLoading) return;

    if (!user) {
      storedCycleSnapshotRef.current = null;
      bootstrapCyclePresentRef.current = false;
      setActiveCycle(null);
      persistStoredActiveCycle(null);
      setLoading(false);
      return;
    }

    // Bootstrap from localStorage once, then refresh in the background.
    // Do not depend on activeCycle here or every successful refresh will
    // schedule another fetch and hammer /api/cycles in a loop.
    if (bootstrapCyclePresentRef.current) {
      bootstrapCyclePresentRef.current = false;
      setLoading(false);

      var cleanup;
      var refreshLater = function () {
        refreshActiveCycle({ background: true });
      };

      if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
        var idleId = window.requestIdleCallback(refreshLater, { timeout: 1200 });
        cleanup = function () {
          window.cancelIdleCallback(idleId);
        };
      } else {
        var timeoutId = window.setTimeout(refreshLater, 250);
        cleanup = function () {
          window.clearTimeout(timeoutId);
        };
      }

      return cleanup;
    }

    refreshActiveCycle();
  }, [authLoading, refreshActiveCycle, user]);

  var value = useMemo(function () {
    return {
      activeCycle: activeCycle,
      currentPhase: activeCycle?.currentPhase || '',
      loading: authLoading || loading,
      refreshActiveCycle: refreshActiveCycle,
    };
  }, [activeCycle, authLoading, loading, refreshActiveCycle]);

  return (
    <ActiveCycleContext.Provider value={value}>
      {children}
    </ActiveCycleContext.Provider>
  );
}
