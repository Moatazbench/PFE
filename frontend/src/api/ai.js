import apiClient from './apiClient';

export const aiAPI = {
    predictPerformance: (metrics) => {
        return apiClient.post('/ai/predict-performance', { metrics });
    },
};
