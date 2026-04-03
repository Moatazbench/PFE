import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../components/AuthContext';
import ExportPDF from '../components/ExportPDF';

function Users() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const API_BASE_URL = 'http://localhost:5000';

  async function fetchUsers() {
    try {
      const res = await axios.get(API_BASE_URL + '/api/users');
      setUsers(res.data);
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

  async function handleDeleteUser(id) {
    try {
      await axios.delete(API_BASE_URL + '/api/users/' + id);
      fetchUsers();
    } catch (err) {
      console.error('Delete user error:', err);
      setError('Failed to delete user');
    }
  }

  if (loading) {
    return <div className="loading">Loading users...</div>;
  }

  return (
    <div className="users-page">
      <div className="page-header">
        <h1>Users Management</h1>
      </div>

      {error && <div className="error-message">{error}</div>}

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
            {users.length === 0 ? (
              <tr>
                <td colSpan="4">No users found</td>
              </tr>
            ) : (
              users.map(function (u) {
                return (
                  <tr key={u._id}>
                    <td>{u.name}</td>
                    <td>{u.email}</td>
                    <td>{u.role}</td>
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
    </div>
  );
}

export default Users;