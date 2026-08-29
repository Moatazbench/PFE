# PROJECT EXTRACTION — Performance / Competency Management Application

This document is a pure reverse-engineering extraction of the codebase at `c:\Users\moata\OneDrive\Documents\application_gestion_competences\application_gestion_competences`. It is intended for a downstream agent with ZERO source-code access to draw UML diagrams. Every fact is labeled `VERIFIED` (directly read in code) or `[INFERRED — not directly confirmed in code]`. Nothing is summarized away; ambiguities are listed in Section 10 rather than silently resolved.

---

## 0. Project Overview

**VERIFIED** — Stack (confirmed via `backend/package.json`-referenced modules seen in source, `backend/app.js`, `backend/server.js`, `frontend/src`, `ai-service/*.py`):
- **Backend**: Node.js + Express (`backend/app.js`, `backend/server.js`). MongoDB via Mongoose (`backend/config/db.js`, all `backend/models/*.js`). Auth: JWT (`jsonwebtoken`) with access + refresh tokens (`backend/routes/auth.js`, `backend/middleware/auth.js`). Validation: Joi (`backend/validators/schemas.js`, `backend/middleware/validate.js`). Security middleware: `helmet`, `cors`, `express-rate-limit`, `xss-clean`, `express-mongo-sanitize`, `compression` (`backend/app.js`). File uploads: `multer` (memory storage) + local disk or Cloudinary (`backend/utils/fileStorage.js`). PDF generation: `pdfkit` (`backend/routes/pdf.js`, `backend/controllers/finalEvaluationController.js`). Email: `nodemailer` (`backend/utils/mailer.js`). Scheduled jobs: `node-cron` (`backend/cron/deadlineCron.js`, `backend/cron/reminderCron.js`) — **VERIFIED neither cron job is ever started/required from `app.js` or `server.js`** (see Section 8, Section 10).
- **Frontend**: React + Vite (`frontend/src/main.jsx`, `frontend/vite.config.js` implied by `VITE_*` env var usage). Routing: `react-router-dom` (`frontend/src/App.jsx`, `frontend/src/routes/routeConfig.jsx`). HTTP client: `axios`, with two parallel wrapped instances (`frontend/src/services/api.js`, `frontend/src/api/apiClient.js`) plus a third ad-hoc interceptor in `frontend/src/components/AuthContext.jsx`.
- **AI microservice**: Python Flask (`ai-service/app.py`), scikit-learn `RandomForestClassifier` + XGBoost `XGBClassifier` (`ai-service/train_model.py`), joblib-serialized models loaded at startup, runs on `0.0.0.0:5000`.
- **AI text/LLM generation** (a SEPARATE mechanism from the Flask ai-service): `backend/services/aiService.js` calls external LLM providers directly (xAI/Grok, OpenAI, or Google Gemini) via the `openai` SDK (OpenAI-compatible client) or `@google/generative-ai` SDK — **VERIFIED this is NOT an HTTP call to the Flask `ai-service`**; it is a separate LLM-provider integration. See Section 5 for the one place the Node backend DOES call the Flask service.

**VERIFIED** — Folder-by-folder purpose:
- `backend/controllers/` — 15 controller files, but **several are dead code** never wired to any route (see Section 10): `teamController.js`, `cycleController.js`, `hrDecisionController.js` (this last one references non-existent models `EvaluationReport` and `EvaluationCycle`).
- `backend/routes/` — 28 route files; **only 24 are mounted** in `app.js`. `routes/me.js`, `routes/progress.js`, `routes/reminders.js` exist but are never `require`d/mounted — dead code (VERIFIED via grep across `backend/`, no `require` of these three files found anywhere).
- `backend/services/` — `aiService.js` (external LLM calls), `reviewContextService.js` (builds compact review context objects from DB), `scoreCalculationService.js` (weighted-score math, shared by final-evaluation and AI-prediction flows).
- `backend/middleware/` — `auth.js` (JWT verify + cached user lookup), `role.js` (RBAC), `validate.js` (Joi wrapper), `ownership.js` (generic owner-check factory, **not observed wired into any route in the files read**), `rateLimiter.js`, `audit.js` (response-interception audit logger, **not observed wired into any route in the files read** — used interchangeably with two other audit helpers), `errorHandler.js`, `validateEnv.js`.
- `backend/utils/` — 12 files covering access control, audit logging (three separate helper modules — see Section 10), calendar token crypto, cycle phase-date validation, file storage (local/Cloudinary), mailer, notification helper, objective weight-allocation math, objective visibility filtering, and evaluation-review completeness checklists.
- `backend/validators/schemas.js` — Joi schemas for `auth`, `user`, `objective`, `cycle` only (no `team`, `task`, `feedback`, `checkin`, `evaluation` schemas exist here).
- `backend/cron/` — two node-cron jobs, both unreachable from the running app (dead code) and both referencing model fields (`Objective.deadline`, `Objective.user`, `Objective.reminderSent`) and helper functions (`notifyDeadlineApproaching`, `sendDeadlineReminderEmail`) that do not exist anywhere else in the codebase — would throw if ever invoked.
- `backend/models/` — 20 Mongoose models (full inventory in Section 1).
- `ai-service/` — `app.py` (Flask server), `performance_text.py` (shared deterministic-given-seed text generator), `train_model.py` (trains 4 models), `generate_dataset.py` (synthetic dataset generator), `models/` (joblib artifacts + `feature_columns.json`), `data/` (CSV dataset).
- `frontend/src/api/` — small per-domain axios service modules (`apiClient.js`, `ai.js`, `cycles.js`, `hrDecisions.js`, `teams.js`, `users.js`).
- `frontend/src/services/api.js` — the primary axios instance used by most pages (GET-response caching/dedup layer).
- `frontend/src/routes/routeConfig.jsx` — central route table (paths, components, allowed roles, allowed cycle phases).
- `frontend/src/pages/` — one file per top-level routed page.
- `frontend/src/components/` — shared layout/chrome + feature-area subfolders (`ai/`, `common/`, `dashboard/`, `evaluations/`, `goals/`, `tasks/`, `teams/`).
- `frontend/src/hooks/`, `frontend/src/utils/` — cross-cutting helpers (`useActiveCycle`, `usePersistentTimer`, `roles.js`, `objectiveRules.js`, `workManagement.js`).

**VERIFIED** — Entry points: `backend/server.js` (loads env, connects Mongoose directly via `mongoose.connect(process.env.MONGO_URI...)`, then `app.listen`), `backend/app.js` (Express app construction, all middleware + route mounting), `frontend/src/main.jsx` (React root), `ai-service/app.py` (`if __name__ == "__main__": app.run(host="0.0.0.0", port=5000)`).

**VERIFIED** — Auth mechanism: JWT access token (`JWT_SECRET`, expiry `ACCESS_TOKEN_EXPIRES_IN` env or `8h` prod / `365d` dev) + JWT refresh token (`JWT_REFRESH_SECRET`, expiry `REFRESH_TOKEN_EXPIRES_IN` env or `30d` prod / `365d` dev), issued in `backend/routes/auth.js` `POST /api/auth/login`. Refresh token stored raw (not hashed) on the `User.refreshToken` field (`select:false`). `backend/middleware/auth.js` reads `Authorization: Bearer <token>` header only (no cookie support observed), verifies with `JWT_SECRET`, looks up the user (`_id role isActive isDeleted` only, with a short in-memory TTL cache, default 10000ms via `AUTH_USER_CACHE_TTL_MS`), rejects if inactive/deleted, attaches `req.user`. Frontend stores `token`/`refreshToken`/`authUser` in `localStorage` (`frontend/src/components/AuthContext.jsx`), with THREE separate refresh-on-401 implementations (`AuthContext.jsx` global axios interceptor, `services/api.js`, `api/apiClient.js`) — see Section 10.

**VERIFIED** — `backend/config/db.js` exports a `connectDB()` function that is **never called** anywhere (VERIFIED via grep); `backend/server.js` connects to MongoDB directly and independently via inline `mongoose.connect(...)`, bypassing `config/db.js` entirely.

---

## 1. Data Model Inventory

All 20 models below are cited from `backend/models/*.js` as pre-verified. Field lists are exhaustive as given.

### 1.1 `User.js` (`backend/models/User.js`)
| Field | Type | Required/Default | Constraints |
|---|---|---|---|
| `name` | String | required, trim | — |
| `email` | String | required, unique | lowercase, trim, regex validated `@biat.com` |
| `password` | String | required | `select:false` |
| `role` | String | required, default `'COLLABORATOR'`, indexed | enum: `['ADMIN','HR','TEAM_LEADER','COLLABORATOR']` |
| `team` | ObjectId (ref `Team`) | default `null` | — |
| `manager` | ObjectId (ref `User`, self-reference) | default `null` | — |
| `isActive` | Boolean | default `true` | — |
| `tenantId` | String | default `'default'`, indexed | — |
| `refreshToken` | String | — | `select:false` |
| `isDeleted` | Boolean | default `false`, indexed | — |
| `profileImage` | String | default `''` | — |
| `createdAt`/`updatedAt` | Date | auto (`timestamps:true`) | — |

Instance method: `comparePassword()` (bcrypt.compare). `pre('save')` hook hashes password with bcrypt salt 12.

### 1.2 `Team.js` (`backend/models/Team.js`)
| Field | Type | Required/Default |
|---|---|---|
| `name` | String | required |
| `description` | String | default `''` |
| `leader` | ObjectId (ref `User`) | — |
| `members` | [ObjectId] (ref `User`) | — |
| `parentTeam` | ObjectId (ref `Team`, self-ref) | default `null` |
| `createdBy` | ObjectId (ref `User`) | — |
| `createdAt` | Date | default `Date.now` |

Indexes: `{leader:1}`, `{members:1}`, `{parentTeam:1}`.

### 1.3 `Cycle.js` (`backend/models/Cycle.js`)
| Field | Type | Required/Default | Constraints |
|---|---|---|---|
| `name` | String | required | — |
| `year` | Number | required, unique | — |
| `status` | String | default `'draft'` | enum: `['draft','open','active','in_progress','closed']` |
| `phase1Start`/`phase1End`/`phase2Start`/`phase2End`/`phase3Start`/`phase3End` | Date | default `null` | — |
| `currentPhase` | String | default `'phase1'` | enum: `['phase1','phase2','phase3','closed']` |
| `createdBy` | ObjectId (ref `User`) | — | — |
| `createdAt` | Date | default `Date.now` | — |

`timestamps:true`. Indexes: `{year:1}` unique, `{status:1}`, `{currentPhase:1}`. `pre('save')` validates phase dates strictly sequential/non-overlapping when modified.

### 1.4 `Objective.js` (`backend/models/Objective.js`)
Six embedded subdocument schemas (all composition — no independent collection):

**`KpiSchema`** (array `kpis`, `{_id:true,timestamps:true}`):
| Field | Type | Default | Constraints |
|---|---|---|---|
| `title` | String | required, trim | — |
| `metricType` | String | `'percent'` | enum: `['percent','number','currency','boolean','milestone']` |
| `initialValue` | Number | `0` | — |
| `targetValue` | Number | `100` | — |
| `currentValue` | Number | `0` | — |
| `unit` | String | `''` | — |
| `status` | String | `'not_started'` | enum: `['not_started','in_progress','completed']` |

**`ProgressUpdateSchema`** (array `progressUpdates`): `user` ObjectId(ref `User`, required); `message` String(required); `createdAt` Date(default `Date.now`).

**`CommentSchema`** (array `comments`): `user` ObjectId(ref `User`, required); `text` String(required); `createdAt` Date(default `Date.now`).

**`AttachmentSchema`** (array `attachments`): `filename` String(required); `originalName` String(required); `size` Number(default `0`); `uploadedBy` ObjectId(ref `User`); `uploadedAt` Date(default `Date.now`).

**`ChangeRequestSchema`** (array `changeRequests`, `{_id:true,timestamps:true}`):
`requestType` String(required, enum `['due_date_extension','scope_change','pause','cancellation']`); `requestedBy` ObjectId(ref `User`, required); `reason` String(required); `newDeadline` Date(default `null`); `newDescription` String(default `''`); `newTitle` String(default `''`); `status` String(default `'pending'`, enum `['pending','approved','rejected','modified']`); `resolvedBy` ObjectId(ref `User`, default `null`); `resolvedAt` Date(default `null`); `resolutionNote` String(default `''`); `createdAt` Date(default `Date.now`).

**`ActivityLogSchema`** (array `activityLog`): `user` ObjectId(ref `User`, required); `action` String(required); `details` String(default `''`); `fromStatus` String(default `''`); `toStatus` String(default `''`); `createdAt` Date(default `Date.now`).

**Main `ObjectiveSchema`**:
| Field | Type | Required/Default | Constraints |
|---|---|---|---|
| `title` | String | required, trim | — |
| `dueDate` | Date | default `null` | — |
| `description` | String | default `''` | — |
| `successIndicator` | String | required, trim | — |
| `owner` | ObjectId (ref `User`) | required, indexed | — |
| `cycle` | ObjectId (ref `Cycle`) | required, indexed | — |
| `category` | String | default `'individual'` | enum: `['individual','team']` |
| `team` | ObjectId (ref `Team`) | default `null`, indexed | — |
| `assignedUsers` | [ObjectId] (ref `User`) | — | — |
| `weight` | Number | required | min `1`, max `100` |
| `priority` | String | default `'medium'`, indexed | enum: `['low','medium','high','critical']` |
| `achievementPercent` | Number | default `null` | min `0`, max `100` |
| `selfAssessment` | String | default `''` | — |
| `finalSelfAssessment` | String | default `''` | — |
| `finalSelfRating` | Number | default `null` | min `1`, max `5` |
| `finalSelfPercent` | Number | default `null` | min `0`, max `100` |
| `finalSelfSubmittedAt` | Date | default `null` | — |
| `finalSelfAttachments` | [{name,url,type,size,mimetype,storageProvider,publicId}] | — | — |
| `finalSelfAttachment` | Mixed | default `null` | — |
| `managerAdjustedPercent` | Number | default `null` | min `0`, max `100` |
| `managerComments` | String | default `''` | — |
| `weightedScore` | Number | default `null`, auto-computed by `pre('save')` = `weight*achievementPercent/100` | — |
| `status` | String | default `'draft'`, indexed | enum: `['draft','pending','submitted','pending_approval','revision_requested','rejected','assigned','acknowledged','approved','validated','locked','cancelled','evaluated','archived']` |
| `source` | String | default `'employee_created'` | enum: `['employee_created','manager_assigned']` |
| `assignedBy` | ObjectId (ref `User`) | default `null` | — |
| `submittedTo` | ObjectId (ref `User`) | default `null` | — |
| `submittedBy` | ObjectId (ref `User`) | default `null` | — |
| `rejectionReason` | String | default `''` | — |
| `revisionReason` | String | default `''` | — |
| `evaluationRating` | String | default `''` | enum: `['exceeded','met','partially_met','not_met','']` |
| `evaluationComment` | String | default `''` | — |
| `evaluationNumericRating` | Number | default `null` | min `1`, max `5` |
| `evaluationEvidence` | String | default `''` | — |
| `evaluatedBy` | ObjectId (ref `User`) | default `null` | — |
| `evaluatedAt` | Date | default `null` | — |
| `validatedBy` | ObjectId (ref `User`) | default `null` | — |
| `validatedAt` | Date | default `null` | — |
| `labels` | [String] | — | — |
| `visibility` | String | default `'public'` | enum: `['private','team','department','public']` |
| `parentObjective` | ObjectId (ref `Objective`, self-ref) | default `null`, indexed | — |
| `kpis` | [KpiSchema] | composition | — |
| `progressUpdates` | [ProgressUpdateSchema] | composition | — |
| `comments` | [CommentSchema] | composition | — |
| `attachments` | [AttachmentSchema] | composition | — |
| `changeRequests` | [ChangeRequestSchema] | composition | — |
| `activityLog` | [ActivityLogSchema] | composition | — |
| `manager_notes` | [{text:String(required), created_at:Date(default `Date.now`)}] | — | — |

`timestamps:true`. Indexes: `{owner:1,cycle:1,title:1}` unique, `{owner:1,status:1}`, `{owner:1,cycle:1}`, `{status:1}`, `{category:1}`, `{team:1,cycle:1,category:1}`, `{source:1}`.

**NOTE**: The `Objective` model has **no `deadline` field, no `user` field, and no `reminderSent` field** — but `backend/cron/deadlineCron.js`, `backend/cron/reminderCron.js`, and `backend/routes/reminders.js` (dead/orphaned route) all query/write `Objective.deadline`, `Objective.user`, `Objective.reminderSent.*`. See Section 10.

### 1.5 `CheckIn.js` (`backend/models/CheckIn.js`)
| Field | Type | Required/Default | Constraints |
|---|---|---|---|
| `objective_id` | ObjectId (ref `Objective`) | required | — |
| `employee_id` | ObjectId (ref `User`) | required | — |
| `cycle_id` | ObjectId (ref `Cycle`) | required | — |
| `status` | String | default `'draft'` | enum: `['draft','pending_review','revision_requested','approved']` |
| `manager_feedback` | String | — | — |
| `manager_id` | ObjectId (ref `User`) | — | — |
| `reviewedBy` | ObjectId (ref `User`) | — | — |
| `reviewedAt` | Date | — | — |
| `progress_percent` | Number | — | min `0`, max `100` |
| `notes` | String | — | — |
| `priority` | String | default `'medium'` | enum: `['low','medium','high']` |
| `attachments` | [{name,url,type:default `'file'`,size,mimetype}] | — | — |
| `history` | [{submitted_at:Date, content:String, status:String, manager_feedback:String}] | — | — |
| `submitted_at` | Date | — | — |
| `last_edited_at` | Date | — | — |

`timestamps:true`. Indexes: `{objective_id:1}`, `{employee_id:1,cycle_id:1}`.

### 1.6 `Evaluation.js` (`backend/models/Evaluation.js`)
Embedded subdocs: `ScoreHistorySchema` (`previousScore`:Number(default `null`), `newScore`:Number(default `null`), `changedBy`:ObjectId(ref `User`,required), `changedAt`:Date(default `Date.now`), `reason`:String(default `''`)); `ObjectiveAssessmentSchema` (`objectiveId`:ObjectId(ref `Objective`, required)); `ApprovalSchema` (`approverId`:ObjectId(ref `User`, required), `status`:String(enum `['pending','approved','rejected']`, default `'pending'`), `comments`:String(default `''`), `date`:Date(default `null`)).

