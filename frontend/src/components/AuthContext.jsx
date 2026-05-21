import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);
const STORED_USER_KEY = 'authUser';
let bootstrapUserPromise = null;

function getStoredToken() {
  return typeof window === 'undefined' ? null : localStorage.getItem('token');
}

function getStoredRefreshToken() {
  return typeof window === 'undefined' ? null : localStorage.getItem('refreshToken');
}

function extractUserPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  if (payload.user && typeof payload.user === 'object') {
    return payload.user;
  }

  if (payload.data && typeof payload.data === 'object') {
    if (payload.data.user && typeof payload.data.user === 'object') {
      return payload.data.user;
    }
    return payload.data;
  }

  return payload;
}

function mergeUserPayload(currentUser, payload) {
  var source = extractUserPayload(payload);
  var previous = currentUser && typeof currentUser === 'object' ? currentUser : null;

  if (!source) {
    return null;
  }

  var userId = source._id || source.id || previous?._id || previous?.id || '';
  if (!userId) {
    return null;
  }

  return {
    _id: userId,
    id: userId,
    name: source.name !== undefined ? source.name : (previous?.name || ''),
    email: source.email !== undefined ? source.email : (previous?.email || ''),
    role: source.role !== undefined ? source.role : (previous?.role || ''),
    profileImage: source.profileImage !== undefined ? source.profileImage : (previous?.profileImage || ''),
  };
}

function readStoredUser() {
  if (typeof window === 'undefined' || !getStoredToken()) {
    return null;
  }

  try {
    var raw = localStorage.getItem(STORED_USER_KEY);
    return raw ? mergeUserPayload(null, JSON.parse(raw)) : null;
  } catch {
    localStorage.removeItem(STORED_USER_KEY);
    return null;
  }
}

function persistStoredUser(user) {
  if (typeof window === 'undefined') {
    return user;
  }

  if (!user) {
    localStorage.removeItem(STORED_USER_KEY);
    return null;
  }

  localStorage.setItem(STORED_USER_KEY, JSON.stringify(user));
  return user;
}

function storeTokens(accessToken, refreshToken) {
  if (typeof window === 'undefined') {
    return;
  }

  if (accessToken) {
    localStorage.setItem('token', accessToken);
  } else {
    localStorage.removeItem('token');
  }

  if (refreshToken) {
    localStorage.setItem('refreshToken', refreshToken);
  } else {
    localStorage.removeItem('refreshToken');
  }
}

function clearStoredSession() {
  storeTokens(null, null);
  persistStoredUser(null);
}

