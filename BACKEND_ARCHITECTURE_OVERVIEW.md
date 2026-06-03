# Backend Architecture Overview
**HR Evaluation System - Node.js/Express API**

---

## 1. Main Express App Setup

### **app.js** - Application Configuration
- **Framework**: Express.js v4.22.1
- **Database**: MongoDB via Mongoose
- **Main Entry Point**: `server.js` (requires app.js)

#### Security Middleware Stack (in order):
1. **Helmet** - Sets security HTTP headers (`crossOriginResourcePolicy: false`)
2. **CORS** - Configures cross-origin requests
   - Allowed origins: `http://localhost:5173`, `http://localhost:3000`, `http://localhost:8081`
   - Credentials: enabled
3. **Compression** - Gzip response compression
4. **Body Parser** - `express.json()` for JSON parsing
5. **XSS Protection** - `xss-clean` middleware
6. **MongoDB Sanitization** - `express-mongo-sanitize` to prevent NoSQL injection
7. **Cache Control** - Disables caching for API (except `/uploads/`)
8. **Rate Limiting** - 5000 requests per 15 minutes with skip logic
9. **Static Files** - `/uploads` directory with 7-day caching

#### Health Endpoints:
- `GET /` - Returns API status
- `GET /api/health` - Returns success status

### **server.js** - Server Startup
- **Environment Variables Required**:
  - `MONGO_URI` - MongoDB connection string
  - `JWT_SECRET` - JWT signing secret
  - `JWT_REFRESH_SECRET` - Refresh token secret
  
- **Configuration**:
  - PORT: `5009` (default from `process.env.PORT` or 5000)
  - NODE_ENV: `development` (default)
  - MongoDB Connection: Validates before startup
  - Error Handling: Exits on missing environment variables or DB connection failure

---

## 2. API Routes & Endpoints

### Route Structure
All routes mounted dynamically in `app.js` with base `/api` prefix. Total: **26 route modules**

#### **Authentication Routes** (`/api/auth`)
- `POST /login` - User login (returns accessToken + refreshToken)
- `POST /refresh` - Refresh access token

#### **User Management** (`/api/users`)
- `GET /filter/list` - Get filtered users list
- `GET /managers` - Get all managers
- `GET /collaborators` - Get all collaborators
- `GET /` [ADMIN] - Get all users
- `GET /:id` [ADMIN] - Get user by ID
- `PUT /:id` - Update user (profile)
- `PUT /:id/avatar` - Upload avatar image
- `DELETE /:id` [ADMIN] - Delete user

#### **Team Management** (`/api/teams`, `/api/team-members`)
- `GET /` - List all teams
- `POST /` [ADMIN/HR] - Create team
- `GET /:id` - Get team details
- `PUT /:id` [ADMIN/HR] - Update team
- `DELETE /:id` [ADMIN/HR] - Delete team
- Team-member operations (CRUD)

#### **Cycles (Performance Cycles)** (`/api/cycles`)
- `GET /` - List all cycles
- `GET /:id` - Get cycle details
- `POST /` [ADMIN/HR] - Create cycle
- `PUT /:id` [ADMIN/HR] - Update cycle
- `DELETE /:id` [ADMIN/HR] - Delete cycle
- **3-Phase Structure**: Phase 1, 2, 3 with configurable dates

#### **Objectives (Goals)** (`/api/objectives`)
- **CRUD Operations**:
  - `GET /` - List objectives
  - `GET /my` - My objectives
  - `GET /user/:userId/cycle/:cycleId` - User objectives in cycle
  - `POST /` [TEAM_LEADER/COLLABORATOR/ADMIN] - Create
  - `PUT /:id` [TEAM_LEADER/COLLABORATOR/ADMIN] - Update
  - `DELETE /:id` [TEAM_LEADER/COLLABORATOR/ADMIN] - Delete

- **Workflow Actions**:
  - `POST /:id/submit` - Submit for approval
  - `POST /:id/validate` [TEAM_LEADER/ADMIN] - Validate
  - `POST /:id/acknowledge` - Acknowledge
  - `POST /:id/mark-completed` - Mark completed
  - `POST /:id/midyear-review` [TEAM_LEADER/ADMIN] - Mid-year review
  - `POST /:id/final-self-assessment` - Final self-assessment
  - `POST /:id/evaluate` [HR/TEAM_LEADER/ADMIN] - Evaluate
  - `POST /:id/lock` [HR/TEAM_LEADER/ADMIN] - Lock objective