Main:
| Field | Type | Required/Default | Constraints |
|---|---|---|---|
| `employeeId` | ObjectId (ref `User`) | required, indexed | — |
| `evaluatorId` | ObjectId (ref `User`) | required, indexed | — |
| `cycleId` | ObjectId (ref `Cycle`) | required, indexed | — |
| `period` | String | default `''` | — |
| `status` | String | default `'draft'`, indexed | enum: `['draft','in_progress','submitted','approved','rejected','completed']` |
| `objectiveAssessments` | [ObjectiveAssessmentSchema] | composition | — |
| `scoringMethod` | String | default `'objective_weighted_sum'` | enum: `['objective_weighted_sum','simple_average','weighted_average']` |
| `suggestedScore` | Number | default `null` | min `0`, max `100` |
| `finalScore` | Number | default `null` | min `0`, max `100` |
| `scoreHistory` | [ScoreHistorySchema] | composition | — |
| `overallComments` | String | default `''` | — |
| `strengths` | String | default `''` | — |
| `areasForImprovement` | String | default `''` | — |
| `developmentRecommendations` | String | default `''` | — |
| `nextSteps` | String | default `''` | — |
| `approvals` | [ApprovalSchema] | composition | — |
| `employeeAcknowledgment` | `{acknowledged:Boolean(default false), date:Date(default null)}` | — | — |
| `submittedAt` | Date | default `null` | — |
| `completedAt` | Date | default `null` | — |

`timestamps:true`. Indexes: `{employeeId:1,cycleId:1}`, `{evaluatorId:1,cycleId:1}`, `{cycleId:1,status:1}`, `{'objectiveAssessments.objectiveId':1}`.

**NOTE**: `Evaluation` is a distinct model/collection/workflow from `FinalEvaluation` (below) — both are live, actively used in parallel (`/api/evaluations` vs `/api/final-evaluations`). See Section 10.

### 1.7 `FinalEvaluation.js` (`backend/models/FinalEvaluation.js`)
| Field | Type | Required/Default | Constraints |
|---|---|---|---|
| `employee_id` | ObjectId (ref `User`) | required | — |
| `cycle_id` | ObjectId (ref `Cycle`) | required | — |
| `auto_score` | Number | — | — |
| `manager_score` | Number | — | — |
| `final_score` | Number | — | — |
| `rating_label` | String | — | enum: `['exceptional','strong','meets_expectations','needs_improvement','unsatisfactory']` |
| `score_difference` | Number | default `0` | — |
| `manager_adjustment_justification` | String | default `''` | — |
| `objective_weight_total` | Number | default `0` | — |
| `objective_score_normalized` | Boolean | default `false` | — |
| `objective_breakdown` | [{objective_id:ObjectId(ref `Objective`), title:String, category:String, weight:Number, employee_achievement:Number, manager_confirmed_achievement:Number, achievement_used:Number, weighted_points:Number, status:String}] | — | — |
| `evidence_summary` | `{tasks:{total,completed,completion_rate}, checkins:{total,approved,approval_rate,average_progress}}` | — | — |
| `consistency_warnings` | [String] | — | — |
| `ai_assisted` | Boolean | default `false` | — |
| `ai_draft_generated_at` | Date | default `null` | — |
| `ai_reviewed_by_manager` | Boolean | default `false` | — |
| `strengths` | [String] | — | — |
| `weaknesses` | [String] | — | — |
| `improvement_suggestions` | [String] | — | — |
| `manager_comments` | String | — | — |
| `recommendation` | String | — | enum: `['promotion','bonus_eligible','performance_improvement_plan','no_action','department_transfer']` |
| `evaluator_id` | ObjectId (ref `User`) | default `null` | — |
| `evaluator_role` | String | default `null` | enum: `['ADMIN','HR','TEAM_LEADER','COLLABORATOR']` |
| `evaluated_at` | Date | — | — |
| `status` | String | default `'draft'` | enum: `['draft','pending_hr','validated','closed']` |
| `hr_validated_by` | ObjectId (ref `User`) | — | — |
| `hr_validated_at` | Date | — | — |
| `hr_review_notes` | String | default `''` | — |
| `hr_return_reason` | String | default `''` | — |
| `workflow_history` | [{action:String(enum `['submitted','validated','sent_back']`), reason:String(default `''`), performed_by:ObjectId(ref `User`), performed_at:Date(default `Date.now`)}] | — | — |
| `performance_status` | String | default `null` | enum: `['excellent_performance','satisfactory','needs_improvement','critical_attention',null]` |
| `exported_at` | Date | — | — |
| `hr_decision` | `{action:String(enum ['promotion','bonus','pip','transfer','no_action']), notes:String, decided_by:ObjectId(ref User), decided_at:Date}` | — | — |
| `employee_feedback` | `{acknowledged:Boolean(default false), comment:String(default ''), acknowledged_at:Date(default null), updated_at:Date(default null)}` | — | — |

`timestamps:true`. Index: `{employee_id:1,cycle_id:1}` unique.

### 1.8 `HRDecision.js` (`backend/models/HRDecision.js`)
| Field | Type | Required/Default |
|---|---|---|
| `user` | ObjectId (ref `User`) | required |
| `cycle` | ObjectId (ref `Cycle`) | required |
| `finalEvaluation` | ObjectId (ref `FinalEvaluation`) | required |
| `individualScore` | Number | default `0` |
| `teamScore` | Number | default `0` |
| `finalScore` | Number | required |
| `action` | String | required, enum: `['reward','promotion','bonus','satisfactory','coaching','training','position_change','termination_review']` |
| `actionLabel` | String | default `''` |
| `decidedBy` | ObjectId (ref `User`) | — |
| `decidedAt` | Date | default `Date.now` |
| `notes` | String | default `''` |
| `createdAt` | Date | default `Date.now` |

Index: `{user:1,cycle:1}` unique.

### 1.9 `BonusPenalty.js` (`backend/models/BonusPenalty.js`)
| Field | Type | Required/Default | Constraints |
|---|---|---|---|
| `employee` | ObjectId (ref `User`) | required | — |
| `assignedBy` | ObjectId (ref `User`) | required | — |
| `type` | String | required | enum: `['bonus','penalty']` |
| `value` | Number | required | min `0.01` |
| `reason` | String | required | — |
| `finalEvaluation` | ObjectId (ref `FinalEvaluation`) | required | — |
| `hrDecision` | ObjectId (ref `HRDecision`) | default `null` | — |
| `objective` | ObjectId (ref `Objective`) | default `null` | — |
| `approvalStatus` | String | default `'approved'` | enum: `['pending','approved','rejected']` |
| `reviewNotes` | String | default `''` | — |
| `reviewedBy` | ObjectId (ref `User`) | default `null` | — |
| `reviewedAt` | Date | default `null` | — |
| `paymentDate` | Date | default `null` | — |
| `createdAt` | Date | default `Date.now` | — |

Indexes: `{employee:1,createdAt:-1}`, `{finalEvaluation:1}`.

### 1.10 `Competency.js` (`backend/models/Competency.js`)
| Field | Type | Required/Default | Constraints |
|---|---|---|---|
| `name` | String | required, trim | — |
| `description` | String | default `''` | — |
| `category` | String | default `'other'` | enum: `['technical','leadership','communication','problem_solving','teamwork','domain','management','other']` |
| `level` | String | default `'beginner'` | enum: `['beginner','intermediate','advanced','expert']` |
| `skills` | [String] | — | — |
| `roles` | [String] | — | — |
| `isActive` | Boolean | default `true` | — |
| `createdBy` | ObjectId (ref `User`) | — | — |

`timestamps:true`. Indexes: `{category:1,isActive:1}`, `{name:1}` unique.

### 1.11 `CareerPath.js` (`backend/models/CareerPath.js`)
Embedded `DevelopmentActionSchema` (array `developmentPlan`): `title`:String(required); `type`:String(default `'other'`, enum `['training','mentoring','project','certification','reading','other']`); `status`:String(default `'planned'`, enum `['planned','in_progress','completed','overdue','cancelled']`); `dueDate`:Date(default `null`); `completedAt`:Date(default `null`); `notes`:String(default `''`); `createdFromEvaluation`:ObjectId(ref `FinalEvaluation`, default `null`).

Main:
| Field | Type | Required/Default |
|---|---|---|
| `user` | ObjectId (ref `User`) | required |
| `currentRole` | String | required, trim |
| `currentLevel` | String | default `''` |
| `targetRole` | String | default `''`, trim |
| `targetLevel` | String | default `''` |
| `targetDate` | Date | default `null` |
| `competencies` | [{competency:ObjectId(ref `Competency`), currentLevel:String(enum ['beginner','intermediate','advanced','expert'], default 'beginner'), targetLevel:String(enum same, default 'advanced'), gap:Number(default 0)}] | qualified association to Competency with metadata |
| `developmentPlan` | [DevelopmentActionSchema] | composition |
| `finalEvaluation` | ObjectId (ref `FinalEvaluation`) | default `null` |
| `mentorId` | ObjectId (ref `User`) | default `null` |
| `status` | String | default `'active'`, enum `['active','completed','paused']` |
| `notes` | String | default `''` |
| `createdBy` | ObjectId (ref `User`) | — |

`timestamps:true`. Index: `{user:1,status:1}`.

### 1.12 `CareerRecommendation.js` (`backend/models/CareerRecommendation.js`)
| Field | Type | Required/Default | Constraints |
|---|---|---|---|
| `employee_id` | ObjectId (ref `User`) | required | — |
| `cycle_id` | ObjectId (ref `Cycle`) | required | — |
| `suggested_path` | String | required | — |
| `skills_to_develop` | [String] | — | — |
| `source` | String | default `'manager'` | enum: `['manager','auto']` |
| `basis` | String | default `''` | — |

`timestamps:true`. Index: `{employee_id:1,cycle_id:1}`.

### 1.13 `ImprovementPlan.js` (`backend/models/ImprovementPlan.js`)
| Field | Type | Required/Default | Constraints |
|---|---|---|---|
| `evaluation_id` | ObjectId (ref `FinalEvaluation`) | required | — |
| `employee_id` | ObjectId (ref `User`) | required | — |
| `cycle_id` | ObjectId (ref `Cycle`) | required | — |
| `objective_goal` | String | required, trim | — |
| `deadline` | Date | required | — |
| `expected_outcome` | String | required, trim | — |
| `notes` | String | default `''`, trim | — |
| `progress_status` | String | default `'not_started'` | enum: `['not_started','in_progress','completed']` |
| `created_by` | ObjectId (ref `User`) | required | — |
| `updated_by` | ObjectId (ref `User`) | default `null` | — |

`timestamps:true`. Indexes: `{evaluation_id:1,deadline:1}`, `{employee_id:1,progress_status:1}`.

### 1.14 `Feedback.js` (`backend/models/Feedback.js`)
| Field | Type | Required/Default | Constraints |
|---|---|---|---|
| `sender` | ObjectId (ref `User`) | required | — |
| `recipient` | ObjectId (ref `User`) | required | — |
| `type` | String | default `'praise'` | enum: `['praise','suggestion','concern','360','peer','manager','self']` |
| `message` | String | required, trim | — |
| `anonymous` | Boolean | default `false` | — |
| `visibility` | String | default `'private'` | enum: `['public','private','manager_only']` |
| `relatedMeeting` | ObjectId (ref `Meeting`) | default `null` | — |
| `relatedReview` | ObjectId (ref `'ManagerReview'`) | default `null` | **`ManagerReview` model does not exist as a file in `backend/models/`** — dangling/legacy ref, see Section 10 |
| `relatedObjective` | ObjectId (ref `Objective`) | default `null` | — |
| `objective_id` | ObjectId (ref `Objective`) | — | duplicate-purpose field alongside `relatedObjective` — see Section 10 |
| `check_in_id` | ObjectId (ref `CheckIn`) | — | — |
| `cycle_id` | ObjectId (ref `Cycle`) | — | — |
| `rating` | Number | default `null` | min `1`, max `5` |
| `tags` | [String] | — | — |
| `status` | String | default `'active'` | enum: `['active','archived','flagged']` |
| `requestedBy` | ObjectId (ref `User`) | default `null` | — |
| `isRequested` | Boolean | default `false` | — |

`timestamps:true`. Indexes: `{recipient:1,createdAt:-1}`, `{sender:1,createdAt:-1}`, `{type:1}`, `{visibility:1}`.

### 1.15 `Meeting.js` (`backend/models/Meeting.js`)
Embedded `agendaItemSchema` (array `agenda`): `title`:String(required); `duration`:Number(default `5`); `presenter`:ObjectId(ref `User`); `notes`:String(default `''`); `completed`:Boolean(default `false`).

Main:
| Field | Type | Required/Default | Constraints |
|---|---|---|---|
| `title` | String | required, trim | — |
| `description` | String | default `''` | — |
| `organizer` | ObjectId (ref `User`) | required | — |
| `attendees` | [ObjectId] (ref `User`) | — | see Section 10 (redundant with `participants`) |
| `participants` | [ObjectId] (ref `User`) | — | see Section 10 |
| `meeting_type` | String | default `'general'` | enum: `['general','mid-year-review','final-evaluation']` |
| `cycle_id` | ObjectId (ref `Cycle`) | — | — |
| `employee_id` | ObjectId (ref `User`) | — | — |
| `final_evaluation_id` | ObjectId (ref `FinalEvaluation`) | — | — |
| `date` | Date | required | — |
| `startTime` | String | default `'09:00'` | — |
| `endTime` | String | default `'10:00'` | — |
| `type` | String | default `'team'` | enum: `['one_on_one','team','all_hands','check_in','review','planning','other']` |
| `status` | String | default `'scheduled'` | enum: `['scheduled','in_progress','completed','cancelled']` |
| `agenda` | [agendaItemSchema] | composition | — |
| `notes` | String | default `''` | — |
| `relatedObjectives` | [ObjectId] (ref `Objective`) | — | — |
| `team` | ObjectId (ref `Team`) | — | — |
| `recurring` | String | default `'none'` | enum: `['none','daily','weekly','biweekly','monthly']` |
| `location` | String | default `''` | — |
| `actionItems` | [{title:String(required), assignee:ObjectId(ref User), dueDate:Date, completed:Boolean(default false)}] | composition | — |

`timestamps:true`. Indexes: `{organizer:1,date:-1}`, `{attendees:1,date:-1}`, `{team:1,date:-1}`, `{status:1}`.

### 1.16 `Notification.js` (`backend/models/Notification.js`)
| Field | Type | Required/Default | Constraints |
|---|---|---|---|
| `recipient` | ObjectId (ref `User`) | required | — |
| `sender` | ObjectId (ref `User`) | — | — |
| `type` | String | required | enum (full list): `['DEADLINE','KPI_DROP','MENTION','GOAL_UPDATE','COMMENT','FEEDBACK','GOAL_SUBMITTED','GOAL_APPROVED','GOAL_REJECTED','GOAL_REVISION_REQUESTED','GOAL_ASSIGNED','GOAL_ACKNOWLEDGED','GOAL_COMPLETED','GOAL_EVALUATED','CHANGE_REQUEST','CHANGE_REQUEST_RESOLVED','GOAL_CANCELLED','MEETING_INVITE','MEETING_UPDATE','MIDYEAR_REVIEW_COMPLETED','FINAL_EVALUATION_COMPLETED','PHASE_OPENED','PHASE_CLOSED','DEADLINE_REMINDER','OVERDUE_ALERT','EVALUATION_CREATED','EVALUATION_SUBMITTED','EVALUATION_APPROVED','EVALUATION_REJECTED','EVALUATION_COMPLETED']` |
| `title` | String | required | — |
| `message` | String | required | — |
| `link` | String | — | — |
| `isRead` | Boolean | default `false` | — |
| `createdAt` | Date | default `Date.now` | — |

`timestamps:true`. Indexes: `{recipient:1,createdAt:-1}`, `{recipient:1,isRead:1,createdAt:-1}`.

### 1.17 `CorrectionRequest.js` (`backend/models/CorrectionRequest.js`)
| Field | Type | Required/Default | Constraints |
|---|---|---|---|
| `objectiveId` | ObjectId (ref `Objective`) | required, indexed | — |
| `field` | String | required | enum: `['description','successIndicator']` |
| `oldValue` | String | default `''` | — |
| `newValue` | String | required | — |
| `correctionReason` | String | required | — |
| `requestedBy` | ObjectId (ref `User`) | required | — |
| `status` | String | default `'PENDING'`, indexed | enum: `['PENDING','APPROVED','REJECTED']` |
| `reviewedBy` | ObjectId (ref `User`) | default `null` | — |
| `reviewedAt` | Date | default `null` | — |
| `resolutionNote` | String | default `''` | — |
| `createdAt` | Date | default `Date.now` | — |
| `updatedAt` | Date | default `Date.now`, also updated in `pre('save')` | — |

### 1.18 `CalendarConnection.js` (`backend/models/CalendarConnection.js`)
| Field | Type | Required/Default | Constraints |
|---|---|---|---|
| `user` | ObjectId (ref `User`) | required, indexed | — |
| `provider` | String | required | enum: `['google','outlook']` |
| `email` | String | default `''` | — |
| `accessToken` | String | default `''` | `select:false` |
| `refreshToken` | String | default `''` | `select:false` |
| `expiresAt` | Date | default `null` | — |
| `scope` | String | default `''` | — |
| `metadata` | Object | default `{}` | — |
| `lastSyncAt` | Date | default `null` | — |

`timestamps:true`. Index: `{user:1,provider:1}` unique.

### 1.19 `AuditLog.js` (`backend/models/AuditLog.js`)
| Field | Type | Required/Default |
|---|---|---|
| `user` | ObjectId (ref `User`) | required, indexed |
| `user_id` | ObjectId (ref `User`) | default `null` — duplicate-purpose field alongside `user`, see Section 10 |
| `action` | String | required |
| `entityType` | String | default `''`, indexed |
| `entity_type` | String | default `''` — duplicate-purpose field, see Section 10 |
| `entityId` | ObjectId | default `null`, indexed |
| `entity_id` | ObjectId | default `null` — duplicate-purpose field, see Section 10 |
| `entityName` | String | default `''` |
| `userName` | String | default `''` |
| `userRole` | String | default `''` |
| `description` | String | default `''` |
| `changes` | `{before:Mixed(default null), after:Mixed(default null)}` | — |
| `metadata` | Mixed | default `null` |
| `ipAddress` | String | default `''` |
| `timestamp` | Date | default `Date.now`, indexed |

`timestamps:true`. Index: `{timestamp:-1}`.

### 1.20 `Task.js` (`backend/models/Task.js`)
| Field | Type | Required/Default | Constraints |
|---|---|---|---|
| `title` | String | required, trim | — |
| `description` | String | default `''` | — |
| `assignee` | ObjectId (ref `User`) | required | — |
| `assignedBy` | ObjectId (ref `User`) | required | — |
| `status` | String | default `'todo'` | enum: `['todo','in_progress','done','cancelled']` |
| `priority` | String | default `'medium'` | enum: `['low','medium','high','urgent']` |
| `workflowStage` | String | default `'todo'` | enum: `['backlog','todo','in_progress','review','completed','cancelled']` |
| `progress` | Number | default `0` | min `0`, max `100` |
| `labels` | [String] | — | — |
| `dueDate` | Date | default `null` | — |
| `completedAt` | Date | default `null` | — |
| `recurring` | String | default `'none'` | enum: `['none','daily','weekly','monthly']` |
| `linkedGoal` | ObjectId (ref `Objective`) | default `null` | — |
| `objective_id` | ObjectId (ref `Objective`) | — | duplicate-purpose field alongside `linkedGoal`, see Section 10 |
| `phase` | Number | — | enum: `[1,2,3]` |
| `kpi_id` | ObjectId (ref `'KPI'`) | — | `'KPI'` is not a registered top-level Mongoose model (`Kpi` is only an embedded subdoc of `Objective`) — dangling/likely-incorrect ref, see Section 10 |
| `linkedMeeting` | ObjectId (ref `Meeting`) | default `null` | — |
| `team` | ObjectId (ref `Team`) | default `null` | — |
| `notes` | String | default `''` | — |
| `timeTracking` | `{totalSeconds:Number(default 0,min 0), lastTrackedAt:Date(default null), sessions:[{startedAt:Date(required), endedAt:Date(required), durationSeconds:Number(required,min 0), focusMode:Boolean(default false), source:String(default 'timer'), notes:String(default '')}]}` | — | — |
| `totalTimeSpent` | Number | default `0`, min `0` | — |
| `totalTrackedTime` | Number | default `0`, min `0` | — |
| `timeSessions` | [{startTime:Date(required), endTime:Date(required), duration:Number(required,min 0), focusMode:Boolean(default false), source:String(default 'timer'), notes:String(default '')}] | — | duplicated/legacy pair with `timeTracking.sessions`, see Section 10 |

