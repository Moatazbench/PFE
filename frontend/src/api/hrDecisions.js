import apiClient from './apiClient';

export const fetchHRDecisions = (filters = {}) => {
  const params = new URLSearchParams();
  if (filters.cycle) params.append('cycle', filters.cycle);
  if (filters.user) params.append('user', filters.user);
  if (filters.action) params.append('action', filters.action);

  return apiClient.get(`/hr-decisions?${params.toString()}`);
};

export const fetchHRDecisionById = (id) => apiClient.get(`/hr-decisions/${id}`);
export const createHRDecision = (decisionData) => apiClient.post('/hr-decisions', decisionData);
export const updateHRDecision = (id, decisionData) => apiClient.put(`/hr-decisions/${id}`, decisionData);
export const deleteHRDecision = (id) => apiClient.delete(`/hr-decisions/${id}`);
export const fetchHRStats = (cycleId) => apiClient.get(`/hr-decisions/stats${cycleId ? `?cycle=${cycleId}` : ''}`);