- **Goal Management**:
  - `POST /submit-all` - Submit all objectives
  - `POST /validate-all` [TEAM_LEADER] - Validate all team objectives
  - `GET /pending-validation` [TEAM_LEADER] - Pending objectives
  - `GET /stale` [TEAM_LEADER/ADMIN] - Stale objectives
  - `GET /team-goals` [ADMIN/TEAM_LEADER/HR] - Team goals
  - `GET /team-weight-capacity` [ADMIN/TEAM_LEADER/HR] - Goal weight analysis

- **KPI Management**:
  - `POST /:id/kpis` - Add KPI
  - `PUT /:id/kpis/:kpiId` - Update KPI
  - `DELETE /:id/kpis/:kpiId` - Delete KPI

- **Progress Tracking**:
  - `POST /:id/progress` - Add progress update
  - `POST /:id/comments` - Add comment
  - `DELETE /:id/comments/:commentId` - Delete comment

- **Change Requests**:
  - `POST /:id/change-requests` - Create change request
  - `PUT /:id/change-requests/:crId` [TEAM_LEADER/ADMIN] - Resolve
  - `PATCH /:id/correction` [COLLABORATOR/TEAM_LEADER/ADMIN] - Correction request
  - `PATCH /:id/correction/:crId` [TEAM_LEADER/ADMIN] - Review correction

- **Utilities**:
  - `GET /:id/children` - Get sub-objectives
  - `POST /:id/duplicate` - Duplicate objective
  - `PUT /:id/note` [TEAM_LEADER/HR/ADMIN] - Add manager note

#### **Evaluations** (`/api/evaluations`)
- `GET /` - List evaluations
- `GET /rubric` - Get evaluation rubric
- `GET /employee/:employeeId` - Evaluations for employee
- `GET /evaluator/:evaluatorId` - Evaluations created by evaluator
- `GET /:id` - Get evaluation details
- `POST /` - Create evaluation
- `PUT /:id` - Update evaluation
- `POST /:id/submit` - Submit for approval
- `POST /:id/approve` [HR/ADMIN] - Approve
- `POST /:id/reject` [HR/ADMIN] - Reject
- `POST /:id/complete` - Mark complete
- `POST /:id/acknowledge` - Acknowledge

#### **Final Evaluations** (`/api/final-evaluations`)
- `GET /team/:cycle_id` [TEAM_LEADER/HR/ADMIN] - Team evaluations
- `GET /hr/pending` [HR/ADMIN] - Pending evaluations
- `GET /hr/reviewed` [HR/ADMIN] - Reviewed evaluations
- `GET /user/:employee_id/history` - User evaluation history
- `GET /export/:id` - Export evaluation for PDF
- `GET /:cycle_id/:employee_id` - Get specific evaluation
- `POST /generate/:cycle_id/:employee_id` [TEAM_LEADER/HR/ADMIN] - Auto-generate
- `PUT /:id` [TEAM_LEADER/HR/ADMIN] - Update
- `PUT /:id/hr-validate` [HR/ADMIN] - HR validation
- `PUT /:id/employee-feedback` [COLLABORATOR] - Employee feedback

#### **HR Decisions** (`/api/hr-decisions`)
- HR workflow for promotion, salary, discipline decisions

#### **Feedback (360-degree)** (`/api/feedback`)
- `POST /` - Create feedback
- `POST /request` - Request 360-degree feedback
- `GET /received` - Feedback received by current user
- `GET /sent` - Feedback sent by current user
- `GET /all` [ADMIN/HR] - All feedback
- `GET /stats` - Feedback statistics
- `GET /stats/:userId` [TEAM_LEADER/HR/ADMIN] - User feedback stats
- `GET /user/:userId` [TEAM_LEADER/HR/ADMIN] - Feedback for specific user
- `DELETE /:id` - Delete feedback

#### **Check-ins** (`/api/checkins`)
- `POST /upload` - Upload check-in attachments (10MB limit)
- `GET /` - List check-ins
- `POST /` - Submit check-in
- `GET /objective/:objective_id/tasks` - Get tasks for objective
- `GET /by-objective` [TEAM_LEADER/HR/ADMIN] - Check-ins by objective
- `GET /team` [TEAM_LEADER/HR/ADMIN] - Team check-ins
- `PUT /:id/review` [TEAM_LEADER/HR/ADMIN] - Review check-in

#### **Tasks** (`/api/tasks`)
- Task creation and tracking

