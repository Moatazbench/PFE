import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './components/AuthContext';
import { ThemeProvider } from './components/ThemeContext';
import ProtectedRoute from './components/ProtectedRoute';
import CyclePhaseRoute from './components/CyclePhaseRoute';
import DashboardLayout from './components/DashboardLayout';
import ErrorBoundary from './components/common/ErrorBoundary';

const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Cycles = lazy(() => import('./pages/Cycles'));
const Evaluations = lazy(() => import('./pages/Evaluations'));
const Validation = lazy(() => import('./pages/Validation'));
const HRDecisions = lazy(() => import('./pages/HRDecisions'));
const Teams = lazy(() => import('./pages/Teams'));
const Users = lazy(() => import('./pages/Users'));
const Settings = lazy(() => import('./pages/Settings'));
const GoalsPage = lazy(() => import('./pages/GoalsPage'));
const MeetingsPage = lazy(() => import('./pages/MeetingsPage'));
const FeedbackPage = lazy(() => import('./pages/FeedbackPage'));
const TasksPage = lazy(() => import('./pages/TasksPage'));
const CalendarPage = lazy(() => import('./pages/CalendarPage'));
const CareerPage = lazy(() => import('./pages/CareerPage'));
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage'));
const TeamFeed = lazy(() => import('./pages/TeamFeed'));
const MyTeamPage = lazy(() => import('./pages/MyTeamPage'));
const MidYearPage = lazy(() => import('./pages/MidYearPage'));
const FinalEvaluationPage = lazy(() => import('./pages/FinalEvaluationPage'));
const PerformancePage = lazy(() => import('./pages/PerformancePage'));
const EvaluationScoringPage = lazy(() => import('./pages/EvaluationScoringPage'));
const AuditLogsPage = lazy(() => import('./pages/AuditLogsPage'));
const ManagerReviewPage = lazy(() => import('./pages/ManagerReviewPage'));
const HRValidation = lazy(() => import('./pages/HRValidation'));

function RouteLoader() {
  return (
    <div className="page-loading" aria-live="polite">
      <div className="spinner"></div>
      <p>Loading workspace...</p>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <ErrorBoundary>
          <Suspense fallback={<RouteLoader />}>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/dashboard" element={<ProtectedRoute><DashboardLayout><Dashboard /></DashboardLayout></ProtectedRoute>} />
              <Route path="/feed" element={<ProtectedRoute><DashboardLayout><TeamFeed /></DashboardLayout></ProtectedRoute>} />
              <Route path="/my-team" element={<ProtectedRoute><DashboardLayout><MyTeamPage /></DashboardLayout></ProtectedRoute>} />
              <Route path="/cycles" element={<ProtectedRoute><DashboardLayout><Cycles /></DashboardLayout></ProtectedRoute>} />
              <Route path="/midyear-assessments" element={<ProtectedRoute><DashboardLayout><CyclePhaseRoute allowedPhases={['phase2']}><MidYearPage /></CyclePhaseRoute></DashboardLayout></ProtectedRoute>} />
              <Route path="/final-evaluations" element={<ProtectedRoute><DashboardLayout><FinalEvaluationPage /></DashboardLayout></ProtectedRoute>} />
              <Route path="/performance" element={<ProtectedRoute><DashboardLayout><PerformancePage /></DashboardLayout></ProtectedRoute>} />
              <Route path="/evaluation-scoring" element={<ProtectedRoute><DashboardLayout><EvaluationScoringPage /></DashboardLayout></ProtectedRoute>} />
              <Route path="/audit-logs" element={<ProtectedRoute><DashboardLayout><AuditLogsPage /></DashboardLayout></ProtectedRoute>} />
              <Route path="/goals" element={<ProtectedRoute><DashboardLayout><GoalsPage /></DashboardLayout></ProtectedRoute>} />
              <Route path="/manager-review" element={<ProtectedRoute><DashboardLayout><ManagerReviewPage /></DashboardLayout></ProtectedRoute>} />
              <Route path="/hr-validation" element={<ProtectedRoute><DashboardLayout><HRValidation /></DashboardLayout></ProtectedRoute>} />
              <Route path="/evaluations" element={<ProtectedRoute><DashboardLayout><Evaluations /></DashboardLayout></ProtectedRoute>} />
              <Route path="/validation" element={<ProtectedRoute><DashboardLayout><Validation /></DashboardLayout></ProtectedRoute>} />
              <Route path="/hr-decisions" element={<ProtectedRoute><DashboardLayout><HRDecisions /></DashboardLayout></ProtectedRoute>} />
              <Route path="/teams" element={<ProtectedRoute><DashboardLayout><Teams /></DashboardLayout></ProtectedRoute>} />
              <Route path="/users" element={<ProtectedRoute><DashboardLayout><Users /></DashboardLayout></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute><DashboardLayout><Settings /></DashboardLayout></ProtectedRoute>} />
              <Route path="/meetings" element={<ProtectedRoute><DashboardLayout><MeetingsPage /></DashboardLayout></ProtectedRoute>} />
              <Route path="/feedback" element={<ProtectedRoute><DashboardLayout><FeedbackPage /></DashboardLayout></ProtectedRoute>} />
              <Route path="/tasks" element={<ProtectedRoute><DashboardLayout><TasksPage /></DashboardLayout></ProtectedRoute>} />
              <Route path="/calendar" element={<ProtectedRoute><DashboardLayout><CalendarPage /></DashboardLayout></ProtectedRoute>} />
              <Route path="/career" element={<ProtectedRoute><DashboardLayout><CareerPage /></DashboardLayout></ProtectedRoute>} />
              <Route path="/analytics" element={<ProtectedRoute><DashboardLayout><AnalyticsPage /></DashboardLayout></ProtectedRoute>} />
              <Route path="/" element={<Navigate to="/login" replace />} />
              <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </ThemeProvider>
    </AuthProvider>
  );
}

export default App;
