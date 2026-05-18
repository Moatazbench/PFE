import api from '../services/api';

export const fetchTeams = async () => (await api.get('/teams')).data;
export const fetchTeamById = async (id) => (await api.get(`/teams/${id}`)).data;
export const createTeam = async (teamData) => (await api.post('/teams', teamData)).data;
export const updateTeam = async (id, teamData) => (await api.put(`/teams/${id}`, teamData)).data;
export const deleteTeam = async (id) => (await api.delete(`/teams/${id}`)).data;