#### **Improvement Plans** (`/api/improvement-plans`)
- Development and improvement plan management

#### **Notifications** (`/api/notifications`)
- Push notifications and alerts

#### **AI Assistance** (`/api/ai`)
- `POST /goal-suggestions` - Generate goal suggestions
- `POST /suggest-kpis` - Suggest KPIs
- `POST /summarize-performance` - Summarize performance
- `POST /detect-risks` - Detect performance risks
- `POST /prioritize-notifications` - Prioritize notifications
- `POST /assist` - General AI assistance
- `POST /draft-checkin` - Draft check-in
- `POST /analyze-objective-quality` - Analyze objective quality
- `POST /refine-objective` - Refine objective
- `POST /review/midyear` - Generate mid-year review
- `POST /review/final-self` - Generate final self-review
- `POST /review/manager` - Generate manager review
- `POST /development-plan` - Generate development plan

#### **Reporting** (`/api/reports`, `/api/stats`, `/api/performance`)
- Analytics and reporting

#### **Audit & Logging** (`/api/audit-logs`)
- Audit trail of all user actions

#### **Additional Routes**:
- `/api/career` - Career development paths
- `/api/calendar` - Calendar integration
- `/api/pdf` - PDF generation
- `/api/feed` - Activity feed
- `/api/progress` - Progress tracking
- `/api/meetings` - Meeting management
- `/api/reminders` - Reminders
- `/api/me` - Current user endpoint

---

## 3. Database Models (19 Total)

### **Core Models**

#### **User**
- Roles: `ADMIN`, `HR`, `TEAM_LEADER`, `COLLABORATOR`
- Fields: name, email (unique @biat.com), password (hashed), role, team, manager, isActive, refreshToken, profileImage, isDeleted, tenantId
- Methods: `comparePassword()` for auth
- Indexes: role, email, isDeleted

#### **Cycle**
- Represents annual performance evaluation cycle
- Fields: name, year (unique), status (draft/open/active/in_progress/closed)
- 3-Phase Structure: phase1Start/End, phase2Start/End, phase3Start/End, currentPhase
- Relationships: createdBy (User)
- Validation: Phase dates must be sequential
- Indexes: year, status, currentPhase

#### **Objective** (Goals)
- Fields: title, description, dueDate, successIndicator, weight (1-40)
- Category: individual or team
- Status: draft → submitted → approved → in_progress → completed/rejected
- Owner: User relationship, can be assigned to multiple users
- Relationships: cycle, team, assignedUsers
- Sub-fields:
  - KPIs: Tracking metrics (percent, number, currency, boolean, milestone)
  - Progress Updates: Timeline of updates
  - Comments: Collaborative feedback
  - Change Requests: Scope changes, extensions, pauses
  - Activity Log: All state changes
  - Attachments: Supporting documents
- Weight: Individual goal weight (1-40), Team capacity tracking

#### **Evaluation**
- Employee performance evaluation
- Fields: employeeId, evaluatorId, cycleId, period, status
- Status: draft → in_progress → submitted → approved/rejected → completed
- Sub-fields:
  - ObjectiveAssessments: References to evaluated objectives
  - Approvals: Multi-level approval tracking
  - ScoreHistory: Score changes audit trail
  - Comments: Evaluation feedback
  - Rubric: Assessment criteria
- Indexes: employeeId, evaluatorId, cycleId, status

#### **FinalEvaluation**
- Year-end comprehensive evaluation
- Aggregates all objectives and evaluations
- HR validation layer

#### **Feedback**
- 360-degree feedback from peers/managers/reports
- Tracks feedback received and sent

#### **CheckIn**
- Regular progress updates on objectives
- Attachments: Supporting documents/evidence
- Manager review/approval workflow

#### **Team**
- Organizational units
- Relationships: leader (User), members (Users), parentTeam (hierarchical)
- Nested team structure support

#### **CareerPath**
- Career progression definitions
- Skills and competencies mapping

#### **CareerRecommendation**
- AI-generated career recommendations

#### **ImprovementPlan**
- Development plans for underperforming employees
- Goals, timeline, resources

#### **HRDecision**
- HR decisions: promotions, salary changes, terminations
- Workflow: pending → approved/rejected → executed

#### **Meeting**
- Performance review meetings
- Scheduling and notes

#### **Notification**
- System notifications for users
- Priority levels

#### **Task**
- Sub-tasks within objectives
- Status tracking

#### **Competency**
- Skills and competencies database
- Mapping to roles

