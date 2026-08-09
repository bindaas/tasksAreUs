import { describe, it, expect, vi, afterEach } from 'vitest';
import { isPriorityEligible, isFormPriorityEligible, splitByPriority, canAddHighPriority, HIGH_PRIORITY_DAILY_LIMIT, shiftPriorityTier, resolveShiftedPriorityTier, resolveDropPriority, highPriorityTasksInSameColumn } from '../utils/taskPriority';
import type { PriorityTier, Task } from '../api/tasks';

function makeTask(id: string, priority: PriorityTier): Task {
  return {
    id,
    board_id: 'board-1',
    title: `Task ${id}`,
    notes: null,
    state: 'pending',
    must_do_by: null,
    target_date: null,
    completed_at: null,
    labels: [],
    priority,
    is_high_priority: priority === 'high',
    is_deleted: false,
    links: [],
    sort_order: 0,
    created_at: '2026-05-26T00:00:00Z',
    updated_at: '2026-05-26T00:00:00Z',
  };
}

function makeTaskWithDate(id: string, priority: PriorityTier, mustDoBy: string): Task {
  return { ...makeTask(id, priority), must_do_by: mustDoBy };
}

describe('isPriorityEligible', () => {
  it('returns true for today', () => {
    expect(isPriorityEligible('today')).toBe(true);
  });

  it('returns true for tomorrow', () => {
    expect(isPriorityEligible('tomorrow')).toBe(true);
  });

  it('returns false for upcoming', () => {
    expect(isPriorityEligible('upcoming')).toBe(false);
  });

  it('returns false for nodate', () => {
    expect(isPriorityEligible('nodate')).toBe(false);
  });

  it('returns false for overdue', () => {
    expect(isPriorityEligible('overdue')).toBe(false);
  });

  it('returns true for day_after_tomorrow', () => {
    expect(isPriorityEligible('day_after_tomorrow')).toBe(true);
  });

  it('returns true for monday', () => {
    expect(isPriorityEligible('monday')).toBe(true);
  });
});

describe('isFormPriorityEligible', () => {
  const TODAY = '2026-06-05';
  const TOMORROW = '2026-06-06';
  const DAY_AFTER_TOMORROW = '2026-06-07';
  const YESTERDAY = '2026-06-04';
  const NEXT_WEEK = '2026-06-12';

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns true when mustDoBy is today', () => {
    expect(isFormPriorityEligible(TODAY, '', TODAY, TOMORROW)).toBe(true);
  });

  it('returns true when mustDoBy is tomorrow', () => {
    expect(isFormPriorityEligible(TOMORROW, '', TODAY, TOMORROW)).toBe(true);
  });

  it('returns true when mustDoBy is in the past (overdue)', () => {
    expect(isFormPriorityEligible(YESTERDAY, '', TODAY, TOMORROW)).toBe(true);
  });

  it('returns true when mustDoBy is the day after tomorrow', () => {
    expect(isFormPriorityEligible(DAY_AFTER_TOMORROW, '', TODAY, TOMORROW)).toBe(true);
  });

  it('returns false when mustDoBy is after day after tomorrow (upcoming)', () => {
    expect(isFormPriorityEligible(NEXT_WEEK, '', TODAY, TOMORROW)).toBe(false);
  });

  it('returns true when targetDate is today', () => {
    expect(isFormPriorityEligible('', TODAY, TODAY, TOMORROW)).toBe(true);
  });

  it('returns true when targetDate is in the past (overdue)', () => {
    expect(isFormPriorityEligible('', YESTERDAY, TODAY, TOMORROW)).toBe(true);
  });

  it('returns true when targetDate is the day after tomorrow', () => {
    expect(isFormPriorityEligible('', DAY_AFTER_TOMORROW, TODAY, TOMORROW)).toBe(true);
  });

  it('returns false when targetDate is after day after tomorrow', () => {
    expect(isFormPriorityEligible('', NEXT_WEEK, TODAY, TOMORROW)).toBe(false);
  });

  it('returns false when both dates are empty', () => {
    expect(isFormPriorityEligible('', '', TODAY, TOMORROW)).toBe(false);
  });

  it('returns true when either date qualifies (targetDate overdue, mustDoBy upcoming)', () => {
    expect(isFormPriorityEligible(NEXT_WEEK, YESTERDAY, TODAY, TOMORROW)).toBe(true);
  });

  it('returns true when mustDoBy is Monday and today is Friday', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-29T12:00:00')); // Friday
    expect(isFormPriorityEligible('2026-06-01', '', '2026-05-29', '2026-05-30')).toBe(true);
  });

  it('returns false when mustDoBy is Monday but today is not Friday', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-25T12:00:00')); // Monday
    expect(isFormPriorityEligible('2026-06-01', '', '2026-05-25', '2026-05-26')).toBe(false);
  });
});

