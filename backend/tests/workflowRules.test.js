const {
  buildEvaluationReviewChecklist,
  getBlockingEvaluationReviewIssues,
  validateBonusPenaltyInput
} = require('../utils/workflowRules');

describe('workflow rules', () => {
  test('builds HR review warnings for incomplete evaluations', () => {
    const warnings = buildEvaluationReviewChecklist({
      employee_id: 'employee-id',
      cycle_id: 'cycle-id',
      auto_score: 62,
      manager_score: 42,
      score_difference: -20,
      final_score: 42,
      rating_label: 'strong',
      strengths: [],
      weaknesses: [],
      manager_comments: '',
      recommendation: 'bonus_eligible',
      manager_adjustment_justification: '',
      hr_return_reason: '',
      objective_breakdown: [],
      ai_assisted: false,
    }, {
      hasImprovementPlan: false,
      hasBonusDocumentation: false,
      hasCareerRecommendation: false,
    });

    expect(warnings).toEqual(expect.arrayContaining([
      expect.stringContaining('Manager score differs from the suggested score'),
      expect.stringContaining('Low performance evaluation has no improvement plan'),
      expect.stringContaining('Rating does not match the final score'),
      expect.stringContaining('Bonus recommendation is missing a documented reason'),
    ]));
  });

  test('blocks HR review when manager-owned report fields are incomplete', () => {
    const issues = getBlockingEvaluationReviewIssues({
      status: 'pending_hr',
      final_score: 72,
      rating_label: 'meets_expectations',
      manager_comments: '',
      strengths: [],
      weaknesses: [],
      objective_breakdown: [],
      ai_assisted: true,
      ai_reviewed_by_manager: false,
    });

    expect(issues).toEqual(expect.arrayContaining([
      'Manager comments are missing.',
      'Strengths are missing.',
      'Weaknesses are missing.',
      'Objective contribution breakdown is missing.',
      'The manager must review the AI-assisted draft before HR review.',
    ]));
  });

  test('rejects non-positive bonus or penalty values', () => {
    const result = validateBonusPenaltyInput({ type: 'bonus', value: 0, reason: 'Good work' });
    expect(result.isValid).toBe(false);
    expect(result.errors).toEqual(expect.arrayContaining([
      expect.stringContaining('Value must be a positive number greater than zero')
    ]));
  });
});
