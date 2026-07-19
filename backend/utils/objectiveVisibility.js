function isDraftPrivateIndividualObjective(objective) {
  const status = String(objective?.status || '').toLowerCase();
  const isEmployeeCreatedIndividual = objective?.category === 'individual' && objective?.source !== 'manager_assigned';
  return isEmployeeCreatedIndividual && status === 'draft';
}

function filterVisibleObjectives(objectives, user, context = {}) {
  const actorId = String(user?.id || user?._id || '');
  const role = user?.role;
  const teamMemberIds = (context.teamMemberIds || []).map(String);
  const isAdmin = role === 'ADMIN';
  const isHr = role === 'HR';
  const isTeamLeader = role === 'TEAM_LEADER';

  return (objectives || []).filter((objective) => {
    if (!objective) return false;

    const ownerId = String(objective.owner?._id || objective.owner || '');
    const isOwner = ownerId && ownerId === actorId;
    const isTeamObjective = objective.category === 'team';
    const isVisibleTeamMember = isTeamLeader && teamMemberIds.includes(ownerId);

    if (isOwner || isAdmin) return true;

    if (isDraftPrivateIndividualObjective(objective)) {
      return false;
    }

    if (isTeamObjective) {
      return isVisibleTeamMember;
    }

    if (isTeamLeader) {
      return isVisibleTeamMember && ['pending', 'submitted', 'pending_approval', 'revision_requested', 'rejected', 'approved', 'validated', 'assigned', 'acknowledged', 'evaluated', 'locked', 'cancelled', 'archived'].includes(String(objective?.status || '').toLowerCase());
    }

    return true;
  });
}

module.exports = { filterVisibleObjectives, isDraftPrivateIndividualObjective };
