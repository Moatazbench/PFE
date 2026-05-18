# Final Year University Project Report

## Title
Performance Management and HR Evaluation Platform Using the MERN Stack

## Scope Note
This report is based on the current repository state of the project located at `application_gestion_competences`. It documents the implemented system as it exists in code, including active modules, shared infrastructure, and a few legacy or partially wired files that remain in the repository for compatibility or future work.

## 1. Project Overview

### 1.1 What the Application Does
This application is a web-based performance management platform built with the MERN stack. It supports the annual performance cycle of an organization by allowing administrators, HR staff, team leaders, and collaborators to create goals, track progress, submit check-ins, evaluate employees, manage meetings, assign tasks, review performance data, and make final HR decisions.

### 1.2 Problem the System Solves
In many organizations, performance management is fragmented across spreadsheets, email threads, document attachments, and manual supervisor reviews. This creates weak traceability, delayed feedback, unclear accountability, and poor visibility into employee development. The system solves this problem by centralizing:

- objective definition and approval
- mid-year progress tracking
- end-of-year performance review
- supporting evidence upload
- team and HR validation workflows
- task and meeting coordination
- auditability of decisions and evaluations

### 1.3 Target Users
- `ADMIN`: full platform administration and high-level control
- `HR`: cycle management, validation, HR decisions, analytics, and governance
- `TEAM_LEADER`: team supervision, goal approval, check-in review, and manager evaluation
- `COLLABORATOR`: goal drafting, self-assessment, check-in submission, and personal dashboard usage

### 1.4 Core Features Summary
- secure authentication with access and refresh tokens
- role-based access control across frontend and backend
- annual cycle setup with phase-based workflow
- objective management with KPI tracking and approval lifecycle
- task management with kanban view and time tracking
- meeting scheduling and follow-up action items
- feedback exchange between employees and managers
- mid-year check-ins with attachments
- end-year final evaluation with manager scoring and HR validation
- dashboard analytics for personal, team, and organizational scope
- notifications and reminders
- calendar integration for Google and Outlook
- PDF export for evaluation reports

## 2. System Architecture

### 2.1 High-Level Architecture
The system follows a classic MERN structure:

- `React + Vite` on the frontend for the single-page application
- `Node.js + Express` on the backend for the API and business logic
- `MongoDB + Mongoose` for persistent data storage
- static uploads stored on the backend file system and served under `/uploads`

The frontend and backend are separated into different folders:

- `frontend/`: presentation, routing, stateful UI, API consumption
- `backend/`: REST API, authentication, models, business rules, uploads, and security middleware

### 2.2 Why This Architecture Was Chosen
This architecture is suitable for a university-scale enterprise application because it offers:

- separation of concerns between user interface and server logic
- flexible document modeling for evolving HR workflows
- rapid development with reusable React components
- scalable API design through route-controller-model separation
- straightforward Docker and Kubernetes deployment

### 2.3 Frontend to Backend Communication
The frontend communicates with the backend through HTTP requests sent with Axios. Most application requests target `/api/...` endpoints. During development, Vite proxies `/api` and `/uploads` to the backend server. In containerized deployment, Nginx forwards `/api` requests to the backend container.

### 2.4 Request Lifecycle
Typical request processing follows this sequence:

1. A user interacts with a React page or component.
2. The component calls an API helper or the shared Axios client.
3. The Axios client attaches the JWT access token in the `Authorization` header.
4. Express receives the request and runs middleware such as CORS, rate limiting, sanitization, JSON parsing, and authentication.
5. The matched route forwards the request to a controller.
6. The controller validates business rules and performs database operations through Mongoose models.
7. The controller returns JSON data or a file response.
8. The frontend updates local state and re-renders the UI.

### 2.5 Step-by-Step Data Flow Example
For a protected page load such as the dashboard:

1. The user logs in and receives `accessToken` and `refreshToken`.
2. The frontend stores both tokens in `localStorage`.
3. `AuthContext` loads the current user from `/api/auth/me`.
4. `ProtectedRoute` allows access only if a valid user exists.
5. `Dashboard.jsx` performs multiple API calls in parallel.
6. Backend controllers aggregate statistics and return scoped data.
7. The dashboard normalizes API responses and displays cards, analytics, timeline, and alerts.

## 3. Technology Stack Explanation

### 3.1 Frontend Technologies

#### React
React was chosen because the application contains many interactive screens, role-specific dashboards, modals, forms, tables, and workflow states. React's component-based model supports reuse, maintainability, and incremental UI growth.

#### React Router
React Router is used to manage navigation between the login page and protected business modules such as dashboard, goals, tasks, meetings, cycles, evaluations, and analytics.

#### State Management Approach
The application does not use Redux or another global state framework. Instead, it uses:

- React Context for global authentication and theme state
- local `useState` and `useEffect` for page-level state
- shared hooks such as `usePersistentTimer` and `useActiveCycle` for reusable logic

This is appropriate for the current system size, though it creates some duplicated fetching logic across pages.

#### Axios
Axios is used for API communication because it supports interceptors, request customization, refresh-token retry logic, and consistent error handling.

#### Framer Motion
Framer Motion is used in parts of the dashboard to enhance perceived quality and improve interaction feedback with lightweight animation.

#### Chart Libraries
The system uses `chart.js`, `react-chartjs-2`, and `recharts` to visualize performance trends, statistics, scores, and dashboards.

### 3.2 Backend Technologies

#### Node.js
Node.js is appropriate because the application is event-driven, API-focused, and performs many asynchronous tasks such as DB queries, token handling, mail notifications, file serving, and third-party calendar communication.

#### Express.js
Express provides a lightweight and modular backend framework. It supports:

- route-based API design
- middleware chains
- clean integration with authentication and validation
- easy REST endpoint expansion

### 3.3 Database Technology

