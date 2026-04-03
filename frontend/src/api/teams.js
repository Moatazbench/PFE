import apiClient from './apiClient';

export const fetchTeams = () => apiClient.get('/api/teams');
export const fetchTeamById = (id) => apiClient.get(`/api/teams/${id}`);
export const createTeam = (teamData) => apiClient.post('/api/teams', teamData);
export const updateTeam = (id, teamData) => apiClient.put(`/api/teams/${id}`, teamData);
export const deleteTeam = (id) => apiClient.delete(`/api/teams/${id}`);