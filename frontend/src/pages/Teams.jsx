import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../components/AuthContext';

function Teams() {
  const { user } = useAuth();
  const [teams, setTeams] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingTeam, setEditingTeam] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    leader: '',
    members: []
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  var API = 'http://localhost:5000';

  async function fetchData() {
    try {
      var [teamsRes, usersRes] = await Promise.all([
        axios.get(API + '/api/teams'),
        axios.get(API + '/api/users')
      ]);
      setTeams(teamsRes.data);
      setUsers(usersRes.data);
    } catch (err) {
      console.error('Fetch data error:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(function () {
    fetchData();
  }, []);

  function openCreateModal() {
    setEditingTeam(null);
    setFormData({ name: '', description: '', leader: '', members: [] });
    setShowModal(true);
    setError('');
  }

  function openEditModal(team) {
    setEditingTeam(team);
    setFormData({
      name: team.name,
      description: team.description || '',
      leader: team.leader?._id || '',
      members: team.members?.map(function (m) { return m._id; }) || []
    });
    setShowModal(true);
    setError('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      if (editingTeam) {
        await axios.put(API + '/api/teams/' + editingTeam._id, formData);
        setSuccess('Team updated successfully!');
      } else {
        await axios.post(API + '/api/teams', formData);
        setSuccess('Team created successfully!');
      }
      setShowModal(false);
      fetchData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save team');
    }
  }

  async function handleDelete(id) {
    try {
      await axios.delete(API + '/api/teams/' + id);
      fetchData();
    } catch (err) {
      setError('Failed to delete team');
    }
  }

  function handleMemberToggle(userId) {
    setFormData(function (prev) {
      var members = prev.members.slice();
      var index = members.indexOf(userId);
      if (index > -1) {
        members.splice(index, 1);
      } else {
        members.push(userId);
      }
      return { ...prev, members: members };
    });
  }

  function getManagers() {
    return users.filter(function (u) {
      return u.role === 'TEAM_LEADER' || u.role === 'ADMIN' || u.role === 'HR';
    });
  }

  function getCollaborators() {
    return users.filter(function (u) {
      return u.role === 'COLLABORATOR';
    });
  }

  if (loading) {
    return <div className="loading">Loading teams...</div>;
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>👥 Teams</h1>
        <button onClick={openCreateModal} className="add-btn">+ Create Team</button>
      </div>

      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}

      {teams.length === 0 ? (
        <div className="empty-state">
          <h2>👥 No Teams Yet</h2>
          <p>Create your first team to organize your employees.</p>
          <button onClick={openCreateModal} className="add-btn">+ Create First Team</button>
        </div>
      ) : (
        <div className="teams-grid">
          {teams.map(function (team) {
            return (
              <div key={team._id} className="team-card">
                <div className="team-header">
                  <h3>👥 {team.name}</h3>
                </div>

                <p className="team-description">{team.description || 'No description'}</p>

                {team.leader && (
                  <div className="team-leader">
                    <span className="label">👔 Team Leader:</span>
                    <span className="leader-name">{team.leader.name}</span>
                    <span className="leader-email">({team.leader.email})</span>
                  </div>
                )}

                <div className="team-members">
                  <span className="label">👤 Members ({team.members?.length || 0}):</span>
                  {team.members?.length === 0 ? (
                    <p className="no-members">No members assigned</p>
                  ) : (
                    <div className="members-list">
                      {team.members?.map(function (member) {
                        return (
                          <span key={member._id} className="member-badge">
                            {member.name}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="card-actions">
                  <button onClick={function () { openEditModal(team); }} className="edit-btn">
                    ✏️ Edit
                  </button>
                  <button onClick={function () { handleDelete(team._id); }} className="delete-btn">
                    🗑️ Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal modal-large">
            <h2>{editingTeam ? '✏️ Edit Team' : '👥 Create Team'}</h2>

            {error && <div className="error-message">{error}</div>}

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Team Name:</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={function (e) { setFormData({ ...formData, name: e.target.value }); }}
                  placeholder="Enter team name"
                  required
                />
              </div>

              <div className="form-group">
                <label>Description:</label>
                <textarea
                  value={formData.description}
                  onChange={function (e) { setFormData({ ...formData, description: e.target.value }); }}
                  placeholder="Team description..."
                  rows={3}
                />
              </div>

              <div className="form-group">
                <label>👔 Team Leader (Manager):</label>
                <select
                  value={formData.leader}
                  onChange={function (e) { setFormData({ ...formData, leader: e.target.value }); }}
                >
                  <option value="">-- Select Leader --</option>
                  {getManagers().map(function (u) {
                    return (
                      <option key={u._id} value={u._id}>
                        {u.name} ({u.email}) - {u.role}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="form-group">
                <label>👤 Team Members (Collaborators):</label>
                <div className="members-selection">
                  {getCollaborators().length === 0 ? (
                    <p className="no-data">No collaborators available</p>
                  ) : (
                    getCollaborators().map(function (u) {
                      var isSelected = formData.members.includes(u._id);
                      return (
                        <label key={u._id} className={'member-checkbox ' + (isSelected ? 'selected' : '')}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={function () { handleMemberToggle(u._id); }}
                          />
                          <span className="member-info">
                            <span className="member-name">{u.name}</span>
                            <span className="member-email">{u.email}</span>
                          </span>
                        </label>
                      );
                    })
                  )}
                </div>
                <p className="form-hint">Selected: {formData.members.length} member(s)</p>
              </div>

              <div className="modal-actions">
                <button type="submit" className="submit-btn">
                  {editingTeam ? 'Update Team' : 'Create Team'}
                </button>
                <button type="button" onClick={function () { setShowModal(false); }} className="cancel-btn">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Teams;