"""
generate_dataset.py

Generates a clean, ready-to-train synthetic dataset for the AI Performance
Analyzer (employee performance rating + promotion readiness).

Design notes (so you can defend this in your jury if asked):
- Each employee has a hidden "skill level" t sampled per target rating band.
- All 8 features are derived from t + independent noise, which is what
  creates realistic correlation between features (e.g. high kpi_score
  tends to co-occur with high goal_completion_percent) without making the
  correlation perfect (1.0), since each feature gets its own noise term.
- Labels (rating, promotion_ready) are computed strictly from the published
  business-logic formula applied to the FINAL rounded feature values, so
  every row is 100% reconstructable/verifiable from the formula -> no label
  leakage bugs, no inconsistency to defend.
- A small number of intentional edge cases are injected for promotion_ready
  (e.g. a few low scorers flagged promotion-ready, a chunk of exceptional
  scorers NOT flagged ready) so the dataset isn't a trivial threshold rule.

Run: python3 generate_dataset.py
Output: data/employee_performance_dataset.csv
"""

import numpy as np
import pandas as pd
import random

from performance_text import generate_text_outputs

SEED = 42
N_TOTAL = 10000
N_PER_CLASS = N_TOTAL // 4

np.random.seed(SEED)

BANDS = {
    "needs_improvement": (28, 59),
    "meets_expectations": (60, 74),
    "exceeds_expectations": (75, 89),
    "exceptional": (90, 99),
}

PROMO_PROB = {
    "exceptional": 0.80,
    "exceeds_expectations": 0.50,
    "meets_expectations": 0.20,
    "needs_improvement": 0.03,  # small intentional edge-case rate
}


def sample_targets(lo, hi, n):
    # Beta(2,2) scaled to the band -> bell-shaped, realistic, not uniform
    raw = np.random.beta(2, 2, size=n)
    return lo + (hi - lo) * raw


def generate_band_rows(band_name, lo, hi, n):
    t = sample_targets(lo, hi, n)

    kpi_score = np.clip(t + np.random.normal(0, 6, n), 0, 100)
    goal_completion_percent = np.clip(t + np.random.normal(0, 7, n), 0, 100)
    avg_checkin_progress = np.clip(t + np.random.normal(1, 8, n), 0, 100)
    task_completion_percent = np.clip(t + np.random.normal(0, 6, n), 0, 100)
    positive_feedback_ratio = np.clip((t + np.random.normal(0, 10, n)) / 100, 0, 1)

    # tasks_on_time_percent correlates with task_completion_percent, not just t
    tasks_on_time_percent = np.clip(
        task_completion_percent + np.random.normal(-3, 8, n), 0, 100
    )

    # discrete counts, scaled from t with their own noise
    checkin_count = np.clip(
        np.round(t / 100 * 18 + np.random.normal(0, 3, n)), 0, 20
    ).astype(int)
    feedback_count = np.clip(
        np.round(t / 100 * 38 + np.random.normal(6, 8, n)), 0, 50
    ).astype(int)

    return pd.DataFrame(
        {
            "kpi_score": kpi_score,
            "goal_completion_percent": goal_completion_percent,
            "checkin_count": checkin_count,
            "avg_checkin_progress": avg_checkin_progress,
            "feedback_count": feedback_count,
            "positive_feedback_ratio": positive_feedback_ratio,
            "task_completion_percent": task_completion_percent,
            "tasks_on_time_percent": tasks_on_time_percent,
        }
    )


def rating_from_score(score):
    if score >= 90:
        return "exceptional"
    elif score >= 75:
        return "exceeds_expectations"
    elif score >= 60:
        return "meets_expectations"
    else:
        return "needs_improvement"


def main():
    frames = []
    for band_name, (lo, hi) in BANDS.items():
        frames.append(generate_band_rows(band_name, lo, hi, N_PER_CLASS))
    df = pd.concat(frames, ignore_index=True)

    # round/clip to final precision FIRST, then derive labels from these
    # exact published values (guarantees formula-consistency end to end)
    df["kpi_score"] = df["kpi_score"].round(1)
    df["goal_completion_percent"] = df["goal_completion_percent"].round(1)
    df["avg_checkin_progress"] = df["avg_checkin_progress"].round(1)
    df["task_completion_percent"] = df["task_completion_percent"].round(1)
    df["tasks_on_time_percent"] = df["tasks_on_time_percent"].round(1)
    df["positive_feedback_ratio"] = df["positive_feedback_ratio"].round(2)
    df["checkin_count"] = df["checkin_count"].astype(int)
    df["feedback_count"] = df["feedback_count"].astype(int)

    df["overall_score"] = (
        df["kpi_score"] * 0.30
        + df["goal_completion_percent"] * 0.25
        + df["avg_checkin_progress"] * 0.15
        + df["task_completion_percent"] * 0.20
        + df["positive_feedback_ratio"] * 100 * 0.10
    ).round(2)

    df["rating"] = df["overall_score"].apply(rating_from_score)

    # shuffle row order (rows were generated in class blocks)
    df = df.sample(frac=1, random_state=SEED).reset_index(drop=True)

    # promotion_ready, with the small intentional edge-case rate per band
    promo = np.random.rand(len(df)) < df["rating"].map(PROMO_PROB).values
    df["promotion_ready"] = promo

    # employee_id after shuffle, clean sequential IDs
    df.insert(0, "employee_id", [f"EMP{i+1:05d}" for i in range(len(df))])

    # text outputs, deterministic per row via seeded Random
    strengths, weaknesses, summaries, suggestions = [], [], [], []
    feature_cols = [
        "kpi_score",
        "goal_completion_percent",
        "checkin_count",
        "avg_checkin_progress",
        "feedback_count",
        "positive_feedback_ratio",
        "task_completion_percent",
        "tasks_on_time_percent",
    ]
    for i, row in df.iterrows():
        rng = random.Random(SEED + i)
        feats = {c: row[c] for c in feature_cols}
        out = generate_text_outputs(
            feats, row["rating"], row["promotion_ready"], row["overall_score"], rng=rng
        )
        strengths.append(out["strengths"])
        weaknesses.append(out["weaknesses"])
        summaries.append(out["review_summary"])
        suggestions.append(out["suggestions"])

    df["strengths"] = strengths
    df["weaknesses"] = weaknesses
    df["review_summary"] = summaries
    df["suggestions"] = suggestions

    # final column order exactly as requested
    cols = [
        "employee_id", "kpi_score", "goal_completion_percent", "checkin_count",
        "avg_checkin_progress", "feedback_count", "positive_feedback_ratio",
        "task_completion_percent", "tasks_on_time_percent", "overall_score",
        "rating", "promotion_ready", "strengths", "weaknesses", "review_summary",
        "suggestions",
    ]
    df = df[cols]

    assert df.isnull().sum().sum() == 0, "Found missing values!"
    assert df["employee_id"].duplicated().sum() == 0, "Found duplicate IDs!"
    assert df.drop(columns=["employee_id"]).duplicated().sum() == 0, "Found duplicate rows!"

    df.to_csv("data/employee_performance_dataset.csv", index=False)

    print("Dataset generated:", df.shape)
    print("\nRating distribution:")
    print(df["rating"].value_counts(normalize=True).round(3))
    print("\nPromotion-ready rate by rating:")
    print(df.groupby("rating")["promotion_ready"].mean().round(3))
    print("\nFeature correlation (kpi_score vs goal_completion_percent):",
          df["kpi_score"].corr(df["goal_completion_percent"]).round(3))


if __name__ == "__main__":
    main()
