import api from '../services/api';

export const fetchHRDecisions = async (filters = {}) => {
  const params = new URLSearchParams();
  if (filters.cycle) params.append('cycle', filters.cycle);
  if (filters.user) params.append('user', filters.user);
  if (filters.action) params.append('action', filters.action);

  return (await api.get(`/hr-decisions?${params.toString()}`)).data;
};

export const fetchHRDecisionById = async (id) => (await api.get(`/hr-decisions/${id}`)).data;
export const createHRDecision = async (decisionData) => (await api.post('/hr-decisions', decisionData)).data;
export const updateHRDecision = async (id, decisionData) => (await api.put(`/hr-decisions/${id}`, decisionData)).data;
export const deleteHRDecision = async (id) => (await api.delete(`/hr-decisions/${id}`)).data;
export const fetchHRStats = async (cycleId) => (await api.get(`/hr-decisions/stats${cycleId ? `?cycle=${cycleId}` : ''}`)).data;
