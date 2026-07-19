const { _private } = require('../controllers/taskController');

describe('task access rules', () => {
  const creator = { _id: '64b000000000000000000001', id: '64b000000000000000000001', role: 'COLLABORATOR' };
  const assignee = { _id: '64b000000000000000000002', id: '64b000000000000000000002', role: 'COLLABORATOR' };
  const director = { _id: '64b000000000000000000003', id: '64b000000000000000000003', role: 'ADMIN' };
  const stranger = { _id: '64b000000000000000000004', id: '64b000000000000000000004', role: 'HR' };
  const task = {
    assignedBy: creator._id,
    assignee: assignee._id,
  };

  test('creator may manage their task but tracking belongs to the assignee', () => {
    expect(_private.canManageTask(task, creator)).toBe(true);
    expect(_private.canTrackTask(task, creator)).toBe(false);
  });

  test('assignee may manage and track assigned work', () => {
    expect(_private.canManageTask(task, assignee)).toBe(true);
    expect(_private.canTrackTask(task, assignee)).toBe(true);
  });

  test('Director may manage globally but cannot track someone else work', () => {
    expect(_private.canManageTask(task, director)).toBe(true);
    expect(_private.canTrackTask(task, director)).toBe(false);
  });

  test('unrelated HR user cannot manage or track unrelated work', () => {
    expect(_private.canManageTask(task, stranger)).toBe(false);
    expect(_private.canTrackTask(task, stranger)).toBe(false);
  });

  test('search remains scoped by the caller-provided visibility filter', () => {
    const filter = _private.addTaskSearch({ assignee: assignee._id }, 'Quarterly');
    expect(filter.assignee).toBe(assignee._id);
    expect(filter.$or).toHaveLength(5);
    expect(filter.$or[0].title.$options).toBe('i');
  });

  test('task update whitelist rejects ownership and audit-field mass assignment', () => {
    const updates = _private.pickTaskUpdates({
      title: 'Allowed title',
      status: 'done',
      assignee: '64b000000000000000000099',
      assignedBy: '64b000000000000000000098',
      team: '64b000000000000000000097',
      completedAt: new Date(),
      createdAt: new Date(),
      totalTrackedTime: 120,
      timeSessions: [],
    });

    expect(updates).toEqual({
      title: 'Allowed title',
      status: 'done',
      totalTrackedTime: 120,
      timeSessions: [],
    });
  });
});