describe('splitByPriority', () => {
  it('splits high, medium, and normal tasks correctly', () => {
    const tasks = [
      makeTask('a', 'high'),
      makeTask('b', 'normal'),
      makeTask('c', 'high'),
      makeTask('d', 'medium'),
      makeTask('e', 'normal'),
    ];
    const { high, medium, normal } = splitByPriority(tasks);
    expect(high.map((t) => t.id)).toEqual(['a', 'c']);
    expect(medium.map((t) => t.id)).toEqual(['d']);
    expect(normal.map((t) => t.id)).toEqual(['b', 'e']);
  });

  it('returns all tasks in normal when none are high or medium', () => {
    const tasks = [makeTask('a', 'normal'), makeTask('b', 'normal')];
    const { high, medium, normal } = splitByPriority(tasks);
    expect(high).toHaveLength(0);
    expect(medium).toHaveLength(0);
    expect(normal).toHaveLength(2);
  });

  it('returns all tasks in high when all are high', () => {
    const tasks = [makeTask('a', 'high'), makeTask('b', 'high')];
    const { high, medium, normal } = splitByPriority(tasks);
    expect(high).toHaveLength(2);
    expect(medium).toHaveLength(0);
    expect(normal).toHaveLength(0);
  });

  it('returns all tasks in medium when all are medium', () => {
    const tasks = [makeTask('a', 'medium'), makeTask('b', 'medium')];
    const { high, medium, normal } = splitByPriority(tasks);
    expect(high).toHaveLength(0);
    expect(medium).toHaveLength(2);
    expect(normal).toHaveLength(0);
  });

  it('handles empty array', () => {
    const { high, medium, normal } = splitByPriority([]);
    expect(high).toHaveLength(0);
    expect(medium).toHaveLength(0);
    expect(normal).toHaveLength(0);
  });
});

describe('canAddHighPriority', () => {
  it('returns true when fewer than limit high-priority tasks exist', () => {
    const high = [makeTask('a', 'high'), makeTask('b', 'high')];
    expect(canAddHighPriority(high, makeTask('c', 'normal'), 3)).toBe(true);
  });

  it('returns false when limit is reached and dropped task is not high', () => {
    const high = Array.from({ length: HIGH_PRIORITY_DAILY_LIMIT }, (_, i) =>
      makeTask(String(i), 'high'),
    );
    expect(canAddHighPriority(high, makeTask('new', 'normal'), HIGH_PRIORITY_DAILY_LIMIT)).toBe(false);
  });

  it('returns true when limit is reached but dropped task is already in the high list', () => {
    const high = Array.from({ length: HIGH_PRIORITY_DAILY_LIMIT }, (_, i) =>
      makeTask(String(i), 'high'),
    );
    expect(canAddHighPriority(high, makeTask('0', 'high'), HIGH_PRIORITY_DAILY_LIMIT)).toBe(true);
  });

  it('returns true when high list is empty', () => {
    expect(canAddHighPriority([], makeTask('a', 'normal'), 3)).toBe(true);
  });

  it('respects a custom limit', () => {
    const high = [makeTask('a', 'high')];
    expect(canAddHighPriority(high, makeTask('b', 'normal'), 1)).toBe(false);
    expect(canAddHighPriority(high, makeTask('b', 'normal'), 2)).toBe(true);
  });
});

describe('shiftPriorityTier', () => {
  it('shifts up one step at a time', () => {
    expect(shiftPriorityTier('normal', 1)).toBe('medium');
    expect(shiftPriorityTier('medium', 1)).toBe('high');
  });

  it('shifts down one step at a time', () => {
    expect(shiftPriorityTier('high', -1)).toBe('medium');
    expect(shiftPriorityTier('medium', -1)).toBe('normal');
  });

  it('shifts two steps at once', () => {
    expect(shiftPriorityTier('normal', 2)).toBe('high');
    expect(shiftPriorityTier('high', -2)).toBe('normal');
  });

  it('clamps at the top of the ladder', () => {
    expect(shiftPriorityTier('high', 1)).toBe('high');
    expect(shiftPriorityTier('medium', 2)).toBe('high');
  });

  it('clamps at the bottom of the ladder', () => {
    expect(shiftPriorityTier('normal', -1)).toBe('normal');
    expect(shiftPriorityTier('medium', -2)).toBe('normal');
  });
});

