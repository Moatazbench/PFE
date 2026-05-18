import lazyWithPreload from '../utils/lazyWithPreload';

const Login = lazyWithPreload(() => import('../pages/Login'));
const Dashboard = lazyWithPreload(() => import('../pages/Dashboard'));
const Cycles = lazyWithPreload(() => import('../pages/Cycles'));
const Evaluations = lazyWithPreload(() => import('../pages/Evaluations'));
const Validation = lazyWithPreload(() => import('../pages/Validation'));
const HRDecisions = lazyWithPreload(() => import('../pages/HRDecisions'));
const Teams = lazyWithPreload(() => import('../pages/Teams'));
const Users = lazyWithPreload(() => import('../pages/Users'));
const Settings = lazyWithPreload(() => import('../pages/Settings'));
const GoalsPage = lazyWithPreload(() => import('../pages/GoalsPage'));
const MeetingsPage = lazyWithPreload(() => import('../pages/MeetingsPage'));
const FeedbackPage = lazyWithPreload(() => import('../pages/FeedbackPage'));
const TasksPage = lazyWithPreload(() => import('../pages/TasksPage'));
const CalendarPage = lazyWithPreload(() => import('../pages/CalendarPage'));
const CareerPage = lazyWithPreload(() => import('../pages/CareerPage'));
const AnalyticsPage = lazyWithPreload(() => import('../pages/AnalyticsPage'));
const TeamFeed = lazyWithPreload(() => import('../pages/TeamFeed'));
const MyTeamPage = lazyWithPreload(() => import('../pages/MyTeamPage'));
const MidYearPage = lazyWithPreload(() => import('../pages/MidYearPage'));
const FinalEvaluationPage = lazyWithPreload(() => import('../pages/FinalEvaluationPage'));
const PerformancePage = lazyWithPreload(() => import('../pages/PerformancePage'));
const EvaluationScoringPage = lazyWithPreload(() => import('../pages/EvaluationScoringPage'));
const AuditLogsPage = lazyWithPreload(() => import('../pages/AuditLogsPage'));
const ManagerReviewPage = lazyWithPreload(() => import('../pages/ManagerReviewPage'));
const HRValidation = lazyWithPreload(() => import('../pages/HRValidation'));

export const PUBLIC_ROUTES = [
  {
    path: '/login',
    component: Login,
    label: 'Login',
    section: 'Auth',
  },
];

export const APP_ROUTES = [
  { path: '/dashboard', label: 'Dashboard', section: 'Main', icon: 'grid', component: Dashboard, showInSidebar: true },
  { path: '/goals', label: 'Objectives', section: 'Main', icon: 'target', component: GoalsPage, showInSidebar: true },
  { path: '/tasks', label: 'Tasks', section: 'Main', icon: 'check-square', component: TasksPage, showInSidebar: true },
  { path: '/calendar', label: 'Calendar', section: 'Main', icon: 'calendar', component: CalendarPage, showInSidebar: true },
  { path: '/meetings', label: 'Meetings', section: 'Main', icon: 'calendar', component: MeetingsPage, showInSidebar: true },
  { path: '/feed', label: 'Feed', section: 'Main', icon: 'activity', component: TeamFeed, showInSidebar: true },

  { path: '/cycles', label: 'Manage Cycles', section: 'Annual Cycle', icon: 'refresh', component: Cycles, showInSidebar: true },
  {
    path: '/midyear-assessments',
    label: 'Mid-Year Assessment',
    section: 'Annual Cycle',
    icon: 'bar-chart',
    component: MidYearPage,
    showInSidebar: true,
    allowedPhases: ['phase2'],
    phaseUnavailableTitle: 'Mid-Year Assessment is not open in this cycle',
    phaseUnavailableDescription: 'This workspace becomes interactive during Phase 2. Outside that phase, the dashboard and the backend rules remain unchanged.',
  },
  { path: '/manager-review', label: 'Goal Check-Up', section: 'Annual Cycle', icon: 'star', component: ManagerReviewPage, showInSidebar: true },
  { path: '/final-evaluations', label: 'End-Year Review', section: 'Annual Cycle', icon: 'clipboard', component: FinalEvaluationPage, showInSidebar: true },
  { path: '/evaluation-scoring', label: 'Evaluation Scoring', section: 'Annual Cycle', icon: 'bar-chart', component: EvaluationScoringPage, showInSidebar: true },
  { path: '/performance', label: 'Performance', section: 'Annual Cycle', icon: 'trending-up', component: PerformancePage, showInSidebar: true },

  { path: '/my-team', label: 'My Team', section: 'People', icon: 'users', component: MyTeamPage, showInSidebar: true },
  { path: '/feedback', label: 'Feedback', section: 'People', icon: 'message-circle', component: FeedbackPage, showInSidebar: true },

  { path: '/career', label: 'Career', section: 'Development', icon: 'compass', component: CareerPage, showInSidebar: true },
  { path: '/evaluations', label: 'Assessments', section: 'Development', icon: 'file-text', component: Evaluations, showInSidebar: true },

  { path: '/validation', label: 'Validation', section: 'Management', icon: 'check-circle', component: Validation, showInSidebar: true },
  { path: '/hr-validation', label: 'HR Validation', section: 'Management', icon: 'shield', component: HRValidation, showInSidebar: true },
  { path: '/hr-decisions', label: 'HR Decisions', section: 'Management', icon: 'briefcase', component: HRDecisions, showInSidebar: true },
  { path: '/teams', label: 'Teams', section: 'Management', icon: 'layers', component: Teams, showInSidebar: true },
  { path: '/users', label: 'Users', section: 'Management', icon: 'user', component: Users, showInSidebar: true },
  { path: '/analytics', label: 'Analytics', section: 'Management', icon: 'pie-chart', component: AnalyticsPage, showInSidebar: true },
  { path: '/audit-logs', label: 'Audit Logs', section: 'Management', icon: 'shield', component: AuditLogsPage, showInSidebar: true },
  { path: '/settings', label: 'Settings', section: 'Management', icon: 'settings', component: Settings, showInSidebar: true },
];

const SIDEBAR_SECTIONS = (function buildSidebarSections() {
  var sections = [];

  APP_ROUTES.filter(function (route) {
    return route.showInSidebar;
  }).forEach(function (route) {
    var existingSection = sections.find(function (section) {
      return section.label === route.section;
    });

    if (!existingSection) {
      existingSection = { label: route.section, items: [] };
      sections.push(existingSection);
    }

    existingSection.items.push(route);
  });

  return sections;
})();

export function getRouteMeta(pathname) {
  return APP_ROUTES.find(function (route) {
    return route.path === pathname;
  }) || PUBLIC_ROUTES.find(function (route) {
    return route.path === pathname;
  }) || null;
}

export function getSidebarSections() {
  return SIDEBAR_SECTIONS;
}

export function preloadRoute(pathname) {
  var route = getRouteMeta(pathname);
  if (route?.component?.preload) {
    route.component.preload();
  }
}

export function preloadPrimaryAppRoutes(limit) {
  APP_ROUTES.slice(0, typeof limit === 'number' ? limit : 4).forEach(function (route) {
    if (route?.component?.preload) {
      route.component.preload();
    }
  });
}
