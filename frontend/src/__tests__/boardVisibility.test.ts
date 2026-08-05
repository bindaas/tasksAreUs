import { describe, it, expect } from 'vitest';
import { effectiveCollapsed, findSingleVisibleBoard } from '../utils/boardVisibility';

// ── effectiveCollapsed ──────────────────────────────────────────────────────

describe('effectiveCollapsed — no pin', () => {
  it('falls back to the collapsed Set when nothing is pinned', () => {
    const collapsed = new Set(['board-1']);
    expect(effectiveCollapsed(null, collapsed, 'board-1')).toBe(true);
    expect(effectiveCollapsed(null, collapsed, 'board-2')).toBe(false);
  });
});

describe('effectiveCollapsed — pinned self', () => {
  it('reads the pinned board as not collapsed regardless of the Set', () => {
    const collapsed = new Set(['board-1']);
    expect(effectiveCollapsed('board-1', collapsed, 'board-1')).toBe(false);
  });
});

describe('effectiveCollapsed — pinned other', () => {
  it('reads every non-pinned board as collapsed regardless of the Set', () => {
    const collapsed = new Set<string>();
    expect(effectiveCollapsed('board-1', collapsed, 'board-2')).toBe(true);
  });
});

// ── findSingleVisibleBoard ───────────────────────────────────────────────────

function makeBoard(boardId: string, taskCount: number) {
  return { board_id: boardId, tasks: Array.from({ length: taskCount }, (_, i) => ({ id: `${boardId}-${i}` })) };
}

describe('findSingleVisibleBoard', () => {
  it('returns null when zero boards qualify', () => {
    const boards = [makeBoard('1', 2), makeBoard('2', 3)];
    const isCollapsed = () => true;
    expect(findSingleVisibleBoard(boards, isCollapsed)).toBeNull();
  });

  it('returns the board when exactly one qualifies', () => {
    const boards = [makeBoard('1', 2), makeBoard('2', 3)];
    const isCollapsed = (id: string) => id !== '2';
    expect(findSingleVisibleBoard(boards, isCollapsed)).toBe(boards[1]);
  });

  it('returns null when multiple boards qualify', () => {
    const boards = [makeBoard('1', 2), makeBoard('2', 3)];
    const isCollapsed = () => false;
    expect(findSingleVisibleBoard(boards, isCollapsed)).toBeNull();
  });

  it('excludes an uncollapsed board with zero tasks', () => {
    const boards = [makeBoard('1', 0), makeBoard('2', 3)];
    const isCollapsed = () => false;
    expect(findSingleVisibleBoard(boards, isCollapsed)).toBe(boards[1]);
  });
});
