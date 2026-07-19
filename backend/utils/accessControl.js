const mongoose = require('mongoose');
const Team = require('../models/Team');
const User = require('../models/User');

function actorId(actor) {
  return String(actor?._id || actor?.id || '');
}

function resourceId(value) {
  return String(value?._id || value || '');
}

function isAdmin(actor) {
  return actor?.role === 'ADMIN';
}

function isHr(actor) {
  return actor?.role === 'HR';
}

async function getManagedTeamIds(userId) {
  if (!userId || !mongoose.isValidObjectId(userId)) return [];

  const roots = await Team.find({ leader: userId }).select('_id');
  const managed = new Set(roots.map((team) => String(team._id)));
  let queue = roots.map((team) => team._id);

  while (queue.length) {
    const children = await Team.find({ parentTeam: { $in: queue } }).select('_id');
    queue = children.map((team) => team._id);
    children.forEach((team) => managed.add(String(team._id)));
  }

  return Array.from(managed);
}

async function getManagedEmployeeIds(actor) {
  const id = actorId(actor);
  if (!id) return [];

  const ids = new Set();
  const managedTeamIds = actor?.role === 'TEAM_LEADER' ? await getManagedTeamIds(id) : [];

  if (managedTeamIds.length) {
    const teams = await Team.find({ _id: { $in: managedTeamIds } }).select('members');
    teams.forEach((team) => {
      (team.members || []).forEach((memberId) => ids.add(String(memberId)));
    });
  }

  const directReports = await User.find({ manager: id, isDeleted: false }).select('_id');
  directReports.forEach((user) => ids.add(String(user._id)));

  return Array.from(ids);
}

async function canAccessEmployee(actor, employeeId, options = {}) {
  const id = actorId(actor);
  const targetId = resourceId(employeeId);
  if (!id || !targetId) return false;
  if (isAdmin(actor)) return true;
  if (options.allowHr !== false && isHr(actor)) return true;
  if (options.allowSelf !== false && id === targetId) return true;

  if (actor?.role === 'TEAM_LEADER') {
    const managedEmployeeIds = await getManagedEmployeeIds(actor);
    return managedEmployeeIds.includes(targetId);
  }

  return false;
}

async function canManageEmployee(actor, employeeId) {
  return canAccessEmployee(actor, employeeId, { allowSelf: false, allowHr: true });
}

async function canAccessTeam(actor, teamId) {
  const id = actorId(actor);
  const targetTeamId = resourceId(teamId);
  if (!id || !targetTeamId) return false;
  if (isAdmin(actor) || isHr(actor)) return true;
  if (actor?.role !== 'TEAM_LEADER') return false;

  const managedTeamIds = await getManagedTeamIds(id);
  return managedTeamIds.includes(targetTeamId);
}

async function canAccessObjective(actor, objective, options = {}) {
  const id = actorId(actor);
  if (!id || !objective) return false;

  const ownerId = resourceId(objective.owner);
  if (ownerId && ownerId === id) return true;
  if (isAdmin(actor)) return true;
  if (options.allowHr !== false && isHr(actor)) return true;

  if (actor?.role === 'TEAM_LEADER') {
    if (objective.team && await canAccessTeam(actor, objective.team)) return true;
    return canAccessEmployee(actor, ownerId, { allowSelf: false, allowHr: false });
  }

  return false;
}

async function canAssignTaskTo(actor, assigneeId) {
  return canAccessEmployee(actor, assigneeId, { allowSelf: true, allowHr: true });
}

module.exports = {
  actorId,
  resourceId,
  getManagedTeamIds,
  getManagedEmployeeIds,
  canAccessEmployee,
  canManageEmployee,
  canAccessTeam,
  canAccessObjective,
  canAssignTaskTo,
};
