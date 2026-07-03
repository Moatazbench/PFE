"""
performance_text.py

Shared, deterministic-given-seed text generator for:
- strengths (2-4 bullets)
- weaknesses (1-3 bullets)
- review_summary (2-3 sentences)
- suggestions (2-4 actionable items)

Used by BOTH the dataset generator (so the CSV has realistic text) and the
Flask API (so live predictions return the same style of text). Keeping this
logic in one shared module guarantees consistency between training data and
production inference.
"""

import random

FEATURE_RANGES = {
    "kpi_score": (0, 100),
    "goal_completion_percent": (0, 100),
    "checkin_count": (0, 20),
    "avg_checkin_progress": (0, 100),
    "feedback_count": (0, 50),
    "positive_feedback_ratio": (0, 1),
    "task_completion_percent": (0, 100),
    "tasks_on_time_percent": (0, 100),
}

FEATURE_LABELS = {
    "kpi_score": "KPI achievement",
    "goal_completion_percent": "goal completion",
    "checkin_count": "check-in frequency",
    "avg_checkin_progress": "progress reporting",
    "feedback_count": "feedback engagement",
    "positive_feedback_ratio": "feedback sentiment",
    "task_completion_percent": "task completion",
    "tasks_on_time_percent": "on-time delivery",
}

STRENGTH_PHRASES = {
    "kpi_score": [
        "Consistently hits or exceeds assigned KPI targets",
        "Strong, reliable KPI achievement across the review period",
        "Objective-based metrics show sustained high performance",
    ],
    "goal_completion_percent": [
        "Successfully completes nearly all approved goals",
        "Strong track record of finishing assigned goals on schedule",
        "High rate of goal completion relative to peers",
    ],
    "checkin_count": [
        "Submits frequent, proactive progress check-ins",
        "Keeps managers well informed through regular check-ins",
        "Highly consistent check-in cadence throughout the period",
    ],
    "avg_checkin_progress": [
        "Reports steady, well-documented progress in check-ins",
        "Check-ins reflect clear, measurable advancement on goals",
        "Demonstrates strong self-tracking of progress over time",
    ],
    "feedback_count": [
        "Actively sought out and received feedback from peers and managers",
        "High level of engagement in the feedback process",
        "Regularly receives input that reinforces continuous improvement",
    ],
    "positive_feedback_ratio": [
        "Receives consistently positive feedback from peers and managers",
        "Feedback sentiment is overwhelmingly favorable",
        "Well regarded by colleagues based on feedback received",
    ],
    "task_completion_percent": [
        "Reliably completes the large majority of assigned tasks",
        "Task throughput is consistently high",
        "Strong execution on day-to-day assigned work",
    ],
    "tasks_on_time_percent": [
        "Demonstrates excellent time management, finishing tasks on schedule",
        "Rarely misses deadlines on assigned tasks",
        "Strong reliability in meeting delivery dates",
    ],
}

WEAKNESS_PHRASES = {
    "kpi_score": [
        "KPI achievement is below the level expected for the role",
        "Objective-based metrics lag behind targets",
        "Needs to close the gap on core KPI performance",
    ],
    "goal_completion_percent": [
        "Goal completion rate is below expectations",
        "A number of approved goals remain unfinished",
        "Struggles to consistently close out assigned goals",
    ],
    "checkin_count": [
        "Submits check-ins infrequently, limiting visibility into progress",
        "Low check-in frequency makes it hard to track ongoing work",
        "Inconsistent check-in habit during the review period",
    ],
    "avg_checkin_progress": [
        "Reported progress in check-ins is often limited or unclear",
        "Check-ins rarely reflect significant forward movement",
        "Progress updates lack the detail needed to track advancement",
    ],
    "feedback_count": [
        "Receives relatively little feedback from peers or managers",
        "Low engagement in the feedback process limits growth signal",
        "Would benefit from seeking out more frequent feedback",
    ],
    "positive_feedback_ratio": [
        "A notable share of feedback received has been critical",
        "Feedback sentiment is mixed to negative",
        "Peer and manager feedback points to recurring concerns",
    ],
    "task_completion_percent": [
        "A meaningful share of assigned tasks remain incomplete",
        "Task throughput is below what the role requires",
        "Struggles to keep pace with assigned workload",
    ],
    "tasks_on_time_percent": [
        "Frequently misses deadlines on assigned tasks",
        "On-time delivery rate is a recurring concern",
        "Time management on tasks needs improvement",
    ],
}

