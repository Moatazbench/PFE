import axios from 'axios';

const BASE_URL = '/api';

const api = axios.create({
  baseURL: BASE_URL,
});

let refreshPromise = null;

function applyAccessToken(token) {
  if (token) {
    api.defaults.headers.common.Authorization = 'Bearer ' + token;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
}

async function refreshAccessToken() {
  if (!refreshPromise) {
    const storedRefreshToken = localStorage.getItem('refreshToken');

    if (!storedRefreshToken) {
      throw new Error('No refresh token available');
    }

    refreshPromise = axios.post(BASE_URL + '/auth/refresh', {
      refreshToken: storedRefreshToken,
    }).then(function (response) {
      const nextAccessToken = response.data?.accessToken;
      const nextRefreshToken = response.data?.refreshToken;

      if (!nextAccessToken || !nextRefreshToken) {
        throw new Error('Refresh response is missing tokens');
      }

      localStorage.setItem('token', nextAccessToken);
      localStorage.setItem('refreshToken', nextRefreshToken);
      applyAccessToken(nextAccessToken);

      return nextAccessToken;
    }).catch(function (error) {
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      applyAccessToken(null);
      window.location.href = '/login';
      throw error;
    }).finally(function () {
      refreshPromise = null;
    });
  }

  return refreshPromise;
}

applyAccessToken(localStorage.getItem('token'));

api.interceptors.request.use(function (config) {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = 'Bearer ' + token;
  }
  return config;
});

api.interceptors.response.use(
  function (response) {
    return response;
  },
  async function (error) {
    const originalRequest = error.config || {};
    const isAuthRoute = String(originalRequest.url || '').includes('/auth/');
    const canRetry = error.response?.status === 401 && !originalRequest._retry && !isAuthRoute;

    if (canRetry) {
      originalRequest._retry = true;

      try {
        const nextAccessToken = await refreshAccessToken();
        originalRequest.headers = originalRequest.headers || {};
        originalRequest.headers.Authorization = 'Bearer ' + nextAccessToken;
        return api(originalRequest);
      } catch (refreshError) {
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