describe('resolveShiftedPriorityTier', () => {
  it('allows an upward shift on an eligible column', () => {
    expect(resolveShiftedPriorityTier('normal', 1, 'today')).toBe('medium');
    expect(resolveShiftedPriorityTier('medium', 1, 'tomorrow')).toBe('high');
    expect(resolveShiftedPriorityTier('normal', 2, 'day_after_tomorrow')).toBe('high');
  });

  it('demotes an upward shift to normal on an ineligible column', () => {
    expect(resolveShiftedPriorityTier('normal', 1, 'upcoming')).toBe('normal');
    expect(resolveShiftedPriorityTier('normal', 2, 'nodate')).toBe('normal');
    expect(resolveShiftedPriorityTier('medium', 1, 'overdue')).toBe('normal');
  });

  it('never gates a downward shift, even on an ineligible column', () => {
    expect(resolveShiftedPriorityTier('high', -1, 'upcoming')).toBe('medium');
    expect(resolveShiftedPriorityTier('high', -2, 'overdue')).toBe('normal');
    expect(resolveShiftedPriorityTier('medium', -1, 'upcoming')).toBe('normal');
  });

  it('is eligible on day_after_tomorrow and monday', () => {
    expect(resolveShiftedPriorityTier('normal', 1, 'day_after_tomorrow')).toBe('medium');
    expect(resolveShiftedPriorityTier('normal', 1, 'monday')).toBe('medium');
  });
});

describe('resolveDropPriority', () => {
  it('keeps a high drop on an eligible column', () => {
    expect(resolveDropPriority('high', 'today')).toBe('high');
  });

  it('keeps a medium drop on an eligible column', () => {
    expect(resolveDropPriority('medium', 'tomorrow')).toBe('medium');
  });

  it('demotes a high drop to normal on an ineligible column', () => {
    expect(resolveDropPriority('high', 'upcoming')).toBe('normal');
    expect(resolveDropPriority('high', 'nodate')).toBe('normal');
  });

  it('demotes a medium drop to normal on an ineligible column', () => {
    expect(resolveDropPriority('medium', 'overdue')).toBe('normal');
  });

  it('leaves a normal drop unchanged regardless of eligibility', () => {
    expect(resolveDropPriority('normal', 'today')).toBe('normal');
    expect(resolveDropPriority('normal', 'upcoming')).toBe('normal');
  });
});

describe('highPriorityTasksInSameColumn', () => {
  const TODAY = '2026-06-05';
  const TOMORROW = '2026-06-06';

  it('only counts high-priority tasks on the same date as target', () => {
    const tasks = [
      makeTaskWithDate('a', 'high', TODAY),
      makeTaskWithDate('b', 'high', TOMORROW),
      makeTaskWithDate('c', 'medium', TODAY),
    ];
    const target = makeTaskWithDate('target', 'medium', TODAY);
    const result = highPriorityTasksInSameColumn(tasks, target, TODAY, TOMORROW);
    expect(result.map((t) => t.id)).toEqual(['a']);
  });

  it('excludes high-priority tasks on a different day even if otherwise identical', () => {
    const tasks = [makeTaskWithDate('a', 'high', TOMORROW)];
    const target = makeTaskWithDate('target', 'normal', TODAY);
    expect(highPriorityTasksInSameColumn(tasks, target, TODAY, TOMORROW)).toHaveLength(0);
  });

  it('returns an empty array when no tasks share the column', () => {
    const target = makeTaskWithDate('target', 'normal', TODAY);
    expect(highPriorityTasksInSameColumn([], target, TODAY, TOMORROW)).toHaveLength(0);
  });

  it('composes with canAddHighPriority to correctly scope a multi-day task list', () => {
    // Regression case for the bug this function fixes: a naive unscoped count across
    // both days would wrongly report the cap as reached for TOMORROW's target even
    // though only TODAY is actually at the limit.
    const tasks = [
      makeTaskWithDate('a', 'high', TODAY),
      makeTaskWithDate('b', 'high', TODAY),
      makeTaskWithDate('c', 'high', TODAY),
    ];
    const target = makeTaskWithDate('target', 'medium', TOMORROW);
    const scoped = highPriorityTasksInSameColumn(tasks, target, TODAY, TOMORROW);
    expect(scoped).toHaveLength(0);
    expect(canAddHighPriority(scoped, target, 3)).toBe(true);
  });
});
