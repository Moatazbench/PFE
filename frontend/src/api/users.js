import apiClient from './apiClient';

export const fetchManagers = () => apiClient.get('/api/users/managers');
export const fetchCollaborators = () => apiClient.get('/api/users/collaborators');
export const fetchUsersByRole = (roles) => {
  const roleParam = Array.isArray(roles) ? roles.join(',') : roles;
  return apiClient.get(`/api/users?role=${roleParam}`);
};
export const fetchAllUsers = () => apiClient.get('/api/users');