import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import {
  dateOnly,
  formatDate,
  formatDateWithDay,
  isOverdue,
  getEffectiveDate,
  getColumn,
  getDropDate,
  isFriday,
} from '../utils/taskDateUtils';

function mockNow(isoDate: string) {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(isoDate + 'T12:00:00'));
}

afterEach(() => {
  vi.useRealTimers();
});

// ── dateOnly ──────────────────────────────────────────────────────────────────

describe('dateOnly', () => {
  it('formats a date as YYYY-MM-DD', () => {
    expect(dateOnly(new Date('2026-05-25T00:00:00'))).toBe('2026-05-25');
  });

  it('pads month and day with zeros', () => {
    expect(dateOnly(new Date('2026-01-03T00:00:00'))).toBe('2026-01-03');
  });
});

// ── formatDate ────────────────────────────────────────────────────────────────

describe('formatDate', () => {
  it('omits year when date is in the current year', () => {
    mockNow('2026-05-25');
    const result = formatDate('2026-05-25');
    expect(result).not.toMatch(/2026/);
    expect(result).toMatch(/May/);
  });

  it('includes year when date is in a different year', () => {
    mockNow('2026-05-25');
    const result = formatDate('2025-03-10');
    expect(result).toMatch(/2025/);
  });

  it('includes year for a future year', () => {
    mockNow('2026-05-25');
    const result = formatDate('2027-01-01');
    expect(result).toMatch(/2027/);
  });
});

// ── isOverdue ─────────────────────────────────────────────────────────────────

describe('isOverdue', () => {
  it('returns false for null', () => {
    expect(isOverdue(null)).toBe(false);
  });

  it('returns true for a date in the past', () => {
    mockNow('2026-05-25');
    expect(isOverdue('2026-05-24')).toBe(true);
  });

  it('returns false for today', () => {
    mockNow('2026-05-25');
    expect(isOverdue('2026-05-25')).toBe(false);
  });

  it('returns false for a future date', () => {
    mockNow('2026-05-25');
    expect(isOverdue('2026-05-26')).toBe(false);
  });
});

// ── getEffectiveDate ──────────────────────────────────────────────────────────

describe('getEffectiveDate', () => {
  it('returns null when both dates are null', () => {
    expect(getEffectiveDate({ must_do_by: null, target_date: null })).toBeNull();
  });

  it('returns must_do_by when target_date is null', () => {
    expect(getEffectiveDate({ must_do_by: '2026-06-01', target_date: null })).toBe('2026-06-01');
  });

  it('returns target_date when must_do_by is null', () => {
    expect(getEffectiveDate({ must_do_by: null, target_date: '2026-06-01' })).toBe('2026-06-01');
  });

  it('returns earliest date when both are set', () => {
    expect(getEffectiveDate({ must_do_by: '2026-06-10', target_date: '2026-06-01' })).toBe('2026-06-01');
    expect(getEffectiveDate({ must_do_by: '2026-06-01', target_date: '2026-06-10' })).toBe('2026-06-01');
  });

  it('returns target_date when both dates are equal', () => {
    expect(getEffectiveDate({ must_do_by: '2026-06-01', target_date: '2026-06-01' })).toBe('2026-06-01');
  });
});

// ── getColumn ─────────────────────────────────────────────────────────────────