#### MongoDB
MongoDB was chosen because performance management data is semi-structured and evolves over time. Entities such as objectives, check-ins, meetings, and evaluations contain nested arrays and optional workflow fields that fit document storage naturally.

#### Mongoose
Mongoose is used to define schemas, enforce validation, create indexes, and model relationships between collections with `ObjectId` references.

### 3.4 Supporting Libraries

- `jsonwebtoken`: access and refresh token generation
- `bcryptjs`: password hashing
- `helmet`: HTTP security headers
- `cors`: cross-origin access control
- `express-rate-limit`: request throttling
- `xss-clean`: XSS sanitization
- `express-mongo-sanitize`: MongoDB operator injection defense
- `joi`: structured input validation
- `multer`: file upload handling
- `nodemailer`: email notifications
- `pdfkit`: PDF report generation
- `openai`: AI-assisted manager draft generation
- `date-fns`: date manipulation on the frontend
- `@dnd-kit/*`: drag-and-drop interaction for kanban functionality

## 4. Project Folder Structure Explanation

### 4.1 Frontend Structure

#### Frontend Root Files

| File | Purpose | Interaction |
|---|---|---|
| `frontend/package.json` | declares frontend dependencies and scripts | used by Vite, npm, Docker build |
| `frontend/vite.config.js` | configures dev server and API proxy | connects frontend dev mode to backend |
| `frontend/index.html` | SPA HTML entry file | Vite injects the React bundle here |
| `frontend/Dockerfile` | builds and serves the frontend with Nginx | used in Docker and Kubernetes |
| `frontend/nginx.conf` | serves SPA and proxies `/api` to backend | supports production deployment |
| `frontend/jest.config.js` | test configuration placeholder | supports frontend test structure |
| `frontend/code-export-tree.txt` | static project tree snapshot | documentation aid, not runtime |
| `frontend/README.md` | developer notes | onboarding support |

#### Frontend Runtime Entry

| File | Purpose | Interaction |
|---|---|---|
| `frontend/src/main.jsx` | boots the React application and router | mounts `App.jsx` into `#root` |
| `frontend/src/App.jsx` | defines application routes and wraps providers | uses `AuthProvider`, `ThemeProvider`, `DashboardLayout`, and page components |
| `frontend/src/index.css` | global reset and baseline transitions | affects all pages and components |
| `frontend/src/App.css` | large legacy/global style layer | shared styling for many older components |
| `frontend/src/premium.css` | premium interaction and modal styles | complements older UI modules |
| `frontend/src/apple-design.css` | alternate design language layer | contributes to visual styling |
| `frontend/src/design-system.css` | design system tokens and component overrides | normalizes cards, inputs, layout |
| `frontend/src/enterprise-shell.css` | enterprise shell, sidebar, header, modal frame | styles protected application layout |
| `frontend/src/evaluation.css` | evaluation-specific styling | used by review and scoring screens |
| `frontend/src/work-management.css` | tasks/calendar/workbench styling | shared by tasks and calendar modules |

#### Frontend Services, Hooks, and Utilities

| File | Purpose | Interaction |
|---|---|---|
| `frontend/src/services/api.js` | main Axios instance with token refresh | used by most pages and components |
| `frontend/src/api/apiClient.js` | secondary Axios wrapper returning `response.data` | used by small wrapper APIs |
| `frontend/src/api/cycles.js` | cycle API convenience functions | consumes `apiClient.js` |
| `frontend/src/api/teams.js` | team API convenience functions | consumes `apiClient.js` |
| `frontend/src/api/users.js` | user filtering helpers | consumes `apiClient.js` |
| `frontend/src/api/hrDecisions.js` | HR decision CRUD wrappers | consumes `apiClient.js` |
| `frontend/src/hooks/usePersistentTimer.js` | task timer persistence logic | used by `TasksPage.jsx` |
| `frontend/src/hooks/useActiveCycle.js` | active cycle/phase lookup | used by header and cycle-aware screens |
| `frontend/src/utils/objectiveRules.js` | goal rule helpers | supports objective logic |
| `frontend/src/utils/workManagement.js` | task/productivity/calendar transforms | used in tasks, calendar, dashboard |

#### Frontend Context and Layout Components

| File | Purpose | Interaction |
|---|---|---|
| `frontend/src/components/AuthContext.jsx` | authentication context, login/logout, token refresh | central auth state provider |
| `frontend/src/components/ThemeContext.jsx` | dark mode/theme state | used by login, shell, and sidebar |
| `frontend/src/components/ProtectedRoute.jsx` | blocks anonymous access | wraps protected routes |
| `frontend/src/components/CyclePhaseRoute.jsx` | restricts route access by active cycle phase | protects phase-dependent pages |
| `frontend/src/components/DashboardLayout.jsx` | protected shell wrapper | composes sidebar, header, and content |
| `frontend/src/components/EnterpriseSidebar.jsx` | main active sidebar navigation | used by layout |
| `frontend/src/components/TopHeader.jsx` | page title, search, notifications, profile menu | used by layout |
| `frontend/src/components/Navbar.jsx` | older navigation component | appears legacy relative to enterprise shell |
| `frontend/src/components/Sidebar.jsx` | earlier sidebar implementation | mostly legacy/alternate navigation |
| `frontend/src/components/UserAvatar.jsx` | reusable avatar rendering | used across profile and team UIs |
| `frontend/src/components/Notifications.jsx` | frontend notification bell and dropdown | pulls backend notifications |

#### Frontend Common Components

| File | Purpose | Interaction |
|---|---|---|
| `frontend/src/components/common/Toast.jsx` | toast notification system and hook | used by many pages for feedback |
| `frontend/src/components/common/ConfirmDialog.jsx` | reusable destructive confirmation dialog | used in task deletion and other flows |
| `frontend/src/components/common/LoadingSkeleton.jsx` | loading placeholders | used to avoid blank states |
| `frontend/src/components/common/ErrorBoundary.jsx` | catches rendering failures | wraps the app tree |

