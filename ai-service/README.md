# AI Performance Analyzer

Synthetic dataset + trained models + Flask REST API for predicting employee
performance rating and promotion readiness, built for integration with the
PerTrack MERN app.

## What's in here

```
data/employee_performance_dataset.csv   10,000-row synthetic dataset (ready to train, no cleaning needed)
generate_dataset.py                     regenerates the dataset (edit constants to change size/seed)
train_model.py                          trains RandomForest + XGBoost for both prediction tasks
performance_text.py                     shared text generator (strengths/weaknesses/summary/suggestions)
app.py                                  Flask REST API serving the trained models
models/                                 saved .joblib models + feature column list (created by train_model.py)
requirements.txt
```

## 1. Setup

```bash
pip install -r requirements.txt
```

## 2. (Optional) Regenerate the dataset

A dataset is already included at `data/employee_performance_dataset.csv`.
Regenerate it only if you want a different size or seed:

```bash
python3 generate_dataset.py
```

Sanity checks already run on this dataset: 0 missing values, 0 duplicate
rows, ~25% per rating class, promotion-ready rates matching the spec
(exceptional ~80%, exceeds_expectations ~50%, meets_expectations ~20%,
needs_improvement ~3% as an intentional edge case), and realistic (not
perfect) correlation between features.

## 3. Train the models

```bash
python3 train_model.py
```

This prints accuracy / classification reports / confusion matrix / feature
importances for both tasks, and saves models to `models/`:

| Model | Task | Test accuracy |
|---|---|---|
| RandomForest | rating (4-class) | ~97% |
| **XGBoost** (used by API) | rating (4-class) | **~98%** |
| RandomForest | promotion_ready (binary) | ~75% (ROC-AUC ~0.83) |
| **XGBoost** (used by API) | promotion_ready (binary) | **~75%** (ROC-AUC ~0.82) |

Rating accuracy is high because the rating is derived from a real formula
plus noise — that's expected and fine. Promotion accuracy is lower by
design: promotion_ready has a built-in probabilistic component (e.g. an
`exceptional` employee is only ~80% likely to be flagged ready, not 100%),
so a model that nails the obvious cases but can't perfectly predict the
judgment-call cases is the realistic, defensible outcome — not a bug.

**Important design note for your jury**: the 8 raw features are the only
model inputs. `overall_score` is excluded from training even though it's a
CSV column, because it's a deterministic linear function of those same 8
features (the published business formula) — including it would let the
model "cheat" via a trivial threshold lookup instead of learning patterns.

## 4. Run the API

```bash
python3 app.py
```

Runs on `http://0.0.0.0:5000`. The Docker image runs it behind Gunicorn for
deployment.

### `POST /predict`

Request body (all 8 fields required):
```json
{
  "kpi_score": 82.5,
  "goal_completion_percent": 78.0,
  "checkin_count": 14,
  "avg_checkin_progress": 80.0,
  "feedback_count": 30,
  "positive_feedback_ratio": 0.85,
  "task_completion_percent": 88.0,
  "tasks_on_time_percent": 79.0
}
```

Response:
```json
{
  "overall_score": 81.78,
  "rating": "exceeds_expectations",
  "rating_confidence": 0.91,
  "promotion_ready": true,
  "promotion_probability": 0.74,
  "strengths": ["...", "..."],
  "weaknesses": ["...", "..."],
  "review_summary": "...",
  "suggestions": ["...", "..."]
}
```

### `POST /predict/batch`

Same shape, but the body is a JSON array of employee objects; returns a
JSON array of results (each tagged with its original `index`).

### `GET /health`

Returns `{"status": "ok"}`.

## 5. Calling it from your Node.js/Express backend

```js
// using axios, already a common dependency in MERN apps
const axios = require('axios');

async function getPerformancePrediction(employeeMetrics) {
  const { data } = await axios.post('http://localhost:5000/predict', employeeMetrics);
  return data;
}

// example usage in a route
app.post('/api/employees/:id/analyze', async (req, res) => {
  try {
    const prediction = await getPerformancePrediction(req.body.metrics);
    // e.g. save prediction.rating / prediction.promotion_ready onto the employee doc
    res.json(prediction);
  } catch (err) {
    res.status(500).json({ error: 'Prediction service unavailable' });
  }
});
```

If Node and Flask run in separate Docker containers (matching your existing
`pfe-dev` Kubernetes setup), set `PERFORMANCE_AI_URL` to the Flask service's
in-cluster DNS name, e.g. `http://ai-service:5000/predict`.
