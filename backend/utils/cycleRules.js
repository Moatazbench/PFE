const PHASE_DATE_FIELDS = [
  'phase1Start',
  'phase1End',
  'phase2Start',
  'phase2End',
  'phase3Start',
  'phase3End',
];

function validatePhaseDates(body, existing) {
  const dates = {};

  PHASE_DATE_FIELDS.forEach(function (field) {
    if (body[field] !== undefined && body[field] !== null && body[field] !== '') {
      dates[field] = new Date(body[field]);
    } else if (existing && existing[field]) {
      dates[field] = new Date(existing[field]);
    }
  });

  for (let index = 0; index < PHASE_DATE_FIELDS.length; index += 1) {
    const field = PHASE_DATE_FIELDS[index];
    if (dates[field] && Number.isNaN(dates[field].getTime())) {
      return field + ' must be a valid date.';
    }
  }

  const ordered = PHASE_DATE_FIELDS.filter(function (field) { return dates[field] != null; });
  for (let index = 1; index < ordered.length; index += 1) {
    if (dates[ordered[index]] <= dates[ordered[index - 1]]) {
      return 'Phase dates must be strictly sequential and cannot overlap: '
        + ordered[index] + ' must be after ' + ordered[index - 1] + '.';
    }
  }

  return null;
}

module.exports = { PHASE_DATE_FIELDS, validatePhaseDates };