#### **AuditLog**
- Complete audit trail
- Fields: user, action, resourceType, resourceId, details, timestamp, tenantId
- All CRUD operations logged

#### **CorrectionRequest**
- Requests to correct/modify submitted objectives
- Workflow: pending → approved/rejected/modified

#### **CalendarConnection**
- External calendar integration (Google Calendar, etc.)

---

## 4. Controllers (15 Total)

### **userController**
- `getUsers()` - Get filtered user list
- `getManagers()` - Get all managers
- `getCollaborators()` - Get all collaborators
- `getAllUsers()` - Admin get all users
- `getUserById()` - Get specific user
- `deleteUser()` - Admin delete user
- `updateUser()` - Update user profile
- `updateAvatar()` - Upload and store avatar image

### **objectiveController**
- Goal/objective CRUD and workflow
- `createObjective()` - Create new objective
- `getObjectives()` - List objectives with filtering
- `getMyObjectives()` - Current user's objectives
- `updateObjective()` - Update objective details
- `deleteObjective()` - Delete objective
- Workflow: `submitObjective()`, `validateObjective()`, `acknowledgeObjective()`, `markCompleted()`
- Reviews: `midYearReviewObjective()`, `finalSelfAssessmentObjective()`, `evaluateObjective()`
- KPI Management: `addKpi()`, `updateKpi()`, `deleteKpi()`
- Progress: `addProgressUpdate()`, `submitProgress()`
- Comments: `addComment()`, `deleteComment()`
- Change Requests: `createChangeRequest()`, `resolveChangeRequest()`, `createCorrectionRequest()`, `reviewCorrectionRequest()`
- Utilities: `lockObjective()`, `duplicateObjective()`, `addManagerNote()`

### **evaluationController**
- `getRubric()` - Get evaluation rubric/criteria
- `getAllEvaluations()` - List all evaluations
- `getMyEvaluations()` - Employee's evaluations
- `getEvaluatorEvaluations()` - Evaluator's created evaluations
- `getEvaluation()` - Get specific evaluation
- `createEvaluation()` - Create new evaluation
- `updateEvaluation()` - Update evaluation (scores, comments)
- Workflow: `submitEvaluation()`, `approveEvaluation()`, `rejectEvaluation()`, `completeEvaluation()`, `acknowledgeEvaluation()`

### **cycleController**
- Performance cycle management
- CRUD operations for cycles
- Phase date validation and sequential checking
- Status management

### **checkInController**
- Regular progress check-ins
- `submitCheckIn()` - Submit check-in
- `getCheckIns()` - Get user's check-ins
- `getTasksForObjective()` - Tasks linked to objective
- `getTeamCheckIns()` [TEAM_LEADER/HR/ADMIN] - Team check-ins
- `getCheckInsByObjective()` [TEAM_LEADER/HR/ADMIN] - Check-ins by objective
- `reviewCheckIn()` [TEAM_LEADER/HR/ADMIN] - Manager review

### **feedbackController**
- 360-degree feedback management
- `createFeedback()` - Submit feedback
- `requestFeedback()` - Request feedback from others
- `getReceived()` - Feedback received
- `getSent()` - Feedback sent
- `getAll()` [ADMIN/HR] - All feedback
- `getStats()` - Feedback statistics
- `getForUser()` - Feedback for specific user
- `deleteFeedback()` - Delete feedback

### **finalEvaluationController**
- Year-end evaluation compilation
- `generateEvaluation()` - Auto-generate from objectives
- `getTeamEvaluations()` - Team evaluations
- `getPendingEvaluations()` - Pending HR review
- `getReviewedEvaluations()` - Already reviewed
- `getUserHistory()` - User evaluation history
- `exportEvaluation()` - Export for PDF
- `validateEvaluation()` [HR/ADMIN] - HR validation
- `submitEmployeeFeedback()` - Employee response

### **hrDecisionController**
- HR workflow decisions

### **aiController**
- OpenAI/Grok API integration
- `generateGoalSuggestions()` - Suggest goals
- `suggestKpis()` - Suggest KPIs
- `summarizePerformance()` - Performance summary
- `detectRisks()` - Identify risks
- `prioritizeNotifications()` - Sort notifications
- `assist()` - General assistance
- `draftCheckin()` - Draft check-in text
- `analyzeObjectiveQuality()` - Quality assessment
- `refineObjective()` - Improve objective
- `generateMidyearReview()` - Mid-year review text
- `generateFinalSelfReview()` - Self-review text
- `generateManagerReview()` - Manager review
- `generateDevelopmentPlan()` - Development plan

