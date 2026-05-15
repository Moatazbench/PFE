import apiClient from './apiClient';

export const fetchTeams = () => apiClient.get('/teams');
export const fetchTeamById = (id) => apiClient.get(`/teams/${id}`);
export const createTeam = (teamData) => apiClient.post('/teams', teamData);
export const updateTeam = (id, teamData) => apiClient.put(`/teams/${id}`, teamData);
export const deleteTeam = (id) => apiClient.delete(`/teams/${id}`);