#### Frontend Dashboard Components

| File | Purpose | Interaction |
|---|---|---|
| `frontend/src/components/dashboard/DashboardHeader.jsx` | dashboard heading and controls | composed inside dashboard |
| `frontend/src/components/dashboard/DashboardAnalytics.jsx` | charts and analytic views | receives normalized dashboard data |
| `frontend/src/components/dashboard/GoalCard.jsx` | objective summary card | used on dashboard |
| `frontend/src/components/dashboard/MeetingCard.jsx` | meeting card | used on dashboard |
| `frontend/src/components/dashboard/TaskCard.jsx` | task card | used on dashboard |
| `frontend/src/components/dashboard/FeedbackCard.jsx` | feedback card | used on dashboard |
| `frontend/src/components/dashboard/ProgressDonut.jsx` | progress visual | used inside dashboard analytics |
| `frontend/src/components/dashboard/dashboardUtils.js` | normalization, aggregation, and helper logic | central dashboard data processing |

#### Frontend Goal Components

| File | Purpose | Interaction |
|---|---|---|
| `frontend/src/components/goals/CreateGoalModal.jsx` | goal creation dialog | used in goals workspace |
| `frontend/src/components/goals/EditGoalModal.jsx` | goal editing dialog | used in goals workspace |
| `frontend/src/components/goals/CheckInModal.jsx` | goal progress update modal | used for quick check-in |
| `frontend/src/components/goals/ChangeRequestModal.jsx` | goal change request UI | supports workflow exceptions |
| `frontend/src/components/goals/EvaluateGoalModal.jsx` | goal evaluation modal | used during review |
| `frontend/src/components/goals/ManagerReviewModal.jsx` | manager review UI | supports goal oversight |
| `frontend/src/components/goals/GoalTable.jsx` | tabular objective display | primary listing surface |
| `frontend/src/components/goals/GoalFilters.jsx` | filter controls | narrows visible goals |
| `frontend/src/components/goals/GoalDetailsPanel.jsx` | expanded goal information | shows deeper context |
| `frontend/src/components/goals/GoalProgressBar.jsx` | progress visualization | reused across goal-related pages |
| `frontend/src/components/goals/GoalProgressSummary.jsx` | summary metrics | supports management views |
| `frontend/src/components/goals/GoalStatusBadge.jsx` | standardized status indicator | reused by goal lists |
| `frontend/src/components/goals/GoalAlignmentTree.jsx` | parent-child objective visualization | supports strategic alignment |
| `frontend/src/components/goals/GoalAlignmentTree.css` | tree styling | styles alignment visualization |
| `frontend/src/components/goals/ViewSwitcher.jsx` | alternate view selection | supports table/tree/scope switching |
| `frontend/src/components/goals/CheckInModal.css` | specific check-in modal styling | styles `CheckInModal.jsx` |

#### Frontend Team Components

| File | Purpose | Interaction |
|---|---|---|
| `frontend/src/components/teams/TeamModal.jsx` | team create/edit modal | used in team management page |
| `frontend/src/components/teams/ConfirmDeleteModal.jsx` | delete confirmation modal | used for team deletion |

#### Frontend Task Components

| File | Purpose | Interaction |
|---|---|---|
| `frontend/src/components/tasks/KanbanBoard.jsx` | drag-and-drop workflow board | used by `TasksPage.jsx` |
| `frontend/src/components/tasks/ProductivityTimerWidget.jsx` | timer UI for focus/productivity tracking | used by `TasksPage.jsx` |

#### Frontend Evaluation Components

| File | Purpose | Interaction |
|---|---|---|
| `frontend/src/components/evaluations/ReportModal.jsx` | report/evidence modal for assessment workflows | exists in repo but appears partially wired to missing API helper |
| `frontend/src/components/evaluations/CycleModal.jsx` | cycle-related modal component | supports evaluation workflow UI |
| `frontend/src/components/ExportPDF.jsx` | PDF export helper | supports output generation |
| `frontend/src/components/ProgressChart.jsx` | shared chart component | used for progress visualization |

#### Frontend AI Components

| File | Purpose | Interaction |
|---|---|---|
| `frontend/src/components/ai/AIGenerateButton.jsx` | trigger for AI-supported generation | connects to AI workflow |
| `frontend/src/components/ai/AIDraftModal.jsx` | modal for AI draft results | supports generated content review |
| `frontend/src/components/ai/DevelopmentPlanGenerator.jsx` | AI-assisted development planning | supports employee growth planning |

#### Frontend Pages

