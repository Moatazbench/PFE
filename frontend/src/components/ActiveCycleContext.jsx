import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthContext';
import api from '../services/api';
import { ActiveCycleContext, pickActiveCycle } from './ActiveCycleStore';

export function ActiveCycleProvider({ children }) {
  var auth = useAuth();
  var user = auth.user;
  var authLoading = auth.loading;
  var [activeCycle, setActiveCycle] = useState(null);
  var [loading, setLoading] = useState(false);

  var refreshActiveCycle = useCallback(async function () {
    if (!user) {
      setActiveCycle(null);
      setLoading(false);
      return null;
    }

    setLoading(true);

    try {
      var res = await api.getCached('/cycles', undefined, { ttl: 60000, cacheKey: 'cycles:active-list' });
      var nextActiveCycle = pickActiveCycle(Array.isArray(res.data) ? res.data : []);
      setActiveCycle(nextActiveCycle);
      return nextActiveCycle;
    } catch {
      setActiveCycle(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(function () {
    if (authLoading) return;
    refreshActiveCycle();
  }, [authLoading, refreshActiveCycle]);

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
