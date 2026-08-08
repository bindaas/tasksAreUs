import { describe, it, expect, vi, afterEach } from 'vitest';
import { computeInsertSortOrder } from '../utils/taskOrder';
import type { Task } from '../api/tasks';

function makeTask(id: string, sort_order: number): Task {
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
    priority: 'normal',
    is_high_priority: false,
    is_deleted: false,
    links: [],
    sort_order,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  };
}

describe('computeInsertSortOrder', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns a now-based value for an empty zone', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-01T00:00:00Z'));
    const result = computeInsertSortOrder([], 'dragged', null, null);
    expect(result).toBeCloseTo(Date.now() / 1000, 3);
  });

  it('appends to the end when there is no target (dropped on empty space)', () => {
    const zone = [makeTask('a', 1), makeTask('b', 2)];
    const result = computeInsertSortOrder(zone, 'dragged', null, null);
    expect(result).toBe(3);
  });

  it('inserts between two siblings', () => {
    const zone = [makeTask('a', 1), makeTask('b', 3)];
    const result = computeInsertSortOrder(zone, 'dragged', 'b', 'above');
    expect(result).toBe(2);
  });

  it('inserts as the first item when dropped above the first sibling', () => {
    const zone = [makeTask('a', 5), makeTask('b', 10)];
    const result = computeInsertSortOrder(zone, 'dragged', 'a', 'above');
    expect(result).toBe(4);
  });

  it('inserts as the last item when dropped below the last sibling', () => {
    const zone = [makeTask('a', 5), makeTask('b', 10)];
    const result = computeInsertSortOrder(zone, 'dragged', 'b', 'below');
    expect(result).toBe(11);
  });

  it('excludes the dragged task from its own neighbor lookup', () => {
    const zone = [makeTask('a', 1), makeTask('dragged', 2), makeTask('b', 3)];
    const result = computeInsertSortOrder(zone, 'dragged', 'b', 'above');
    expect(result).toBe(2); // midpoint of a(1) and b(3), dragged itself excluded
  });

  it('falls through to append-to-end on self-hover (targetTaskId === draggedTaskId)', () => {
    const zone = [makeTask('a', 1), makeTask('dragged', 2)];
    const result = computeInsertSortOrder(zone, 'dragged', 'dragged', 'above');
    expect(result).toBe(2); // dragged excluded from siblings -> idx===-1 -> append after a(1)
  });

  it('handles a target below with no "after" neighbor (last position)', () => {
    const zone = [makeTask('a', 1)];
    const result = computeInsertSortOrder(zone, 'dragged', 'a', 'below');
    expect(result).toBe(2);
  });

  it('handles a target above with no "before" neighbor (first position)', () => {
    const zone = [makeTask('a', 1)];
    const result = computeInsertSortOrder(zone, 'dragged', 'a', 'above');
    expect(result).toBe(0);
  });
});