### **notificationController**
- System notifications

### **taskController**
- Task management

### **teamController**
- Team management and hierarchy

### **statsController**
- Analytics and statistics

### **careerController**
- Career path management

### **improvementPlanController**
- Development plan tracking

---

## 5. Middleware (8 Total)

### **auth.js** - Authentication
- JWT token validation from `Authorization: Bearer <token>` header
- User caching (configurable TTL via `AUTH_USER_CACHE_TTL_MS`)
- Validates token signature, expiry
- Attaches user object to `req.user` with id, role
- Returns 401 if token missing/invalid/expired
- Caches auth user lookups to reduce DB queries

### **role.js** - Role-Based Access Control (RBAC)
- Strict role enforcement: `ADMIN`, `HR`, `TEAM_LEADER`, `COLLABORATOR`
- `ADMIN` role bypasses all role checks
- Usage: `role('ADMIN', 'HR')` or `role(['ADMIN', 'HR'])`
- Returns 403 if insufficient permissions

### **ownership.js** - Resource Ownership
- Ensures users can only access/modify their own resources
- Bypassed for `ADMIN` and `HR` roles
- Checks: owner, user, manager fields on document
- Returns 403 if not owner

### **rateLimiter.js** - Rate Limiting
- Express-rate-limit integration
- 5000 requests per 15 minutes per IP
- Skip logic for certain endpoints (uploads, health checks)

### **validate.js** - Request Validation
- Joi schema validation
- Validates `req.body` against provided schema
- Returns 400 with field-level error details if validation fails
- `stripUnknown: true` removes unknown fields

