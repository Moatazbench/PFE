import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import CreateGoalModal from '../src/components/goals/CreateGoalModal';
import EditGoalModal from '../src/components/goals/EditGoalModal';
import api from '../src/services/api';

jest.mock('../src/services/api', () => ({
  __esModule: true,
  default: {
    getCached: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
  },
}));

jest.mock('../src/components/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: '64b000000000000000000011',
      _id: '64b000000000000000000011',
      role: 'COLLABORATOR',
      department: 'Product',
    },
  }),
}));

const cycles = [
  {
    _id: '64b000000000000000000001',
    name: '2026 Performance Cycle',
    year: 2026,
    status: 'draft',
    currentPhase: 'phase1',
  },
];

const goal = {
  _id: '64b000000000000000000099',
  title: 'Improve customer retention',
  description: 'Reduce churn through better onboarding',
  successIndicator: 'Increase retention to at least 90 percent',
  weight: 20,
  cycle: cycles[0],
  category: 'individual',
  priority: 'medium',
  visibility: 'public',
  status: 'draft',
  owner: '64b000000000000000000011',
};

describe('objective create/edit modals', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    api.getCached.mockResolvedValue({ data: [] });
    api.post.mockResolvedValue({ data: { success: true } });
    api.put.mockResolvedValue({ data: { success: true } });
  });

  test('create mode shows the required cycle selector', () => {
    render(
      <CreateGoalModal
        onClose={jest.fn()}
        onCreated={jest.fn()}
        cycles={cycles}
        selectedCycle=""
        existingObjectives={[]}
      />
    );

    expect(screen.getByText('Evaluation Cycle *')).toBeInTheDocument();
    expect(document.querySelector('select[required]')).toBeRequired();
  });

  test('edit mode does not render the cycle field', () => {
    render(
      <EditGoalModal
        goal={goal}
        onClose={jest.fn()}
        onUpdated={jest.fn()}
        cycles={cycles}
        existingObjectives={[]}
      />
    );

    expect(screen.queryByText('Cycle *')).not.toBeInTheDocument();
    expect(screen.queryByText('Evaluation Cycle *')).not.toBeInTheDocument();
    expect(screen.getByText('Weight allocation')).toBeInTheDocument();
  });

  test('edit mode saves editable fields without sending a cycle value', async () => {
    render(
      <EditGoalModal
        goal={goal}
        onClose={jest.fn()}
        onUpdated={jest.fn()}
        cycles={cycles}
        existingObjectives={[]}
      />
    );

    fireEvent.click(screen.getByText('Save Changes'));

    await waitFor(() => {
      expect(api.put).toHaveBeenCalledTimes(1);
    });

    const payload = api.put.mock.calls[0][1];
    expect(payload).toMatchObject({
      title: goal.title,
      description: goal.description,
      successIndicator: goal.successIndicator,
      weight: goal.weight,
      priority: goal.priority,
      visibility: goal.visibility,
    });
    expect(payload).not.toHaveProperty('cycle');
    expect(payload).not.toHaveProperty('cycleId');
  });

  test('save button enters a loading state and prevents duplicate update after rerender', async () => {
    let resolveUpdate;
    api.put.mockImplementation(() => new Promise((resolve) => { resolveUpdate = resolve; }));

    render(
      <EditGoalModal
        goal={goal}
        onClose={jest.fn()}
        onUpdated={jest.fn()}
        cycles={cycles}
        existingObjectives={[]}
      />
    );

    fireEvent.click(screen.getByText('Save Changes'));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Saving/i })).toBeDisabled();
    });

    fireEvent.click(screen.getByRole('button', { name: /Saving/i }));
    expect(api.put).toHaveBeenCalledTimes(1);

    resolveUpdate({ data: { success: true } });
  });
});
