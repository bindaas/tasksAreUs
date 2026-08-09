import {
  HIGH_PRIORITY_DAILY_LIMIT,
  PRIORITY_CYCLE,
  isPriorityEligible,
  isFormPriorityEligible,
  resolveNextPriorityTier,
  canAddHighPriority,
} from '../utils/taskPriority';
import type { Task } from '../types';

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    board_id: 'board-1',
    title: 'Default task',
    notes: null,
    state: 'pending',
    must_do_by: null,
    target_date: null,
    completed_at: null,
    labels: [],
    priority: 'normal',
    is_high_priority: false,
    is_deleted: false,
    links: [],
    sort_order: 0,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('HIGH_PRIORITY_DAILY_LIMIT', () => {
  it('defaults to 3', () => {
    expect(HIGH_PRIORITY_DAILY_LIMIT).toBe(3);
  });
});

describe('PRIORITY_CYCLE', () => {
  it('cycles normal -> medium -> high -> normal', () => {
    expect(PRIORITY_CYCLE.normal).toBe('medium');
    expect(PRIORITY_CYCLE.medium).toBe('high');
    expect(PRIORITY_CYCLE.high).toBe('normal');
  });
});

describe('isFormPriorityEligible', () => {
  const today = '2026-06-09';
  const tomorrow = '2026-06-10';
  const dayAfterTomorrow = '2026-06-11';
  const beyondDayAfterTomorrow = '2026-06-12';

  it('returns true when must_do_by is today', () => {
    expect(isFormPriorityEligible('2026-06-09', '', today, tomorrow)).toBe(true);
  });

  it('returns true when must_do_by is tomorrow', () => {
    expect(isFormPriorityEligible('2026-06-10', '', today, tomorrow)).toBe(true);
  });

  it('returns true when target_date is today', () => {
    expect(isFormPriorityEligible('', '2026-06-09', today, tomorrow)).toBe(true);
  });

  it('returns true when must_do_by is the day after tomorrow', () => {
    expect(isFormPriorityEligible(dayAfterTomorrow, '', today, tomorrow)).toBe(true);
  });

  it('returns true when target_date is the day after tomorrow', () => {
    expect(isFormPriorityEligible('', dayAfterTomorrow, today, tomorrow)).toBe(true);
  });

  it('returns false when must_do_by is past the day after tomorrow', () => {
    expect(isFormPriorityEligible(beyondDayAfterTomorrow, '', today, tomorrow)).toBe(false);
  });

  it('returns false when both dates are empty', () => {
    expect(isFormPriorityEligible('', '', today, tomorrow)).toBe(false);
  });

  it('returns true when must_do_by is overdue (past today)', () => {
    expect(isFormPriorityEligible('2026-06-01', '', today, tomorrow)).toBe(true);
  });

  it('returns true when either date qualifies (must_do_by far but target_date today)', () => {
    expect(isFormPriorityEligible('2026-07-01', '2026-06-09', today, tomorrow)).toBe(true);
  });
});

describe('isPriorityEligible', () => {
  it('returns true for today, tomorrow, and day_after_tomorrow', () => {
    expect(isPriorityEligible('today')).toBe(true);
    expect(isPriorityEligible('tomorrow')).toBe(true);
    expect(isPriorityEligible('day_after_tomorrow')).toBe(true);
  });

  it('returns false for all other columns', () => {
    expect(isPriorityEligible('overdue')).toBe(false);
    expect(isPriorityEligible('upcoming')).toBe(false);
    expect(isPriorityEligible('nodate')).toBe(false);
  });
});

describe('resolveNextPriorityTier', () => {
  it('advances normal -> medium -> high -> normal on an eligible column', () => {
    expect(resolveNextPriorityTier('normal', 'today')).toBe('medium');
    expect(resolveNextPriorityTier('medium', 'today')).toBe('high');
    expect(resolveNextPriorityTier('high', 'today')).toBe('normal');
  });

  it('demotes to normal instead of promoting on an ineligible column', () => {
    expect(resolveNextPriorityTier('normal', 'overdue')).toBe('normal');
    expect(resolveNextPriorityTier('medium', 'nodate')).toBe('normal');
  });

  it('always allows demoting high -> normal regardless of eligibility', () => {
    expect(resolveNextPriorityTier('high', 'upcoming')).toBe('normal');
  });
});

describe('canAddHighPriority', () => {
  const existing = [
    makeTask({ id: 'a', priority: 'high' }),
    makeTask({ id: 'b', priority: 'high' }),
  ];

  it('returns true when under the limit', () => {
    const newTask = makeTask({ id: 'c' });
    expect(canAddHighPriority(existing, newTask, 3)).toBe(true);
  });

  it('returns false when at the limit', () => {
    const newTask = makeTask({ id: 'c' });
    expect(canAddHighPriority(existing, newTask, 2)).toBe(false);
  });

  it('returns true when the task is already in the list (idempotent)', () => {
    expect(canAddHighPriority(existing, existing[0], 1)).toBe(true);
  });

  it('uses HIGH_PRIORITY_DAILY_LIMIT as default', () => {
    const manyTasks = Array.from({ length: HIGH_PRIORITY_DAILY_LIMIT }, (_, i) =>
      makeTask({ id: `t${i}`, priority: 'high' })
    );
    expect(canAddHighPriority(manyTasks, makeTask({ id: 'new' }))).toBe(false);
  });
});
