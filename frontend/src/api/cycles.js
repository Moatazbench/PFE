import apiClient from './apiClient';

export const fetchCycles = () => apiClient.get('/api/cycles');
export const fetchActiveCycle = () => apiClient.get('/api/cycles/active');
export const fetchCycleById = (id) => apiClient.get(`/api/cycles/${id}`);
export const createCycle = (cycleData) => apiClient.post('/api/cycles', cycleData);
export const updateCycle = (id, cycleData) => apiClient.put(`/api/cycles/${id}`, cycleData);
export const deleteCycle = (id) => apiClient.delete(`/api/cycles/${id}`);
export const lockCycle = (id) => apiClient.post(`/api/cycles/${id}/lock`);