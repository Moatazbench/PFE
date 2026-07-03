const schemas = require('../validators/schemas');
const { validatePhaseDates } = require('../utils/cycleRules');

describe('critical request validation', () => {
  const validCycle = {
    name: 'Annual Cycle 2027',
    year: 2027,
    phase1Start: '2027-01-01',
    phase1End: '2027-03-01',
    phase2Start: '2027-03-02',
    phase2End: '2027-09-01',
    phase3Start: '2027-09-02',
    phase3End: '2027-12-15',
  };

  test('requires all cycle phase dates', () => {
    const result = schemas.cycle.create.validate(
      { name: 'Annual Cycle 2027', year: 2027 },
      { abortEarly: false }
    );
    expect(result.error).toBeDefined();
    expect(result.error.message).toContain('phase1Start');
    expect(result.error.message).toContain('phase3End');
  });

  test('accepts a complete cycle payload', () => {
    expect(schemas.cycle.create.validate(validCycle).error).toBeUndefined();
    expect(validatePhaseDates(validCycle)).toBeNull();
  });

  test('rejects overlap and out-of-order cycle phases', () => {
    expect(validatePhaseDates({
      ...validCycle,
      phase2Start: validCycle.phase1End,
    })).toContain('cannot overlap');
    expect(validatePhaseDates({
      ...validCycle,
      phase3Start: '2027-08-01',
    })).toContain('phase3Start');
  });

  test('accepts and preserves objective priority', () => {
    const result = schemas.objective.create.validate({
      title: 'Improve customer retention',
      description: '',
      successIndicator: 'Increase retention to at least 90 percent',
      weight: 30,
      priority: 'critical',
      cycle: '64b000000000000000000001',
      category: 'individual',
    });
    expect(result.error).toBeUndefined();
    expect(result.value.priority).toBe('critical');
  });

  test('rejects unknown objective priority', () => {
    const result = schemas.objective.create.validate({
      title: 'Improve customer retention',
      successIndicator: 'Increase retention to at least 90 percent',
      weight: 30,
      priority: 'whenever',
      cycle: '64b000000000000000000001',
    });
    expect(result.error).toBeDefined();
  });
});
