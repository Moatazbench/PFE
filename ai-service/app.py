"""
app.py

Flask REST API for the AI Performance Analyzer.
Loads the trained models once at startup and serves predictions for your
Node.js/Express backend to call.

Run:
    python3 app.py
Server starts on http://0.0.0.0:5000

Endpoints:
    GET  /health
    POST /predict        -> single employee
    POST /predict/batch   -> list of employees

Example request body for /predict:
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
"""

import json
import joblib
import pandas as pd
from flask import Flask, request, jsonify

from performance_text import generate_text_outputs

app = Flask(__name__)

with open("models/feature_columns.json") as f:
    FEATURE_COLUMNS = json.load(f)

rating_model = joblib.load("models/rating_xgb.joblib")
rating_label_encoder = joblib.load("models/rating_label_encoder.joblib")
promotion_model = joblib.load("models/promotion_xgb.joblib")

FEATURE_BOUNDS = {
    "kpi_score": (0, 100),
    "goal_completion_percent": (0, 100),
    "checkin_count": (0, 20),
    "avg_checkin_progress": (0, 100),
    "feedback_count": (0, 50),
    "positive_feedback_ratio": (0, 1),
    "task_completion_percent": (0, 100),
    "tasks_on_time_percent": (0, 100),
}


def validate_payload(payload):
    missing = [f for f in FEATURE_COLUMNS if f not in payload]
    if missing:
        return f"Missing required fields: {missing}"

    for f in FEATURE_COLUMNS:
        val = payload[f]
        if not isinstance(val, (int, float)):
            return f"Field '{f}' must be numeric"
        lo, hi = FEATURE_BOUNDS[f]
        if val < lo or val > hi:
            return f"Field '{f}' must be between {lo} and {hi}"
    return None


def compute_overall_score(payload):
    return round(
        payload["kpi_score"] * 0.30
        + payload["goal_completion_percent"] * 0.25
        + payload["avg_checkin_progress"] * 0.15
        + payload["task_completion_percent"] * 0.20
        + payload["positive_feedback_ratio"] * 100 * 0.10,
        2,
    )


def predict_one(payload):
    X = pd.DataFrame([{f: payload[f] for f in FEATURE_COLUMNS}])

    rating_idx = rating_model.predict(X)[0]
    rating = rating_label_encoder.inverse_transform([rating_idx])[0]
    rating_proba = rating_model.predict_proba(X)[0]
    rating_confidence = round(float(max(rating_proba)), 4)

    promotion_ready = bool(promotion_model.predict(X)[0])
    promotion_proba = float(promotion_model.predict_proba(X)[0][1])

    overall_score = compute_overall_score(payload)

    text = generate_text_outputs(
        {f: payload[f] for f in FEATURE_COLUMNS},
        rating,
        promotion_ready,
        overall_score,
    )

    return {
        "overall_score": overall_score,
        "rating": rating,
        "rating_confidence": rating_confidence,
        "promotion_ready": promotion_ready,
        "promotion_probability": round(promotion_proba, 4),
        "strengths": text["strengths"].split("; "),
        "weaknesses": text["weaknesses"].split("; "),
        "review_summary": text["review_summary"],
        "suggestions": text["suggestions"].split("; "),
    }


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})


@app.route("/predict", methods=["POST"])
def predict():
    payload = request.get_json(silent=True)
    if payload is None:
        return jsonify({"error": "Request body must be valid JSON"}), 400

    error = validate_payload(payload)
    if error:
        return jsonify({"error": error}), 400

    try:
        result = predict_one(payload)
    except Exception as e:
        return jsonify({"error": f"Prediction failed: {str(e)}"}), 500

    return jsonify(result)


@app.route("/predict/batch", methods=["POST"])
def predict_batch():
    payload = request.get_json(silent=True)
    if not isinstance(payload, list):
        return jsonify({"error": "Request body must be a JSON array of employee objects"}), 400

    results = []
    for i, item in enumerate(payload):
        error = validate_payload(item) if isinstance(item, dict) else "Item must be an object"
        if error:
            results.append({"index": i, "error": error})
            continue
        try:
            results.append({"index": i, **predict_one(item)})
        except Exception as e:
            results.append({"index": i, "error": f"Prediction failed: {str(e)}"})

    return jsonify(results)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False)
