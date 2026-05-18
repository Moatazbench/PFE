import api from '../services/api';

export const fetchCycles = async () => (await api.get('/cycles')).data;
export const fetchActiveCycle = async () => (await api.get('/cycles/active')).data;
export const fetchCycleById = async (id) => (await api.get(`/cycles/${id}`)).data;
export const createCycle = async (cycleData) => (await api.post('/cycles', cycleData)).data;
export const updateCycle = async (id, cycleData) => (await api.put(`/cycles/${id}`, cycleData)).data;
export const deleteCycle = async (id) => (await api.delete(`/cycles/${id}`)).data;
export const lockCycle = async (id) => (await api.post(`/cycles/${id}/lock`)).data;
