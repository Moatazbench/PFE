const {
  isWeightBearingObjective,
  sumObjectiveWeights,
  sumTeamObjectiveWeights,
  getUniqueTeamObjectives,
  getTeamMemberWeightUsage,
} = require('../utils/objectiveRules');

describe('objective weight rules', () => {
  const cycle = '64b000000000000000000001';
  const team = '64b000000000000000000002';

  test('counts employee-created and manager-assigned objectives for the owner', () => {
    const objectives = [
      { _id: '1', owner: 'member-a', source: 'employee_created', weight: 35, status: 'draft' },
      { _id: '2', owner: 'member-a', source: 'manager_assigned', assignedBy: 'leader', weight: 25, status: 'assigned' },
    ];
    expect(sumObjectiveWeights(objectives)).toBe(60);
  });

  test('editing an assigned objective changes the calculated total', () => {
    const objectives = [
      { _id: '1', weight: 40, status: 'draft' },
      { _id: '2', weight: 20, status: 'assigned' },
    ];
    expect(sumObjectiveWeights(objectives)).toBe(60);
    objectives[1].weight = 35;
    expect(sumObjectiveWeights(objectives)).toBe(75);
  });

  test('deleting or reassigning removes the objective from the former owner collection', () => {
    const formerOwnerObjectives = [{ _id: '1', weight: 45, status: 'draft' }];
    const assigned = { _id: '2', owner: 'member-a', weight: 30, status: 'assigned' };
    formerOwnerObjectives.push(assigned);
    expect(sumObjectiveWeights(formerOwnerObjectives)).toBe(75);

    formerOwnerObjectives.splice(1, 1);
    assigned.owner = 'member-b';
    expect(sumObjectiveWeights(formerOwnerObjectives)).toBe(45);
    expect(sumObjectiveWeights([assigned])).toBe(30);
  });

  test('does not count rejected, cancelled, or archived objectives', () => {
    ['rejected', 'cancelled', 'archived'].forEach((status) => {
      expect(isWeightBearingObjective({ status })).toBe(false);
    });
    expect(sumObjectiveWeights([
      { weight: 20, status: 'approved' },
      { weight: 70, status: 'cancelled' },
    ])).toBe(20);
  });

  test('deduplicates distributed team-objective copies', () => {
    const copies = [
      { _id: 'a', owner: 'member-a', title: 'Grow revenue', cycle, team, category: 'team', weight: 40, status: 'assigned' },
      { _id: 'b', owner: 'member-b', title: 'Grow revenue', cycle, team, category: 'team', weight: 40, status: 'assigned' },
      { _id: 'c', owner: 'member-c', title: 'Improve quality', cycle, team, category: 'team', weight: 60, status: 'approved' },
    ];
    expect(getUniqueTeamObjectives(copies)).toHaveLength(2);
    expect(sumTeamObjectiveWeights(copies)).toBe(100);
  });

  test('a 40% whole-team objective consumes 40% for every assigned member', () => {
    const members = ['member-a', 'member-b', 'member-c', 'member-d'];
    const copies = members.map((owner, index) => ({
      _id: String(index + 1),
      owner,
      assignedUsers: members,
      title: 'Grow revenue',
      cycle,
      team,
      category: 'team',
      weight: 40,
      status: 'assigned',
    }));

    expect(getTeamMemberWeightUsage(copies, members)).toEqual({
      'member-a': 40,
      'member-b': 40,
      'member-c': 40,
      'member-d': 40,
    });
  });

  test('team-objective weights accumulate per member without being divided', () => {
    const members = ['member-a', 'member-b'];
    const objectives = [
      { _id: '1', owner: 'member-a', assignedUsers: members, title: 'Goal one', cycle, team, weight: 40, status: 'assigned' },
      { _id: '2', owner: 'member-b', assignedUsers: members, title: 'Goal one', cycle, team, weight: 40, status: 'assigned' },
      { _id: '3', owner: 'member-a', assignedUsers: members, title: 'Goal two', cycle, team, weight: 35, status: 'approved' },
      { _id: '4', owner: 'member-b', assignedUsers: members, title: 'Goal two', cycle, team, weight: 35, status: 'approved' },
    ];

    expect(getTeamMemberWeightUsage(objectives, members)).toEqual({
      'member-a': 75,
      'member-b': 75,
    });
  });

  test('individual and team objectives share one employee 100% budget', () => {
    const employeeObjectives = [
      { _id: 'individual-1', owner: 'member-a', category: 'individual', weight: 35, status: 'approved' },
      { _id: 'individual-2', owner: 'member-a', category: 'individual', weight: 25, status: 'approved' },
      { _id: 'team-copy', owner: 'member-a', category: 'team', weight: 40, status: 'approved' },
    ];

    expect(sumObjectiveWeights(employeeObjectives)).toBe(100);
  });

  test('excludes the full distributed group while validating an edit', () => {
    const copies = [
      { _id: 'a', title: 'Grow revenue', cycle, team, weight: 40, status: 'assigned' },
      { _id: 'b', title: 'Grow revenue', cycle, team, weight: 40, status: 'assigned' },
      { _id: 'c', title: 'Improve quality', cycle, team, weight: 50, status: 'approved' },
    ];
    expect(sumTeamObjectiveWeights(copies, { excludeId: 'a' })).toBe(50);
  });
});