| File | Purpose | Interaction |
|---|---|---|
| `frontend/src/pages/Login.jsx` | authentication entry screen | uses `AuthContext` |
| `frontend/src/pages/Dashboard.jsx` | main system overview | loads stats, objectives, meetings, tasks, feedback |
| `frontend/src/pages/GoalsPage.jsx` | objective workspace | central goal lifecycle page |
| `frontend/src/pages/MidYearPage.jsx` | phase 2 check-in workflow | uses uploads and manager review logic |
| `frontend/src/pages/FinalEvaluationPage.jsx` | end-year module entry | switches employee/team view |
| `frontend/src/pages/FinalEvaluationEmployee.jsx` | employee self-assessment screen | uploads final evidence to objective |
| `frontend/src/pages/FinalEvaluationManager.jsx` | manager evaluation editor | generates and submits final review |
| `frontend/src/pages/PerformancePage.jsx` | weighted performance summaries | consumes `/performance` API |
| `frontend/src/pages/HRValidation.jsx` | HR validation queue | final review governance |
| `frontend/src/pages/HRDecisions.jsx` | HR decision management | post-evaluation action decisions |
| `frontend/src/pages/Evaluations.jsx` | evaluation overview page | summarizes readiness and cycle information |
| `frontend/src/pages/EvaluationScoringPage.jsx` | scoring/rubric related view | supports evaluation visibility |
| `frontend/src/pages/EvaluationListPage.jsx` | list-style evaluation page | exists but route is effectively unused |
| `frontend/src/pages/Validation.jsx` | validation workspace | manager/admin workflow page |
| `frontend/src/pages/Users.jsx` | user management | admin/HR maintenance |
| `frontend/src/pages/Teams.jsx` | team management | admin/HR organizational setup |
| `frontend/src/pages/MyTeamPage.jsx` | current team overview | team leader and member visibility |
| `frontend/src/pages/MyTeamPage.css` | styles My Team page | page-specific styling |
| `frontend/src/pages/TeamFeed.jsx` | collaborative team feed | activity/social-style updates |
| `frontend/src/pages/TasksPage.jsx` | task board, timer, and timesheet page | uses kanban and timer hooks |
| `frontend/src/pages/MeetingsPage.jsx` | meeting management | scheduler and review meeting workflows |
| `frontend/src/pages/FeedbackPage.jsx` | feedback exchange view | peer/manager/self feedback |
| `frontend/src/pages/CalendarPage.jsx` | unified calendar and provider sync | merges internal and external events |
| `frontend/src/pages/CareerPage.jsx` | career recommendation view | supports development planning |
| `frontend/src/pages/Cycles.jsx` | cycle administration | setup of performance periods |
| `frontend/src/pages/Settings.jsx` | profile and notification test settings | includes avatar upload |
| `frontend/src/pages/AuditLogsPage.jsx` | audit visibility page | governance and accountability |
| `frontend/src/pages/AnalyticsPage.jsx` | analytics/reporting page | organization-level analysis |
| `frontend/src/pages/ManagerReviewPage.jsx` | manager goal review/check-up page | inspects check-ins and attachments |

### 4.2 Backend Structure

#### Backend Root and Configuration

| File | Purpose | Interaction |
|---|---|---|
| `backend/server.js` | application bootstrap and MongoDB connection | starts Express server |
| `backend/app.js` | Express app composition | registers middleware and routes |
| `backend/package.json` | backend dependencies and scripts | used by npm and Docker |
| `backend/Dockerfile` | container build for API | used in deployment |
| `backend/jest.config.js` | backend test configuration | used by Jest |
| `backend/config/db.js` | database-related configuration helper | supports DB connectivity organization |
| `backend/AI_SETUP.md` | AI integration notes | developer documentation |
| `backend/QUICK_TEST_REFERENCE.md` | quick testing support | developer documentation |
| `backend/code-export-tree.txt` | static tree snapshot | documentation aid |

#### Backend Middleware

| File | Purpose | Interaction |
|---|---|---|
| `backend/middleware/auth.js` | JWT verification and active-user validation | protects secured routes |
| `backend/middleware/role.js` | role-based access control | enforces RBAC at route level |
| `backend/middleware/validate.js` | Joi schema validation wrapper | sanitizes request bodies |
| `backend/middleware/errorHandler.js` | final error response formatting | catches uncaught route errors |
| `backend/middleware/rateLimiter.js` | custom request throttling | used on sensitive endpoints |
| `backend/middleware/audit.js` | audit middleware | supports traceability |
| `backend/middleware/ownership.js` | resource ownership support | protects user-specific access |
| `backend/middleware/validateEnv.js` | environment validation support | deployment/runtime hygiene |

#### Backend Validators

| File | Purpose | Interaction |
|---|---|---|
| `backend/validators/schemas.js` | Joi schemas for auth, users, objectives, and cycles | used by `validate.js` middleware |

#### Backend Models

| File | Purpose | Interaction |
|---|---|---|
| `backend/models/User.js` | user identity, role, password, team, manager, refresh token | core auth and access entity |
| `backend/models/Team.js` | team structure, leader, and members | groups users organizationally |
| `backend/models/Cycle.js` | annual cycle and phase dates | governs phase-based workflows |
| `backend/models/Objective.js` | core performance objective with KPIs, attachments, comments, and lifecycle status | central business entity |
| `backend/models/CheckIn.js` | phase 2 progress submissions with attachments and history | supports mid-year review |
| `backend/models/Evaluation.js` | structured evaluation workflow with approvals | separate general evaluation engine |
| `backend/models/FinalEvaluation.js` | final end-year manager/HR evaluation record | main phase 3 review entity |
| `backend/models/Task.js` | operational tasks, workflow stage, and time tracking | execution support layer |
| `backend/models/Meeting.js` | meetings, agenda, participants, action items | coordination and review support |
| `backend/models/Feedback.js` | feedback messages and related links | qualitative review input |
| `backend/models/Notification.js` | system notifications | delivery of in-app alerts |
| `backend/models/HRDecision.js` | post-evaluation HR decisions | administrative decision layer |
| `backend/models/CareerRecommendation.js` | generated or manager-entered growth plans | development support |
| `backend/models/CalendarConnection.js` | encrypted OAuth provider connection data | external calendar integration |
| `backend/models/AuditLog.js` | audit trail records | governance and accountability |
| `backend/models/CorrectionRequest.js` | correction request persistence | supports revision workflows |
| `backend/models/Competency.js` | competency-related modeling | supports HR growth evaluation |
| `backend/models/CareerPath.js` | career path structure | supports development planning |

#### Backend Routes

