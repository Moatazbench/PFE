import React, { useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import { useAuth } from '../components/AuthContext';

function Teams() {
  const { user } = useAuth();
  const [teams, setTeams] = useState([]);
  const [users, setUsers] = useState([]);
  const [myTeam, setMyTeam] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingTeam, setEditingTeam] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    leader: '',
    members: [],
    parentTeamId: ''
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const isAdminLike = user && (user.role === 'ADMIN' || user.role === 'HR');
  const isTeamLeader = user && user.role === 'TEAM_LEADER';

  async function fetchData() {
    setLoading(true);
    try {
      if (isAdminLike) {
        var [teamsRes, usersRes] = await Promise.all([
          api.get('/teams'),
          api.get('/users')
        ]);
        setTeams(Array.isArray(teamsRes.data) ? teamsRes.data : teamsRes.data.teams || []);
        var userData = usersRes.data;
        setUsers(Array.isArray(userData) ? userData : userData.users || []);
        setMyTeam(null);
      } else {
        var [leaderTeamsRes, myTeamRes] = await Promise.all([
          api.get('/teams'),
          api.get('/teams/my-team')
        ]);
        var accessibleTeams = Array.isArray(leaderTeamsRes.data) ? leaderTeamsRes.data : leaderTeamsRes.data.teams || [];
        var currentTeam = myTeamRes.data?.team || null;
        setTeams(accessibleTeams);
        setMyTeam(currentTeam);
        setUsers(buildParentPool(currentTeam));
      }
    } catch (err) {
      console.error('Fetch data error:', err);
      setError(err.response?.data?.message || 'Failed to load teams');
    } finally {
      setLoading(false);
    }
  }

  useEffect(function () {
    fetchData();
  }, [isAdminLike, isTeamLeader]);

  const teamMap = useMemo(function () {
    return teams.reduce(function (acc, team) {
      acc[team._id] = team;
      return acc;
    }, {});
  }, [teams]);

  const rootTeams = useMemo(function () {
    return teams.filter(function (team) {
      var parentId = team.parentTeam?._id || team.parentTeam || '';
      return !parentId || !teamMap[parentId];
    });
  }, [teams, teamMap]);

  function buildParentPool(team) {
    if (!team) return [];
    var seen = new Set();
    var pool = [];
    [team.leader].concat(team.members || []).forEach(function (person) {
      if (person && person._id && !seen.has(person._id)) {
        seen.add(person._id);
        pool.push(person);
      }
    });
    return pool;
  }

  function getChildTeams(parentId) {
    return teams.filter(function (team) {
      return String(team.parentTeam?._id || team.parentTeam || '') === String(parentId);
    });
  }

  function openCreateModal(parentTeam) {
    setEditingTeam(null);
    setFormData({
      name: '',
      description: '',
      leader: '',
      members: [],
      parentTeamId: parentTeam?._id || ''
    });
    setShowModal(true);
    setError('');
  }

  function openEditModal(team) {
    setEditingTeam(team);
    setFormData({
      name: team.name,
      description: team.description || '',
      leader: team.leader?._id || '',
      members: team.members?.map(function (member) { return member._id; }) || [],
      parentTeamId: team.parentTeam?._id || ''
    });
    setShowModal(true);
    setError('');
  }

  function closeModal() {
    setShowModal(false);
    setEditingTeam(null);
  }

  function getParentTeam() {
    return formData.parentTeamId ? teamMap[formData.parentTeamId] : null;
  }

  function getLeaderOptions() {
    if (formData.parentTeamId) {
      return buildParentPool(getParentTeam());
    }
    return users.filter(function (person) {
      return person.role === 'TEAM_LEADER' || person.role === 'ADMIN' || person.role === 'HR';
    });
  }

  function getMemberOptions() {
    if (formData.parentTeamId) {
      var autoLeaderId = String(editingTeam?.leader?._id || user?.id || user?._id || '');
      return buildParentPool(getParentTeam()).filter(function (person) {
        return String(person._id) !== autoLeaderId;
      });
    }
    return users.filter(function (person) {
      return person.role === 'COLLABORATOR';
    });
  }

  function canManageSubteams(parentTeam) {
    if (isAdminLike) return true;
    return isTeamLeader && String(parentTeam.leader?._id || parentTeam.leader || '') === String(user.id || user._id);
  }

  function canEditTeam(team) {
    if (isAdminLike) return true;
    if (!team.parentTeam) return false;
    var parentTeamId = team.parentTeam?._id || team.parentTeam;
    var parentTeam = teamMap[parentTeamId];
    return !!parentTeam && canManageSubteams(parentTeam);
  }

  function canDeleteTeam(team) {
    return canEditTeam(team) || (isAdminLike && !team.parentTeam);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!formData.name || !formData.name.trim()) {
      setError('Team name is required.');
      return;
    }
    if (!formData.parentTeamId && !formData.leader) {
      setError(formData.parentTeamId ? 'A sub-team leader is required.' : 'A team leader is required.');
      return;
    }
    if (!formData.members || formData.members.length === 0) {
      setError(formData.parentTeamId ? 'At least one sub-team member is required.' : 'At least one team member (collaborator) is required.');
      return;
    }

    try {
      if (editingTeam) {
        await api.put('/teams/' + editingTeam._id, {
          name: formData.name,
          description: formData.description,
          leader: formData.leader,
          members: formData.members
        });
        setSuccess(formData.parentTeamId ? 'Sub-team updated successfully!' : 'Team updated successfully!');
      } else if (formData.parentTeamId) {
        await api.post('/teams/' + formData.parentTeamId + '/subteams', {
          name: formData.name,
          description: formData.description,
          members: formData.members
        });
        setSuccess('Sub-team created successfully!');
      } else {
        await api.post('/teams', {
          name: formData.name,
          description: formData.description,
          leader: formData.leader,
          members: formData.members
        });
        setSuccess('Team created successfully!');
      }

      closeModal();
      fetchData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save team');
    }
  }

  async function handleDelete(team) {
    try {
      await api.delete('/teams/' + team._id);
      setSuccess(team.parentTeam ? 'Sub-team deleted successfully!' : 'Team deleted successfully!');
      fetchData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete team');
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

  function renderSubTeamCard(team) {
    return (
      <div key={team._id} className="team-card" style={{ marginTop: '1rem', borderStyle: 'dashed' }}>
        <div className="team-header">
          <h3>Sub-Team: {team.name}</h3>
        </div>

        <p className="team-description">{team.description || 'No description'}</p>

        {team.leader && (
          <div className="team-leader">
            <span className="label">Leader:</span>
            <span className="leader-name">{team.leader.name}</span>
            <span className="leader-email">({team.leader.email})</span>
          </div>
        )}

        <div className="team-members">
          <span className="label">Members ({team.members?.length || 0}):</span>
          {team.members?.length === 0 ? (
            <p className="no-members">No members assigned</p>
          ) : (
            <div className="members-list">
              {team.members.map(function (member) {
                return (
                  <span key={member._id} className="member-badge">
                    {member.name}
                  </span>
                );
              })}
            </div>
          )}
        </div>

        {(canEditTeam(team) || canDeleteTeam(team)) && (
          <div className="card-actions">
            {canEditTeam(team) && (
              <button onClick={function () { openEditModal(team); }} className="edit-btn">
                Edit
              </button>
            )}
            {canDeleteTeam(team) && (
              <button onClick={function () { handleDelete(team); }} className="delete-btn">
                Delete
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  if (loading) {
    return <div className="loading">Loading teams...</div>;
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Teams</h1>
        {isAdminLike && <button onClick={function () { openCreateModal(null); }} className="add-btn">+ Create Team</button>}
      </div>

      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}

      {rootTeams.length === 0 ? (
        <div className="empty-state">
          <h2>No Teams Yet</h2>
          <p>{isAdminLike ? 'Create your first team to organize your employees.' : 'No team structure is available for you yet.'}</p>
          {isAdminLike && <button onClick={function () { openCreateModal(null); }} className="add-btn">+ Create First Team</button>}
        </div>
      ) : (
        <div className="teams-grid">
          {rootTeams.map(function (team) {
            var subTeams = getChildTeams(team._id);
            return (
              <div key={team._id} className="team-card">
                <div className="team-header">
                  <h3>{team.name}</h3>
                </div>

                <p className="team-description">{team.description || 'No description'}</p>

                {team.leader && (
                  <div className="team-leader">
                    <span className="label">Team Leader:</span>
                    <span className="leader-name">{team.leader.name}</span>
                    <span className="leader-email">({team.leader.email})</span>
                  </div>
                )}

                <div className="team-members">
                  <span className="label">Members ({team.members?.length || 0}):</span>
                  {team.members?.length === 0 ? (
                    <p className="no-members">No members assigned</p>
                  ) : (
                    <div className="members-list">
                      {team.members.map(function (member) {
                        return (
                          <span key={member._id} className="member-badge">
                            {member.name}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="team-members" style={{ marginTop: '1rem' }}>
                  <span className="label">Sub-Teams ({subTeams.length}):</span>
                  {subTeams.length === 0 ? (
                    <p className="no-members">No sub-teams created yet</p>
                  ) : (
                    subTeams.map(renderSubTeamCard)
                  )}
                </div>

                <div className="card-actions">
                  {isAdminLike && !team.parentTeam && (
                    <button onClick={function () { openEditModal(team); }} className="edit-btn">
                      Edit
                    </button>
                  )}
                  {canManageSubteams(team) && (
                    <button onClick={function () { openCreateModal(team); }} className="edit-btn">
                      + Create Sub-Team
                    </button>
                  )}
                  {isAdminLike && (
                    <button onClick={function () { handleDelete(team); }} className="delete-btn">
                      Delete
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay">
          <div className="modal modal-large">
            <h2>
              {editingTeam ? (formData.parentTeamId ? 'Edit Sub-Team' : 'Edit Team') : (formData.parentTeamId ? 'Create Sub-Team' : 'Create Team')}
            </h2>

            {error && <div className="error-message">{error}</div>}

            <form onSubmit={handleSubmit}>
              {formData.parentTeamId && (
                <div className="form-group">
                  <label>Parent Team:</label>
                  <input type="text" value={getParentTeam()?.name || ''} disabled />
                </div>
              )}

              <div className="form-group">
                <label>{formData.parentTeamId ? 'Sub-Team Name:' : 'Team Name:'}</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={function (e) { setFormData({ ...formData, name: e.target.value }); }}
                  placeholder={formData.parentTeamId ? 'Enter sub-team name' : 'Enter team name'}
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

              {!formData.parentTeamId && (
                <div className="form-group">
                  <label>Team Leader: <span style={{ color: 'red' }}>*</span></label>
                  <select
                    value={formData.leader}
                    onChange={function (e) { setFormData({ ...formData, leader: e.target.value }); }}
                    required
                  >
                    <option value="">-- Select Leader --</option>
                    {getLeaderOptions().map(function (person) {
                      return (
                        <option key={person._id} value={person._id}>
                          {person.name} ({person.email}){person.role ? ' - ' + person.role : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}

              {formData.parentTeamId && (
                <div className="form-group">
                  <label>Sub-Team Leader:</label>
                  <input
                    type="text"
                    value={((editingTeam?.leader?.name || user?.name || 'Current Team Leader')) + ' (auto-assigned)'}
                    disabled
                  />
                </div>
              )}

              <div className="form-group">
                <label>{formData.parentTeamId ? 'Sub-Team Members:' : 'Team Members:'} <span style={{ color: 'red' }}>*</span></label>
                <div className="members-selection">
                  {getMemberOptions().length === 0 ? (
                    <p className="no-data">{formData.parentTeamId ? 'No parent team members available' : 'No collaborators available'}</p>
                  ) : (
                    getMemberOptions().map(function (person) {
                      var isSelected = formData.members.includes(person._id);
                      return (
                        <label key={person._id} className={'member-checkbox ' + (isSelected ? 'selected' : '')}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={function () { handleMemberToggle(person._id); }}
                          />
                          <span className="member-info">
                            <span className="member-name">{person.name}</span>
                            <span className="member-email">{person.email}</span>
                          </span>
                        </label>
                      );
                    })
                  )}
                </div>
                <p className="form-hint">
                  Selected: {formData.members.length} member(s)
                  {formData.parentTeamId ? ' from the parent team only' : ''}
                </p>
                {formData.parentTeamId && (
                  <p className="form-hint">
                    You will automatically be added as the sub-team leader and a member.
                  </p>
                )}
              </div>

              <div className="modal-actions">
                <button type="submit" className="submit-btn">
                  {editingTeam ? 'Save Changes' : (formData.parentTeamId ? 'Create Sub-Team' : 'Create Team')}
                </button>
                <button type="button" onClick={closeModal} className="cancel-btn">
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
