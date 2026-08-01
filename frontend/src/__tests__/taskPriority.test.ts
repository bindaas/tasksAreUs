import { describe, it, expect, vi, afterEach } from 'vitest';
import { isHighPriorityEligible, isFormHighPriorityEligible, splitByPriority, canAddHighPriority, HIGH_PRIORITY_DAILY_LIMIT } from '../utils/taskPriority';
import type { Task } from '../api/tasks';

function makeTask(id: string, is_high_priority: boolean): Task {
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
    is_high_priority,
    is_deleted: false,
    links: [],
    created_at: '2026-05-26T00:00:00Z',
    updated_at: '2026-05-26T00:00:00Z',
  };
}

describe('isHighPriorityEligible', () => {
  it('returns true for today', () => {
    expect(isHighPriorityEligible('today')).toBe(true);
  });

  it('returns true for tomorrow', () => {
    expect(isHighPriorityEligible('tomorrow')).toBe(true);
  });

  it('returns false for upcoming', () => {
    expect(isHighPriorityEligible('upcoming')).toBe(false);
  });

  it('returns false for nodate', () => {
    expect(isHighPriorityEligible('nodate')).toBe(false);
  });

  it('returns false for overdue', () => {
    expect(isHighPriorityEligible('overdue')).toBe(false);
  });

  it('returns true for day_after_tomorrow', () => {
    expect(isHighPriorityEligible('day_after_tomorrow')).toBe(true);
  });

  it('returns true for monday', () => {
    expect(isHighPriorityEligible('monday')).toBe(true);
  });
});

describe('isFormHighPriorityEligible', () => {
  const TODAY = '2026-06-05';
  const TOMORROW = '2026-06-06';
  const DAY_AFTER_TOMORROW = '2026-06-07';
  const YESTERDAY = '2026-06-04';
  const NEXT_WEEK = '2026-06-12';

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns true when mustDoBy is today', () => {
    expect(isFormHighPriorityEligible(TODAY, '', TODAY, TOMORROW)).toBe(true);
  });

  it('returns true when mustDoBy is tomorrow', () => {
    expect(isFormHighPriorityEligible(TOMORROW, '', TODAY, TOMORROW)).toBe(true);
  });

  it('returns true when mustDoBy is in the past (overdue)', () => {
    expect(isFormHighPriorityEligible(YESTERDAY, '', TODAY, TOMORROW)).toBe(true);
  });

  it('returns true when mustDoBy is the day after tomorrow', () => {
    expect(isFormHighPriorityEligible(DAY_AFTER_TOMORROW, '', TODAY, TOMORROW)).toBe(true);
  });

  it('returns false when mustDoBy is after day after tomorrow (upcoming)', () => {
    expect(isFormHighPriorityEligible(NEXT_WEEK, '', TODAY, TOMORROW)).toBe(false);
  });

  it('returns true when targetDate is today', () => {
    expect(isFormHighPriorityEligible('', TODAY, TODAY, TOMORROW)).toBe(true);
  });

  it('returns true when targetDate is in the past (overdue)', () => {
    expect(isFormHighPriorityEligible('', YESTERDAY, TODAY, TOMORROW)).toBe(true);
  });

  it('returns true when targetDate is the day after tomorrow', () => {
    expect(isFormHighPriorityEligible('', DAY_AFTER_TOMORROW, TODAY, TOMORROW)).toBe(true);
  });

  it('returns false when targetDate is after day after tomorrow', () => {
    expect(isFormHighPriorityEligible('', NEXT_WEEK, TODAY, TOMORROW)).toBe(false);
  });

  it('returns false when both dates are empty', () => {
    expect(isFormHighPriorityEligible('', '', TODAY, TOMORROW)).toBe(false);
  });

  it('returns true when either date qualifies (targetDate overdue, mustDoBy upcoming)', () => {
    expect(isFormHighPriorityEligible(NEXT_WEEK, YESTERDAY, TODAY, TOMORROW)).toBe(true);
  });

  it('returns true when mustDoBy is Monday and today is Friday', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-29T12:00:00')); // Friday
    expect(isFormHighPriorityEligible('2026-06-01', '', '2026-05-29', '2026-05-30')).toBe(true);
  });

  it('returns false when mustDoBy is Monday but today is not Friday', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-25T12:00:00')); // Monday
    expect(isFormHighPriorityEligible('2026-06-01', '', '2026-05-25', '2026-05-26')).toBe(false);
  });
});

describe('splitByPriority', () => {
  it('splits high and normal tasks correctly', () => {
    const tasks = [
      makeTask('a', true),
      makeTask('b', false),
      makeTask('c', true),
      makeTask('d', false),
    ];
    const { high, normal } = splitByPriority(tasks);
    expect(high.map((t) => t.id)).toEqual(['a', 'c']);
    expect(normal.map((t) => t.id)).toEqual(['b', 'd']);
  });

  it('returns all tasks in normal when none are high', () => {
    const tasks = [makeTask('a', false), makeTask('b', false)];
    const { high, normal } = splitByPriority(tasks);
    expect(high).toHaveLength(0);
    expect(normal).toHaveLength(2);
  });

  it('returns all tasks in high when all are high', () => {
    const tasks = [makeTask('a', true), makeTask('b', true)];
    const { high, normal } = splitByPriority(tasks);
    expect(high).toHaveLength(2);
    expect(normal).toHaveLength(0);
  });

  it('handles empty array', () => {
    const { high, normal } = splitByPriority([]);
    expect(high).toHaveLength(0);
    expect(normal).toHaveLength(0);
  });
});

describe('canAddHighPriority', () => {
  it('returns true when fewer than limit high-priority tasks exist', () => {
    const high = [makeTask('a', true), makeTask('b', true)];
    expect(canAddHighPriority(high, makeTask('c', false), 3)).toBe(true);
  });

  it('returns false when limit is reached and dropped task is not high', () => {
    const high = Array.from({ length: HIGH_PRIORITY_DAILY_LIMIT }, (_, i) =>
      makeTask(String(i), true),
    );
    expect(canAddHighPriority(high, makeTask('new', false), HIGH_PRIORITY_DAILY_LIMIT)).toBe(false);
  });

  it('returns true when limit is reached but dropped task is already in the high list', () => {
    const high = Array.from({ length: HIGH_PRIORITY_DAILY_LIMIT }, (_, i) =>
      makeTask(String(i), true),
    );
    expect(canAddHighPriority(high, makeTask('0', true), HIGH_PRIORITY_DAILY_LIMIT)).toBe(true);
  });

  it('returns true when high list is empty', () => {
    expect(canAddHighPriority([], makeTask('a', false), 3)).toBe(true);
  });

  it('respects a custom limit', () => {
    const high = [makeTask('a', true)];
    expect(canAddHighPriority(high, makeTask('b', false), 1)).toBe(false);
    expect(canAddHighPriority(high, makeTask('b', false), 2)).toBe(true);
  });
});
