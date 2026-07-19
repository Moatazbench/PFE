const { filterVisibleObjectives } = require('../utils/objectiveVisibility');

describe('objective visibility rules', () => {
  it('keeps draft individual objectives private to the owner', () => {
    const objectives = [
      { _id: '1', category: 'individual', status: 'draft', owner: 'emp-1' },
      { _id: '2', category: 'individual', status: 'pending', owner: 'emp-2' },
    ];

    const visibleForOwner = filterVisibleObjectives(objectives, { id: 'emp-1', role: 'COLLABORATOR' });
    const visibleForTeamLeader = filterVisibleObjectives(objectives, { id: 'manager-1', role: 'TEAM_LEADER' }, { teamMemberIds: ['emp-2'] });
    const visibleForHr = filterVisibleObjectives(objectives, { id: 'hr-1', role: 'HR' });

    expect(visibleForOwner).toHaveLength(2);
    expect(visibleForTeamLeader).toHaveLength(1);
    expect(visibleForHr).toHaveLength(1);
  });

  it('keeps team and subteam objectives visible to the relevant team leader', () => {
    const objectives = [
      { _id: '3', category: 'team', status: 'approved', owner: 'emp-2' },
      { _id: '4', category: 'individual', status: 'draft', owner: 'emp-2' },
    ];

    const visible = filterVisibleObjectives(objectives, { id: 'manager-1', role: 'TEAM_LEADER' }, { teamMemberIds: ['emp-2'] });

    expect(visible).toHaveLength(1);
    expect(visible[0]._id).toBe('3');
  });
});
