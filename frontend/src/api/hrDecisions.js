import apiClient from './apiClient';

export const fetchHRDecisions = (filters = {}) => {
  const params = new URLSearchParams();
  if (filters.cycle) params.append('cycle', filters.cycle);
  if (filters.user) params.append('user', filters.user);
  if (filters.action) params.append('action', filters.action);

  return apiClient.get(`/api/hr-decisions?${params.toString()}`);
};

export const fetchHRDecisionById = (id) => apiClient.get(`/api/hr-decisions/${id}`);
export const createHRDecision = (decisionData) => apiClient.post('/api/hr-decisions', decisionData);
export const updateHRDecision = (id, decisionData) => apiClient.put(`/api/hr-decisions/${id}`, decisionData);
export const deleteHRDecision = (id) => apiClient.delete(`/api/hr-decisions/${id}`);
export const fetchHRStats = (cycleId) => apiClient.get(`/api/hr-decisions/stats${cycleId ? `?cycle=${cycleId}` : ''}`);