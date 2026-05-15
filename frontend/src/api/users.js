import apiClient from './apiClient';

export const fetchManagers = () => apiClient.get('/users/managers');
export const fetchCollaborators = () => apiClient.get('/users/collaborators');
export const fetchUsersByRole = (roles) => {
  const roleParam = Array.isArray(roles) ? roles.join(',') : roles;
  return apiClient.get(`/users?role=${roleParam}`);
};
export const fetchAllUsers = () => apiClient.get('/users');