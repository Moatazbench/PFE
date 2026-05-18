import axios from 'axios';

const BASE_URL = '/api';

const api = axios.create({
  baseURL: BASE_URL,
});

let refreshPromise = null;
const pendingGetRequests = new Map();
const responseCache = new Map();

function normalizeParams(params) {
  if (!params || typeof params !== 'object' || Array.isArray(params)) {
    return params || null;
  }

  return Object.keys(params).sort().reduce(function (result, key) {
    result[key] = normalizeParams(params[key]);
    return result;
  }, {});
}

function buildGetCacheKey(url, config) {
  return JSON.stringify({
    url: url,
    params: normalizeParams(config?.params || null),
  });
}

function cloneCachedResponse(response) {
  return {
    data: response.data,
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
    config: response.config,
    request: response.request,
  };
}

function clearCachedGets() {
  responseCache.clear();
}

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
    if (String(response.config?.method || 'get').toLowerCase() !== 'get') {
      clearCachedGets();
    }
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

api.getCached = function getCached(url, config, options) {
  var settings = options || {};
  var ttl = Number(settings.ttl || 0);
  var force = Boolean(settings.force);
  var cacheKey = settings.cacheKey || buildGetCacheKey(url, config);
  var cached = responseCache.get(cacheKey);
  var now = Date.now();

  if (!force && ttl > 0 && cached && cached.expiresAt > now) {
    return Promise.resolve(cloneCachedResponse(cached.response));
  }

  if (!force && pendingGetRequests.has(cacheKey)) {
    return pendingGetRequests.get(cacheKey);
  }

  var request = api.get(url, config).then(function (response) {
    if (ttl > 0) {
      responseCache.set(cacheKey, {
        expiresAt: Date.now() + ttl,
        response: response,
      });
    }

    return response;
  }).finally(function () {
    pendingGetRequests.delete(cacheKey);
  });

  pendingGetRequests.set(cacheKey, request);
  return request;
};

api.prefetch = function prefetch(url, config, options) {
  return api.getCached(url, config, options).then(function () {
    return null;
  }).catch(function () {
    return null;
  });
};

api.clearCachedGets = clearCachedGets;

export default api;
