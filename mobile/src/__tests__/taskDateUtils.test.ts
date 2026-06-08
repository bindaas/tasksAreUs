import { dateOnly, formatDate, isOverdue, getEffectiveDate, getColumn } from '../utils/taskDateUtils';

describe('dateOnly', () => {
  it('formats a Date to YYYY-MM-DD', () => {
    expect(dateOnly(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(dateOnly(new Date(2026, 11, 31))).toBe('2026-12-31');
  });
});

describe('formatDate', () => {
  it('omits year when same as current year', () => {
    const currentYear = new Date().getFullYear();
    const result = formatDate(`${currentYear}-03-15`);
    expect(result).not.toContain(String(currentYear));
    expect(result).toMatch(/Mar/i);
  });

  it('includes year for past years', () => {
    const result = formatDate('2020-06-01');
    expect(result).toContain('2020');
  });
});

describe('isOverdue', () => {
  it('returns false for null', () => {
    expect(isOverdue(null)).toBe(false);
  });

  it('returns true for a past date', () => {
    expect(isOverdue('2000-01-01')).toBe(true);
  });

  it('returns false for today', () => {
    const today = dateOnly(new Date());
    expect(isOverdue(today)).toBe(false);
  });

  it('returns false for a future date', () => {
    expect(isOverdue('2099-12-31')).toBe(false);
  });
});

describe('getEffectiveDate', () => {
  it('returns null when both are null', () => {
    expect(getEffectiveDate({ target_date: null, must_do_by: null })).toBeNull();
  });

  it('returns target_date when must_do_by is null', () => {
    expect(getEffectiveDate({ target_date: '2026-03-01', must_do_by: null })).toBe('2026-03-01');
  });

  it('returns must_do_by when target_date is null', () => {
    expect(getEffectiveDate({ target_date: null, must_do_by: '2026-03-05' })).toBe('2026-03-05');
  });

  it('returns earliest date when both are set — target_date earlier', () => {
    expect(getEffectiveDate({ target_date: '2026-03-01', must_do_by: '2026-03-05' })).toBe('2026-03-01');
  });

  it('returns earliest date when both are set — must_do_by earlier', () => {
    expect(getEffectiveDate({ target_date: '2026-06-15', must_do_by: '2026-06-08' })).toBe('2026-06-08');
  });
});

describe('getColumn', () => {
  const today = '2026-06-07';
  const tomorrow = '2026-06-08';

  it('returns nodate when no effective date', () => {
    expect(getColumn({ target_date: null, must_do_by: null }, today, tomorrow)).toBe('nodate');
  });

  it('returns overdue for past date', () => {
    expect(getColumn({ target_date: '2026-01-01', must_do_by: null }, today, tomorrow)).toBe('overdue');
  });

  it('returns today', () => {
    expect(getColumn({ target_date: today, must_do_by: null }, today, tomorrow)).toBe('today');
  });

  it('returns tomorrow', () => {
    expect(getColumn({ target_date: tomorrow, must_do_by: null }, today, tomorrow)).toBe('tomorrow');
  });

  it('returns day_after_tomorrow', () => {
    expect(getColumn({ target_date: '2026-06-09', must_do_by: null }, today, tomorrow)).toBe('day_after_tomorrow');
  });

  it('returns upcoming for further future dates', () => {
    expect(getColumn({ target_date: '2026-07-01', must_do_by: null }, today, tomorrow)).toBe('upcoming');
  });
});
