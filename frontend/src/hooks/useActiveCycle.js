import { useContext } from 'react';
import { ActiveCycleContext } from '../components/ActiveCycleStore';

export default function useActiveCycle() {
  return useContext(ActiveCycleContext);
}
