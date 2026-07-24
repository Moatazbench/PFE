# Report Evidence Map

| Report claim | Repository evidence |
|---|---|
| The frontend uses React and Vite | `frontend/package.json`, `frontend/vite.config.js` |
| The backend uses Express and Mongoose | `backend/package.json`, `backend/app.js`, `backend/models/*.js` |
| MongoDB is the data store | `backend/server.js`, `backend/config/db.js`, Mongoose models |
| Authentication uses JWT and refresh tokens | `backend/routes/auth.js`, `backend/middleware/auth.js`, `frontend/src/components/AuthContext.jsx` |
| Passwords are hashed with bcrypt | `backend/models/User.js` |
| Roles are ADMIN, HR, TEAM_LEADER, COLLABORATOR | `backend/models/User.js`, `backend/validators/schemas.js` |
| Backend route-level RBAC exists | `backend/middleware/role.js`, `backend/routes/*.js` |
| Frontend route roles exist | `frontend/src/routes/routeConfig.jsx` |
| Frontend route phases are enforced for annual workflows | `frontend/src/routes/routeConfig.jsx`, `frontend/src/components/RouteGuard.jsx` |
| Frontend API calls use Axios with token refresh handling | `frontend/src/services/api.js` |
| Teams support subteams | `backend/models/Team.js`, `backend/routes/teams.js`, `backend/utils/accessControl.js` |
| Cycles have phases phase1, phase2, phase3, closed | `backend/models/Cycle.js`, `backend/routes/cycles.js` |
| Cycle date and phase transitions are validated server-side | `backend/models/Cycle.js`, `backend/routes/cycles.js`, `backend/validators/schemas.js` |
| Objectives embed KPIs | `backend/models/Objective.js` |
| Objectives support draft, submission, validation, correction, evaluation, locking, cancellation, and archival states | `backend/models/Objective.js`, `backend/routes/objectives.js`, `backend/utils/objectiveVisibility.js` |
| Objective score is weight times achievement divided by 100 | `backend/models/Objective.js`, `backend/services/scoreCalculationService.js` |
| Final score normalizes non-100 weight totals | `backend/services/scoreCalculationService.js`, `backend/tests/scoreCalculationService.test.js` |
| Team objective weight is not divided by member count | `backend/tests/scoreCalculationService.test.js`, `backend/tests/objectiveRules.test.js` |
| Objective visibility hides employee-created draft individual objectives from managers until submission | `backend/utils/objectiveVisibility.js`, `backend/tests/objectiveVisibility.test.js` |
| Check-ins include manager review | `backend/models/CheckIn.js`, `backend/controllers/checkInController.js` |
| Tasks include kanban states and time tracking | `backend/models/Task.js`, `frontend/src/pages/TasksPage.jsx` |
| Final evaluations include HR validation | `backend/models/FinalEvaluation.js`, `backend/routes/finalEvaluations.js`, `backend/controllers/finalEvaluationController.js` |
| HR validation blocks incomplete or inconsistent final evaluations | `backend/utils/workflowRules.js`, `backend/tests/workflowRules.test.js` |
| HR decisions, improvement plans, and bonus/penalty records exist | `backend/models/HRDecision.js`, `backend/models/ImprovementPlan.js`, `backend/models/BonusPenalty.js` |
| Generative AI supports multiple providers and fallbacks | `backend/services/aiService.js`, `backend/controllers/aiController.js` |
| Generative AI prompts constrain output to supplied performance data | `backend/services/aiService.js`, `backend/services/reviewContextService.js` |
| Python AI service uses Flask, Random Forest, and XGBoost artifacts | `ai-service/app.py`, `ai-service/train_model.py`, `ai-service/models/*.joblib` |
| AI dataset is synthetic with 10,000 rows | `ai-service/README.md`, `ai-service/data/employee_performance_dataset.csv` |
| AI service exposes health, single prediction, and batch prediction endpoints | `ai-service/app.py` |
| Backend tests passed locally | `backend/tests/*.js`, local command `npm test -- --runInBand` |
| Frontend tests passed locally | `frontend/tests/*.jsx`, local command `npm test -- --runInBand` |
| Frontend build succeeded locally | local command `npm run build` in `frontend` |
| CI/CD uses GitHub Actions, Gitleaks, tests, Docker builds, Trivy, and smoke test | `.github/workflows/docker-build.yml` |
| Containerization exists for backend and frontend | `backend/Dockerfile`, `frontend/Dockerfile`, `docker-compose.yml` |
| Kubernetes and GitOps files exist | `k8s/base/*.yaml`, `k8s/overlays/*`, `k8s/argocd-app.yaml` |
| Docker Compose does not include MongoDB or the Python AI service | `docker-compose.yml` |
| Kubernetes manifests describe backend and frontend but do not deploy the Python AI service | `k8s/base/*.yaml`, `k8s/overlays/*` |
| Monitoring dashboards are not present in repository evidence | Repository scan for Prometheus, Grafana, dashboards, and monitoring manifests |
