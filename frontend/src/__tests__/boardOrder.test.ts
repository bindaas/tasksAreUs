import { describe, it, expect, vi, afterEach } from 'vitest';
import { computeBoardInsertSortOrder } from '../utils/boardOrder';
import type { Board } from '../api/boards';

function makeBoard(id: string, sort_order: number): Board {
  return {
    id,
    name: `Board ${id}`,
    is_default: false,
    is_deleted: false,
    color: null,
    sort_order,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  };
}

describe('computeBoardInsertSortOrder', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns a now-based value for an empty list', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-01T00:00:00Z'));
    const result = computeBoardInsertSortOrder([], 'dragged', null, null);
    expect(result).toBeCloseTo(Date.now() / 1000, 3);
  });

  it('returns a now-based value for a single-board list containing only the dragged board', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-01T00:00:00Z'));
    const boards = [makeBoard('dragged', 1)];
    const result = computeBoardInsertSortOrder(boards, 'dragged', null, null);
    expect(result).toBeCloseTo(Date.now() / 1000, 3);
  });

  it('appends to the end when there is no target (dropped on empty space)', () => {
    const boards = [makeBoard('a', 1), makeBoard('b', 2)];
    const result = computeBoardInsertSortOrder(boards, 'dragged', null, null);
    expect(result).toBe(3);
  });

  it('inserts between two siblings', () => {
    const boards = [makeBoard('a', 1), makeBoard('b', 3)];
    const result = computeBoardInsertSortOrder(boards, 'dragged', 'b', 'above');
    expect(result).toBe(2);
  });

  it('inserts at the top when dropped above the first board', () => {
    const boards = [makeBoard('a', 5), makeBoard('b', 10)];
    const result = computeBoardInsertSortOrder(boards, 'dragged', 'a', 'above');
    expect(result).toBe(4);
  });

  it('inserts at the bottom when dropped below the last board', () => {
    const boards = [makeBoard('a', 5), makeBoard('b', 10)];
    const result = computeBoardInsertSortOrder(boards, 'dragged', 'b', 'below');
    expect(result).toBe(11);
  });

  it('excludes the dragged board from its own neighbor lookup', () => {
    const boards = [makeBoard('a', 1), makeBoard('dragged', 2), makeBoard('b', 3)];
    const result = computeBoardInsertSortOrder(boards, 'dragged', 'b', 'above');
    expect(result).toBe(2); // midpoint of a(1) and b(3), dragged itself excluded
  });
});
