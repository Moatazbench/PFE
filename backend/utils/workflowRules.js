function buildEvaluationReviewChecklist(evaluation, context = {}) {
  const warnings = [];
  const hasFinalScore = evaluation?.final_score != null && Number.isFinite(Number(evaluation.final_score));
  const finalScore = Number(evaluation?.final_score ?? 0);
  const autoScore = Number(evaluation?.auto_score ?? 0);
  const managerScore = Number(evaluation?.manager_score ?? (evaluation?.auto_score == null ? finalScore : autoScore));
  const explicitScoreDifference = Number.isFinite(Number(evaluation?.score_difference))
    ? Number(evaluation.score_difference)
    : managerScore - autoScore;
  const scoreDifference = Number(explicitScoreDifference || 0);
  const hasManualScoreOverride = evaluation?.manager_score != null || (evaluation?.auto_score == null && evaluation?.final_score != null);
  if (!evaluation?.employee_id) {
    warnings.push('Evaluation is not linked to an employee.');
  }

  if (!evaluation?.cycle_id) {
    warnings.push('Evaluation is not linked to a cycle.');
  }

  if (!hasFinalScore) {
    warnings.push('Final score is missing.');
  }

  if (!String(evaluation?.rating_label || '').trim()) {
    warnings.push('Rating is missing.');
  }

  if (hasManualScoreOverride && Math.abs(scoreDifference) >= 10 && !String(evaluation?.manager_adjustment_justification || '').trim()) {
    warnings.push(`Manager score differs from the suggested score by ${Math.abs(scoreDifference)} points. Justification required.`);
  }

  if (finalScore < 50 && !context.hasImprovementPlan) {
    warnings.push('Low performance evaluation has no improvement plan.');
  }

  if (evaluation?.rating_label && hasFinalScore) {
    const derivedRating = finalScore >= 90 ? 'exceptional' : finalScore >= 75 ? 'strong' : finalScore >= 50 ? 'meets_expectations' : finalScore >= 30 ? 'needs_improvement' : 'unsatisfactory';
    if (evaluation.rating_label !== derivedRating) {
      warnings.push('Rating does not match the final score.');
    }
  }

  if (!String(evaluation?.manager_comments || '').trim()) {
    warnings.push('Manager comments are missing.');
  }

  if (!Array.isArray(evaluation?.strengths) || evaluation.strengths.length === 0) {
    warnings.push('Strengths are missing.');
  }

  if (!Array.isArray(evaluation?.weaknesses) || evaluation.weaknesses.length === 0) {
    warnings.push('Weaknesses are missing.');
  }

  if (!Array.isArray(evaluation?.objective_breakdown) || evaluation.objective_breakdown.length === 0) {
    warnings.push('Objective contribution breakdown is missing.');
  }

  if (evaluation?.ai_assisted && !evaluation?.ai_reviewed_by_manager) {
    warnings.push('AI-assisted draft has not been confirmed as reviewed by the manager.');
  }

  if (evaluation?.recommendation !== 'no_action' && !context.hasCareerRecommendation) {
    warnings.push('Career recommendation is missing.');
  }

  if (evaluation?.recommendation === 'bonus_eligible' && !context.hasBonusDocumentation) {
    warnings.push('Bonus recommendation is missing a documented reason.');
  }

  return warnings;
}

function getBlockingEvaluationReviewIssues(evaluation) {
  const issues = [];

  if (evaluation?.status !== 'pending_hr') {
    issues.push('Only manager-submitted evaluations can be marked as reviewed.');
  }
  if (evaluation?.final_score == null || !Number.isFinite(Number(evaluation.final_score))) {
    issues.push('Final score is missing.');
  }
  if (!String(evaluation?.rating_label || '').trim()) {
    issues.push('Rating is missing.');
  }
  if (!String(evaluation?.manager_comments || '').trim()) {
    issues.push('Manager comments are missing.');
  }
  if (!Array.isArray(evaluation?.strengths) || evaluation.strengths.length === 0) {
    issues.push('Strengths are missing.');
  }
  if (!Array.isArray(evaluation?.weaknesses) || evaluation.weaknesses.length === 0) {
    issues.push('Weaknesses are missing.');
  }
  if (!Array.isArray(evaluation?.objective_breakdown) || evaluation.objective_breakdown.length === 0) {
    issues.push('Objective contribution breakdown is missing.');
  }
  if (evaluation?.ai_assisted && !evaluation?.ai_reviewed_by_manager) {
    issues.push('The manager must review the AI-assisted draft before HR review.');
  }

  return issues;
}

function validateBonusPenaltyInput(payload = {}) {
  const errors = [];
  const value = Number(payload.value);

  if (!payload.type || !['bonus', 'penalty'].includes(payload.type)) {
    errors.push('Type must be bonus or penalty.');
  }

  if (!Number.isFinite(value) || value <= 0) {
    errors.push('Value must be a positive number greater than zero.');
  }

  if (!String(payload.reason || '').trim()) {
    errors.push('Reason is required.');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

module.exports = {
  buildEvaluationReviewChecklist,
  getBlockingEvaluationReviewIssues,
  validateBonusPenaltyInput,
};
