import React, { createContext, useState, useContext, useEffect, useRef } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [refreshToken, setRefreshToken] = useState(localStorage.getItem('refreshToken'));
  const [loading, setLoading] = useState(true);
  const initialLoadDone = useRef(false);

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

  // Axios setup
  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = 'Bearer ' + token;
    } else {
      delete axios.defaults.headers.common['Authorization'];
    }
  }, [token]);

  // Axios interceptor for 401 token refresh
  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          const storedRefreshToken = localStorage.getItem('refreshToken');
          if (storedRefreshToken) {
            try {
              const res = await axios.post(`${API_BASE_URL}/api/auth/refresh`, {
                refreshToken: storedRefreshToken
              });

              const newAccessToken = res.data.accessToken;
              const newRefreshToken = res.data.refreshToken;

              localStorage.setItem('token', newAccessToken);
              localStorage.setItem('refreshToken', newRefreshToken);

              setToken(newAccessToken);
              setRefreshToken(newRefreshToken);

              axios.defaults.headers.common['Authorization'] = 'Bearer ' + newAccessToken;
              originalRequest.headers['Authorization'] = 'Bearer ' + newAccessToken;

              return axios(originalRequest);
            } catch (refreshErr) {
              console.error('Token refresh failed:', refreshErr);
              logout(); // Force logout if refresh fails
            }
          } else {
            logout();
          }
        }
        return Promise.reject(error);
      }
    );

    return () => {
      axios.interceptors.response.eject(interceptor);
    };
  }, []);

  // Load user ONCE on app start
  useEffect(() => {
    let isMounted = true;
    async function loadUser() {
      if (token && !initialLoadDone.current) {
        try {
          const res = await axios.get(API_BASE_URL + '/api/auth/me');
          if (isMounted) {
            setUser(res.data);
            initialLoadDone.current = true;
          }
        } catch (err) {
          console.error('Load user error:', err);
        }
      }
      if (isMounted) {
        setLoading(false);
      }
    }
    loadUser();
    return () => { isMounted = false; };
  }, [token]);

  async function login(email, password) {
    try {
      const res = await axios.post(API_BASE_URL + '/api/auth/login', { email, password });

      const newAccessToken = res.data.accessToken;
      const newRefreshToken = res.data.refreshToken;
      const userData = res.data.user;

      localStorage.setItem('token', newAccessToken);
      localStorage.setItem('refreshToken', newRefreshToken);

      setToken(newAccessToken);
      setRefreshToken(newRefreshToken);
      setUser(userData);

      return { success: true };
    } catch (err) {
      console.error('Login error:', err);
      const message = err.response?.data?.message || 'Login failed';
      return { success: false, message };
    }
  }

  async function logout() {
    try {
      const storedRefreshToken = localStorage.getItem('refreshToken');
      if (storedRefreshToken) {
        await axios.post(API_BASE_URL + '/api/auth/logout', {
          refreshToken: storedRefreshToken
        });
      }
    } catch (err) {
      console.error('Logout error pinging backend:', err);
    } finally {
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      setToken(null);
      setRefreshToken(null);
      setUser(null);
      delete axios.defaults.headers.common['Authorization'];
    }
  }

  const value = { user, token, loading, login, logout, updateUser: setUser };

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