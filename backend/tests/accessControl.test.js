jest.mock('../models/Team', () => ({
  find: jest.fn(),
}));

jest.mock('../models/User', () => ({
  find: jest.fn(),
}));

const Team = require('../models/Team');
const User = require('../models/User');
const {
  getManagedTeamIds,
  canAccessEmployee,
  canManageEmployee,
  canAccessObjective,
  canAssignTaskTo,
} = require('../utils/accessControl');

function queryResult(value) {
  return { select: jest.fn().mockResolvedValue(value) };
}

describe('shared access control rules', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('team leaders inherit managed subteam ids', async () => {
    Team.find
      .mockReturnValueOnce(queryResult([{ _id: 'team-root' }]))
      .mockReturnValueOnce(queryResult([{ _id: 'team-child' }]))
      .mockReturnValueOnce(queryResult([]));

    await expect(getManagedTeamIds('64b000000000000000000001')).resolves.toEqual(['team-root', 'team-child']);
  });

  test('team leaders can access only managed employees, including subteams', async () => {
    Team.find
      .mockReturnValueOnce(queryResult([{ _id: 'team-root' }]))
      .mockReturnValueOnce(queryResult([{ _id: 'team-child' }]))
      .mockReturnValueOnce(queryResult([]))
      .mockReturnValueOnce(queryResult([
        { members: ['64b000000000000000000010'] },
        { members: ['64b000000000000000000011'] },
      ]));
    User.find.mockReturnValueOnce(queryResult([]));

    const leader = { id: '64b000000000000000000001', role: 'TEAM_LEADER' };
    await expect(canAccessEmployee(leader, '64b000000000000000000011', { allowSelf: false, allowHr: false })).resolves.toBe(true);
  });

  test('collaborators cannot manage or assign work to another employee', async () => {
    const actor = { id: '64b000000000000000000010', role: 'COLLABORATOR' };

    await expect(canManageEmployee(actor, '64b000000000000000000011')).resolves.toBe(false);
    await expect(canAssignTaskTo(actor, '64b000000000000000000011')).resolves.toBe(false);
    await expect(canAssignTaskTo(actor, '64b000000000000000000010')).resolves.toBe(true);
  });

  test('HR and Admin can access employee records, but objective owners always access their own objective', async () => {
    await expect(canAccessEmployee({ id: 'hr', role: 'HR' }, '64b000000000000000000011')).resolves.toBe(true);
    await expect(canAccessEmployee({ id: 'admin', role: 'ADMIN' }, '64b000000000000000000011')).resolves.toBe(true);
    await expect(canAccessObjective(
      { id: '64b000000000000000000011', role: 'COLLABORATOR' },
      { owner: '64b000000000000000000011' }
    )).resolves.toBe(true);
  });
});