| File | Purpose | Interaction |
|---|---|---|
| `backend/routes/auth.js` | login, refresh, logout, current-user retrieval | drives frontend auth flow |
| `backend/routes/users.js` | user CRUD and avatar upload | consumed by admin/settings pages |
| `backend/routes/teams.js` | team CRUD and team lookups | consumed by team screens |
| `backend/routes/teamMembers.js` | team-member specific operations | organizational support |
| `backend/routes/cycles.js` | annual cycle management | used by cycle administration |
| `backend/routes/objectives.js` | goal lifecycle endpoints | most central business route |
| `backend/routes/checkins.js` | check-in CRUD/review and upload endpoint | phase 2 workflow |
| `backend/routes/evaluations.js` | structured evaluation API | generic evaluation engine |
| `backend/routes/finalEvaluations.js` | end-year evaluation API | phase 3 manager and HR workflow |
| `backend/routes/performance.js` | performance summary and team scoring | consumed by performance page |
| `backend/routes/meetings.js` | meeting scheduling and action items | consumed by meetings page |
| `backend/routes/tasks.js` | task CRUD, stats, and timer entries | consumed by tasks page |
| `backend/routes/feedback.js` | feedback APIs | consumed by feedback page |
| `backend/routes/notifications.js` | notification APIs | consumed by notification bell |
| `backend/routes/stats.js` | dashboard stats and distributions | consumed by dashboard/analytics |
| `backend/routes/hrDecisions.js` | HR decisions CRUD | consumed by HR page |
| `backend/routes/calendar.js` | OAuth connect, sync, and event APIs | consumed by calendar page |
| `backend/routes/career.js` | career recommendation APIs | consumed by career page |
| `backend/routes/reports.js` | cycle objective summary reporting | related to assessment reporting |
| `backend/routes/pdf.js` | PDF reporting routes | export functionality |
| `backend/routes/feed.js` | feed-related data | team feed page |
| `backend/routes/ai.js` | AI generation endpoints | AI-assisted drafting |
| `backend/routes/auditLog.js` | audit log retrieval | admin/HR governance view |
| `backend/routes/progress.js` | progress-related support routes | workflow support |
| `backend/routes/reminders.js` | reminder operations | notification support |
| `backend/routes/me.js` | self-user utility route | user-centric convenience endpoint |

#### Backend Controllers

| File | Purpose | Interaction |
|---|---|---|
| `backend/controllers/userController.js` | user retrieval, update, deletion, avatar upload | supports `/users` routes |
| `backend/controllers/teamController.js` | team CRUD and membership validation | supports `/teams` |
| `backend/controllers/cycleController.js` | cycle creation, update, phase logic | supports `/cycles` |
| `backend/controllers/objectiveController.js` | objective creation, submission, approval, evaluation, change requests, KPIs, comments | heart of performance workflow |
| `backend/controllers/checkInController.js` | check-in submit/review/history logic | supports phase 2 operations |
| `backend/controllers/evaluationController.js` | general evaluation workflow, scoring, approvals | structured evaluation module |
| `backend/controllers/finalEvaluationController.js` | end-year manager draft generation, HR validation, history, export | critical phase 3 module |
| `backend/controllers/taskController.js` | task CRUD, status synchronization, timer persistence | execution management |
| `backend/controllers/feedbackController.js` | feedback creation and retrieval | communication layer |
| `backend/controllers/notificationController.js` | notification management and helper creation | alert subsystem |
| `backend/controllers/hrDecisionController.js` | HR decision business logic | post-review action layer |
| `backend/controllers/statsController.js` | dashboard and score aggregations | analytics support |
| `backend/controllers/aiController.js` | AI feature access | generation support |
| `backend/controllers/careerController.js` | career suggestion workflows | development planning |

#### Backend Services and Utilities

| File | Purpose | Interaction |
|---|---|---|
| `backend/services/scoreCalculationService.js` | automated scoring and label logic | used in final evaluation generation |
| `backend/services/reviewContextService.js` | compiles review context for AI and fallback summaries | used by final evaluations |
| `backend/services/aiService.js` | OpenAI-based generation wrapper | used for manager draft generation |
| `backend/utils/authHelpers.js` | auth-related utility functions | backend support |
| `backend/utils/objectiveRules.js` | reusable objective rules | business logic support |
| `backend/utils/notificationHelper.js` | notification helper methods | used by workflows |
| `backend/utils/mailer.js` | email sending utility | supports email notifications |
| `backend/utils/calendarCrypto.js` | encryption/decryption of calendar tokens | protects OAuth credentials |
| `backend/utils/auditLogger.js` | audit event logger | used in sensitive workflows |
| `backend/utils/auditHelper.js` | audit support abstraction | used in evaluation module |

#### Backend Cron Jobs, Scripts, and Tests

| File | Purpose | Interaction |
|---|---|---|
| `backend/cron/reminderCron.js` | scheduled reminders | time-based notifications |
| `backend/cron/deadlineCron.js` | deadline alert processing | proactive deadline management |
| `backend/scripts/seed-users.js` | seed initial users | developer setup |
| `backend/scripts/list-users.js` | inspect seeded users | debugging/inspection |
| `backend/scripts/fix_stuck_goals.js` | maintenance script | data repair |
| `backend/scripts/check-data.js` | data verification | maintenance |
| `backend/scripts/cleanup.js` | environment/data cleanup | maintenance |
| `backend/scripts/migrate-okr.js` | migration helper | schema/data migration |
| `backend/scripts/test_realtime.js` | integration/debug script | development utility |
| `backend/tests/app.test.js` | API test coverage | backend validation |
| `backend/tests/health.test.js` | health endpoint test | deployment sanity check |

## 5. Application Data Flow

### 5.1 General Flow
The platform follows a strict UI to API to database round trip:

1. user triggers an action on a page
2. page calls API client
3. API request includes JWT token
4. backend authenticates request
5. route passes request to controller
6. controller performs validation and authorization checks
7. controller queries or updates MongoDB through a Mongoose model
8. JSON response returns to frontend
9. frontend updates state and re-renders affected UI

### 5.2 Real Example 1: Login Flow

