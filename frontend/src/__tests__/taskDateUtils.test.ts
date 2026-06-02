import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import {
  dateOnly,
  formatDate,
  isOverdue,
  getEffectiveDate,
  getColumn,
  getDropDate,
  getEffectiveDateField,
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

  it('returns the earlier date when both are set', () => {
    expect(getEffectiveDate({ must_do_by: '2026-06-10', target_date: '2026-06-01' })).toBe('2026-06-01');
  });

  it('returns must_do_by when it is earlier', () => {
    expect(getEffectiveDate({ must_do_by: '2026-06-01', target_date: '2026-06-10' })).toBe('2026-06-01');
  });

  it('returns must_do_by when both dates are equal', () => {
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

  it('assigns to upcoming when effective date is after tomorrow', () => {
    expect(getColumn({ must_do_by: '2026-06-01', target_date: null }, today, tomorrow)).toBe('upcoming');
  });

  it('uses the earlier of two dates for column assignment', () => {
    // target is earlier → should use target date
    expect(getColumn({ must_do_by: '2026-06-01', target_date: today }, today, tomorrow)).toBe('today');
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

  it('returns 7 days from today for upcoming column', () => {
    expect(getDropDate('upcoming')).toBe('2026-06-01');
  });
});

// ── getEffectiveDateField ─────────────────────────────────────────────────────

describe('getEffectiveDateField', () => {
  it('returns must_do_by when only must_do_by is set', () => {
    expect(getEffectiveDateField({ must_do_by: '2026-06-01', target_date: null })).toBe('must_do_by');
  });

  it('returns target_date when only target_date is set', () => {
    expect(getEffectiveDateField({ must_do_by: null, target_date: '2026-06-01' })).toBe('target_date');
  });

  it('returns must_do_by when it is earlier than target_date', () => {
    expect(getEffectiveDateField({ must_do_by: '2026-06-01', target_date: '2026-06-10' })).toBe('must_do_by');
  });

  it('returns target_date when it is earlier than must_do_by', () => {
    expect(getEffectiveDateField({ must_do_by: '2026-06-10', target_date: '2026-06-01' })).toBe('target_date');
  });

  it('defaults to must_do_by when neither is set', () => {
    expect(getEffectiveDateField({ must_do_by: null, target_date: null })).toBe('must_do_by');
  });
});
