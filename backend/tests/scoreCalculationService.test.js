const {
  calculateWeightedScoreFromObjectives,
  determineRatingLabel,
} = require('../services/scoreCalculationService');

describe('weighted final evaluation scoring', () => {
  test('uses objective weights as score contribution', () => {
    const result = calculateWeightedScoreFromObjectives([
      { _id: 'a', title: 'Objective A', weight: 30, finalSelfPercent: 100, status: 'approved' },
      { _id: 'b', title: 'Objective B', weight: 30, finalSelfPercent: 60, status: 'approved' },
      { _id: 'c', title: 'Team Objective C', category: 'team', weight: 40, finalSelfPercent: 80, status: 'approved' },
    ]);

    expect(result.score).toBe(80);
    expect(result.totalWeight).toBe(100);
    expect(result.normalized).toBe(false);
    expect(result.breakdown.map((item) => item.weighted_points)).toEqual([30, 18, 32]);
  });

  test('uses manager-confirmed achievement instead of employee input', () => {
    const result = calculateWeightedScoreFromObjectives([
      { weight: 50, finalSelfPercent: 100, managerAdjustedPercent: 70, status: 'evaluated' },
      { weight: 50, finalSelfPercent: 80, managerAdjustedPercent: 90, status: 'evaluated' },
    ]);

    expect(result.score).toBe(80);
    expect(result.breakdown[0].employee_achievement).toBe(100);
    expect(result.breakdown[0].achievement_used).toBe(70);
  });

  test('does not divide a team objective weight by member count', () => {
    const employeeCopy = {
      title: 'Shared delivery target',
      category: 'team',
      assignedUsers: ['a', 'b', 'c', 'd'],
      weight: 40,
      managerAdjustedPercent: 80,
      status: 'evaluated',
    };

    const result = calculateWeightedScoreFromObjectives([
      employeeCopy,
      { title: 'Individual target', category: 'individual', weight: 60, managerAdjustedPercent: 100, status: 'evaluated' },
    ]);

    expect(result.breakdown[0].weighted_points).toBe(32);
    expect(result.score).toBe(92);
  });

  test('excludes draft objectives from the automatic score', () => {
    const result = calculateWeightedScoreFromObjectives([
      { title: 'Approved objective', weight: 100, managerAdjustedPercent: 80, status: 'approved' },
      { title: 'Unapproved draft', weight: 100, managerAdjustedPercent: 10, status: 'draft' },
    ]);

    expect(result.score).toBe(80);
    expect(result.breakdown).toHaveLength(1);
    expect(result.breakdown[0].title).toBe('Approved objective');
  });

  test('excludes non-final objective workflow statuses from the automatic score', () => {
    const result = calculateWeightedScoreFromObjectives([
      { title: 'Approved objective', weight: 50, managerAdjustedPercent: 80, status: 'approved' },
      { title: 'Evaluated objective', weight: 50, managerAdjustedPercent: 100, status: 'evaluated' },
      { title: 'Pending objective', weight: 100, managerAdjustedPercent: 10, status: 'pending' },
      { title: 'Assigned objective', weight: 100, managerAdjustedPercent: 10, status: 'assigned' },
      { title: 'Revision objective', weight: 100, managerAdjustedPercent: 10, status: 'revision_requested' },
    ]);

    expect(result.score).toBe(90);
    expect(result.breakdown.map((item) => item.title)).toEqual(['Approved objective', 'Evaluated objective']);
  });

  test('normalizes legacy or incomplete weight totals without penalizing missing administrative weight', () => {
    const result = calculateWeightedScoreFromObjectives([
      { weight: 40, managerAdjustedPercent: 100, status: 'evaluated' },
    ]);

    expect(result.rawWeightedPoints).toBe(40);
    expect(result.score).toBe(100);
    expect(result.normalized).toBe(true);
  });

  test.each([
    [95, 'exceptional'],
    [80, 'strong'],
    [60, 'meets_expectations'],
    [40, 'needs_improvement'],
    [20, 'unsatisfactory'],
  ])('maps score %s to rating %s', (score, expected) => {
    expect(determineRatingLabel(score)).toBe(expected);
  });
});
