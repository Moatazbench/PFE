import { createContext } from 'react';

export const ActiveCycleContext = createContext({
  activeCycle: null,
  currentPhase: '',
  loading: false,
  refreshActiveCycle: async function () {},
});

export function pickActiveCycle(cycles) {
  var items = Array.isArray(cycles) ? cycles : [];
  return items.find(function (cycle) {
    return cycle.status === 'in_progress' || cycle.status === 'active';
  }) || items.find(function (cycle) {
    return cycle.status !== 'draft';
  }) || null;
}