describe('getColumn', () => {
  const today = '2026-05-25';
  const tomorrow = '2026-05-26';

  it('assigns to nodate when no dates set', () => {
    expect(getColumn({ must_do_by: null, target_date: null }, today, tomorrow)).toBe('nodate');
  });

  it('assigns to today when effective date equals today', () => {
    expect(getColumn({ must_do_by: today, target_date: null }, today, tomorrow)).toBe('today');
  });

  it('assigns overdue tasks to overdue', () => {
    expect(getColumn({ must_do_by: '2026-05-20', target_date: null }, today, tomorrow)).toBe('overdue');
  });

  it('assigns to tomorrow when effective date equals tomorrow', () => {
    expect(getColumn({ must_do_by: tomorrow, target_date: null }, today, tomorrow)).toBe('tomorrow');
  });

  it('assigns to day_after_tomorrow when effective date is two days from now', () => {
    expect(getColumn({ must_do_by: '2026-05-27', target_date: null }, today, tomorrow)).toBe('day_after_tomorrow');
  });

  it('assigns to upcoming when effective date is three or more days from now', () => {
    expect(getColumn({ must_do_by: '2026-05-28', target_date: null }, today, tomorrow)).toBe('upcoming');
    expect(getColumn({ must_do_by: '2026-06-01', target_date: null }, today, tomorrow)).toBe('upcoming');
  });

  it('uses earliest date for column assignment when both are set', () => {
    // target_date is earlier (today), must_do_by is upcoming
    expect(getColumn({ must_do_by: '2026-06-01', target_date: today }, today, tomorrow)).toBe('today');
    // must_do_by is earlier (today), target_date is upcoming
    expect(getColumn({ must_do_by: today, target_date: '2026-06-01' }, today, tomorrow)).toBe('today');
  });
});

// ── getDropDate ───────────────────────────────────────────────────────────────

describe('getDropDate', () => {
  beforeEach(() => mockNow('2026-05-25'));

  it('returns null for nodate column', () => {
    expect(getDropDate('nodate')).toBeNull();
  });

  it('returns null for overdue column', () => {
    expect(getDropDate('overdue')).toBeNull();
  });

  it('returns today for today column', () => {
    expect(getDropDate('today')).toBe('2026-05-25');
  });

  it('returns tomorrow for tomorrow column', () => {
    expect(getDropDate('tomorrow')).toBe('2026-05-26');
  });

  it('returns day after tomorrow for day_after_tomorrow column', () => {
    expect(getDropDate('day_after_tomorrow')).toBe('2026-05-27');
  });

  it('returns 7 days from today for upcoming column', () => {
    expect(getDropDate('upcoming')).toBe('2026-06-01');
  });

  it('returns monday for monday column (when today is Friday)', () => {
    vi.useRealTimers();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-29T12:00:00')); // Friday
    expect(getDropDate('monday')).toBe('2026-06-01');
  });
});

// ── formatDateWithDay ────────────────────────────────────────────────────────────

describe('formatDateWithDay', () => {
  it('formats date with month, day, and day name', () => {
    const result = formatDateWithDay('2026-07-27');
    expect(result).toMatch(/July.*27.*Monday/);
  });

  it('includes correct day name for different dates', () => {
    const result = formatDateWithDay('2026-07-28');
    expect(result).toMatch(/July.*28.*Tuesday/);
  });

  it('handles month transitions', () => {
    const result = formatDateWithDay('2026-08-01');
    expect(result).toMatch(/August.*1.*Saturday/);
  });
});

// ── isFriday ──────────────────────────────────────────────────────────────────

describe('isFriday', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns true when today is Friday', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-29T12:00:00')); // Friday
    expect(isFriday()).toBe(true);
  });

  it('returns false when today is not Friday', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-25T12:00:00')); // Monday
    expect(isFriday()).toBe(false);
  });

  it('returns false on Saturday', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-30T12:00:00')); // Saturday
    expect(isFriday()).toBe(false);
  });
});

// ── getColumn with Monday ─────────────────────────────────────────────────────────

describe('getColumn with Monday', () => {
  it('assigns to monday when today is Friday and effective date equals Monday', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-29T12:00:00')); // Friday
    const today = '2026-05-29';
    const tomorrow = '2026-05-30';
    expect(getColumn({ must_do_by: '2026-06-01', target_date: null }, today, tomorrow)).toBe('monday');
  });

  it('assigns to upcoming when today is not Friday even if date would be Monday', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-25T12:00:00')); // Monday
    const today = '2026-05-25';
    const tomorrow = '2026-05-26';
    expect(getColumn({ must_do_by: '2026-06-01', target_date: null }, today, tomorrow)).toBe('upcoming');
  });

  afterEach(() => {
    vi.useRealTimers();
  });
});

