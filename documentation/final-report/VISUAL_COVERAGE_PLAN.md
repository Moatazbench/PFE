# Visual Coverage Plan

Generated on July 21, 2026 after current-report audit and repository verification.

| Chapter | Visual | Type | Source | Status |
|---|---|---|---|---|
| Preliminary pages | Cover identity block | Designed cover layout | Report metadata, missing-logo placeholders | Improve existing |
| General Introduction | Performance-management lifecycle | Workflow diagram | Application modules and cycle phases | To create |
| Chapter 1 | Repository and engineering workflow | Folder/process diagram | Repository structure, GitHub Actions | To create |
| Chapter 1 | Stakeholder map | Diagram/table | Verified roles and target users | To create |
| Chapter 2 | Scope boundary | Context/scope diagram | Implemented modules and known gaps | To create |
| Chapter 2 | Risk matrix | Heat-map style table | Existing risk analysis | Improve existing |
| Chapter 2 | Sprint planning | Gantt chart | Current report planning and repository feature order | Keep and polish |
| Chapter 3 | Global use-case diagram | UML-style diagram | Frontend routes, backend routes, roles | To create |
| Chapter 3 | Role-permission matrix | Table | `routeConfig.jsx`, backend route middleware | Improve existing |
| Chapter 3 | System-context diagram | Architecture diagram | Frontend, backend, MongoDB, AI service, external AI providers | Keep and polish |
| Chapter 3 | Logical architecture | Layer diagram | React, Express, Mongoose, MongoDB, Flask AI | Keep and expand |
| Chapter 3 | Component architecture | Component diagram | Source folders and services | Keep and polish |
| Chapter 3 | Frontend/backend/AI communication | Sequence/data-flow diagram | API service, AI controller, Flask service | To create |
| Chapter 3 | Global database model | Data model diagram | Mongoose models | Keep and improve |
| Chapter 3 | Technology stack overview | Stack panel | Package manifests and deployment files | To create |
| Chapter 4 | Login and dashboard screen | Project screenshot | Running React app | Deferred by user request |
| Chapter 4 | Authentication flow | Sequence diagram | `auth.js`, `auth.js` middleware, `api.js` | To create |
| Chapter 4 | Role and phase guard flow | Activity diagram | `RouteGuard.jsx`, role middleware | To create |
| Chapter 4 | Cycle state diagram | State diagram | `Cycle.js`, cycle routes | Keep and polish |
| Chapter 4 | Security controls table | Table | `app.js`, middleware, validators | Improve existing |
| Chapter 5 | Objectives workspace | Project screenshot | Running React app | Deferred by user request |
| Chapter 5 | Objective lifecycle | State diagram | `Objective.js`, objective routes | Keep and improve |
| Chapter 5 | Objective submission sequence | Sequence diagram | `objectives.js`, objective controller | To create |
| Chapter 5 | Weight-calculation visual | Formula/table diagram | `objectiveRules.js`, `scoreCalculationService.js` | To create |
| Chapter 5 | Task workspace/Kanban | Project screenshot | Running React app | Deferred by user request |
| Chapter 5 | Check-in workflow | Workflow diagram | `CheckIn.js`, routes/controllers | To create |
| Chapter 6 | Final evaluation screen | Project screenshot | Running React app | Deferred by user request |
| Chapter 6 | HR validation screen | Project screenshot | Running React app | Deferred by user request |
| Chapter 6 | Evaluation workflow | Sequence/activity diagram | `FinalEvaluation.js`, routes, workflow rules | Keep and improve |
| Chapter 6 | HR blocking rules | Decision table | `workflowRules.js` | To create |
| Chapter 6 | Career/HR follow-up model | Data-model extract | HR decision, improvement plan, bonus/penalty models | To create |
| Chapter 7 | AI service architecture | Architecture diagram | Node AI service, Flask service, external providers | To create |
| Chapter 7 | AI inference sequence | Sequence diagram | `aiController.js`, `aiService.js`, `ai-service/app.py` | Keep and polish |
| Chapter 7 | Model comparison chart | Chart | Saved model evaluation | To create |
| Chapter 7 | Feature-importance chart | Chart | Saved XGBoost artifact evaluation | To create |
| Chapter 7 | Confusion matrices | Heat-map tables/charts | Saved artifact evaluation | To create |
| Chapter 7 | AI prediction/analytics screens | Project screenshots | Running React app | Deferred by user request |
| Chapter 8 | Test strategy map | Table/diagram | Backend/frontend test files | To create |
| Chapter 8 | CI/CD pipeline | Pipeline diagram | `.github/workflows/docker-build.yml` | Keep and polish |
| Chapter 8 | Docker/Kubernetes deployment overview | Deployment diagram | Dockerfiles, Compose, K8s manifests | Keep and improve |
| Chapter 8 | Pipeline evidence table | Table | GitHub Actions workflow | To create |
| Chapter 8 | Deployment limitation panel | Callout/table | Compose/K8s scan | To create |
| General conclusion | Delivered-vs-limited summary | Summary table | Evidence map and QA results | To create |
| Appendices | API inventory | Longtable | Express route extraction | Keep |
| Appendices | Database dictionary | Table | Mongoose models | Keep |
| Appendices | AI model evidence | Charts and tables | Saved AI artifacts | Improve |
| Appendices | Test evidence | Command excerpts/tables | Actual local test commands | Improve |

## Screenshot Capture Plan

Screenshots are deferred for this revision by user request. The report will therefore use verified architecture diagrams, workflow diagrams, model charts, tables, and clear missing-information notes instead of inserting new UI captures.

| Screen | Folder | Capture method | Status |
|---|---|---|---|
| Login | `screenshots/auth/` | Frontend route | Deferred |
| Dashboard | `screenshots/admin/` | Dashboard route | Deferred |
| User administration | `screenshots/admin/` | Users route | Deferred |
| Team management | `screenshots/admin/` | Teams route | Deferred |
| Objectives | `screenshots/employee/` | Objectives route | Deferred |
| Tasks workspace | `screenshots/employee/` | Tasks route | Deferred |
| Final evaluation | `screenshots/manager/` | Final evaluation route | Deferred |
| HR validation | `screenshots/hr/` | HR validation route | Deferred |
| Analytics | `screenshots/hr/` | Analytics route | Deferred |
| AI prediction | `screenshots/ai/` | Prediction route | Deferred |

## External Visual Source Policy

- Architecture, workflow, database, AI, and DevOps diagrams will be authored as editable TikZ/vector graphics based on repository evidence.
- Technology visuals will be drawn as consistent stack panels with technology names and roles. External logo files will not be added unless traceable official or permissively licensed sources are used and recorded in `FIGURE_SOURCES.md`.
- No generic internet architecture screenshots will be used.
- No feature screenshot will be fabricated. If an interface cannot be safely captured from the running application, the report will retain an explicit limitation rather than showing a fake screen.