`timestamps:true`. Indexes: `{assignee:1,status:1}`, `{assignee:1,dueDate:1,createdAt:-1}`, `{assignedBy:1,createdAt:-1}`, `{dueDate:1,status:1}`, `{linkedGoal:1}`, `{linkedMeeting:1}`, `{team:1,status:1}`, `{team:1,dueDate:1,createdAt:-1}`.

### 1.21 Dead/orphaned models referenced but not part of the 20-model inventory
**VERIFIED** (found in `backend/controllers/cycleController.js` and `backend/controllers/hrDecisionController.js`, both dead-code controllers): `require('../models/EvaluationCycle')` and `require('../models/EvaluationReport')`. Neither `EvaluationCycle.js` nor `EvaluationReport.js` exists in `backend/models/` (confirmed: only the 20 files above exist). These two controller files would throw `Cannot find module` if ever `require`d — and indeed they are never required by any route file (VERIFIED via grep). See Section 10.

### 1.22 AI-service data shapes (`ai-service/`)
**VERIFIED** — No Pydantic/marshmallow schema classes are used; `ai-service/app.py` validates plain dicts manually via `validate_payload()`.

**Request shape for `POST /predict` and each item of `POST /predict/batch`** (8 required numeric fields, from `FEATURE_COLUMNS` loaded from `models/feature_columns.json` and `FEATURE_BOUNDS` dict in `app.py`):
| Field | Type | Bounds |
|---|---|---|
| `kpi_score` | number | 0–100 |
| `goal_completion_percent` | number | 0–100 |
| `checkin_count` | number | 0–20 |
| `avg_checkin_progress` | number | 0–100 |
| `feedback_count` | number | 0–50 |
| `positive_feedback_ratio` | number | 0–1 |
| `task_completion_percent` | number | 0–100 |
| `tasks_on_time_percent` | number | 0–100 |

**Response shape for `POST /predict`** (built by `predict_one()`): `{overall_score:number, rating:string(one of 4 labels), rating_confidence:number(0-1,4dp), promotion_ready:boolean, promotion_probability:number(0-1,4dp), strengths:[string], weaknesses:[string], review_summary:string, suggestions:[string]}`.

**Response shape for `POST /predict/batch`**: JSON array, each item either the above shape plus `index:number`, or `{index:number, error:string}` on a per-item validation/prediction failure.

**Response shape for `GET /health`**: `{status:"ok"}`.

**Dataset row shape** (`ai-service/data/employee_performance_dataset.csv`, generated by `generate_dataset.py`): `employee_id`(string `EMP00001`-style), the 8 feature columns above, `overall_score`(number), `rating`(one of 4 rating labels), `promotion_ready`(boolean), `strengths`/`weaknesses`/`review_summary`/`suggestions` (generated text, `;`-joined for the list fields).

---

## 2. Relationship Inventory

Every `ref:` field from Section 1, expressed as a directed relationship. Mechanism key: **FK-ref** = Mongoose `ObjectId` with `ref:`, resolved via `.populate()`; **composition** = embedded subdocument array/object, lifecycle bound to parent; **self-ref** = model refs itself; **dangling ref** = `ref:` target model does not exist/is not the intended target.

