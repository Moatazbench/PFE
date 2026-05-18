import api from '../services/api';

export const fetchManagers = async () => (await api.get('/users/managers')).data;
export const fetchCollaborators = async () => (await api.get('/users/collaborators')).data;
export const fetchUsersByRole = async (roles) => {
  const roleParam = Array.isArray(roles) ? roles.join(',') : roles;
  return (await api.get(`/users/filter/list?role=${encodeURIComponent(roleParam)}`)).data;
};
export const fetchAllUsers = async () => (await api.get('/users')).data;
