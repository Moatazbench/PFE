import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

const apiClient = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json'
    }
});

// Request interceptor to attach token
apiClient.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Response interceptor to handle 401 and refresh
apiClient.interceptors.response.use(
    (response) => response.data,
    async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;

            const refreshToken = localStorage.getItem('refreshToken');
            if (refreshToken) {
                try {
                    const res = await axios.post(`${API_BASE_URL}/api/auth/refresh`, { refreshToken });

                    const newAccessToken = res.data.accessToken;
                    const newRefreshToken = res.data.refreshToken;

                    localStorage.setItem('token', newAccessToken);
                    localStorage.setItem('refreshToken', newRefreshToken);

                    apiClient.defaults.headers.common['Authorization'] = `Bearer ${newAccessToken}`;
                    originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;

                    const retryResponse = await axios(originalRequest);
                    return retryResponse.data;
                } catch (refreshErr) {
                    localStorage.removeItem('token');
                    localStorage.removeItem('refreshToken');
                    window.location.href = '/login';
                    return Promise.reject(refreshErr);
                }
            } else {
                localStorage.removeItem('token');
                localStorage.removeItem('refreshToken');
                window.location.href = '/login';
            }
        }

        // Format error properly for components
        const responseError = new Error(error.response?.data?.message || error.message || 'API request failed');
        responseError.status = error.response?.status;
        responseError.data = error.response?.data;
        throw responseError;
    }
);

export default apiClient;