#### Frontend
- `Login.jsx` collects email and password
- `AuthContext.login()` sends `POST /api/auth/login`
- on success the access and refresh tokens are stored in `localStorage`
- user data is stored in context state
- router navigates to `/dashboard`

#### Backend
- `routes/auth.js` receives the login request
- `User.findOne(...).select('+password')` loads the user
- `comparePassword()` verifies the bcrypt hash
- JWT access and refresh tokens are generated
- refresh token is stored on the user document
- response returns tokens plus a user summary

### 5.3 Real Example 2: Mid-Year Check-In Submission Flow

#### Frontend
- employee opens `MidYearPage.jsx`
- page loads objectives and existing check-ins for the active phase 2 cycle
- user enters progress and notes
- if the user uploads a file, the page first sends `POST /api/checkins/upload`
- backend returns attachment metadata
- page then sends `POST /api/checkins` with objective ID, cycle ID, progress, notes, priority, and attachments array

#### Backend
- `routes/checkins.js` handles upload through Multer
- uploaded file is stored in `uploads/checkins`
- `checkInController.submitCheckIn()` validates the cycle phase and request body
- attachment metadata is sanitized and stored in the `CheckIn` document
- `Objective.achievementPercent` is updated to reflect submitted progress
- response returns the new or updated check-in

### 5.4 Real Example 3: End-of-Year Evaluation Flow

#### Employee side
- `FinalEvaluationEmployee.jsx` loads evaluation state, objectives, check-ins, and history
- employee enters final percentage, self-rating, and comments per objective
- optional evidence is uploaded through the same check-in upload route
- form submits to `POST /api/objectives/:id/final-self-assessment`

#### Manager side
- `FinalEvaluationManager.jsx` loads team members and existing final evaluations
- manager chooses an employee and optionally generates an AI-assisted draft
- manager edits score, strengths, weaknesses, recommendations, and comments
- form saves through `PUT /api/final-evaluations/:id`
- evaluation can be submitted to HR with status `pending_hr`

#### HR side
- `HRValidation.jsx` retrieves pending evaluations
- HR validates or sends back the evaluation
- validation updates the final status and audit trail

## 6. Database Design (MongoDB)

### 6.1 Main Collections
- `users`
- `teams`
- `cycles`
- `objectives`
- `checkins`
- `evaluations`
- `finalevaluations`
- `tasks`
- `meetings`
- `feedback`
- `notifications`
- `hrdecisions`
- `careerrecommendations`
- `calendarconnections`
- `auditlogs`

### 6.2 Key Schema Structures

#### Users
Stores identity, role, team assignment, manager relationship, profile image, active status, deletion flag, and refresh token.

#### Teams
Stores a leader and an array of members, linking organization structure to performance ownership.

#### Cycles
Stores one annual cycle per year, including start and end dates for three phases and current phase status.

#### Objectives
This is the richest schema in the application. It stores:

- title, description, success indicator
- owner, team, cycle
- status lifecycle
- weight and computed score
- KPI array
- comments and progress updates
- change requests
- attachments
- final self-assessment fields

#### CheckIns
Stores mid-year progress submissions, manager feedback, attachments, approval state, and historical revisions.

#### FinalEvaluations
Stores final performance review output:

- auto score
- manager score
- final score
- rating label
- recommendation
- strengths
- weaknesses
- improvement suggestions
- manager comments
- evaluator and HR validation metadata

### 6.3 Relationships
Although MongoDB is non-relational, the project uses reference-based relationships:

- `User -> Team`
- `User -> manager (User)`
- `Objective -> User`
- `Objective -> Cycle`
- `Objective -> Team`
- `CheckIn -> Objective/User/Cycle`
- `Task -> User/Objective/Meeting/Team`
- `Meeting -> User/Cycle/Objective/FinalEvaluation`
- `FinalEvaluation -> User/Cycle`
- `HRDecision -> User/Cycle`

### 6.4 Why MongoDB Was Chosen
MongoDB is suitable because HR workflows contain variable and nested data. For example:

- objectives may or may not contain KPIs
- check-ins may contain zero or many attachments
- meetings contain nested agenda items and action items
- final evaluations contain optional arrays of strengths and weaknesses

This flexibility reduces rigid schema migration pressure during iterative development.

### 6.5 Attachment Storage
Attachments are not stored inside MongoDB as binary files. Instead:

- files are uploaded through Multer
- files are written to backend disk under `uploads/...`
- MongoDB stores metadata such as file name, URL, type, size, and MIME type

This is better than storing large files directly in MongoDB, but for larger production scale a cloud object store such as Amazon S3 or Cloudinary would be preferable.

## 7. Frontend Design and UX Decisions

### 7.1 Layout Strategy
The application uses a sidebar-first enterprise shell:

- `DashboardLayout.jsx` wraps protected pages
- `EnterpriseSidebar.jsx` provides route navigation
- `TopHeader.jsx` exposes page context, notifications, and profile access

This design is appropriate for multi-module business software because users need stable navigation across many workflows.

### 7.2 Responsive Design
The UI is desktop-first but still includes responsive CSS rules for smaller screens. Layouts use:

- CSS grid for cards and stats
- flexbox for headers, toolbars, and lists
- max-width constraints and shell spacing
- modals with internal scrolling

### 7.3 Forms and Modals
The system relies heavily on forms for objectives, teams, cycles, check-ins, meetings, settings, and evaluations. Modals are used where focused data entry is needed without leaving the current workflow context.

### 7.4 Navigation Design
Navigation is role-aware:

- pages are protected by authentication
- some views are hidden or redirected when the role is not allowed
- some routes are phase-aware through `CyclePhaseRoute`

### 7.5 Animations and Transitions
The UI includes:

- page enter transitions
- button hover/active transitions
- dashboard motion in selected analytics cards
- modal fade/scale animation styles

