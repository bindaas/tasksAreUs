import { describe, it, expect } from 'vitest';
import { isHighPriorityEligible, splitByPriority, canAddHighPriority, HIGH_PRIORITY_DAILY_LIMIT } from '../utils/taskPriority';
import type { Task } from '../api/tasks';

function makeTask(id: string, is_high_priority: boolean): Task {
  return {
    id,
    title: `Task ${id}`,
    notes: null,
    state: 'pending',
    must_do_by: null,
    target_date: null,
    completed_at: null,
    recurrence_group_id: null,
    labels: [],
    is_high_priority,
    is_deleted: false,
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
    expect(canAddHighPriority(high, makeTask('c', false))).toBe(true);
  });

  it('returns false when limit is reached and dropped task is not high', () => {
    const high = Array.from({ length: HIGH_PRIORITY_DAILY_LIMIT }, (_, i) =>
      makeTask(String(i), true),
    );
    expect(canAddHighPriority(high, makeTask('new', false))).toBe(false);
  });

  it('returns true when limit is reached but dropped task is already in the high list', () => {
    const high = Array.from({ length: HIGH_PRIORITY_DAILY_LIMIT }, (_, i) =>
      makeTask(String(i), true),
    );
    expect(canAddHighPriority(high, makeTask('0', true))).toBe(true);
  });

  it('returns true when high list is empty', () => {
    expect(canAddHighPriority([], makeTask('a', false))).toBe(true);
  });
});
