const { _private } = require('../controllers/taskController');

describe('task creator privacy rules', () => {
  const creator = { _id: '64b000000000000000000001', id: '64b000000000000000000001', role: 'COLLABORATOR' };
  const otherUser = { _id: '64b000000000000000000002', id: '64b000000000000000000002', role: 'ADMIN' };
  const task = {
    assignedBy: creator._id,
    assignee: otherUser._id,
  };

  test('creator may manage and track their task', () => {
    expect(_private.canManageTask(task, creator)).toBe(true);
    expect(_private.canTrackTask(task, creator)).toBe(true);
  });

  test('assignee and Director cannot access a task they did not create', () => {
    expect(_private.canManageTask(task, otherUser)).toBe(false);
    expect(_private.canTrackTask(task, otherUser)).toBe(false);
  });

  test('search remains scoped by the caller-provided creator filter', () => {
    const filter = _private.addTaskSearch({ assignedBy: creator._id }, 'Quarterly');
    expect(filter.assignedBy).toBe(creator._id);
    expect(filter.$or).toHaveLength(5);
    expect(filter.$or[0].title.$options).toBe('i');
  });
});