The animation strategy is mostly enhancement-oriented, not logic-critical.

### 7.6 Usability Improvements
The repository includes several practical usability decisions:

- toast notifications for success and failure
- loading skeletons to reduce blank screens
- badges and progress bars for status readability
- charts and summaries for decision support
- kanban and timer tools to support execution, not only evaluation

## 8. Performance Optimization

### 8.1 Current Optimizations Present
- `Promise.all` and `Promise.allSettled` are used in major pages to reduce serial waiting
- backend aggregation is used in statistics and score distributions
- task queries support pagination for some routes
- dashboard utilities normalize data before rendering
- check-in and file upload flows avoid refetching entire binaries
- static frontend assets are cacheable under Nginx

### 8.2 Performance Constraints Still Present
The project also shows areas for improvement:

- route-level lazy loading is not yet implemented in `App.jsx`
- several pages contain very large components with heavy inline rendering
- the production build currently emits a large JavaScript bundle
- there are overlapping CSS layers that increase style complexity
- API client logic is duplicated between `services/api.js`, `apiClient.js`, and `AuthContext.jsx`

### 8.3 File Upload Handling
Uploads are handled asynchronously with Multer and the frontend shows upload status messages. However, true upload progress bars are not consistently implemented in all attachment flows.

## 9. Security Considerations

### 9.1 Authentication
The system uses JWT-based authentication with two tokens:

- access token for authenticated API calls
- refresh token for renewing sessions without forcing immediate logout

### 9.2 Authorization
Authorization is enforced in multiple ways:

- backend `auth.js` validates token and active user status
- backend `role.js` enforces role-based access at route level
- frontend `ProtectedRoute.jsx` blocks anonymous access
- specific controller checks restrict managers to their own team members

### 9.3 Validation and Sanitization
- Joi validation is used for many structured payloads
- `xss-clean` reduces stored or reflected script injection risk
- `express-mongo-sanitize` reduces operator injection risk
- multer limits file type and file size

### 9.4 Network and API Security
- Helmet sets security headers
- CORS only allows configured origins
- rate limiting reduces abuse risk
- no-store cache headers reduce sensitive response caching

### 9.5 Credential Protection
- passwords are hashed with bcrypt
- calendar OAuth tokens are encrypted with `calendarCrypto.js`
- refresh tokens are persisted server-side and rotated on refresh

## 10. Key Feature Explanations

### 10.1 Authentication System
Purpose: identify users and apply role-specific access.

Implementation:
- login via `/api/auth/login`
- JWT access token plus refresh token
- `AuthContext` keeps frontend session state
- `ProtectedRoute` and backend middleware enforce access

### 10.2 Dashboard System
Purpose: give users a role- and scope-aware summary of work, progress, and alerts.

Implementation:
- `Dashboard.jsx` fetches stats, objectives, cycles, teams, meetings, feedback, tasks, and check-ins
- utilities normalize payloads into dashboard-ready structures
- cards and charts visualize current system state

### 10.3 File Upload System
Purpose: attach supporting evidence to progress and evaluation workflows.

Implementation:
- uploads use Multer
- files are saved under `backend/uploads`
- metadata is stored in MongoDB records
- frontend pages upload file first, then include returned metadata in final form submission

### 10.4 Evaluation System
Purpose: support structured performance review from employee self-assessment through manager review and HR validation.

Implementation:
- `Evaluation` model handles general evaluation workflow
- `FinalEvaluation` model handles end-of-year scoring and final decision workflow
- objective progress and weighted scores feed final results
- AI can assist manager draft generation through backend services

### 10.5 Task/Kanban/Calendar System
Purpose: connect performance planning with day-to-day execution.

Implementation:
- tasks support status, priority, workflow stage, time tracking, and linked goals
- calendar aggregates tasks, objectives, meetings, check-ins, and remote provider events
- Google and Outlook connections extend scheduling into real calendars

## 11. End-of-Year Evaluation Module

### 11.1 How Employee Evaluations Work
The end-of-year process is centered on phase 3 of the annual cycle:

1. employee opens `FinalEvaluationEmployee.jsx`
2. relevant objectives are loaded for the selected cycle
3. employee records final percentage, self-rating, and self-comment per objective
4. manager opens `FinalEvaluationManager.jsx`
5. manager loads team data for the same cycle
6. manager generates or edits a final evaluation draft
7. manager submits the draft for HR validation
8. HR validates or returns the evaluation

### 11.2 How Attachments Are Uploaded and Stored
Important technical observation:

- final self-assessment evidence is currently attached at the objective level through `Objective.finalSelfAttachment`
- this is a single attachment field, not an array
- mid-year check-ins support an attachments array
- `FinalEvaluation` itself does not store an attachments array

This means the current end-year implementation supports evidence per objective, but not a full multi-file attachment collection directly on the final evaluation record.

### 11.3 How Managers View Evaluation Data
Managers use `FinalEvaluationManager.jsx` to:

- list team members for a cycle
- inspect employee objective completion
- view employee self-assessment text
- open and download employee-submitted attachments
- edit score and narrative fields
- trigger AI-assisted manager draft generation

### 11.4 How Filtering by Year and Employee Works
- cycle selection on end-year pages acts as the year filter
- team evaluation endpoints scope records by `cycle_id`
- employee-specific views scope by both `employee_id` and `cycle_id`
- managers only see their own managed employees unless role is `ADMIN` or `HR`

### 11.5 How File Preview and Download Works
- uploaded files are returned as metadata with a URL under `/uploads/...`
- frontend uses anchor links or fetch-plus-download patterns
- files can be opened in a browser tab or downloaded locally

### 11.6 UX Flow of the Evaluation Dashboard
The UX flow is intentionally staged:

- select cycle
- select self or team mode
- review objective and historical data
- submit self-assessment or manager draft
- validate through HR queue