SUGGESTION_PHRASES = {
    "kpi_score": [
        "Work with your manager to break KPI targets into smaller, trackable milestones",
        "Identify the one or two KPIs with the biggest gap and prioritize them next cycle",
    ],
    "goal_completion_percent": [
        "Review open goals weekly and flag blockers early instead of at the deadline",
        "Re-scope any goals that are consistently slipping so they're realistic and achievable",
    ],
    "checkin_count": [
        "Set a recurring weekly reminder to submit a progress check-in",
        "Build check-ins into your existing workflow so they happen without extra friction",
    ],
    "avg_checkin_progress": [
        "Add concrete, measurable detail to check-ins instead of high-level status only",
        "Use check-ins to call out specific next steps, not just current state",
    ],
    "feedback_count": [
        "Proactively ask 2-3 colleagues for feedback after key deliverables",
        "Request a mid-cycle check-in with your manager to get more frequent input",
    ],
    "positive_feedback_ratio": [
        "Discuss recurring critical feedback themes directly with your manager and build an action plan",
        "Ask for specific examples behind critical feedback so it's actionable",
    ],
    "task_completion_percent": [
        "Audit your task backlog and deprioritize or delegate lower-impact items",
        "Break larger tasks into smaller steps to improve completion rate",
    ],
    "tasks_on_time_percent": [
        "Build in buffer time when estimating task deadlines",
        "Flag at-risk deadlines to your manager as soon as they're identified, not after the fact",
    ],
}

RATING_DESCRIPTORS = {
    "needs_improvement": "is currently falling short of core expectations for the role",
    "meets_expectations": "is reliably meeting the core expectations of the role",
    "exceeds_expectations": "is performing above expectations for the role",
    "exceptional": "is delivering exceptional, top-tier performance",
}

PROMOTION_PHRASES = {
    True: [
        "is considered ready for the next level of responsibility",
        "shows strong readiness for advancement",
    ],
    False: [
        "is not yet considered ready for promotion at this time",
        "would benefit from further development before advancement",
    ],
}


def _normalize(feature, value):
    lo, hi = FEATURE_RANGES[feature]
    return (value - lo) / (hi - lo) if hi > lo else 0.0


def generate_text_outputs(features, rating, promotion_ready, overall_score, rng=None):
    """
    features: dict with the 8 numerical feature values
    rating: one of the 4 rating strings
    promotion_ready: bool
    overall_score: float
    rng: optional random.Random instance for reproducibility; a new one is
         created if not provided.

    Returns dict with keys: strengths, weaknesses, review_summary, suggestions
    (strengths/weaknesses/suggestions are '; '-joined strings of bullet text,
    matching a flat CSV column; the Flask API also returns them as lists).
    """
    if rng is None:
        rng = random.Random()

    ranked = sorted(
        features.keys(),
        key=lambda f: _normalize(f, features[f]),
        reverse=True,
    )
    top_features = ranked[:4]
    bottom_features = ranked[::-1][:4]

    n_strengths = rng.randint(2, 4)
    n_weaknesses = rng.randint(1, 3)
    n_suggestions = rng.randint(2, 4)

    strengths = [
        rng.choice(STRENGTH_PHRASES[f]) for f in top_features[:n_strengths]
    ]
    weaknesses = [
        rng.choice(WEAKNESS_PHRASES[f]) for f in bottom_features[:n_weaknesses]
    ]
    suggestions = [
        rng.choice(SUGGESTION_PHRASES[f]) for f in bottom_features[:n_suggestions]
    ]

    top_label = FEATURE_LABELS[top_features[0]]
    bottom_label = FEATURE_LABELS[bottom_features[0]]
    descriptor = RATING_DESCRIPTORS[rating]
    promo_phrase = rng.choice(PROMOTION_PHRASES[bool(promotion_ready)])

    summary = (
        f"With an overall performance score of {overall_score:.1f}, this employee "
        f"{descriptor}. {top_label.capitalize()} stands out as the strongest area, "
        f"while {bottom_label} represents the clearest opportunity for growth. "
        f"Based on current performance, this employee {promo_phrase}."
    )

    return {
        "strengths": "; ".join(strengths),
        "weaknesses": "; ".join(weaknesses),
        "review_summary": summary,
        "suggestions": "; ".join(suggestions),
    }
