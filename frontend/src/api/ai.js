import apiClient from './apiClient';

export const aiAPI = {
    getPerformanceUsers: (cycleId) => {
        return apiClient.get('/ai/performance-users', { params: { cycleId } });
    },
    getEmployeePrediction: (employeeId, cycleId) => {
        return apiClient.get(`/ai/performance-predictions/${employeeId}`, { params: { cycleId } });
    },
    predictPerformance: (metrics) => {
        return apiClient.post('/ai/predict-performance', { metrics });
    },
};