This matches real organizational review processes and reduces role confusion.

## 12. Deployment

### 12.1 Docker Deployment
The project includes Docker support for both services.

#### Frontend
- multi-stage Docker build
- Vite build output copied into Nginx image
- Nginx serves the SPA and proxies API requests

#### Backend
- Node Alpine image
- production dependencies installed with `npm ci --omit=dev`
- app exposed on port `5000`

### 12.2 Docker Compose
`docker-compose.yml` defines:

- one frontend container
- one backend container

This is suitable for local integrated testing.

### 12.3 Kubernetes Deployment
The project includes Kubernetes manifests under `k8s/`:

- base deployments for frontend and backend
- services for internal exposure
- overlays for `dev`, `qa`, `staging`, and `prod`

This indicates an intention to support multi-environment deployment beyond local development.

### 12.4 Environment Variables
Key runtime configuration includes:

- `MONGO_URI`
- `JWT_SECRET`
- `JWT_REFRESH_SECRET`
- `PORT`
- `VITE_DEV_PROXY_TARGET`
- calendar OAuth client IDs, secrets, and redirect URIs
- `FRONTEND_BASE_URL` and related app URLs

### 12.5 Build Process
- frontend: `npm run build` through Vite
- backend: direct Node startup via `node server.js`
- frontend production serving through Nginx

## 13. Final Conclusion

### 13.1 What Was Achieved
This project successfully implements a broad HR performance management platform rather than a simple CRUD application. It integrates planning, execution, review, evidence handling, reporting, and administrative decision-making into one platform.

### 13.2 System Strengths
- clear MERN separation between client and server
- strong domain coverage for HR performance workflows
- useful role-based and phase-based controls
- flexible MongoDB modeling for complex nested business data
- practical security middleware stack
- deployment readiness through Docker and Kubernetes
- strong feature depth in objectives, evaluations, and work-management modules

### 13.3 Current Limitations
- route lazy loading is not yet implemented
- some API wrappers and UI files appear legacy or partially wired
- CSS layering is complex due to multiple design systems
- final evaluation attachments are not yet modeled as a dedicated multi-file collection
- file storage is local disk based, which is less scalable than cloud object storage

### 13.4 Future Improvements
- introduce route-level code splitting
- unify API client strategy into one shared implementation
- move uploads to cloud storage with signed URLs
- support multiple direct attachments on final evaluations
- add more complete frontend progress indicators for uploads
- expand automated testing coverage
- modularize very large page components

### 13.5 Scalability Considerations
The current architecture can grow further if:

- frontend bundles are split
- file storage is externalized
- DB indexing continues to follow query patterns
- background jobs are isolated for reminders and heavy generation tasks
- configuration is standardized across environments

## Questions You Might Be Asked and Strong Answers

### Q1. Why did you choose the MERN stack for this project?
Answer: I chose MERN because the project requires a highly interactive frontend, a flexible backend API, and a schema model that can evolve with complex HR workflows. React provides reusable UI composition, Express offers fast API development, Node.js handles asynchronous workloads well, and MongoDB fits nested entities such as objectives, check-ins, meetings, and evaluations.

### Q2. Why did you choose MongoDB instead of MySQL or PostgreSQL?
Answer: The system stores semi-structured documents with many nested arrays and optional sections, such as KPIs, comments, change requests, attachments, agenda items, and evaluation notes. MongoDB allows these structures to evolve more naturally than a rigid relational schema, which is useful during iterative product development.

### Q3. How is security enforced in the application?
Answer: Security is enforced through JWT authentication, refresh-token rotation, role-based authorization middleware, route-level access control, request validation with Joi, XSS sanitization, MongoDB operator sanitization, CORS restriction, and rate limiting. Sensitive workflows such as final evaluation and HR validation also include controller-level permission checks.

### Q4. How does the system ensure that managers only evaluate their own team members?
Answer: The backend final evaluation controller computes managed employee IDs from team membership and direct-report relationships. When a team leader accesses evaluation endpoints, the controller checks whether the target employee belongs to that manager's team before allowing the action.

### Q5. How are file attachments handled technically?
Answer: Files are uploaded through Multer and stored physically on the backend server inside `uploads/` folders. MongoDB stores only the metadata and URL reference. This reduces database bloat and keeps the upload flow simple, though a cloud object store would be better for production scale.

### Q6. What is the difference between `Evaluation` and `FinalEvaluation` in the backend?
Answer: `Evaluation` is a more general structured evaluation workflow with approvals and rubric logic, while `FinalEvaluation` is the specialized end-of-year manager and HR review record used in phase 3. This indicates the system evolved to support both generic assessment logic and a dedicated annual review module.

### Q7. What performance improvements would you make next?
Answer: My first three improvements would be route-level lazy loading, unifying duplicate API client logic, and moving large pages into smaller memoizable subcomponents. I would also externalize file storage and review query-heavy screens for stronger pagination and caching.

### Q8. What part of the system is the most technically complex?
Answer: The most complex part is the performance workflow centered on objectives, check-ins, final self-assessment, manager evaluation, and HR validation. It combines phase-based access, role-based access, score calculation, evidence handling, historical context, and multi-step review state transitions.

### Q9. If you had more time, what architectural improvement would you prioritize?
Answer: I would prioritize consolidating the evaluation architecture and API client architecture. There are signs of multiple generations of the system coexisting, so unifying evaluation modules and frontend request handling would reduce maintenance overhead and improve long-term clarity.

### Q10. What makes this project more than a CRUD application?
Answer: This project goes beyond CRUD because it models real business workflows. It includes approval states, scoring rules, role-based visibility, phase-aware access control, manager-team restrictions, auditability, task and meeting coordination, evidence uploads, and deployment support. Those aspects turn it into an enterprise workflow platform, not just a data entry tool.
