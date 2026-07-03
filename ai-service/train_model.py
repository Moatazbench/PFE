"""
train_model.py

Trains 4 models on the synthetic dataset:
- RandomForestClassifier   -> rating (4-class)
- XGBClassifier            -> rating (4-class)
- RandomForestClassifier   -> promotion_ready (binary)
- XGBClassifier            -> promotion_ready (binary)

IMPORTANT design choice: training features are ONLY the 8 raw inputs
(kpi_score, goal_completion_percent, checkin_count, avg_checkin_progress,
feedback_count, positive_feedback_ratio, task_completion_percent,
tasks_on_time_percent).

overall_score is deliberately EXCLUDED from the model's input features even
though it's a column in the CSV. overall_score is a deterministic linear
function of the other 8 features (that's the published business-logic
formula), so including it would let the model "cheat" by just learning the
threshold rule instead of genuinely learning patterns across the 8 raw
signals. This is the right call to defend in a jury: it keeps the model
honest and means it would still work even if the scoring formula's weights
ever change.

Run: python3 train_model.py
Outputs (in models/):
  rating_rf.joblib, rating_xgb.joblib, rating_label_encoder.joblib
  promotion_rf.joblib, promotion_xgb.joblib
  feature_columns.json
"""

import json
import joblib
import numpy as np
import pandas as pd

from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    roc_auc_score,
)
from xgboost import XGBClassifier

FEATURE_COLUMNS = [
    "kpi_score",
    "goal_completion_percent",
    "checkin_count",
    "avg_checkin_progress",
    "feedback_count",
    "positive_feedback_ratio",
    "task_completion_percent",
    "tasks_on_time_percent",
]

SEED = 42


def train_rating_models(df):
    X = df[FEATURE_COLUMNS]
    y_raw = df["rating"]

    le = LabelEncoder()
    y = le.fit_transform(y_raw)

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=SEED, stratify=y
    )

    print("\n" + "=" * 60)
    print("RATING MODEL (4-class classification)")
    print("=" * 60)

    rf = RandomForestClassifier(
        n_estimators=300, max_depth=12, random_state=SEED, n_jobs=-1
    )
    rf.fit(X_train, y_train)
    rf_pred = rf.predict(X_test)
    print("\n--- Random Forest ---")
    print("Accuracy:", round(accuracy_score(y_test, rf_pred), 4))
    print(classification_report(y_test, rf_pred, target_names=le.classes_))

    xgb = XGBClassifier(
        n_estimators=300,
        max_depth=6,
        learning_rate=0.1,
        random_state=SEED,
        eval_metric="mlogloss",
    )
    xgb.fit(X_train, y_train)
    xgb_pred = xgb.predict(X_test)
    print("\n--- XGBoost ---")
    print("Accuracy:", round(accuracy_score(y_test, xgb_pred), 4))
    print(classification_report(y_test, xgb_pred, target_names=le.classes_))

    print("\nConfusion matrix (XGBoost):")
    print(pd.DataFrame(
        confusion_matrix(y_test, xgb_pred),
        index=[f"true_{c}" for c in le.classes_],
        columns=[f"pred_{c}" for c in le.classes_],
    ))

    print("\nFeature importance (XGBoost):")
    importances = pd.Series(xgb.feature_importances_, index=FEATURE_COLUMNS)
    print(importances.sort_values(ascending=False).round(3))

    joblib.dump(rf, "models/rating_rf.joblib")
    joblib.dump(xgb, "models/rating_xgb.joblib")
    joblib.dump(le, "models/rating_label_encoder.joblib")


def train_promotion_models(df):
    X = df[FEATURE_COLUMNS]
    y = df["promotion_ready"].astype(int)

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=SEED, stratify=y
    )

    print("\n" + "=" * 60)
    print("PROMOTION READINESS MODEL (binary classification)")
    print("=" * 60)

    rf = RandomForestClassifier(
        n_estimators=300, max_depth=10, random_state=SEED, n_jobs=-1
    )
    rf.fit(X_train, y_train)
    rf_pred = rf.predict(X_test)
    rf_proba = rf.predict_proba(X_test)[:, 1]
    print("\n--- Random Forest ---")
    print("Accuracy:", round(accuracy_score(y_test, rf_pred), 4))
    print("ROC-AUC:", round(roc_auc_score(y_test, rf_proba), 4))
    print(classification_report(y_test, rf_pred, target_names=["not_ready", "ready"]))

    xgb = XGBClassifier(
        n_estimators=300,
        max_depth=5,
        learning_rate=0.1,
        random_state=SEED,
        eval_metric="logloss",
    )
    xgb.fit(X_train, y_train)
    xgb_pred = xgb.predict(X_test)
    xgb_proba = xgb.predict_proba(X_test)[:, 1]
    print("\n--- XGBoost ---")
    print("Accuracy:", round(accuracy_score(y_test, xgb_pred), 4))
    print("ROC-AUC:", round(roc_auc_score(y_test, xgb_proba), 4))
    print(classification_report(y_test, xgb_pred, target_names=["not_ready", "ready"]))

    joblib.dump(rf, "models/promotion_rf.joblib")
    joblib.dump(xgb, "models/promotion_xgb.joblib")


def main():
    df = pd.read_csv("data/employee_performance_dataset.csv")
    train_rating_models(df)
    train_promotion_models(df)

    with open("models/feature_columns.json", "w") as f:
        json.dump(FEATURE_COLUMNS, f)

    print("\nAll models saved to models/")


if __name__ == "__main__":
    main()