### **audit.js** - Audit Logging
- Logs all actions via `AuditLog` model
- Captures: user, action, resourceType, resourceId, HTTP method, path, status code
- Asynchronous logging (doesn't block response)

### **errorHandler.js** - Global Error Handler
- Express error handling middleware
- Converts errors to proper HTTP responses

### **validateEnv.js** - Environment Validation
- Ensures required environment variables are set on startup

---

## 6. Environment Configuration

### **Environment Variables** (.env file)

#### **Server**
```
NODE_ENV=development
PORT=5009
```

#### **Database**
```
MONGO_URI=mongodb+srv://moataz:0000@clusterhr.l7w8pvw.mongodb.net/hr_evaluation
MONGO_DB_NAME=hr_evaluation
```

#### **Authentication**
```
JWT_SECRET=your_super_secret_jwt_key_change_this_in_production_123!
JWT_REFRESH_SECRET=your_super_secret_refresh_token_key_change_this_in_production_456!
JWT_EXPIRE=7d
ACCESS_TOKEN_EXPIRES_IN=365d (dev), 8h (prod)
REFRESH_TOKEN_EXPIRES_IN=365d (dev), 30d (prod)
```

#### **CORS**
```
CORS_ORIGIN=http://localhost:5173
```

#### **AI Configuration**
```
AI_PROVIDER=grok (or openai)
XAI_API_KEY=<xai-api-key>
AI_MODEL=grok-3-mini-fast
AI_TIMEOUT_MS=15000
AI_MAX_INPUT_CHARS=12000
```

#### **Objective Constraints**
```
MIN_OBJECTIVES=4
MAX_OBJECTIVES=7
MIN_OBJECTIVE_VALUE=11
MAX_OBJECTIVE_VALUE=39
TOTAL_OBJECTIVE_VALUE=70
```

#### **Email (Optional)**
```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=moatazben1@gmail.com
SMTP_PASS=uroo xvta isfg prmy
```

#### **Caching**
```
AUTH_USER_CACHE_TTL_MS=10000 (milliseconds)
```

---

## 7. Static File Serving & Uploads

### **Upload Directory Structure**
```
backend/
  uploads/
    avatars/        - User profile images
    checkins/       - Check-in attachments (10MB limit)
```

### **Configuration**
- Express static middleware for `/uploads` path
- Automatic directory creation in `app.js` on startup
- Multer integration for file uploads
- Caching: 7-day browser cache for uploads (immutable)

#### **Avatar Uploads** (`/api/users/:id/avatar`)
- Multer memory storage
- 5MB file size limit
- Only image files allowed
- Stored in `/uploads/avatars`

#### **Check-in Attachments** (`/api/checkins/upload`)
- Multer memory storage
- 10MB file size limit
- Allowed formats: PDF, Office (DOC/DOCX/XLS/XLSX/PPT/PPTX), Images (PNG/JPG/JPEG/GIF), Text (TXT/CSV/ZIP)
- Stored in `/uploads/checkins`

### **File Storage Utility** (`utils/fileStorage.js`)
- `storeUploadedFile()` - Handles file storage with metadata
- Accepts folder name and userId for organization
- Returns stored file metadata for database reference

---

## 8. Additional Infrastructure

### **Dependencies** (package.json)
- **Express Ecosystem**: express, cors, compression, helmet
- **Database**: mongoose, mongodb
- **Authentication**: jsonwebtoken, bcryptjs
- **Validation**: joi, express-mongo-sanitize, xss-clean
- **File Handling**: multer
- **Scheduling**: node-cron (for deadline reminders)
- **Email**: nodemailer
- **AI Integration**: openai (with Grok support)
- **PDF Generation**: pdfkit
- **Rate Limiting**: express-rate-limit

### **Cron Jobs** (`cron/`)
- `deadlineCron.js` - Monitor objective deadlines
- `reminderCron.js` - Send reminder notifications

### **Services Directory** (`services/`)
- Reusable business logic and external integrations

### **Utils Directory** (`utils/`)
- Helper functions for notifications, auditing, file storage

### **Validators Directory** (`validators/`)
- Joi schema definitions for request validation

### **Tests** (`tests/`)
- Jest test files and test utilities
- `testCreate.js` - Example test file

---

## 9. Architecture Patterns

### **Request Flow**
```
Client Request
    ↓
Rate Limiting → Auth (JWT) → Role Check → Ownership Check → Validation
    ↓
Route Handler (Controller)
    ↓
DB Operations (Mongoose Models)
    ↓
Audit Logging (Async)
    ↓
Response to Client
```

### **Error Handling**
- Global error handler middleware
- Consistent error response format
- Status codes: 400 (validation), 401 (auth), 403 (authorization), 404 (not found), 500 (server)

### **Authentication Flow**
1. User logs in with email/password
2. Server verifies credentials against hashed password
3. Access token (short-lived) and refresh token (long-lived) issued
4. Refresh token stored in User document
5. Subsequent requests include access token in Authorization header
6. Token verified and user cached for performance

### **RBAC Model**
- Strict role-based: Admin > HR > Team Leader > Collaborator
- Admin bypasses most checks
- Some endpoints restricted to specific roles only
- Ownership checks for personal resources (non-admins)

---

## 10. Database Schema Summary

**Collections (19)**:
1. users - User accounts with roles
2. cycles - Performance evaluation cycles
3. objectives - Goals and targets
4. evaluations - Individual evaluations
5. finalevaluations - Year-end summaries
6. feedback - 360-degree feedback
7. checkins - Progress check-ins
8. teams - Organizational teams
9. careerpaths - Career progression paths
10. careerrecommendations - AI-generated recommendations
11. improvementplans - Development plans
12. hrdecisions - HR workflow decisions
13. meetings - Review meetings
14. notifications - System alerts
15. tasks - Sub-tasks
16. competencies - Skills database
17. auditlogs - Complete audit trail
18. correctionrequests - Objective corrections
19. calendarconnections - Calendar integrations

**Indexes**:
- User: role, email, isDeleted
- Cycle: year (unique), status, currentPhase
- Objective: owner, cycle, team
- Evaluation: employeeId, evaluatorId, cycleId, status

---

## 11. Security Features

✅ **Implemented**:
- JWT-based authentication with refresh tokens
- Bcrypt password hashing (salt rounds: 12)
- CORS with whitelist
- Helmet security headers
- XSS protection and MongoDB sanitization
- Rate limiting
- RBAC enforcement
- Ownership validation
- Complete audit logging
- Input validation with Joi
- Email domain restriction (@biat.com)
- Token caching to reduce DB load

---

## 12. Deployment Notes

**Docker Support**:
- `Dockerfile` present for containerization
- `docker-compose.yml` for local development

**Environment-specific Defaults**:
- Production: Shorter token expiry (8h access, 30d refresh)
- Development: Longer token expiry (365d) for convenience

**MongoDB Connection**:
- Supports both connection string formats
- Timeout configurations: selectTimeout 5s, connectTimeout 10s

---

This backend implements a comprehensive HR evaluation system with performance management, 360-degree feedback, career development, and AI-assisted analytics. The architecture emphasizes security, auditability, and role-based access control.
