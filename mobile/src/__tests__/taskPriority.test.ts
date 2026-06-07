import {
  HIGH_PRIORITY_DAILY_LIMIT,
  isHighPriorityEligible,
  splitByPriority,
  canAddHighPriority,
} from '../utils/taskPriority';
import type { Task } from '../types';

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    title: 'Default task',
    notes: null,
    state: 'pending',
    must_do_by: null,
    target_date: null,
    completed_at: null,
    recurrence_group_id: null,
    labels: [],
    is_high_priority: false,
    is_deleted: false,
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

describe('isHighPriorityEligible', () => {
  it('returns true for today and tomorrow only', () => {
    expect(isHighPriorityEligible('today')).toBe(true);
    expect(isHighPriorityEligible('tomorrow')).toBe(true);
  });

  it('returns false for all other columns', () => {
    expect(isHighPriorityEligible('overdue')).toBe(false);
    expect(isHighPriorityEligible('day_after_tomorrow')).toBe(false);
    expect(isHighPriorityEligible('upcoming')).toBe(false);
    expect(isHighPriorityEligible('nodate')).toBe(false);
  });
});

describe('splitByPriority', () => {
  it('separates high and normal tasks', () => {
    const high = makeTask({ id: 'h1', is_high_priority: true });
    const normal = makeTask({ id: 'n1', is_high_priority: false });
    const result = splitByPriority([high, normal]);
    expect(result.high).toEqual([high]);
    expect(result.normal).toEqual([normal]);
  });

  it('handles empty list', () => {
    const result = splitByPriority([]);
    expect(result.high).toHaveLength(0);
    expect(result.normal).toHaveLength(0);
  });

  it('handles all high priority', () => {
    const tasks = [makeTask({ id: '1', is_high_priority: true }), makeTask({ id: '2', is_high_priority: true })];
    const result = splitByPriority(tasks);
    expect(result.high).toHaveLength(2);
    expect(result.normal).toHaveLength(0);
  });
});

describe('canAddHighPriority', () => {
  const existing = [
    makeTask({ id: 'a', is_high_priority: true }),
    makeTask({ id: 'b', is_high_priority: true }),
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
      makeTask({ id: `t${i}`, is_high_priority: true })
    );
    expect(canAddHighPriority(manyTasks, makeTask({ id: 'new' }))).toBe(false);
  });
});
