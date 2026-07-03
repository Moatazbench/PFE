import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../components/AuthContext';
import ExportPDF from '../components/ExportPDF';
import { formatRoleLabel } from '../utils/roles';

function Users() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filtering & Pagination State
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  async function fetchUsers() {
    try {
      const res = await api.get('/users');
      const data = res.data;
      setUsers(Array.isArray(data) ? data : data.users || []);
    } catch (err) {
      console.error('Fetch users error:', err);
      setError('Failed to load users');
    } finally {
      setLoading(false);
    }
  }

  useEffect(function () {
    fetchUsers();
  }, []);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, roleFilter]);

  async function handleDeleteUser(id) {
    try {
      await api.delete('/users/' + id);
      fetchUsers();
    } catch (err) {
      console.error('Delete user error:', err);
      setError('Failed to delete user');
    }
  }

  if (loading) {
    return <div className="loading">Loading users...</div>;
  }

  // Derived state for filtering
  const filteredUsers = users.filter((u) => {
    const normalizedSearch = searchQuery.trim().toLowerCase();
    const matchesSearch = [u.name, u.email, u.role, formatRoleLabel(u.role)]
      .some((value) => String(value || '').toLowerCase().includes(normalizedSearch));
    const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const totalPages = Math.ceil(filteredUsers.length / ITEMS_PER_PAGE) || 1;
  const paginatedUsers = filteredUsers.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  return (
    <div className="users-page">
      <div className="page-header">
        <h1>Users Management</h1>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="filters-container" style={{ marginBottom: '1rem', display: 'flex', gap: '1rem' }}>
        <input 
          type="text" 
          placeholder="Search by name or email..." 
          value={searchQuery} 
          onChange={(e) => setSearchQuery(e.target.value)} 
          style={{ flex: 1, padding: '0.5rem' }}
        />
        <select 
          value={roleFilter} 
          onChange={(e) => setRoleFilter(e.target.value)}
          style={{ padding: '0.5rem' }}
        >
          <option value="ALL">All Roles</option>
          <option value="EMPLOYEE">Employee</option>
          <option value="MANAGER">Manager</option>
          <option value="HR">HR</option>
          <option value="ADMIN">Director</option>
          <option value="COLLABORATEUR">Collaborateur</option>
          <option value="TEAM_LEADER">Team Leader</option>
        </select>
      </div>

      <div className="users-table-container">
        <table className="users-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedUsers.length === 0 ? (
              <tr>
                <td colSpan="4">No users found</td>
              </tr>
            ) : (
              paginatedUsers.map(function (u) {
                return (
                  <tr key={u._id}>
                    <td>{u.name}</td>
                    <td>{u.email}</td>
                    <td>{formatRoleLabel(u.role)}</td>
                    <td>
                      <div className="table-actions">
                        <ExportPDF type="user" id={u._id} label="PDF" />
                        {user && u._id !== user._id && (
                          <button
                            onClick={function () { handleDeleteUser(u._id); }}
                            className="delete-btn"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="pagination" style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '1rem' }}>
          <button 
            disabled={currentPage === 1} 
            onClick={() => setCurrentPage(p => p - 1)}
            style={{ padding: '0.5rem 1rem' }}
          >
            Previous
          </button>
          <span style={{ padding: '0.5rem' }}>Page {currentPage} of {totalPages}</span>
          <button 
            disabled={currentPage === totalPages} 
            onClick={() => setCurrentPage(p => p + 1)}
            style={{ padding: '0.5rem 1rem' }}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

export default Users;