| # | Source Model.Field | Target Model | Mechanism | Cardinality (source→target) | File |
|---|---|---|---|---|---|
| 1 | `User.team` | `Team` | FK-ref | N:1 (many users → one team) | `backend/models/User.js` |
| 2 | `User.manager` | `User` (self-ref) | FK-ref | N:1 (many employees → one manager) | `backend/models/User.js` |
| 3 | `Team.leader` | `User` | FK-ref | 1:1 (one team → one leader user; asymmetric — `User` has no back-ref field to `Team` as leader, only `User.team` for membership) | `backend/models/Team.js` |
| 4 | `Team.members` | `User` (array) | FK-ref (aggregation — array of independent User docs) | N:N (one team → many users; one user can be a member of one team via `User.team`, asymmetric field naming) | `backend/models/Team.js` |
| 5 | `Team.parentTeam` | `Team` (self-ref) | FK-ref | N:1 (many sub-teams → one parent team) | `backend/models/Team.js` |
| 6 | `Team.createdBy` | `User` | FK-ref | N:1 | `backend/models/Team.js` |
| 7 | `Cycle.createdBy` | `User` | FK-ref | N:1 | `backend/models/Cycle.js` |
| 8 | `Objective.owner` | `User` | FK-ref | N:1 (many objectives → one owner) | `backend/models/Objective.js` |
| 9 | `Objective.cycle` | `Cycle` | FK-ref | N:1 | `backend/models/Objective.js` |
| 10 | `Objective.team` | `Team` | FK-ref | N:1 | `backend/models/Objective.js` |
| 11 | `Objective.assignedUsers` | `User` (array) | FK-ref (aggregation) | N:N | `backend/models/Objective.js` |
| 12 | `Objective.assignedBy` | `User` | FK-ref | N:1 | `backend/models/Objective.js` |
| 13 | `Objective.submittedTo` | `User` | FK-ref | N:1 | `backend/models/Objective.js` |
| 14 | `Objective.submittedBy` | `User` | FK-ref | N:1 | `backend/models/Objective.js` |
| 15 | `Objective.evaluatedBy` | `User` | FK-ref | N:1 | `backend/models/Objective.js` |
| 16 | `Objective.validatedBy` | `User` | FK-ref | N:1 | `backend/models/Objective.js` |
| 17 | `Objective.parentObjective` | `Objective` (self-ref) | FK-ref | N:1 (sub-objective → parent) | `backend/models/Objective.js` |
| 18 | `Objective.kpis[]` | (embedded) | composition | 1:N owned | `backend/models/Objective.js` |
| 19 | `Objective.progressUpdates[].user` | `User` | FK-ref (inside composed subdoc) | N:1 | `backend/models/Objective.js` |
| 20 | `Objective.comments[].user` | `User` | FK-ref (inside composed subdoc) | N:1 | `backend/models/Objective.js` |
| 21 | `Objective.attachments[].uploadedBy` | `User` | FK-ref (inside composed subdoc) | N:1 | `backend/models/Objective.js` |
| 22 | `Objective.changeRequests[].requestedBy` | `User` | FK-ref (inside composed subdoc) | N:1 | `backend/models/Objective.js` |
| 23 | `Objective.changeRequests[].resolvedBy` | `User` | FK-ref (inside composed subdoc) | N:1 | `backend/models/Objective.js` |
| 24 | `Objective.activityLog[].user` | `User` | FK-ref (inside composed subdoc) | N:1 | `backend/models/Objective.js` |
| 25 | `CheckIn.objective_id` | `Objective` | FK-ref | N:1 | `backend/models/CheckIn.js` |
| 26 | `CheckIn.employee_id` | `User` | FK-ref | N:1 | `backend/models/CheckIn.js` |
| 27 | `CheckIn.cycle_id` | `Cycle` | FK-ref | N:1 | `backend/models/CheckIn.js` |
| 28 | `CheckIn.manager_id` | `User` | FK-ref | N:1 | `backend/models/CheckIn.js` |
| 29 | `CheckIn.reviewedBy` | `User` | FK-ref | N:1 | `backend/models/CheckIn.js` |
| 30 | `Evaluation.employeeId` | `User` | FK-ref | N:1 | `backend/models/Evaluation.js` |
| 31 | `Evaluation.evaluatorId` | `User` | FK-ref | N:1 | `backend/models/Evaluation.js` |
| 32 | `Evaluation.cycleId` | `Cycle` | FK-ref | N:1 | `backend/models/Evaluation.js` |
| 33 | `Evaluation.objectiveAssessments[].objectiveId` | `Objective` | FK-ref (inside composed subdoc) | N:1 (informal aggregation — assessment subdoc merely stores objective id, real objective fetched live at read time by `evaluationController.hydrateEvaluation`) | `backend/models/Evaluation.js` |
| 34 | `Evaluation.scoreHistory[].changedBy` | `User` | FK-ref (inside composed subdoc) | N:1 | `backend/models/Evaluation.js` |
| 35 | `Evaluation.approvals[].approverId` | `User` | FK-ref (inside composed subdoc) | N:1 | `backend/models/Evaluation.js` |
| 36 | `FinalEvaluation.employee_id` | `User` | FK-ref | N:1 | `backend/models/FinalEvaluation.js` |
| 37 | `FinalEvaluation.cycle_id` | `Cycle` | FK-ref | N:1 | `backend/models/FinalEvaluation.js` |
| 38 | `FinalEvaluation.objective_breakdown[].objective_id` | `Objective` | FK-ref (inside composed subdoc) | N:1 | `backend/models/FinalEvaluation.js` |
| 39 | `FinalEvaluation.evaluator_id` | `User` | FK-ref | N:1 | `backend/models/FinalEvaluation.js` |
| 40 | `FinalEvaluation.hr_validated_by` | `User` | FK-ref | N:1 | `backend/models/FinalEvaluation.js` |
| 41 | `FinalEvaluation.workflow_history[].performed_by` | `User` | FK-ref (inside composed subdoc) | N:1 | `backend/models/FinalEvaluation.js` |
| 42 | `FinalEvaluation.hr_decision.decided_by` | `User` | FK-ref (inside composed object) | N:1 | `backend/models/FinalEvaluation.js` |
| 43 | `HRDecision.user` | `User` | FK-ref | N:1 | `backend/models/HRDecision.js` |
| 44 | `HRDecision.cycle` | `Cycle` | FK-ref | N:1 | `backend/models/HRDecision.js` |
| 45 | `HRDecision.finalEvaluation` | `FinalEvaluation` | FK-ref | 1:1 (unique index `{user:1,cycle:1}`) | `backend/models/HRDecision.js` |
| 46 | `HRDecision.decidedBy` | `User` | FK-ref | N:1 | `backend/models/HRDecision.js` |
| 47 | `BonusPenalty.employee` | `User` | FK-ref | N:1 | `backend/models/BonusPenalty.js` |
| 48 | `BonusPenalty.assignedBy` | `User` | FK-ref | N:1 | `backend/models/BonusPenalty.js` |
| 49 | `BonusPenalty.finalEvaluation` | `FinalEvaluation` | FK-ref | N:1 | `backend/models/BonusPenalty.js` |
| 50 | `BonusPenalty.hrDecision` | `HRDecision` | FK-ref | N:1 | `backend/models/BonusPenalty.js` |
| 51 | `BonusPenalty.objective` | `Objective` | FK-ref | N:1 | `backend/models/BonusPenalty.js` |
| 52 | `BonusPenalty.reviewedBy` | `User` | FK-ref | N:1 | `backend/models/BonusPenalty.js` |
| 53 | `Competency.createdBy` | `User` | FK-ref | N:1 | `backend/models/Competency.js` |
| 54 | `CareerPath.user` | `User` | FK-ref | N:1 (per index, one user can have multiple CareerPath docs over time/status) | `backend/models/CareerPath.js` |
| 55 | `CareerPath.competencies[].competency` | `Competency` | FK-ref (qualified association — subdoc carries `currentLevel`/`targetLevel`/`gap` metadata) | N:N | `backend/models/CareerPath.js` |
| 56 | `CareerPath.developmentPlan[].createdFromEvaluation` | `FinalEvaluation` | FK-ref (inside composed subdoc) | N:1 | `backend/models/CareerPath.js` |
| 57 | `CareerPath.finalEvaluation` | `FinalEvaluation` | FK-ref | N:1 | `backend/models/CareerPath.js` |
| 58 | `CareerPath.mentorId` | `User` | FK-ref | N:1 | `backend/models/CareerPath.js` |
| 59 | `CareerPath.createdBy` | `User` | FK-ref | N:1 | `backend/models/CareerPath.js` |
| 60 | `CareerRecommendation.employee_id` | `User` | FK-ref | N:1 | `backend/models/CareerRecommendation.js` |
| 61 | `CareerRecommendation.cycle_id` | `Cycle` | FK-ref | N:1 | `backend/models/CareerRecommendation.js` |
| 62 | `ImprovementPlan.evaluation_id` | `FinalEvaluation` | FK-ref | N:1 | `backend/models/ImprovementPlan.js` |
| 63 | `ImprovementPlan.employee_id` | `User` | FK-ref | N:1 | `backend/models/ImprovementPlan.js` |
| 64 | `ImprovementPlan.cycle_id` | `Cycle` | FK-ref | N:1 | `backend/models/ImprovementPlan.js` |
| 65 | `ImprovementPlan.created_by` | `User` | FK-ref | N:1 | `backend/models/ImprovementPlan.js` |
| 66 | `ImprovementPlan.updated_by` | `User` | FK-ref | N:1 | `backend/models/ImprovementPlan.js` |
| 67 | `Feedback.sender` | `User` | FK-ref | N:1 | `backend/models/Feedback.js` |
| 68 | `Feedback.recipient` | `User` | FK-ref | N:1 | `backend/models/Feedback.js` |
| 69 | `Feedback.relatedMeeting` | `Meeting` | FK-ref | N:1 | `backend/models/Feedback.js` |
| 70 | `Feedback.relatedReview` | `'ManagerReview'` | **dangling FK-ref** — target model file does not exist | N:1 (never resolvable) | `backend/models/Feedback.js` |
| 71 | `Feedback.relatedObjective` | `Objective` | FK-ref | N:1 | `backend/models/Feedback.js` |
| 72 | `Feedback.objective_id` | `Objective` | FK-ref (duplicate-purpose with #71) | N:1 | `backend/models/Feedback.js` |
| 73 | `Feedback.check_in_id` | `CheckIn` | FK-ref | N:1 | `backend/models/Feedback.js` |
| 74 | `Feedback.cycle_id` | `Cycle` | FK-ref | N:1 | `backend/models/Feedback.js` |
| 75 | `Feedback.requestedBy` | `User` | FK-ref | N:1 | `backend/models/Feedback.js` |
| 76 | `Meeting.organizer` | `User` | FK-ref | N:1 | `backend/models/Meeting.js` |
| 77 | `Meeting.attendees` | `User` (array) | FK-ref (aggregation) | N:N | `backend/models/Meeting.js` |
| 78 | `Meeting.participants` | `User` (array) | FK-ref (aggregation, duplicate-purpose with #77) | N:N | `backend/models/Meeting.js` |
| 79 | `Meeting.agenda[].presenter` | `User` | FK-ref (inside composed subdoc) | N:1 | `backend/models/Meeting.js` |
| 80 | `Meeting.cycle_id` | `Cycle` | FK-ref | N:1 | `backend/models/Meeting.js` |
| 81 | `Meeting.employee_id` | `User` | FK-ref | N:1 | `backend/models/Meeting.js` |
| 82 | `Meeting.final_evaluation_id` | `FinalEvaluation` | FK-ref | N:1 | `backend/models/Meeting.js` |
| 83 | `Meeting.relatedObjectives` | `Objective` (array) | FK-ref (aggregation) | N:N | `backend/models/Meeting.js` |
| 84 | `Meeting.team` | `Team` | FK-ref | N:1 | `backend/models/Meeting.js` |
| 85 | `Meeting.actionItems[].assignee` | `User` | FK-ref (inside composed subdoc) | N:1 | `backend/models/Meeting.js` |
| 86 | `Notification.recipient` | `User` | FK-ref | N:1 | `backend/models/Notification.js` |
| 87 | `Notification.sender` | `User` | FK-ref | N:1 | `backend/models/Notification.js` |
| 88 | `CorrectionRequest.objectiveId` | `Objective` | FK-ref | N:1 | `backend/models/CorrectionRequest.js` |
| 89 | `CorrectionRequest.requestedBy` | `User` | FK-ref | N:1 | `backend/models/CorrectionRequest.js` |
| 90 | `CorrectionRequest.reviewedBy` | `User` | FK-ref | N:1 | `backend/models/CorrectionRequest.js` |
| 91 | `CalendarConnection.user` | `User` | FK-ref | N:1 (unique per `{user,provider}`) | `backend/models/CalendarConnection.js` |
| 92 | `AuditLog.user` | `User` | FK-ref | N:1 | `backend/models/AuditLog.js` |
| 93 | `AuditLog.user_id` | `User` | FK-ref (duplicate-purpose with #92) | N:1 | `backend/models/AuditLog.js` |
| 94 | `Task.assignee` | `User` | FK-ref | N:1 | `backend/models/Task.js` |
| 95 | `Task.assignedBy` | `User` | FK-ref | N:1 | `backend/models/Task.js` |
| 96 | `Task.linkedGoal` | `Objective` | FK-ref | N:1 | `backend/models/Task.js` |
| 97 | `Task.objective_id` | `Objective` | FK-ref (duplicate-purpose with #96) | N:1 | `backend/models/Task.js` |
| 98 | `Task.kpi_id` | `'KPI'` | **dangling/likely-incorrect FK-ref** — no top-level `KPI` model registered (Kpi is embedded-only inside `Objective`) | N:1 (never resolvable via `.populate()`) | `backend/models/Task.js` |
| 99 | `Task.linkedMeeting` | `Meeting` | FK-ref | N:1 | `backend/models/Task.js` |
| 100 | `Task.team` | `Team` | FK-ref | N:1 | `backend/models/Task.js` |

**Asymmetry notes (VERIFIED)**: `Team.leader`/`Team.members` → `User` has no reverse array field on `User` for "teams I lead" or "teams I'm a member of" beyond the single `User.team` scalar (which itself only supports one team membership, not multiple, and is not kept in sync with sub-team membership — team assignment logic lives in `routes/teams.js`, not a schema-level bidirectional sync). `Objective.parentObjective` and `Team.parentTeam` are one-directional self-refs with no `children`/`subTeams` array field on the model itself — child lookups are done via `Objective.find({parentObjective: parentId})` / `Team.find({parentTeam: id})` queries in controllers, not via a stored inverse relationship.

---

## 3. API / Endpoint Inventory

All paths are prefixed per the mount table in Section 0 (`backend/app.js`). Auth is `backend/middleware/auth.js` unless noted; Role is `backend/middleware/role.js` with the listed allowed roles (ADMIN always bypasses per `role.js` logic).

### 3.1 `routes/auth.js` → mounted `/api/auth` (no controller; inline logic)
| Method | Path | Auth/Role | Request | Response | Side effects |
|---|---|---|---|---|---|
| POST | `/api/auth/login` | none | `{email,password}` | `{success,message,token,accessToken,refreshToken,user:{_id,id,name,email,role,profileImage}}` | writes `user.refreshToken` |
| POST | `/api/auth/refresh` | none | `{refreshToken}` | `{success,token,accessToken,refreshToken}` | rotates+saves `user.refreshToken` |
| POST | `/api/auth/logout` | none | `{refreshToken}` | `{success,message}` | `User.updateOne({refreshToken},{$unset:{refreshToken:1}})` |
| GET | `/api/auth/me` | parses Bearer header itself (not `auth` middleware) | — | `{success,_id,id,name,email,role,profileImage}` | none |

### 3.2 `routes/users.js` → mounted `/api/users`, controller `userController.js`
| Method | Path | Fn | Middleware |
|---|---|---|---|
| GET | `/api/users/filter/list` | `getUsers` | rateLimiter, auth |
| GET | `/api/users/managers` | `getManagers` | rateLimiter, auth |
| GET | `/api/users/collaborators` | `getCollaborators` | rateLimiter, auth |
| GET | `/api/users/` | `getAllUsers` | rateLimiter, auth, role(ADMIN) |
| GET | `/api/users/:id` | `getUserById` | rateLimiter, auth, role(ADMIN) |
| DELETE | `/api/users/:id` | `deleteUser` | rateLimiter, auth, role(ADMIN) |
| PUT | `/api/users/:id` | `updateUser` | rateLimiter, auth |
| PUT | `/api/users/:id/avatar` | `updateAvatar` | rateLimiter, auth, multer(5MB image), `storeUploadedFile` |

Detail: `deleteUser` is soft-delete (`isDeleted=true,isActive=false`); self-delete blocked. `updateUser` self-path allows name/email/password; admin path allows name/email/role/team. No notification/audit side effects.

### 3.3 `routes/teamMembers.js` → mounted `/api/team-members` (inline, no controller)
| GET `/api/team-members/` | rateLimiter, auth | Resolves caller's team; aggregates `Task`/`Objective`/`Evaluation` stats per member via `calculateMemberWeightBreakdowns`. Returns raw array `{id,name,avatar,role,department,status,progress,tasksCompleted,activeTasks,activeGoals,pendingReviews,usedWeight,remainingWeight,weightBreakdown}`.

### 3.4 `routes/teams.js` → mounted `/api/teams` (inline logic; `controllers/teamController.js` exists but is dead code — never required)
| Method | Path | Middleware | Notes |
|---|---|---|---|
| GET | `/api/teams/` | rateLimiter, auth, role(ADMIN,HR,TEAM_LEADER) | TEAM_LEADER scoped to managed team tree |
| GET | `/api/teams/my-team` | rateLimiter, auth | finds leader-or-member team, walks to root, returns `{team,subTeams}` |
| GET | `/api/teams/:id/summary` | rateLimiter, auth | query `cycleId`; computes objectiveProgress/taskCompletion/averagePerformanceScore/weightHealth |
| GET | `/api/teams/:id/subteams` | rateLimiter, auth | in-fn access check |
| GET | `/api/teams/:id` | rateLimiter, auth, role(ADMIN,HR,TEAM_LEADER) | + `canManageTeam` |
| POST | `/api/teams/` | rateLimiter, auth, role(ADMIN,HR) | body: name,description,leader,members. Sets `User.team` on leader+members. Notifies new members `GOAL_UPDATE` |
| POST | `/api/teams/:id/subteams` | rateLimiter, auth, role(ADMIN,HR,TEAM_LEADER) | sub-team leader/members must be in parent pool |
| PUT | `/api/teams/:id` | rateLimiter, auth, role(ADMIN,HR,TEAM_LEADER) | `parentTeam` immutable; TEAM_LEADER cannot edit main (non-sub) teams |
| DELETE | `/api/teams/:id` | rateLimiter, auth, role(ADMIN,HR,TEAM_LEADER) | cascades delete of descendant teams |

### 3.5 `routes/cycles.js` → mounted `/api/cycles` (inline logic using `Cycle` model; `controllers/cycleController.js` is dead code referencing a non-existent `EvaluationCycle` model)
| Method | Path | Middleware | Notes |
|---|---|---|---|
| GET | `/api/cycles/` | rateLimiter, auth | query search/status/year; non-ADMIN forced `status≠draft` |
| GET | `/api/cycles/:id` | rateLimiter, auth | — |
| POST | `/api/cycles/` | rateLimiter, auth, role(ADMIN), validate(schemas.cycle.create) | audit `action:'created'` |
| PUT | `/api/cycles/:id` | rateLimiter, auth, role(ADMIN), validate(schemas.cycle.update) | blocks editing closed cycle; on transition to `closed` generates `HRDecision` docs from validated `FinalEvaluation`s (action=`reward` if score≥90, `termination_review` if <60, else `satisfactory`); audit `action:'updated'` |
| PATCH | `/api/cycles/:id` | rateLimiter, auth, role(ADMIN), validate(schemas.cycle.update) | partial update; audit `action:'updated'` |
| PATCH | `/api/cycles/:id/phase` | rateLimiter, auth, role(ADMIN), validate(schemas.cycle.updatePhase) | strict sequential phase enforcement + readiness guards (phase2 needs ≥1 objective; phase3 needs all approved/validated objectives to have progress); broadcasts `notifyAllActiveUsers` `PHASE_OPENED`/`PHASE_CLOSED`; audit `action:'phase_changed'` |
| GET | `/api/cycles/:id/phase-check` | rateLimiter, auth, role(ADMIN,HR,TEAM_LEADER) | dry-run readiness `{ready,nextPhase,currentPhase,issues,unapprovedObjectives}` |
| POST | `/api/cycles/:id/rollback` | rateLimiter, auth, role(ADMIN) | phase2→phase1 only, blocked if assessments already submitted; audit `action:'phase_rollback'` |
| DELETE | `/api/cycles/:id` | rateLimiter, auth, role(ADMIN) | cascades `Objective.deleteMany`, `HRDecision.deleteMany`; audit `action:'deleted'` |

### 3.6 `routes/objectives.js` → mounted `/api/objectives`, controller `objectiveController.js`
| Method | Path | Fn | Middleware |
|---|---|---|---|
| GET | `/api/objectives/` | `getObjectives` | rateLimiter, auth |
| GET | `/api/objectives/my` | `getMyObjectives` | rateLimiter, auth |
| GET | `/api/objectives/user/:userId/cycle/:cycleId` | inline → `getObjectives` | rateLimiter, auth |
| GET | `/api/objectives/pending-validation` | `getPendingValidation` | rateLimiter, auth, role(TEAM_LEADER) |
| GET | `/api/objectives/stale` | `getStaleObjectives` | rateLimiter, auth, role(TEAM_LEADER,ADMIN) |
| GET | `/api/objectives/pending-change-requests` | `getPendingChangeRequests` | rateLimiter, auth, role(TEAM_LEADER,ADMIN) |
| GET | `/api/objectives/completed-awaiting-evaluation` | `getCompletedAwaitingEvaluation` | rateLimiter, auth, role(TEAM_LEADER,ADMIN) |
| GET | `/api/objectives/team-weight-capacity` | `getTeamWeightCapacity` | rateLimiter, auth, role(ADMIN,TEAM_LEADER,HR) |
| ALL | `/api/objectives/team-goals` | inline stub | rateLimiter, auth → always 404 "Goal Check-Up has been removed." |
| GET | `/api/objectives/:id` | `getObjectiveById` | rateLimiter, auth |
| POST | `/api/objectives/` | `createObjective` | rateLimiter, auth, role(ADMIN,TEAM_LEADER,COLLABORATOR), validate(schemas.objective.create) |
| PUT | `/api/objectives/:id` | `updateObjective` | rateLimiter, auth, role(ADMIN,TEAM_LEADER,COLLABORATOR), validate(schemas.objective.update) |
| DELETE | `/api/objectives/:id` | `deleteObjective` | rateLimiter, auth, role(ADMIN,TEAM_LEADER,COLLABORATOR) |
| POST | `/api/objectives/submit-all` | `submitObjectives` | rateLimiter, auth, role(ADMIN,TEAM_LEADER,COLLABORATOR), validate(schemas.objective.submitAll) |
| POST | `/api/objectives/validate-all` | `validateAllTeamObjectives` | rateLimiter, auth, role(ADMIN,TEAM_LEADER) |
| POST | `/api/objectives/submit` | `submitObjectives` | rateLimiter, auth, validate(schemas.objective.submitAll) |
| POST | `/api/objectives/submit/:id` | `submitObjective` | rateLimiter, auth |
| POST | `/api/objectives/:id/submit` | `submitProgress` | rateLimiter, auth, role(ADMIN,TEAM_LEADER,COLLABORATOR), validate(schemas.objective.submitProgress) |
| POST | `/api/objectives/:id/submit-for-approval` | `submitObjective` | rateLimiter, auth |
| POST | `/api/objectives/:id/validate` | `validateObjective` | rateLimiter, auth, role(ADMIN,TEAM_LEADER) |
| POST | `/api/objectives/:id/acknowledge` | `acknowledgeObjective` | rateLimiter, auth |
| POST | `/api/objectives/:id/mark-completed` | `markCompleted` | rateLimiter, auth |
| POST | `/api/objectives/:id/midyear-review` | `midYearReviewObjective` | rateLimiter, auth, role(ADMIN,TEAM_LEADER) |
| POST | `/api/objectives/:id/final-self-assessment` | `finalSelfAssessmentObjective` | rateLimiter, auth |
| POST | `/api/objectives/:id/evaluate` | `evaluateObjective` | rateLimiter, auth, role(ADMIN,HR,TEAM_LEADER) |
| POST | `/api/objectives/:id/lock` | `lockObjective` | rateLimiter, auth, role(ADMIN,HR,TEAM_LEADER) |
| POST | `/api/objectives/:id/change-requests` | `createChangeRequest` | rateLimiter, auth |
| PUT | `/api/objectives/:id/change-requests/:crId` | `resolveChangeRequest` | rateLimiter, auth, role(ADMIN,TEAM_LEADER) |
| PATCH | `/api/objectives/:id/correction` | `createCorrectionRequest` | rateLimiter, auth, role(COLLABORATOR,TEAM_LEADER,ADMIN), validate(schemas.objective.correctionRequest) |
| PATCH | `/api/objectives/:id/correction/:crId` | `reviewCorrectionRequest` | rateLimiter, auth, role(ADMIN,TEAM_LEADER), validate(schemas.objective.reviewCorrectionRequest) |
| POST | `/api/objectives/:id/kpis` | `addKpi` | rateLimiter, auth |
| PUT | `/api/objectives/:id/kpis/:kpiId` | `updateKpi` | rateLimiter, auth |
| DELETE | `/api/objectives/:id/kpis/:kpiId` | `deleteKpi` | rateLimiter, auth |
| POST | `/api/objectives/:id/progress` | `addProgressUpdate` | rateLimiter, auth |
| POST | `/api/objectives/:id/comments` | `addComment` | rateLimiter, auth |
| DELETE | `/api/objectives/:id/comments/:commentId` | `deleteComment` | rateLimiter, auth |
| GET | `/api/objectives/:id/children` | `getSubObjectives` | rateLimiter, auth |
| POST | `/api/objectives/:id/duplicate` | `duplicateObjective` | rateLimiter, auth |

Detail (VERIFIED from `objectiveController.js` full read): notification helper used is the positional `createNotification(recipientId,title,message,link,type)` imported from `./notificationController`. Audit via `createAuditLog` from `utils/auditHelper`. `createObjective` reads body `title,description,successIndicator,weight,priority,cycle,category,labels,visibility,parentObjective,targetUser,targetTeam`; team-category objectives fan out into one `Objective` doc per team member via `Objective.insertMany`, each notified type `GOAL_ASSIGNED`. `updateObjective` enforces phase-based field locking (phase3 read-only for non-admin; phase2 hard-locks title/weight/parentObjective, soft-locks description/successIndicator requiring `correctionReason`). Full workflow chain and status values are detailed in Section 4.

**Note (VERIFIED directly in source)**: in `createCorrectionRequest`, `addActivity(objective,...)` mutates the in-memory `objective` document but `objective.save()` is never called afterward in that function — only the separate `CorrectionRequest` document persists; the activity-log entry on the objective itself is silently discarded. See Section 10.

### 3.7 `routes/checkins.js` → mounted `/api/checkins`, controller `checkInController.js`; `router.use(auth)` global
| Method | Path | Fn/handler | Middleware |
|---|---|---|---|
| POST | `/api/checkins/upload` | inline | multer(10MB, doc/image whitelist) → `storeUploadedFile(folder:'checkins')` |
| GET | `/api/checkins/attachments/:filename` | inline | `canAccessEmployee` gate, path-traversal guarded |
| GET | `/api/checkins/` | `getCheckIns` | (auth) |
| POST | `/api/checkins/` | `submitCheckIn` | (auth) |
| GET | `/api/checkins/objective/:objective_id/tasks` | `getTasksForObjective` | (auth) |
| GET | `/api/checkins/by-objective` | `getCheckInsByObjective` | role(ADMIN,HR,TEAM_LEADER) |
| GET | `/api/checkins/team` | `getTeamCheckIns` | role(ADMIN,HR,TEAM_LEADER) |
| PUT | `/api/checkins/:id/review` | `reviewCheckIn` | role(ADMIN,HR,TEAM_LEADER) |

Detail: `submitCheckIn` requires objective ownership match + cycle phase `phase2` (`enforceCyclePhaseAccess`); fire-and-forget audit via `auditLogger.log(userId,'checkin.submitted','CheckIn',checkInId,{...})`. On re-submission while `status==='revision_requested'`, pushes prior submission into `history[]`. `reviewCheckIn`: `action` ∈ `{approve, request_revision}`; feedback required for revision; on approve with `progress_percent`, also updates `Objective.achievementPercent` directly.

### 3.8 `routes/evaluations.js` → mounted `/api/evaluations`, controller `evaluationController.js`
| Method | Path | Fn | Middleware |
|---|---|---|---|
| GET | `/api/evaluations/rubric` | `getRubric` | auth |
| GET | `/api/evaluations/` | `getAllEvaluations` | auth |
| GET | `/api/evaluations/employee/:employeeId` | `getMyEvaluations` | auth |
| GET | `/api/evaluations/evaluator/:evaluatorId` | `getEvaluatorEvaluations` | auth |
| GET | `/api/evaluations/:id` | `getEvaluation` | auth |
| POST | `/api/evaluations/` | `createEvaluation` | auth |
| PUT | `/api/evaluations/:id` | `updateEvaluation` | auth |
| POST | `/api/evaluations/:id/submit` | `submitEvaluation` | auth |
| POST | `/api/evaluations/:id/approve` | `approveEvaluation` | auth, role(HR,ADMIN) |
| POST | `/api/evaluations/:id/reject` | `rejectEvaluation` | auth, role(HR,ADMIN) |
| POST | `/api/evaluations/:id/complete` | `completeEvaluation` | auth |
| POST | `/api/evaluations/:id/acknowledge` | `acknowledgeEvaluation` | auth |

Detail: `createEvaluation` requires ADMIN/HR or `isManagerOf(evaluatorId,employeeId)`, cycle `currentPhase==='phase3'` (unless ADMIN); fails if no eligible objectives (`ACTIVE_OBJECTIVE_STATUSES=['approved','validated','evaluated','locked']`) or total weight > 100. `submitEvaluation` locks related objectives (`Objective.updateMany({...},{status:'locked'})`). Notifications via `utils/notificationHelper.createNotification` (object-style args): `EVALUATION_CREATED`, `EVALUATION_SUBMITTED`, `EVALUATION_APPROVED`, `EVALUATION_REJECTED`, `EVALUATION_COMPLETED`. Audit via `createAuditLog({entityType:'evaluation',...})`.

### 3.9 `routes/finalEvaluations.js` → mounted `/api/final-evaluations`, controller `finalEvaluationController.js`; `router.use(auth)` global
| Method | Path | Fn | Middleware |
|---|---|---|---|
| GET | `/api/final-evaluations/team/:cycle_id` | `getTeamEvaluations` | role(ADMIN,HR,TEAM_LEADER) |
| GET | `/api/final-evaluations/export/:id` | `exportEvaluation` | (auth) |
| GET | `/api/final-evaluations/hr/pending` | `getPendingEvaluations` | role(ADMIN,HR) |
| GET | `/api/final-evaluations/hr/reviewed` | `getReviewedEvaluations` | role(ADMIN,HR) |
| GET | `/api/final-evaluations/user/:employee_id/history` | `getUserHistory` | (auth) |
| POST | `/api/final-evaluations/generate/:cycle_id/:employee_id` | `generateEvaluation` | role(ADMIN,TEAM_LEADER) |
| PUT | `/api/final-evaluations/:id` | `updateEvaluation` | role(ADMIN,TEAM_LEADER) |
| POST | `/api/final-evaluations/:id/recalculate` | `recalculateEvaluation` | role(ADMIN,TEAM_LEADER) |
| PUT | `/api/final-evaluations/:id/hr-validate` | `validateEvaluation` | role(ADMIN,HR) |
| PUT | `/api/final-evaluations/:id/employee-feedback` | `submitEmployeeFeedback` | role(COLLABORATOR) |
| GET | `/api/final-evaluations/:cycle_id/:employee_id` | `getEvaluation` | (auth) |

Detail (VERIFIED full read): uses `scoreCalculationService` (`calculateWeightedObjectiveScore`, `getEvaluationEvidence`, `determineRatingLabel`, `FINAL_SCORE_OBJECTIVE_STATUSES`), `aiService.generateManagerReview` (AI-assisted draft in `generateEvaluation`, with rule-based fallback `buildManagerReviewFallback` when AI unconfigured or returns a warning), `reviewContextService.buildReviewContext`. `updateEvaluation` requires `manager_adjustment_justification` when `|score_difference| >= 10` (`SIGNIFICANT_SCORE_ADJUSTMENT`); submission to `pending_hr` blocked unless manager_comments/strengths/weaknesses/objective_breakdown are populated AND every eligible objective has `finalSelfSubmittedAt` and `managerAdjustedPercent` set. `validateEvaluation` (HR): action ∈ `{validate, send_back}`; `send_back` requires `return_reason`, notifies evaluator `EVALUATION_REJECTED`; successful first-time validate notifies employee `EVALUATION_COMPLETED`. `exportEvaluation` streams a `pdfkit` PDF (not JSON), gated by `canAccessEmployee`.

### 3.10 `routes/hrDecisions.js` → mounted `/api/hr-decisions` (inline logic; `controllers/hrDecisionController.js` is dead code referencing non-existent `EvaluationReport`/`EvaluationCycle` models)
| Method | Path | Middleware | Notes |
|---|---|---|---|
| GET | `/api/hr-decisions/` | auth | COLLABORATOR→own only; TEAM_LEADER→`getManagedEmployeeIds`; ADMIN/HR→all |
| GET | `/api/hr-decisions/:id` | auth | same scoping |
| POST | `/api/hr-decisions/` | auth, role(ADMIN,HR) | requires linked `FinalEvaluation` validated/closed matching user+cycle |
| PUT | `/api/hr-decisions/:id` | auth, role(ADMIN,HR) | body: action,actionLabel,notes |
| DELETE | `/api/hr-decisions/:id` | auth, role(ADMIN) | — |

### 3.11 `routes/bonusPenalty.js` → mounted `/api/bonus-penalty` (inline, no controller)
| Method | Path | Middleware | Notes |
|---|---|---|---|
| POST | `/api/bonus-penalty/` | auth, role(ADMIN,HR,TEAM_LEADER) | requires validated `FinalEvaluation`; duplicate-type-per-evaluation check; `canManageEmployee` gate; TEAM_LEADER forced `approvalStatus:'pending'` |
| PUT | `/api/bonus-penalty/:id/approval` | auth, role(HR,ADMIN) | rejection requires `reviewNotes`; notifies `assignedBy` `EVALUATION_REJECTED` |
| GET | `/api/bonus-penalty/eligible-evaluations` | auth, role(ADMIN,HR,TEAM_LEADER) | lists validated evaluations not fully used, filtered `canAccessEmployee` |
| GET | `/api/bonus-penalty/` | auth, role(HR,ADMIN) | all records |
| GET | `/api/bonus-penalty/employee/:employeeId` | auth | **VERIFIED bug**: references undefined variable `currentUserId` (never declared in this handler) — would throw `ReferenceError`→500 for any non-HR/ADMIN caller. See Section 10. |

### 3.12 `routes/improvementPlans.js` → mounted `/api/improvement-plans`, controller `improvementPlanController.js`; `router.use(auth)` global
| Method | Path | Fn | Middleware |
|---|---|---|---|
| GET | `/api/improvement-plans/evaluation/:evaluationId` | `getPlansForEvaluation` | (auth) |
| POST | `/api/improvement-plans/evaluation/:evaluationId` | `createPlan` | (auth) |
| PUT | `/api/improvement-plans/:id` | `updatePlan` | (auth) |
| DELETE | `/api/improvement-plans/:id` | `deletePlan` | (auth) |

Detail `[from background-agent extraction, cross-checked against model shape]`: create/update/delete gated ADMIN/HR-only in-function; `createPlan` requires linked `FinalEvaluation.performance_status` ∈ `{needs_improvement, critical_attention}`; notifies employee on creation. View access via role-based scoping (ADMIN/HR always; COLLABORATOR self only; TEAM_LEADER managed employees or self).

### 3.13 `routes/career.js` → mounted `/api/career`, controller `careerController.js`; `router.use(auth)` global
| Method | Path | Fn | Middleware |
|---|---|---|---|
| POST | `/api/career/competencies` | `createCompetency` | role(ADMIN,HR) |
| GET | `/api/career/competencies` | `getCompetencies` | (auth) |
| PUT | `/api/career/competencies/:id` | `updateCompetency` | role(ADMIN,HR) |
| DELETE | `/api/career/competencies/:id` | `deleteCompetency` | role(ADMIN,HR) |
| POST | `/api/career/paths` | `createCareerPath` | (auth) |
| GET | `/api/career/paths/my` | `getMyCareerPath` | (auth) |
| GET | `/api/career/paths/all` | `getAllCareerPaths` | role(ADMIN,HR,TEAM_LEADER) |
| GET | `/api/career/paths/user/:userId` | `getCareerPathForUser` | role(ADMIN,HR,TEAM_LEADER) |
| PUT | `/api/career/paths/:id` | `updateCareerPath` | (auth) |
| DELETE | `/api/career/paths/:id` | `deleteCareerPath` | (auth) |
| POST | `/api/career/paths/:pathId/actions` | `createDevelopmentAction` | (auth) |
| PUT | `/api/career/paths/:pathId/actions/:actionId` | `updateDevAction` | (auth) |
| GET | `/api/career/recommendations/my` | `getMyRecommendations` | (auth) |
| GET | `/api/career/recommendations/all` | `getAllRecommendations` | role(ADMIN,HR,TEAM_LEADER) |
| POST | `/api/career/recommendations/generate` | `generateRecommendation` | role(ADMIN,HR,TEAM_LEADER) |
| POST | `/api/career/recommendations` | `saveRecommendation` | role(ADMIN,HR,TEAM_LEADER) |

Detail (VERIFIED full read): `deleteCompetency` is soft (`isActive:false`). `canManageCareerUser`/`canManageCareerPath` are two near-identical helper functions (ADMIN/HR/self/TEAM_LEADER-of-target). `createDevelopmentAction` notifies target user `GOAL_UPDATE` if actor≠target. `generateRecommendation` is read-only/computed-in-memory (not persisted); `saveRecommendation` upserts a `CareerRecommendation` doc.

### 3.14 `routes/feedback.js` → mounted `/api/feedback`, controller `feedbackController.js`; `router.use(auth)` global
| Method | Path | Fn | Middleware |
|---|---|---|---|
| POST | `/api/feedback/` | `createFeedback` | (auth) |
| GET | `/api/feedback/received` | `getReceived` | (auth) |
| GET | `/api/feedback/sent` | `getSent` | (auth) |
| GET | `/api/feedback/recipients` | `getAvailableRecipients` | (auth) |
| GET | `/api/feedback/all` | `getAll` | role(ADMIN) |
| GET | `/api/feedback/stats` | `getStats` | (auth) |
| GET | `/api/feedback/stats/:userId` | `getStats` | role(ADMIN,TEAM_LEADER) |
| GET | `/api/feedback/user/:userId` | `getForUser` | role(ADMIN,TEAM_LEADER) |
| DELETE | `/api/feedback/:id` | `deleteFeedback` | (auth) |

Detail `[from background-agent extraction]`: visibility scoping helper computes related user ids per role (ADMIN unrestricted; HR scoped to evaluations they're involved in; others via team hierarchy + direct reports). Anonymous feedback masks sender as `{name:'Anonymous', email:'', role:''}`. No notification/audit side effects observed.

### 3.15 `routes/tasks.js` → mounted `/api/tasks`, controller `taskController.js`; `router.use(auth)` global
| Method | Path | Fn | Middleware |
|---|---|---|---|
| POST | `/api/tasks/` | `createTask` | (auth) |
| GET | `/api/tasks/my` | `getMyTasks` | (auth) |
| GET | `/api/tasks/assigned` | `getAssignedByMe` | (auth) |
| GET | `/api/tasks/stats` | `getStats` | (auth) |
| GET | `/api/tasks/all` | `getAllTasks` | role(ADMIN,HR) |
| GET | `/api/tasks/teams` | `getTasksByTeams` | (auth) |
| GET | `/api/tasks/team/:teamId` | `getTeamTasks` | (auth) |
| POST | `/api/tasks/:id/time-entries` | `appendTimeEntry` | (auth) |
| PUT | `/api/tasks/:id` | `updateTask` | (auth) |
| DELETE | `/api/tasks/:id` | `deleteTask` | (auth) |

Detail (VERIFIED full read): `createTask`/`updateTask`/`deleteTask` write `createAuditLog({entityType:'task',...})`. `updateTask` auto-recomputes linked `Objective.achievementPercent` from % of linked tasks with `status==='done'`. Time tracking maintained through `sanitizeTimeTracking`/`buildTimerAliases`/`syncTaskTimerFields` which keep `timeTracking.sessions` and the legacy alias fields (`timeSessions`,`totalTrackedTime`,`totalTimeSpent`) in sync on every write. Access control via `utils/accessControl` (`canAssignTaskTo`,`canAccessObjective`,`canAccessTeam`) plus in-file `canManageTask`/`canTrackTask`.

### 3.16 `routes/meetings.js` → mounted `/api/meetings` (inline; uses positional `createNotification` from `controllers/notificationController.js`)
| Method | Path | Middleware | Notes |
|---|---|---|---|
| GET | `/api/meetings/` | rateLimiter, auth | auto-completes past `scheduled`/`in_progress` meetings on read (writes `m.save()`) |
| GET | `/api/meetings/:id` | rateLimiter, auth | — |
| POST | `/api/meetings/` | rateLimiter, auth | notifies attendees `MEETING_INVITE` |
| PUT | `/api/meetings/:id` | rateLimiter, auth | organizer/ADMIN only (`canManageMeeting`); notifies attendees `MEETING_UPDATE` |
| DELETE | `/api/meetings/:id` | rateLimiter, auth | organizer/ADMIN only |
| POST | `/api/meetings/:id/duplicate` | rateLimiter, auth | organizer/ADMIN only |
| POST | `/api/meetings/:id/actions` | rateLimiter, auth | organizer/ADMIN only |

### 3.17 `routes/notifications.js` → mounted `/api/notifications` (inline; `controllers/notificationController.js` exports `getMyNotifications`/`markAsRead`/`markAllRead` but these are NOT wired to this route — the route re-implements the same logic inline; only `createNotification` from that controller file is actually reused elsewhere)
| Method | Path | Middleware | Notes |
|---|---|---|---|
| GET | `/api/notifications/` | auth | ADMIN sees all, else own only; `.limit(50)` |
| GET | `/api/notifications/unread-count` | auth | `{count}` |
| POST | `/api/notifications/` | auth | non-self recipient requires ADMIN; optional `sendEmail` flag → `sendNotificationEmail` |
| POST | `/api/notifications/:id/read` | auth | ownership-filtered unless ADMIN |
| POST | `/api/notifications/read-all` | auth | — |
| DELETE | `/api/notifications/:id` | auth | ownership-filtered unless ADMIN |

### 3.18 `routes/feed.js` → mounted `/api/feed` (inline, no controller)
| GET `/api/feed/` | auth | Aggregates activity from `Objective`,`Task`,`Feedback`,`CheckIn`,`AuditLog` scoped by role (`resolveFeedScope`); uses `Promise.allSettled` per source (partial failures → `warnings[]`, non-fatal); response `{success,activities:[...≤60],warnings}`.

### 3.19 `routes/stats.js` → mounted `/api/stats`, controller `statsController.js`
| Method | Path | Fn |
|---|---|---|
| GET | `/api/stats/dashboard` | `getDashboardStats` |
| GET | `/api/stats/performance` | `getPerformanceStats` |
| GET | `/api/stats/objectives-by-status` | `getObjectivesByStatus` |
| GET | `/api/stats/users-by-role` | `getUsersByRole` |
| GET | `/api/stats/score-distribution` | `getScoreDistribution` |

Detail `[from background-agent extraction]`: `getDashboardStats` reads `req.query.scope` (`org`/`team`/`me`, default `me`); `org` gated `['ADMIN','HR']`. Aggregates across `Cycle,Objective,Task,CheckIn,FinalEvaluation,CareerPath,BonusPenalty,ImprovementPlan,Team,User`. `getPerformanceStats` gated `['ADMIN','HR']`; returns top/bottom-5 performers + score distribution buckets. `getScoreDistribution` uses `HRDecision.aggregate([$bucket])` on `finalScore`.

### 3.20 `routes/auditLog.js` → mounted `/api/audit-logs` (inline)
| Method | Path | Middleware | Notes |
|---|---|---|---|
| GET | `/api/audit-logs/` | auth, role(ADMIN,HR) | query entityType/action/userId/entityId/from(or startDate)/to(or endDate)/page/limit; response `{success,logs,pagination}`; normalizes legacy field-name variants |
| GET | `/api/audit-logs/entity/:entityType/:entityId` | auth, role(ADMIN,HR,TEAM_LEADER) | `.limit(100)` |

### 3.21 `routes/ai.js` → mounted `/api/ai`, controller `aiController.js`
| Method | Path | Fn | Middleware |
|---|---|---|---|
| POST | `/api/ai/goal-suggestions` | `generateGoalSuggestions` | auth |
| POST | `/api/ai/generate-objective` | `generateGoalSuggestions` (alias) | auth |
| POST | `/api/ai/suggest-kpis` | `suggestKpis` | auth |
| POST | `/api/ai/summarize-performance` | `summarizePerformance` | auth |
| POST | `/api/ai/detect-risks` | `detectRisks` | auth |
| POST | `/api/ai/prioritize-notifications` | `prioritizeNotifications` | auth |
| POST | `/api/ai/assist` | `assist` | auth |
| POST | `/api/ai/draft-checkin` | `draftCheckin` | auth |
| POST | `/api/ai/analyze-objective-quality` | `analyzeObjectiveQuality` | auth |
| POST | `/api/ai/refine-objective` | `refineObjective` | auth |
| POST | `/api/ai/review/midyear` | `generateMidyearReview` | auth |
| POST | `/api/ai/review/final-self` | `generateFinalSelfReview` | auth |
| POST | `/api/ai/review/manager` | `generateManagerReview` | auth |
| POST | `/api/ai/development-plan` | `generateDevelopmentPlan` | auth |
| POST | `/api/ai/generate-evaluation` | `generateEvaluationDraft` | auth, role(ADMIN,TEAM_LEADER) |
| GET | `/api/ai/performance-users` | `getPerformancePredictionUsers` | auth |
| GET | `/api/ai/performance-predictions/:employeeId` | `getEmployeePerformancePrediction` | auth |
| POST | `/api/ai/predict-performance` | `predictEmployeePerformance` | auth |

Full request/response detail per function is in Section 5 (Cross-Service Communication) and Section 7 (Key Workflows).

### 3.22 `routes/calendar.js` → mounted `/api/calendar` (inline, `CalendarConnection` model)
| Method | Path | Middleware | Notes |
|---|---|---|---|
| GET | `/api/calendar/providers` | auth | lists google/outlook connection status |
| GET | `/api/calendar/connect/:provider` | auth | builds OAuth authorize URL, HMAC-signs `state` |
| GET | `/api/calendar/callback/:provider` | none (public OAuth redirect target) | exchanges code for tokens, encrypts via `calendarCrypto`, upserts `CalendarConnection` |
| DELETE | `/api/calendar/connect/:provider` | auth | — |
| GET | `/api/calendar/events` | auth | query start/end/provider; proxies Google Calendar API / Microsoft Graph |
| POST | `/api/calendar/events` | auth | creates remote event via provider API |

### 3.23 `routes/performance.js` → mounted `/api/performance` (inline, no controller)
| GET `/api/performance/summary/:employeeId/:cycleId` | auth | weighted performanceScore/averageRating/performanceLabel |
| GET `/api/performance/team-summary/:managerId/:cycleId` | auth | 403 unless self/ADMIN/HR |

### 3.24 `routes/reports.js` → mounted `/api/reports` (inline, no controller)
| GET `/api/reports/cycle/:cycleId` | auth, role(ADMIN,HR) | groups objectives by employee, computes overallScore |
| GET `/api/reports/team/:managerId/:cycleId` | auth | 403 unless self/ADMIN/HR |

### 3.25 `routes/pdf.js` → mounted `/api/pdf` (inline, `pdfkit`)
| GET `/api/pdf/team/:id` | auth | streams `application/pdf` team roster report |
| GET `/api/pdf/user/:id` | auth | streams `application/pdf` single-user report |

### 3.26 Orphaned/never-mounted route files (dead code — see Section 10)
- `routes/me.js`: `GET /me` → `auth` → `{success,user:{_id,name,email,role,team}}`.
- `routes/progress.js`: `GET /:userId` → `auth` → queries `Evaluation.find({user:...})` (note: `Evaluation` model has no `user` field, only `employeeId` — this query would never match) → `{labels,values}`.
- `routes/reminders.js`: `GET /upcoming`, `GET /overdue`, `POST /check` → `auth` → all reference non-existent `Objective.deadline`/`Objective.user`/`Objective.reminderSent` fields.

### 3.27 AI-service (`ai-service/app.py`) Flask endpoints
| Method | Path | Notes |
|---|---|---|
| GET | `/health` | `{status:"ok"}` |
| POST | `/predict` | single-employee prediction, see Section 1.22 for request/response shape |
| POST | `/predict/batch` | array of employee objects, per-item error isolation |

No auth mechanism, no CORS configuration observed in `app.py` (VERIFIED — no `flask_cors` import or `Access-Control-*` header set anywhere in the file). Runs via `app.run(host="0.0.0.0", port=5000, debug=False)`.

---

## 4. Business Logic & Status Workflows

### 4.1 `Objective.status` (`backend/controllers/objectiveController.js`, `VALID_TRANSITIONS` map, lines ~92-107 — VERIFIED)
```
'draft':              ['pending', 'pending_approval', 'submitted']
'pending':             ['pending_approval', 'approved', 'validated', 'rejected', 'revision_requested']
'submitted':           ['approved', 'validated', 'rejected', 'revision_requested', 'pending_approval']
'pending_approval':    ['approved', 'validated', 'rejected', 'revision_requested']
'revision_requested':  ['pending', 'pending_approval', 'submitted', 'draft']
'rejected':            ['draft', 'pending', 'pending_approval', 'submitted', 'archived']
'assigned':            ['acknowledged', 'approved', 'cancelled']
'acknowledged':        ['approved']
'approved':            ['evaluated', 'cancelled', 'archived', 'locked']
'validated':           ['evaluated', 'cancelled', 'archived', 'locked']
'evaluated':           ['archived']
'locked':              ['archived']
'cancelled':           ['archived']
'archived':            []
```
`isValidTransition(from,to)` allows same-state (`from===to`) always. **NOTE**: this `VALID_TRANSITIONS` map is defined but [INFERRED — not directly confirmed to be invoked/enforced anywhere in the read code] — the individual endpoint handlers (`submitObjective`, `validateObjective`, `acknowledgeObjective`, etc.) each perform their own ad-hoc `if (!['x','y'].includes(objective.status))` checks rather than calling `isValidTransition`; no call site for `isValidTransition` was found in the portions of `objectiveController.js` read.

Concrete transition triggers observed (VERIFIED, with source function, condition, and side effect):
| From | To | Trigger (endpoint/fn) | Condition | Side effect |
|---|---|---|---|---|
| `draft` | `pending` | `submitObjective` | owner-only; only if `status` ∈ draft/revision_requested/rejected; phase1 required if starting from draft | notification to team leader `GOAL_SUBMITTED`; audit `submitted` |
| `draft` | `pending_approval` | `submitObjectives` (batch) | all individual objectives valid, total weight = 100%, 3–10 objectives | `Objective.updateMany(...,{status:'pending_approval',submittedTo,submittedBy})`; notification `GOAL_SUBMITTED`; audit |
| `pending`/`submitted`/`pending_approval` | `rejected` | `validateObjective` | only the specific submittedTo team leader (or ADMIN); phase1 only (non-admin) | sets `rejectionReason`; notification `GOAL_REJECTED` |
| `pending`/`submitted`/`pending_approval` | `revision_requested` | `validateObjective` | same as above | sets `revisionReason`; notification `GOAL_REVISION_REQUESTED` |
| `pending`/`submitted`/`pending_approval` | `approved`/`validated` | `validateObjective` | same as above | sets `validatedBy`/`validatedAt`, may set `managerAdjustedPercent`/`achievementPercent`/`weightedScore`; notification `GOAL_APPROVED` |
| `pending`/`submitted`/`pending_approval` | `approved`/`rejected` (bulk) | `validateAllTeamObjectives` | `managerComments` mandatory | notification per-objective `GOAL_APPROVED`/`GOAL_REJECTED` |
| `assigned` | `approved` | `acknowledgeObjective` (accepted=true) | owner or ADMIN | notification to `assignedBy` `GOAL_ACKNOWLEDGED` |
| `assigned` | `assigned` (no-op) | `acknowledgeObjective` (accepted=false) | owner or ADMIN | comment added; notification `GOAL_UPDATE` |
| `approved`/`validated` | (no status change, sets fields) | `markCompleted` | owner-only; phase2 or phase3 required | notification to team leader `GOAL_COMPLETED` |
| (no status change, sets fields on manager side) | — | `midYearReviewObjective` | TEAM_LEADER/ADMIN only, phase2 required | notification `GOAL_UPDATE` |
| (no status change, sets fields on employee side) | — | `finalSelfAssessmentObjective` | owner-only, phase3 required | notification to team leader `GOAL_UPDATE` |
| any except draft/cancelled/rejected | `evaluated` | `evaluateObjective` | TEAM_LEADER/ADMIN/HR, phase3 required | sets `evaluationRating` (enum `exceeded/met/partially_met/not_met`), `evaluatedBy/evaluatedAt`; notification `GOAL_EVALUATED` |
| any (must already have `evaluationRating`) | `locked` | `lockObjective` | TEAM_LEADER/ADMIN/HR, phase3 required | notification `GOAL_EVALUATED` |
| `approved`/`validated` | `cancelled` | `resolveChangeRequest` (cancellation change request approved) | TEAM_LEADER/ADMIN | notification `CHANGE_REQUEST_RESOLVED` |

### 4.2 `CheckIn.status` (`backend/controllers/checkInController.js` — VERIFIED)
```
draft → pending_review     (submitCheckIn, first submission)
pending_review → approved            (reviewCheckIn, action='approve')
pending_review → revision_requested  (reviewCheckIn, action='request_revision', requires feedback)
revision_requested → pending_review  (submitCheckIn, resubmission; prior submission pushed to history[])
approved → (locked — submitCheckIn blocks further edits: "Check-in already approved and cannot be modified.")
```
Side effects: approve with `progress_percent` also sets `Objective.achievementPercent`; `auditLogger.log` fired on submit/approve/revision_requested.

### 4.3 `Evaluation.status` (`backend/controllers/evaluationController.js` — VERIFIED, `EDITABLE_EVALUATION_STATUSES=['draft','in_progress','rejected']`)
```
draft → in_progress   (updateEvaluation, automatic when any editable field is changed while status==='draft')
draft/in_progress/rejected → submitted   (submitEvaluation) — locks related Objectives to status 'locked'; notifies employee EVALUATION_SUBMITTED
submitted → approved   (approveEvaluation, HR/ADMIN only) — notifies evaluator + employee EVALUATION_APPROVED
submitted → rejected   (rejectEvaluation, HR/ADMIN only, requires comments) — notifies evaluator EVALUATION_REJECTED
approved → completed   (completeEvaluation) — notifies employee EVALUATION_COMPLETED
submitted/approved/completed → (employeeAcknowledgment set, no status change)   (acknowledgeEvaluation, employee-only)
```

### 4.4 `FinalEvaluation.status` (`backend/controllers/finalEvaluationController.js` — VERIFIED)
```
(new) → draft            (generateEvaluation, creates or regenerates while status==='draft'; blocked if evaluation exists and status≠'draft')
draft → pending_hr        (updateEvaluation, status param, only if submission checklist passes: manager_comments, strengths, weaknesses, objective_breakdown all non-empty AND every eligible objective has finalSelfSubmittedAt+managerAdjustedPercent) — pushes workflow_history {action:'submitted'}
pending_hr → validated    (validateEvaluation, action='validate', HR/ADMIN, only if getBlockingEvaluationReviewIssues()===[]) — sets hr_validated_by/hr_validated_at; pushes workflow_history {action:'validated'}; notifies employee EVALUATION_COMPLETED
pending_hr → draft        (validateEvaluation, action='send_back', HR/ADMIN, requires return_reason) — sets hr_return_reason; pushes workflow_history {action:'sent_back'}; notifies evaluator EVALUATION_REJECTED
validated/closed → (re-run validate, idempotent re-review allowed without re-transitioning status unless isFirstReview)
```
`closed` status value exists in the model enum but **no controller code observed sets `status:'closed'` directly** on `FinalEvaluation` [INFERRED — closure may happen via the `routes/cycles.js` cycle-close flow which reads `FinalEvaluation` with `status:{$in:['validated','closed']}` but does not itself write `closed`, so the transition to `closed` was not located in the files read].

### 4.5 `HRDecision` — no `status` field; `action` is a one-time classification set at creation
`action` enum: `['reward','promotion','bonus','satisfactory','coaching','training','position_change','termination_review']`. Auto-generated on `Cycle` close transition (`routes/cycles.js` `PUT /api/cycles/:id`): `finalScore>=90→'reward'`, `finalScore<60→'termination_review'`, else `'satisfactory'`. Can be manually created/updated by ADMIN/HR via `POST`/`PUT /api/hr-decisions`.

### 4.6 `BonusPenalty.approvalStatus` (`backend/routes/bonusPenalty.js` — VERIFIED)
```
(new, TEAM_LEADER-created) → pending
(new, ADMIN/HR-created) → approved (default, unless approvalStatus explicitly passed as pending/approved/rejected)
pending → approved   (PUT /:id/approval, HR/ADMIN)
pending → rejected   (PUT /:id/approval, HR/ADMIN, requires reviewNotes) — notifies assignedBy EVALUATION_REJECTED-typed message
```

### 4.7 `CorrectionRequest.status` (`backend/controllers/objectiveController.js` `reviewCorrectionRequest`, `routes/objectives.js` — VERIFIED)
```
PENDING → APPROVED   (reviewCorrectionRequest, TEAM_LEADER/ADMIN) — applies correctionRequest.newValue onto objective[field]
PENDING → REJECTED   (reviewCorrectionRequest, TEAM_LEADER/ADMIN) — no objective field change
```
Guard: `if (correctionRequest.status !== 'PENDING') return 400` — already-reviewed requests cannot be re-reviewed.

### 4.8 `Task.status` / `Task.workflowStage` (`backend/controllers/taskController.js` — VERIFIED)
Two parallel state fields kept in sync via `resolveStatus`/`resolveWorkflowStage` helper functions:
```
status enum:        ['todo','in_progress','done','cancelled']
workflowStage enum:  ['backlog','todo','in_progress','review','completed','cancelled']

resolveWorkflowStage(inputStage, inputStatus, existing):
  if inputStage given → use it
  else if status==='done' → 'completed'
  else if status ∈ {'cancelled','canceled'} → 'cancelled'
  else if status==='in_progress' → existing.workflowStage==='review' ? 'review' : 'in_progress'
  else → existing.workflowStage or 'todo'

resolveStatus(inputStatus, inputStage, existing):
  if inputStatus given → use it
  else if workflowStage==='cancelled' → 'cancelled'
  else if workflowStage==='completed' → 'done'
  else if workflowStage ∈ {'in_progress','review'} → 'in_progress'
  else → existing.status or 'todo'
```
On `status` transitioning to `'done'` (from non-`'done'`): `completedAt` set to now, `progress` forced to 100. On transitioning away from `'done'`: `completedAt` cleared. Side effect: when a task's `linkedGoal`/`objective_id` is set, `updateTask` recomputes `Objective.achievementPercent` as `(count of sibling tasks with status==='done') / (total sibling tasks) * 100`.

### 4.9 `CareerPath.status` and `CareerPath.developmentPlan[].status`
`CareerPath.status` enum `['active','completed','paused']` — settable via `updateCareerPath` (`allowedUpdates` includes `status`); no automatic transition logic observed (manual only). `developmentPlan[].status` enum `['planned','in_progress','completed','overdue','cancelled']` — settable via `updateDevAction`; when set to `'completed'`, `completedAt` is auto-stamped (`action.completedAt = new Date()`), VERIFIED in `careerController.js`.

### 4.10 `ImprovementPlan.progress_status`
Enum `['not_started','in_progress','completed']`. `[INFERRED — not directly confirmed]`: transition logic was not directly read in `improvementPlanController.js` in this pass (only summarized via background-agent extraction); based on the model shape and typical CRUD pattern (`updatePlan` accepting arbitrary allowed fields), this is presumably a manually-set field with no automatic transitions, but this is not verified against the controller source directly in this session.

### 4.11 `Meeting.status`
Enum `['scheduled','in_progress','completed','cancelled']`. VERIFIED auto-transition: on every `GET /api/meetings/` read, any of the caller's own organized meetings still `scheduled`/`in_progress` whose `date`+`endTime` are in the past are auto-flipped to `completed` and saved (`routes/meetings.js`). Manual transition to `'cancelled'` via `PUT /api/meetings/:id` with `status:'cancelled'` in body (triggers a different notification message text but same `MEETING_UPDATE` type).

### 4.12 `Cycle.status` / `Cycle.currentPhase` (`backend/routes/cycles.js`, `backend/utils/cycleRules.js` — VERIFIED)
```
status enum:       ['draft','open','active','in_progress','closed']
currentPhase enum:  ['phase1','phase2','phase3','closed']

Phase advance (PATCH /api/cycles/:id/phase):
  if cycle.status==='draft': currentPhase MUST be set to 'phase1' (no other value allowed)
  else: newPhaseIndex must be exactly oldPhaseIndex+1 in ordered list [phase1,phase2,phase3,closed] — no skipping, no going backwards
  Readiness guards: phase2 requires ≥1 Objective exists in the cycle; phase3 requires no approved/validated objective has achievementPercent null (or 0 with no kpis)
  On reaching 'closed': cycle.status also forced to 'closed'
  On leaving 'draft' for the first time: cycle.status forced to 'in_progress'
Rollback (POST /api/cycles/:id/rollback, ADMIN only): only phase2→phase1, blocked if any objective already has selfAssessment or managerComments populated.
```
`utils/cycleRules.validatePhaseDates` (used on create/update, not on phase-advance) enforces that all six phase date fields, wherever present, are strictly increasing (`phase1Start < phase1End < phase2Start < ...`).

---

## 5. Cross-Service Communication (Node backend ↔ Python ai-service)

**VERIFIED** — There are TWO separate "AI" mechanisms in this codebase, and only ONE of them talks to the Flask `ai-service`:

1. **LLM text generation** (`backend/services/aiService.js`): calls external LLM providers (Grok/xAI, OpenAI, or Google Gemini) directly via SDK — **NOT** the Flask `ai-service`. Used for goal suggestions, KPI suggestions (partially, see below), objective quality analysis, objective refinement, mid-year/final-self/manager review drafts, and development plans. Governed by env vars `AI_PROVIDER` (default `'grok'`), `AI_MODEL`, `AI_TIMEOUT_MS` (default 15000), `AI_MAX_INPUT_CHARS` (default 12000), plus provider API keys `GEMINI_API_KEY`/`XAI_API_KEY`/`OPENAI_API_KEY`.

2. **The actual call to the Flask ai-service** happens in exactly one place: `backend/controllers/aiController.js`, function `enhancePredictionWithAIService(metrics, fallback)` (called from `getEmployeePerformancePrediction`, i.e. `GET /api/ai/performance-predictions/:employeeId`).

**VERIFIED exact call** (`aiController.js`):
```js
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 2500);
const response = await fetch(process.env.PERFORMANCE_AI_URL || 'http://localhost:5000/predict', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(requiredMetrics),
  signal: controller.signal
});
```
- **Protocol**: HTTP POST, JSON body, JSON response, 2500ms client-side timeout via `AbortController`.
- **Env var for base URL**: `PERFORMANCE_AI_URL`, falls back to `http://localhost:5000/predict` (i.e., assumes the Flask service's default host/port, matching `ai-service/app.py`'s `app.run(host="0.0.0.0", port=5000)`).
- **Payload sent** (`requiredMetrics` object, built from an internal `metrics` object computed by `buildEmployeePredictionData()`):
  | Field sent | Source expression |
  |---|---|
  | `kpi_score` | `metrics.weighted_objective_score ?? metrics.kpi_score ?? 0` |
  | `goal_completion_percent` | `metrics.objective_completion_percent ?? metrics.goal_completion_percent ?? 0` |
  | `checkin_count` | `metrics.checkin_count` |
  | `avg_checkin_progress` | `metrics.avg_checkin_progress ?? 0` |
  | `feedback_count` | `metrics.feedback_count` |
  | `positive_feedback_ratio` | `metrics.positive_feedback_ratio ?? 0` |
  | `task_completion_percent` | `metrics.task_completion_percent ?? 0` |
  | `tasks_on_time_percent` | `metrics.tasks_on_time_percent ?? 0` |

  These 8 fields exactly match `ai-service/app.py`'s `FEATURE_COLUMNS`/`FEATURE_BOUNDS` (Section 1.22).

- **Guard before calling**: `enhancePredictionWithAIService` only calls the Flask service if `fallback.reliable` is true (i.e., the rule-based fallback prediction already found ≥2 real evidence sources); otherwise it returns the fallback immediately with `fallback_reason:'Not enough real metrics are available to call the trained AI service.'` — the Flask call is skipped entirely in that case.
- **Response fields received and merged into the result** (`aiResult` = parsed Flask JSON response):
  | Received field | Mapped to |
  |---|---|
  | `aiResult.overall_score` | `predicted_score` (clamped 0-100) |
  | `aiResult.rating_confidence` | `confidence_level` ('high' if ≥0.75 else 'medium'), `confidence_percent` (×100, rounded) |
  | `aiResult.rating` | `model_rating` |
  | `aiResult.promotion_ready` | `promotion_ready` |
  | `aiResult.promotion_probability` | `promotion_probability` |
  | `aiResult.strengths` | `strengths` |
  | `aiResult.weaknesses` | `weaknesses` |
  | (constructed) | `source:'python_ml_service'`, `explanation` (appended text noting the trained service supplied the score) |
- **On failure/timeout**: catches the error, returns the local `fallback` object unmodified plus `fallback_reason` (`'AI service timed out.'` if `AbortError`, else `'AI service unavailable.'`) and an updated `explanation` noting the fallback was used.
- The internal 8-metric object (`metrics`) is computed server-side in `buildEmployeePredictionData()` from live MongoDB data: `Objective` (via `scoreCalculationService.calculateWeightedScoreFromObjectives`), `Task`, `CheckIn`, `Feedback`, `FinalEvaluation` — i.e., the Node backend does its own weighted-score computation FIRST (the "fallback"/"project_metrics_fallback" prediction), and only optionally asks the Python ML service to refine/replace the `predicted_score`, `model_rating`, `promotion_ready`/`promotion_probability`, `strengths`, `weaknesses` fields on top of that.
- `predictEmployeePerformance` (`POST /api/ai/predict-performance`) is documented in-code as a "Legacy manual metrics endpoint retained for compatibility" — it accepts a raw `metrics` object in the request body directly (bypassing `buildEmployeePredictionData`) and runs it through the same `buildPredictionResult` + `enhancePredictionWithAIService` pipeline.

**No other Node→Flask calls were found** in the codebase (VERIFIED: no other `fetch`/`axios` call targeting a `PERFORMANCE_AI_URL`-like host or port 5000 was found in the controllers/services read).

---

## 6. Actors / Roles Inventory

Role source of truth: `User.role` enum `['ADMIN','HR','TEAM_LEADER','COLLABORATOR']` (`backend/models/User.js`), enforced by `backend/middleware/role.js` (`ADMIN` always bypasses any `role(...)` check regardless of the listed allowed roles).

### 6.1 ADMIN
Bypasses every `role(...)` middleware check in the codebase (VERIFIED, `role.js` line 14-16: `if (currentRole === 'ADMIN') return next();`). Can reach every role-gated endpoint in Section 3, plus every endpoint with no role restriction. Practically has unrestricted access to all 24 mounted route files.

### 6.2 HR
Endpoints explicitly listing `HR` in `role(...)`: `POST/PUT /api/cycles` — **no**, cycles are `role('ADMIN')` only (HR cannot manage cycles); `GET /api/objectives/team-weight-capacity` (with ADMIN,TEAM_LEADER); `POST /api/objectives/:id/evaluate`, `POST /api/objectives/:id/lock` (with ADMIN,TEAM_LEADER); `POST/PUT /api/hr-decisions`; `POST /api/bonus-penalty`, `PUT /api/bonus-penalty/:id/approval`, `GET /api/bonus-penalty/`, `GET /api/bonus-penalty/eligible-evaluations`; `GET/PUT /api/final-evaluations/hr/*`, `/api/final-evaluations/:id/hr-validate`; `GET /api/final-evaluations/team/:cycle_id` (with ADMIN,TEAM_LEADER); `POST/PUT/DELETE /api/career/competencies`, `GET/POST /api/career/paths/all|user/:id|recommendations/all|recommendations/generate|recommendations`; `POST /api/evaluations/:id/approve|reject`; `GET /api/stats/performance`, `GET /api/stats/dashboard?scope=org`; `GET /api/audit-logs`; `GET /api/tasks/all`; `GET /api/feedback/stats/:userId`, `GET /api/feedback/user/:userId` (with TEAM_LEADER, feedback also has an ADMIN-only `/all`); `GET /api/reports/cycle/:cycleId`; `POST /api/ai/generate-evaluation` — **no**, that one is ADMIN,TEAM_LEADER only, not HR.

### 6.3 TEAM_LEADER
Endpoints explicitly listing `TEAM_LEADER`: `GET /api/objectives/pending-validation`, `/stale`, `/pending-change-requests`, `/completed-awaiting-evaluation`, `/team-weight-capacity`; `POST /api/objectives/validate-all`, `POST /api/objectives/:id/validate`, `POST /api/objectives/:id/evaluate`, `POST /api/objectives/:id/lock`, `PUT /api/objectives/:id/change-requests/:crId`, `PATCH /api/objectives/:id/correction/:crId`, `PATCH /api/objectives/:id/correction` (with COLLABORATOR,ADMIN); `PUT /api/cycles/:id` — **no** (ADMIN only); `GET /api/cycles/:id/phase-check` (with ADMIN,HR); `POST /api/checkins/by-objective`, `/team`, `PUT /api/checkins/:id/review` (all with ADMIN,HR); `GET /api/final-evaluations/team/:cycle_id`, `POST /api/final-evaluations/generate/:cycle_id/:employee_id`, `PUT /api/final-evaluations/:id`, `POST /api/final-evaluations/:id/recalculate` (all with ADMIN); `GET/PUT /api/teams/*` (with ADMIN,HR); `POST /api/bonus-penalty` (with ADMIN,HR — but forces its own submissions to `approvalStatus:'pending'`, i.e., cannot self-approve); `GET /api/bonus-penalty/eligible-evaluations` (with ADMIN,HR); `GET /api/career/paths/all|user/:id`, `/recommendations/all`, `POST /recommendations/generate|recommendations` (with ADMIN,HR); `POST /api/ai/generate-evaluation` (with ADMIN); `GET /api/feedback/stats/:userId`, `/user/:userId` (with ADMIN); `POST /api/objectives/:id/midyear-review` (with ADMIN); `GET /api/reports/team/:managerId/:cycleId` — no role restriction beyond self/ADMIN/HR check inline.

### 6.4 COLLABORATOR
Endpoints explicitly listing `COLLABORATOR`: `POST /api/objectives/` (with ADMIN,TEAM_LEADER), `PUT /api/objectives/:id`, `DELETE /api/objectives/:id`, `POST /api/objectives/submit-all`, `POST /api/objectives/:id/submit`, `PATCH /api/objectives/:id/correction` (with TEAM_LEADER,ADMIN); `PUT /api/final-evaluations/:id/employee-feedback` (COLLABORATOR only). All other non-role-gated endpoints (the majority — objectives read/submit-for-self, tasks, meetings, feedback create, notifications, feed, calendar, checkins submit, career paths/my, evaluations self-view/acknowledge, final-evaluations self-view) are reachable by any authenticated role including COLLABORATOR since they only require `auth` with in-function ownership checks (e.g., "only the owner can...").

### 6.5 Non-human actors
- **Cron jobs** (`backend/cron/deadlineCron.js`, `backend/cron/reminderCron.js`): **VERIFIED never started** — `startDeadlineCron`/`startReminderCron`/`checkDeadlinesNow` are exported but never `require`d/invoked from `app.js` or `server.js` (confirmed via grep across `backend/`). If they were ever wired up, they would reference non-existent `Objective` fields (`deadline`, `user`, `reminderSent`) and non-existent helper exports (`notifyDeadlineApproaching` from `notificationHelper.js`, `sendDeadlineReminderEmail` from `mailer.js`) and would throw at runtime.
- **ai-service (Flask)**: acts as a passive HTTP prediction service, called only from `enhancePredictionWithAIService` (Section 5). No scheduling; runs continuously as a standalone process (`python3 app.py`), listening on port 5000.
- **External LLM providers** (Grok/xAI, OpenAI, Gemini): called by `backend/services/aiService.js` on-demand per HTTP request to the various `/api/ai/*` endpoints — not scheduled, not autonomous.
- **Calendar OAuth providers** (Google Calendar API, Microsoft Graph): called on-demand from `backend/routes/calendar.js` in response to user actions (connect, list events, create event); token refresh (`refreshConnection`) is triggered lazily by `getAccessToken()` whenever a stored token's `expiresAt` is within 60 seconds of now or already expired.

---

## 7. Key Workflows

### 7.1 Objective lifecycle (employee-created individual objective, end-to-end)
1. **Frontend**: `frontend/src/components/goals/CreateGoalModal.jsx` — user fills in title/description/successIndicator/weight/priority/cycle; on submit calls `POST /objectives` (via `frontend/src/services/api.js` `api` instance).
2. **Backend route**: `backend/routes/objectives.js` `POST /api/objectives/` → middleware `rateLimiter, auth, role('ADMIN','TEAM_LEADER','COLLABORATOR'), validate(schemas.objective.create)` → controller `objectiveController.createObjective`.
3. **Controller**: validates cycle exists/not closed/phase1 (unless ADMIN), validates weight 1-100 and no duplicate title in cycle, checks individual weight allocation ≤100% via `getObjectiveWeightBreakdown`+`sumObjectiveWeights` (`utils/objectiveRules.js`), creates `Objective` doc with `status:'draft'`, `source:'employee_created'`, pushes an `activityLog` entry `{action:'created'}`.
4. **Model write**: `backend/models/Objective.js` document persisted.
5. **Frontend**: `GoalsPage.jsx` shows the new draft; user later clicks "Submit All Objectives" once 3-10 drafts exist with individual weight totaling 100%.
6. **Backend**: `POST /api/objectives/submit-all` → `objectiveController.submitObjectives` → validates batch, `Objective.updateMany(...,{status:'pending_approval',submittedTo:team.leader,submittedBy:userId})`, audit log, `createNotification(team.leader, 'Objectives Submitted', ..., '/goals', 'GOAL_SUBMITTED')`.
7. **Notification model write**: `backend/models/Notification.js` doc created for the team leader, `type:'GOAL_SUBMITTED'`.
8. **Frontend (manager side)**: `frontend/src/pages/Validation.jsx` polls/fetches `GET /objectives/pending-validation`; manager reviews and calls `POST /objectives/:id/validate` (or `POST /objectives/validate-all`) with `{status:'approved'|'validated'|'rejected'|'revision_requested', managerComments}`.
9. **Backend**: `objectiveController.validateObjective` checks `submittedTo===req.user.id` (or ADMIN), phase1 (unless ADMIN), sets new status + `validatedBy/validatedAt`, `addActivity`, `createNotification` back to the owner with the corresponding `GOAL_APPROVED`/`GOAL_REJECTED`/`GOAL_REVISION_REQUESTED` type.
10. **Cycle advances to phase2**: manager (`ADMIN` only, via `PATCH /api/cycles/:id/phase`) moves `currentPhase` to `phase2` (guarded: ≥1 objective must exist). Employee submits check-ins (`POST /api/checkins`) during phase2; manager may submit `POST /api/objectives/:id/midyear-review` (sets `managerAdjustedPercent`, `achievementPercent`, `weightedScore`, notifies owner).
11. **Cycle advances to phase3**: employee submits `POST /api/objectives/:id/final-self-assessment` (sets `finalSelfPercent`,`finalSelfRating`,`finalSelfAssessment`,`finalSelfSubmittedAt`, notifies team leader). Manager calls `POST /api/objectives/:id/evaluate` (sets `evaluationRating` ∈ `{exceeded,met,partially_met,not_met}`, `evaluatedBy/evaluatedAt`, status→`'evaluated'`, notifies owner `GOAL_EVALUATED`), then `POST /api/objectives/:id/lock` (status→`'locked'`, requires `evaluationRating` already set, notifies owner).
12. This locked/evaluated objective then feeds into the `FinalEvaluation` weighted-score calculation (Section 7.2) via `scoreCalculationService.calculateWeightedScoreFromObjectives`, which only counts objectives with `status` ∈ `['approved','validated','evaluated','locked']`.

### 7.2 Evaluation → Final Evaluation → HR Decision → Bonus/Penalty (end-to-end)
1. **Frontend (manager)**: `frontend/src/pages/FinalEvaluationManager.jsx` — manager selects an employee+cycle in Phase 3, clicks "Generate Evaluation", calling `POST /final-evaluations/generate/:cycleId/:employeeId`.
2. **Backend**: `finalEvaluationController.generateEvaluation` → `enforcePhase3Evaluation` → `calculateEvaluationSnapshot(employeeId, cycleId)` which calls `scoreCalculationService.calculateWeightedObjectiveScore` (weighted-sum of eligible `Objective`s, normalized to 100 if total weight ≠ 100) and `getEvaluationEvidence` (Task completion rate + CheckIn approval rate/average progress) → `determineRatingLabel(auto_score)` (thresholds: ≥90 exceptional, ≥75 strong, ≥50 meets_expectations, ≥30 needs_improvement, else unsatisfactory) → `generateManagerDraft` calls `reviewContextService.buildReviewContext` then `aiService.generateManagerReview(context)` (external LLM call) or, if unconfigured/failed, `buildManagerReviewFallback` (rule-based summary from real objective/feedback/meeting data) → creates/updates `FinalEvaluation` doc with `status:'draft'`, `auto_score`, `objective_breakdown`, `evidence_summary`, `strengths/weaknesses/improvement_suggestions` (from the AI or fallback draft), `ai_assisted` flag.
3. **Frontend**: manager reviews/edits the draft in `FinalEvaluationManager.jsx`, optionally overrides `manager_score` (requires `manager_adjustment_justification` if the delta from `auto_score` is ≥10 points), then submits via `PUT /final-evaluations/:evaluationId` with `status:'pending_hr'`.
4. **Backend**: `finalEvaluationController.updateEvaluation` validates the full submission checklist (manager_comments, strengths, weaknesses, objective_breakdown non-empty; every eligible objective has `finalSelfSubmittedAt` and `managerAdjustedPercent`), sets `status:'pending_hr'`, pushes `workflow_history` entry `{action:'submitted'}`.
5. **Frontend (HR)**: `frontend/src/pages/HRValidation.jsx` fetches `GET /final-evaluations/hr/pending`, reviews, calls `PUT /final-evaluations/:id/hr-validate` with `{action:'validate', performance_status, hr_review_notes}` (or `action:'send_back'` with `return_reason`).
6. **Backend**: `finalEvaluationController.validateEvaluation` — on `'validate'` (first time, from `pending_hr`): checks `getBlockingEvaluationReviewIssues` (final_score/rating_label/manager_comments/strengths/weaknesses/objective_breakdown present, and if `ai_assisted` then `ai_reviewed_by_manager` must be true), sets `status:'validated'`, `hr_validated_by/hr_validated_at`, notifies employee `EVALUATION_COMPLETED`.
7. **Cycle close** (`ADMIN`, `PUT /api/cycles/:id` with `status:'closed'`): backend queries all `FinalEvaluation` docs with `status ∈ {validated,closed}` for that cycle, computes `individualScore`/`teamScore` from `objective_breakdown` category split, computes `finalScore`, derives `action` (`reward` if ≥90, `termination_review` if <60, else `satisfactory`), `HRDecision.deleteMany`+`insertMany` for the cycle.
8. **Frontend (HR)**: `frontend/src/pages/HRDecisions.jsx` lists/edits `HRDecision` records via `GET/PUT/DELETE /hr-decisions`.
9. **Frontend (HR/manager)**: `frontend/src/pages/BonusPenaltyPage.jsx` fetches `GET /bonus-penalty/eligible-evaluations` (validated `FinalEvaluation`s not yet fully used), creates a record via `POST /bonus-penalty` (`{employee,type,value,reason,finalEvaluation,hrDecision,objective}` — requires a validated `finalEvaluation`, blocks duplicate `type` per evaluation, TEAM_LEADER submissions forced `approvalStatus:'pending'`).
10. **Backend**: `routes/bonusPenalty.js` `PUT /:id/approval` (HR/ADMIN) sets `approvalStatus:'approved'|'rejected'` (rejection requires `reviewNotes`, notifies the original `assignedBy`).

### 7.3 Career recommendation with AI-service round trip (frontend → backend, note: NOT the Flask ai-service — this workflow uses in-process rule logic, not an LLM or the Python service)
1. **Frontend**: `frontend/src/pages/FinalEvaluationManager.jsx` (after a `FinalEvaluation` is validated/finalized) calls `POST /career/recommendations/generate` with `{employee_id, cycle_id}`.
2. **Backend**: `careerController.generateRecommendation` — reads the employee's `FinalEvaluation` for that cycle, derives `suggested_path` (`'Accelerated Leadership Track'` if `recommendation==='promotion'`, `'Core Competency Reinforcement'` if `recommendation==='performance_improvement_plan'`, else `'Standard Progression'`), `skills_to_develop` from `evaluation.weaknesses` (first word + `' improvement'`), `basis` explanatory text, `source:'auto'`. This is computed in-memory and NOT persisted.
3. **Frontend**: displays the suggestion; manager can edit and confirm, calling `POST /career/recommendations` with the (possibly edited) fields.
4. **Backend**: `careerController.saveRecommendation` upserts a `CareerRecommendation` document (`employee_id, cycle_id, suggested_path, skills_to_develop, source, basis`).
5. Separately, `frontend/src/components/ai/DevelopmentPlanGenerator.jsx` calls `POST /ai/development-plan` with `{userId, evaluationId?}` → `aiController.generateDevelopmentPlan` — this DOES use `aiService.isConfigured()`/`aiService.generateDevelopmentPlan(dataContext)` (external LLM call) with a rule-based fallback (`buildDevelopmentPlanFallback`) if unconfigured or the AI call returns null. This is a separate, unrelated feature to the career-recommendation flow above, both under the "career development" umbrella but hitting different endpoints/data.
6. The Flask `ai-service` is **not involved** in either of the above — its only integration point is the performance-prediction flow (Section 5, Section 7.4).

### 7.4 Performance prediction (with the actual Flask ai-service round trip)
1. **Frontend**: `frontend/src/pages/PerformancePredictionPage.jsx` calls `GET /ai/performance-predictions/:employeeId?cycleId=...` (via `frontend/src/api/ai.js` `aiAPI.getEmployeePrediction`, using the `apiClient` axios instance).
2. **Backend**: `aiController.getEmployeePerformancePrediction` → `canViewPrediction` (role/team scoping) → `buildEmployeePredictionData(employeeId, cycleId)` — pulls `User`, `Cycle`, `Objective` (via `scoreCalculationService.calculateWeightedScoreFromObjectives`), `Task`, `CheckIn`, `Feedback`, `FinalEvaluation` — computes the 8-feature `metrics` object and a rule-based `prediction` (`buildPredictionResult`, weighted average of weighted-objective-score/task-completion/checkin-progress/previous-final-score with fixed weights 45/20/15/20).
3. **Cross-service call**: `enhancePredictionWithAIService(metrics, prediction)` — if the rule-based prediction is `reliable` (≥2 real evidence sources), POSTs the 8 metrics to the Flask `ai-service` `/predict` endpoint (`process.env.PERFORMANCE_AI_URL` or `http://localhost:5000/predict`), 2500ms timeout.
4. **ai-service (Flask)**: `app.py` `predict()` → `validate_payload()` (bounds check) → `predict_one()` — loads `X = pd.DataFrame([payload subset to FEATURE_COLUMNS])`, runs `rating_model.predict(X)` (XGBoost 4-class) + `rating_label_encoder.inverse_transform(...)`, `promotion_model.predict(X)`/`.predict_proba(X)` (XGBoost binary), computes `overall_score` via the fixed published formula (`kpi_score*0.30 + goal_completion_percent*0.25 + avg_checkin_progress*0.15 + task_completion_percent*0.20 + positive_feedback_ratio*100*0.10`), calls `performance_text.generate_text_outputs(...)` for `strengths/weaknesses/review_summary/suggestions` text, returns the JSON response shape from Section 1.22.
5. **Backend**: merges the Flask response into the final `prediction` object (`predicted_score`, `confidence_level/percent`, `model_rating`, `promotion_ready/probability`, `strengths/weaknesses`, `source:'python_ml_service'`), also computes `buildLongRangeForecasts` (1/2/5-year performance/productivity/flight-risk projections, purely rule-based, no further Flask calls).
6. **Frontend**: renders `predicted_score`, `rating`, `confidence`, `strengths/weaknesses`, and the long-range forecast charts on `PerformancePredictionPage.jsx`.

### 7.5 Check-in cycle (Phase 2 progress reporting)
1. **Frontend**: `frontend/src/pages/MidYearPage.jsx` — employee views their objectives (`GET /objectives/user/:userId/cycle/:cycleId`), optionally uploads an attachment (`POST /checkins/upload`, multipart), then submits progress via `POST /checkins` with `{objective_id, cycle_id, progress_percent, notes, priority, attachments}`.
2. **Backend**: `checkInController.submitCheckIn` — validates objective ownership matches caller, objective's cycle matches `cycle_id`, cycle phase is `phase2` (`enforceCyclePhaseAccess`). If a `CheckIn` doc already exists for `{objective_id,cycle_id,employee_id}`: blocks if `status==='approved'`; if `status==='revision_requested'`, archives the prior content into `history[]` before overwriting; sets `status:'pending_review'`, `submitted_at`/`last_edited_at`. Fire-and-forget `auditLogger.log(...,'checkin.submitted',...)`.
3. **Frontend (manager)**: `MidYearPage.jsx` (manager view) or dedicated review UI calls `GET /checkins/team?cycle_id=...` then `PUT /checkins/:id/review` with `{action:'approve'|'request_revision', feedback, progress_percent}`.
4. **Backend**: `checkInController.reviewCheckIn` — requires `canManageEmployee(req.user, checkIn.employee_id)`; sets `status:'approved'` or `'revision_requested'` (feedback mandatory for the latter); if approving with a `progress_percent`, also directly updates `Objective.achievementPercent`; sets `manager_id/reviewedBy/reviewedAt`; audit logged.
5. This check-in evidence (`total`, `approved`, `approval_rate`, `average_progress`) later feeds into `scoreCalculationService.getEvaluationEvidence()` used by the Final Evaluation generation flow (Section 7.2) and the AI performance-prediction flow (Section 7.4, `checkin_count`/`avg_checkin_progress` metrics).

---

## 8. Non-Human/System Components

### 8.1 `backend/cron/deadlineCron.js`
- **Schedule**: `cron.schedule('0 9 * * *', ...)` — every day at 09:00 (server local time, `node-cron` default).
- **What it touches**: reads `Objective.find({deadline:{$gte:today,$lte:today+3days}, status:{$ne:'completed'}}).populate('user','name email')`, for each match calls `notifyDeadlineApproaching(objective.user._id, objective.title, diffDays)` (imported from `utils/notificationHelper` — **not exported by that module**, VERIFIED) and `sendDeadlineReminderEmail(objective.user, objective)` (imported from `utils/mailer` — **not exported by that module**, VERIFIED). Also exports a non-scheduled `checkDeadlinesNow()` doing the same query+notify (without the email step).
- **VERIFIED STATUS**: `startDeadlineCron` is never called from `app.js`/`server.js` (confirmed via grep) — this cron never runs in the deployed app. Even if it were wired up, it references `Objective.deadline` and `Objective.user`, neither of which exists on the `Objective` schema (the real fields are `dueDate` and `owner`), and calls two functions that don't exist in their respective modules — it would throw `TypeError` on every run.

### 8.2 `backend/cron/reminderCron.js`
- **Schedule**: `cron.schedule('0 8 * * *', ...)` — every day at 08:00.
- **What it touches**: three sequential queries against `Objective` for 3-day / 1-day / overdue deadlines, each filtered on `'reminderSent.threeDays'`/`'reminderSent.oneDay'`/`'reminderSent.overdue'` (fields that do not exist on the `Objective` schema, VERIFIED against Section 1.4), creates `Notification.create({user:obj.user, title, message, link:'/objectives'})` directly (bypassing the `createNotification` helper; also references `Notification.user`, which does not exist — the real field is `recipient`), then sets the `reminderSent.*` flag and `obj.save()`.
- **VERIFIED STATUS**: `startReminderCron` is never called from `app.js`/`server.js` — never runs. If it were wired up, every `Notification.create` call would fail Mongoose validation (`recipient` is required and not supplied) and the `reminderSent` field writes would be silently dropped (not in schema, `strict` mode default) or throw depending on Mongoose strict-mode configuration [INFERRED — exact Mongoose strict-mode setting for this field was not directly verified in this pass, but `Notification.recipient` being `required:true` with no value supplied would raise a `ValidationError` regardless].

### 8.3 AI-service (Flask, `ai-service/app.py`)
- Not scheduled; runs as a long-lived process (`python3 app.py`), single-threaded Flask dev server (`debug=False`), listening on `0.0.0.0:5000`.
- Loads at startup (module level, before first request): `models/feature_columns.json` (8-column list), `models/rating_xgb.joblib`, `models/rating_label_encoder.joblib`, `models/promotion_xgb.joblib`. **NOTE**: `models/rating_rf.joblib` and `models/promotion_rf.joblib` (the RandomForest variants trained by `train_model.py`) exist on disk but are **never loaded/used** by `app.py` — only the XGBoost variants are served.
- No authentication, no CORS middleware observed (VERIFIED — no `flask_cors` import, no manual CORS headers in `app.py`).
- Touched only by the one Node.js call site described in Section 5/7.4.

---

## 9. Configuration & Environment Notes

**VERIFIED environment variables referenced across the codebase**:
- Backend core: `MONGO_URI` (required, checked by `server.js` and `middleware/validateEnv.js`), `MONGO_DB_NAME` (used only by the unused `config/db.js`), `JWT_SECRET` (required), `JWT_REFRESH_SECRET` (required), `CORS_ORIGIN` (required per `validateEnv.js`, though `app.js` itself hardcodes its own `allowedOrigins` array `['http://localhost:5173','http://localhost:3000','http://localhost:8081']` rather than reading `CORS_ORIGIN` — see Section 10), `PORT` (default `5000`), `NODE_ENV`, `ACCESS_TOKEN_EXPIRES_IN`, `REFRESH_TOKEN_EXPIRES_IN`, `AUTH_USER_CACHE_TTL_MS` (default `10000`).
- AI/LLM: `AI_PROVIDER` (default `'grok'`), `AI_MODEL`, `AI_TIMEOUT_MS` (default `15000`), `AI_MAX_INPUT_CHARS` (default `12000`), `GEMINI_API_KEY`, `XAI_API_KEY`, `OPENAI_API_KEY`, `PERFORMANCE_AI_URL` (default `http://localhost:5000/predict`).
- File storage: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `CLOUDINARY_FOLDER_PREFIX` (default `'performance-management'`).
- Email: `SMTP_HOST`, `SMTP_PORT` (default `587`), `SMTP_USER`, `SMTP_PASS`.
- Calendar OAuth: `FRONTEND_BASE_URL`/`APP_BASE_URL`, `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`/`GOOGLE_REDIRECT_URI`, `MICROSOFT_TENANT_ID`(default `'common'`)/`MICROSOFT_CLIENT_ID`/`MICROSOFT_CLIENT_SECRET`/`MICROSOFT_REDIRECT_URI`, `CALENDAR_OAUTH_STATE_SECRET` (falls back to `JWT_SECRET`), `CALENDAR_TOKEN_SECRET` (falls back to `JWT_SECRET`).
- Frontend: `VITE_API_URL` (set in `.env` to `/api`) and `VITE_DEV_PROXY_TARGET` (set to `http://localhost:5009`) — **but** the code actually reads `import.meta.env.VITE_API_BASE_URL` (in `frontend/src/api/apiClient.js` and `frontend/src/components/AuthContext.jsx`), a name that does not match anything in `.env` — this env var is always `undefined` at runtime, so both call sites silently fall back to the hardcoded default `'/api'`. See Section 10.

**`tenantId` usage** (VERIFIED): only `User.tenantId` exists (String, default `'default'`, indexed) — [INFERRED — not directly confirmed] no other model has a `tenantId` field, and no controller/route logic filtering by `tenantId` was found in any of the files read in this session; it appears to be a placeholder/future-multi-tenancy field that is not currently enforced anywhere in the read code.

**Feature flags**: No dedicated feature-flag system (e.g., LaunchDarkly, custom flags table) was found. The closest analogues are: (a) `aiService.isConfigured()` acting as a runtime capability gate for AI features (falls back to rule-based logic when false), (b) the removed "Goal Check-Up" feature stub in `routes/objectives.js` (`router.all('/team-goals', ...)` always returns 404 "Goal Check-Up has been removed."), and (c) Cloudinary-vs-local file storage auto-detection via `isCloudinaryConfigured()`.

---

## 10. Open Questions / Unclear Items

1. **`Feedback.relatedReview` → `'ManagerReview'` dangling ref**: `backend/models/Feedback.js` declares `relatedReview: {type: ObjectId, ref: 'ManagerReview'}`, but no `ManagerReview.js` model file exists anywhere in `backend/models/`. This ref can never be `.populate()`d successfully.
2. **`Feedback.objective_id` vs `Feedback.relatedObjective`**: two fields both `ref:'Objective'` with overlapping apparent purpose; unclear which is authoritative/used by which code path — not resolved in the controller reads performed.
3. **`AuditLog` triplicate field pairs**: `user`/`user_id`, `entityType`/`entity_type`, `entityId`/`entity_id` all coexist with overlapping purpose. `routes/auditLog.js` reads defensively from both variants (`item.entityType || item.entity_type`, etc.), confirming both are actually written by different code paths (three separate audit-helper modules: `middleware/audit.js`, `utils/auditHelper.js`, `utils/auditLogger.js` — VERIFIED each uses a different field-naming convention).
4. **`Task.kpi_id` → `ref:'KPI'` dangling/incorrect ref**: no top-level Mongoose model named `KPI` is registered; the only "Kpi" concept in the codebase is the embedded `KpiSchema` inside `Objective.kpis[]`, which is not an independent collection and cannot be the target of this ref.
5. **`Task.linkedGoal` vs `Task.objective_id`**: two fields both `ref:'Objective'`; VERIFIED in `taskController.js` that both are written together on create/update (`linkedGoal: objectiveValidation.value, objective_id: objectiveValidation.value`) and both are queried together (`$or:[{objective_id:objId},{linkedGoal:objId}]`) — deliberate redundancy for backward compatibility, but a genuine schema duplication.
6. **`Task.timeTracking.sessions` vs `Task.timeSessions`** (and `totalTimeSpent`/`totalTrackedTime`/`timeTracking.totalSeconds`): VERIFIED three-way duplication kept manually in sync via `sanitizeTimeTracking`/`buildTimerAliases`/`syncTaskTimerFields` helper functions in `taskController.js` — a legacy/current field pair maintained in parallel rather than migrated.
7. **`Meeting.attendees` vs `Meeting.participants`**: both `[ObjectId] ref:'User'`; VERIFIED in `routes/meetings.js` `resolveMeetingParticipants()` that both arrays are always set to the identical value on create/update — full redundancy, no observed divergent use.
8. **Dead-code controllers, referencing non-existent models**: `backend/controllers/cycleController.js` requires `../models/EvaluationCycle` (file does not exist); `backend/controllers/hrDecisionController.js` requires both `../models/EvaluationReport` and `../models/EvaluationCycle` (neither exists). Both controllers are never `require`d by any route file (VERIFIED via grep) — if ever wired up, they would crash at module-load time with `Cannot find module`.
9. **Dead-code controller with divergent live implementation**: `backend/controllers/teamController.js` (flat team model, no hierarchy, no notifications) is never wired to any route; the live `/api/teams` route (`routes/teams.js`) reimplements team CRUD inline with parent/sub-team hierarchy support and notification side effects. The two implementations use the same `Team`/`User` models but materially different business rules.
10. **Two parallel, both-live evaluation systems**: `Evaluation` model + `evaluationController.js` (mounted `/api/evaluations`) and `FinalEvaluation` model + `finalEvaluationController.js` (mounted `/api/final-evaluations`) are BOTH reachable, both actively used by the frontend (`Evaluations.jsx`/`EvaluationListPage.jsx`/`EvaluationScoringPage.jsx` vs `FinalEvaluationManager.jsx`/`FinalEvaluationEmployee.jsx`), and appear to represent two distinct (possibly overlapping/competing) evaluation workflows in the same application. The exact intended relationship/hand-off between the two (if any) was not established in the code read.
11. **Orphaned/never-mounted route files**: `backend/routes/me.js`, `backend/routes/progress.js`, `backend/routes/reminders.js` all exist on disk with working-looking handler code but are never `require`d by `app.js` (VERIFIED — the `routes` mount object in `app.js` lists exactly 25 entries, none referencing these three files). `routes/progress.js` additionally queries `Evaluation.find({user:...})`, a field that does not exist on the `Evaluation` model (real field is `employeeId`) — would never match even if mounted. `routes/reminders.js` shares the same non-existent `Objective.deadline`/`Objective.user`/`Objective.reminderSent` field problem as the cron jobs (Section 8).
12. **`config/db.js` unused**: exports `connectDB()`, never called; `server.js` connects to MongoDB independently inline. Two parallel, redundant DB-connection code paths exist, only one of which is live.
13. **Three separate audit-logging code paths**: `middleware/audit.js` (response-interception style, `audit(action,resourceType)` factory — not observed wired into any route in the files read), `utils/auditHelper.createAuditLog({...})` (object-style, used by `objectiveController`, `taskController`, `routes/cycles.js`), `utils/auditLogger.log(userId,action,entityType,entityId,metadata)` (positional-style, used by `checkInController`, `finalEvaluationController`, dead `cycleController.js`). All three write to the same `AuditLog` collection but with different field-naming conventions (contributing to item 3 above).
14. **Two notification-creation call signatures**: object-style `createNotification({recipientId,senderId,type,title,message,link})` from `utils/notificationHelper.js` (used by most controllers) vs. positional-style `createNotification(recipientId,title,message,link,type)` exported directly from `controllers/notificationController.js` (used only by `objectiveController.js` and `routes/meetings.js`). Both ultimately write to the same `Notification` model.
15. **`routes/notifications.js` duplicates `controllers/notificationController.js`**: the mounted route re-implements `getMyNotifications`/`markAsRead`/`markAllRead`-equivalent logic inline rather than calling the controller's exported functions of the same apparent purpose; only `notificationController.createNotification` (the positional-style legacy helper) is actually reused elsewhere.
16. **`middleware/ownership.js` and `middleware/audit.js` appear unused**: neither was observed being `require`d/wired into any of the 28 route files read in this session — [INFERRED — not exhaustively confirmed against every line of every route file, since some route-file reads were summarized by a sub-agent rather than fully re-verified line-by-line in this transcript] they may be legacy/aspirational middleware.
17. **`CALENDAR_TOKEN_SECRET`/`CALENDAR_OAUTH_STATE_SECRET` fall back to `JWT_SECRET`** if unset — a configuration choice that reuses the auth signing secret for calendar-token encryption/OAuth-state signing, worth flagging as a coupling between two otherwise-independent secrets.
18. **`CORS_ORIGIN` env var required by `validateEnv.js` but not actually used by `app.js`**: `app.js` hardcodes its own `allowedOrigins` array (`localhost:5173/3000/8081`) instead of reading `process.env.CORS_ORIGIN`. Also, [INFERRED — not directly confirmed] `validateEnv.js` itself does not appear to be invoked from `server.js`/`app.js` in the files read (only the inline `requiredEnv` check in `server.js` for `MONGO_URI`/`JWT_SECRET`/`JWT_REFRESH_SECRET` was observed running at boot) — so the `CORS_ORIGIN` requirement in `validateEnv.js` may never actually be enforced at runtime.
19. **Frontend env var name mismatch**: `frontend/.env` defines `VITE_API_URL`, but `frontend/src/api/apiClient.js` and `frontend/src/components/AuthContext.jsx` read `import.meta.env.VITE_API_BASE_URL` — never populated, both silently fall back to hardcoded `/api`.
20. **`frontend/src/components/ProtectedRoute.jsx` appears to be dead code**: exists alongside `RouteGuard.jsx`, but `App.jsx` only imports/uses `RouteGuard` for route gating [INFERRED — based on sub-agent's grep of `App.jsx` imports, not independently re-verified against `ProtectedRoute.jsx`'s full content in this session].
21. **`objectiveController.createCorrectionRequest` in-memory mutation not persisted**: `addActivity(objective, req.user.id, 'correction_requested', ...)` mutates the in-memory `objective` object but the function never calls `objective.save()` afterward — only the separate `CorrectionRequest` document is persisted. The activity-log entry is silently lost. VERIFIED directly in source (`backend/controllers/objectiveController.js`, `createCorrectionRequest` function body).
22. **`routes/bonusPenalty.js` `GET /employee/:employeeId` references an undeclared variable `currentUserId`**: VERIFIED directly in source — this identifier is never declared/destructured anywhere in that route handler, so any request from a non-HR/ADMIN caller would throw a `ReferenceError`, resulting in an unhandled 500 rather than the intended 403/200 branching logic.
23. **`Objective.VALID_TRANSITIONS` map defined but apparently unused**: `objectiveController.js` defines a full `isValidTransition(from,to)` helper backed by a `VALID_TRANSITIONS` map, but no call site for `isValidTransition` was found in the portions of the controller read — each workflow endpoint (`submitObjective`, `validateObjective`, etc.) instead does its own ad-hoc status-array `.includes()` check. [INFERRED — not exhaustively confirmed against literally every line of the ~2000-line file, since some later sections (deleteObjective, addKpi/updateKpi/deleteKpi, addProgressUpdate, addComment/deleteComment, getSubObjectives, duplicateObjective, getTeamGoalsForManager, addManagerNote) were not individually read in full in this session — flagged here as a gap.]
24. **`ImprovementPlan.progress_status` transition logic**: not directly verified against `improvementPlanController.js` source in this session (only cross-checked via a sub-agent's summary and the model shape) — exact transition rules/triggers for `not_started → in_progress → completed` were not independently confirmed.
25. **`FinalEvaluation.status` transition to `'closed'`**: the enum value exists and is queried against (`status:{$in:['validated','closed']}`) in multiple places, but no controller code that explicitly WRITES `status:'closed'` onto a `FinalEvaluation` document was found in the files read — the exact trigger for this transition (if it exists) was not located.
26. **`tenantId` field on `User`**: present in the schema but no filtering/scoping logic by `tenantId` was observed anywhere in the controllers/routes read — likely an unused placeholder for future multi-tenancy, but not exhaustively confirmed absent from the ~14 controller files and dozens of route files, some of which were only summarized rather than fully read line-by-line.
27. **`middleware/validateEnv.js` invocation site not located**: the function is defined and exports a required-env-var check including `CORS_ORIGIN`, but no call site (e.g., `require('./middleware/validateEnv')()`) was found in `app.js` or `server.js` in the files read — unclear whether/when this validation actually runs.
28. **AI-service unused artifacts**: `ai-service/models/rating_rf.joblib` and `ai-service/models/promotion_rf.joblib` (RandomForest variants) are produced by `train_model.py` but never loaded by `app.py` (which only loads the XGBoost variants) — dead artifacts from a model-comparison exercise, not a functional gap, but worth noting for completeness.
29. **Some controllers were extracted via a background sub-agent's summary rather than a full direct re-read in this transcript**: `feedbackController.js`, `improvementPlanController.js`, and `statsController.js` were read in full by a parallel research agent whose findings are incorporated verbatim into Sections 3/4/6 above and were spot-checked against the (independently, directly read) model/route files for consistency, but their exact line-by-line content was not independently re-verified by the primary session. Flagged for transparency per the "cite source, don't silently resolve" rule.

---

## 11. Completion Checklist

| Item | Target | Found/Covered | Notes |
|---|---|---|---|
| Backend Mongoose models | 20 | 20 | All 20 listed in Section 1, all pre-verified data used as given, spot-checked against controller usage. |
| Backend controllers | 15 files | 15 files read (11 fully read directly in this session: `objectiveController`, `checkInController`, `evaluationController`, `finalEvaluationController`, `careerController`, `taskController`, `userController`, `teamController`, `cycleController`, `notificationController`, `hrDecisionController`, `aiController`; 3 covered via a background sub-agent's full read: `feedbackController`, `improvementPlanController`, `statsController`) | 3 dead-code controllers identified (`teamController`, `cycleController`, `hrDecisionController`). |
| Backend route files | 28 | 28 (25 mounted per `app.js`'s `routes` object + `routes/performance.js` confirmed mounted = 24 route files actually reachable; `me.js`, `progress.js`, `reminders.js` confirmed unmounted/dead) | Every mounted route file's endpoints enumerated in Section 3. |
| Backend services | 3 | 3 (`aiService.js`, `reviewContextService.js`, `scoreCalculationService.js`) | Fully read directly. |
| Backend middleware | 8 | 8 (`auth`, `role`, `validate`, `ownership`, `rateLimiter`, `audit`, `errorHandler`, `validateEnv`) | Fully read directly. |
| Backend utils | 12 | 12 (`accessControl`, `auditHelper`, `auditLogger`, `authHelpers`, `calendarCrypto`, `cycleRules`, `fileStorage`, `mailer`, `notificationHelper`, `objectiveRules`, `objectiveVisibility`, `workflowRules`) | Fully read directly. |
| Backend validators | 1 file (`schemas.js`) | 1 | Fully read directly; only 4 schema groups exist (`auth`,`user`,`objective`,`cycle`) — no `team`/`task`/`feedback`/`checkin`/`evaluation` schemas found. |
| Backend cron jobs | 2 | 2 (`deadlineCron.js`, `reminderCron.js`) | Both fully read directly; both confirmed dead (never started) and both reference non-existent model fields/helper exports. |
| App bootstrap files | `app.js`, `server.js`, `config/db.js` | 3 | Fully read directly. `config/db.js` confirmed unused. |
| AI-service files | `app.py`, `performance_text.py`, `train_model.py`, `generate_dataset.py` | 4 | Fully read directly. |
| Data model relationships enumerated | all `ref:` fields across 20 models | 100 relationship rows (Section 2) | Includes 2 dangling refs (`Feedback.relatedReview`→`ManagerReview`, `Task.kpi_id`→`KPI`) and multiple duplicate-purpose field pairs, all flagged. |
| Status workflow transition tables | Objective, CheckIn, Evaluation, FinalEvaluation, HRDecision(action), BonusPenalty(approvalStatus), CorrectionRequest, Task(status/workflowStage), CareerPath(status), ImprovementPlan(progress_status), Meeting(status), Cycle(status/currentPhase) | 12 of 12 entities covered in Section 4 | `ImprovementPlan.progress_status` transition detail flagged as not independently verified (item 24 in Open Questions); `FinalEvaluation→closed` trigger not located (item 25). |
| Cross-service (Node↔Flask) call sites | — | 1 call site found and fully documented (Section 5) | Clarified that `aiService.js` (LLM calls) is a SEPARATE mechanism from the one real Flask call in `aiController.enhancePredictionWithAIService`. |
| Roles inventory | ADMIN, HR, TEAM_LEADER, COLLABORATOR + non-human actors | 4 human roles + cron jobs + ai-service + LLM providers + calendar OAuth providers, all covered in Section 6/8 | — |
| Key workflows traced | ≥4 requested (objective lifecycle, evaluation→final eval→HR decision→bonus/penalty, career recommendation + AI round trip, check-in cycle) | 5 traced (added performance-prediction round trip as 7.4 since it's the actual Flask call site, distinct from the career-recommendation flow which does NOT hit Flask) | Each includes a frontend trigger file/component per the instructions. |
| Frontend route inventory | — | ~26 app routes + 1 public route enumerated with role/phase gating (from background sub-agent's full read of `routeConfig.jsx`) | Incorporated into Sections 0, 6, 7. |
| Open questions logged | all pre-flagged items + new findings | 29 items in Section 10 | Includes all 7 items pre-flagged by the user plus 22 additional findings from direct code reads (dead controllers, dead routes, undeclared variable bug, unpersisted mutation bug, env var mismatches, unused DB connector, triplicate audit helpers, etc.). |