function requestCurrentUser(apiBaseUrl) {
  if (!bootstrapUserPromise) {
    bootstrapUserPromise = axios.get(apiBaseUrl + '/auth/me')
      .then(function (response) {
        return mergeUserPayload(null, response.data);
      })
      .finally(function () {
        bootstrapUserPromise = null;
      });
  }

  return bootstrapUserPromise;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

export function AuthProvider({ children }) {
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';
  const [user, setUserState] = useState(function () {
    return readStoredUser();
  });
  const [token, setToken] = useState(function () {
    return getStoredToken();
  });
  const [loading, setLoading] = useState(function () {
    return Boolean(getStoredToken() && !readStoredUser());
  });

  const setUser = useCallback(function (nextUserOrUpdater) {
    setUserState(function (currentUser) {
      var resolvedUser = typeof nextUserOrUpdater === 'function'
        ? nextUserOrUpdater(currentUser)
        : nextUserOrUpdater;

      if (!resolvedUser) {
        return persistStoredUser(null);
      }

      return persistStoredUser(mergeUserPayload(currentUser, resolvedUser));
    });
  }, []);

  const clearSession = useCallback(function () {
    clearStoredSession();
    setToken(null);
    setUser(null);
    setLoading(false);
    delete axios.defaults.headers.common.Authorization;
  }, [setUser]);

  const logout = useCallback(async function (options) {
    var shouldPingBackend = options?.pingBackend !== false;

    try {
      var storedRefreshToken = getStoredRefreshToken();
      if (shouldPingBackend && storedRefreshToken) {
        await axios.post(API_BASE_URL + '/auth/logout', {
          refreshToken: storedRefreshToken
        });
      }
    } catch (err) {
      console.error('Logout error pinging backend:', err);
    } finally {
      clearSession();
    }
  }, [API_BASE_URL, clearSession]);

  useEffect(() => {
    if (token) {
      axios.defaults.headers.common.Authorization = 'Bearer ' + token;
    } else {
      delete axios.defaults.headers.common.Authorization;
    }
  }, [token]);

  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      function (response) {
        return response;
      },
      async function (error) {
        const originalRequest = error.config || {};
        const requestUrl = String(originalRequest.url || '');
        const shouldAttemptRefresh =
          error.response?.status === 401 &&
          !originalRequest._retry &&
          !requestUrl.includes('/auth/login') &&
          !requestUrl.includes('/auth/logout') &&
          !requestUrl.includes('/auth/refresh');

        if (!shouldAttemptRefresh) {
          return Promise.reject(error);
        }

        originalRequest._retry = true;

        const storedRefreshToken = getStoredRefreshToken();
        if (!storedRefreshToken) {
          await logout({ pingBackend: false });
          return Promise.reject(error);
        }

        try {
          const response = await axios.post(API_BASE_URL + '/auth/refresh', {
            refreshToken: storedRefreshToken
          });

          const nextAccessToken = response.data?.accessToken;
          const nextRefreshToken = response.data?.refreshToken;

          storeTokens(nextAccessToken, nextRefreshToken);
          setToken(nextAccessToken);

          originalRequest.headers = originalRequest.headers || {};
          originalRequest.headers.Authorization = 'Bearer ' + nextAccessToken;
          axios.defaults.headers.common.Authorization = 'Bearer ' + nextAccessToken;

          return axios(originalRequest);
        } catch (refreshError) {
          console.error('Token refresh failed:', refreshError);
          await logout({ pingBackend: false });
          return Promise.reject(refreshError);
        }
      }
    );

    return function () {
      axios.interceptors.response.eject(interceptor);
    };
  }, [API_BASE_URL, logout]);

  useEffect(() => {
    let isMounted = true;
    var cleanup = function () {};

    if (!token) {
      setLoading(false);
      setUser(null);
      return function () {
        isMounted = false;
      };
    }

    var storedUser = readStoredUser();
    var hasLiveUser = Boolean(mergeUserPayload(null, user));
    var hasBootstrapUser = Boolean(hasLiveUser ? user : storedUser);

    if (!hasLiveUser && storedUser) {
      setUser(storedUser);
    }

    async function hydrateUser() {
      try {
        var nextUser = await requestCurrentUser(API_BASE_URL);
        if (isMounted) {
          setUser(nextUser);
        }
      } catch (err) {
        console.error('Load user error:', err);

        if (!isMounted) {
          return;
        }

        if (err.response?.status === 401 || err.response?.status === 403) {
          await logout({ pingBackend: false });
          return;
        }

        if (!hasBootstrapUser) {
          setUser(null);
        }
      } finally {
        if (isMounted && !hasBootstrapUser) {
          setLoading(false);
        }
      }
    }

    if (hasBootstrapUser) {
      setLoading(false);

      if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
        var idleId = window.requestIdleCallback(hydrateUser, { timeout: 1200 });
        cleanup = function () {
          window.cancelIdleCallback(idleId);
        };
      } else {
        var timeoutId = window.setTimeout(hydrateUser, 250);
        cleanup = function () {
          window.clearTimeout(timeoutId);
        };
      }
    } else {
      setLoading(true);
      hydrateUser();
    }

    return function () {
      isMounted = false;
      cleanup();
    };
  }, [API_BASE_URL, logout, setUser, token]);

  async function login(email, password) {
    try {
      const response = await axios.post(API_BASE_URL + '/auth/login', { email, password });
      const nextAccessToken = response.data?.accessToken;
      const nextRefreshToken = response.data?.refreshToken;
      const nextUser = mergeUserPayload(null, response.data?.user || response.data);

      storeTokens(nextAccessToken, nextRefreshToken);
      setToken(nextAccessToken);
      setUser(nextUser);
      setLoading(false);

      return { success: true };
    } catch (err) {
      console.error('Login error:', err);
      const message = err.response?.data?.message || 'Login failed';
      return { success: false, message };
    }
  }

  const value = useMemo(function () {
    return {
      user: user,
      token: token,
      loading: loading,
      login: login,
      logout: logout,
      updateUser: setUser,
    };
  }, [loading, logout, setUser, token, user]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontSize: '20px' }}>
        Loading...
      </div>
    );
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export default AuthContext;
