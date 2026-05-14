import apiClient from './apiClient';

export const fetchCycles = () => apiClient.get('/cycles');
export const fetchActiveCycle = () => apiClient.get('/cycles/active');
export const fetchCycleById = (id) => apiClient.get(`/cycles/${id}`);
export const createCycle = (cycleData) => apiClient.post('/cycles', cycleData);
export const updateCycle = (id, cycleData) => apiClient.put(`/cycles/${id}`, cycleData);
export const deleteCycle = (id) => apiClient.delete(`/cycles/${id}`);
export const lockCycle = (id) => apiClient.post(`/cycles/${id}/lock`);