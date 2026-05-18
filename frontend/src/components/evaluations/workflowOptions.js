export const PERFORMANCE_STATUS_OPTIONS = [
  { value: 'excellent_performance', label: 'Excellent Performance', color: '#166534', background: '#dcfce7' },
  { value: 'satisfactory', label: 'Satisfactory', color: '#1d4ed8', background: '#dbeafe' },
  { value: 'needs_improvement', label: 'Needs Improvement', color: '#b45309', background: '#fef3c7' },
  { value: 'critical_attention', label: 'Critical Attention', color: '#991b1b', background: '#fee2e2' }
];

export const IMPROVEMENT_PROGRESS_OPTIONS = [
  { value: 'not_started', label: 'Not Started' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' }
];

export function getPerformanceStatusMeta(status) {
  return PERFORMANCE_STATUS_OPTIONS.find((item) => item.value === status) || null;
}

export function getImprovementProgressLabel(status) {
  return IMPROVEMENT_PROGRESS_OPTIONS.find((item) => item.value === status)?.label || 'Not Started';
}

export function canHaveImprovementPlan(status) {
  return ['needs_improvement', 'critical_attention'].includes(String(status || ''));
}

export function humanizeWorkflowLabel(value) {
  return String(value || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
