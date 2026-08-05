import { describe, it, expect } from 'vitest';
import { filterTasks, filterBoards } from '../utils/taskFilters';
import type { Task } from '../api/tasks';
import type { FocusedBoard } from '../api/focusedView';

function makeTask(overrides: Partial<Task>): Task {
  return {
    id: 'task-1',
    board_id: 'board-1',
    title: 'Test task',
    notes: null,
    state: 'pending',
    must_do_by: null,
    target_date: null,
    completed_at: null,
    labels: [],
    is_high_priority: false,
    is_deleted: false,
    links: [],
    sort_order: 0,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

const labelA = { id: 'label-a', category: 'type' as const, value: 'Work' };
const labelB = { id: 'label-b', category: 'type' as const, value: 'Deep' };

// ── no filters ────────────────────────────────────────────────────────────────

describe('filterTasks — no filters', () => {
  it('returns all tasks when no labels selected and query is empty', () => {
    const tasks = [makeTask({ id: '1' }), makeTask({ id: '2' })];
    expect(filterTasks(tasks, new Set(), '')).toHaveLength(2);
  });

  it('returns all tasks when query is only whitespace', () => {
    const tasks = [makeTask({ id: '1' }), makeTask({ id: '2' })];
    expect(filterTasks(tasks, new Set(), '   ')).toHaveLength(2);
  });
});

// ── label filter ──────────────────────────────────────────────────────────────

describe('filterTasks — label filter', () => {
  it('keeps tasks that have at least one selected label', () => {
    const tasks = [
      makeTask({ id: '1', labels: [labelA] }),
      makeTask({ id: '2', labels: [labelB] }),
      makeTask({ id: '3', labels: [] }),
    ];
    const result = filterTasks(tasks, new Set(['label-a']), '');
    expect(result.map((t) => t.id)).toEqual(['1']);
  });

  it('keeps a task that has any one of multiple selected labels (OR semantics)', () => {
    const tasks = [
      makeTask({ id: '1', labels: [labelA] }),
      makeTask({ id: '2', labels: [labelB] }),
      makeTask({ id: '3', labels: [] }),
    ];
    const result = filterTasks(tasks, new Set(['label-a', 'label-b']), '', 'OR');
    expect(result.map((t) => t.id)).toEqual(['1', '2']);
  });
});

// ── AND/OR match mode ─────────────────────────────────────────────────────────

describe('filterTasks — AND/OR match mode', () => {
  it('AND mode keeps only tasks that have all selected labels', () => {
    const tasks = [
      makeTask({ id: '1', labels: [labelA, labelB] }),
      makeTask({ id: '2', labels: [labelA] }),
      makeTask({ id: '3', labels: [labelB] }),
    ];
    const result = filterTasks(tasks, new Set(['label-a', 'label-b']), '', 'AND');
    expect(result.map((t) => t.id)).toEqual(['1']);
  });

  it('AND mode excludes a task that has only one of the selected labels', () => {
    const tasks = [
      makeTask({ id: '1', labels: [labelA] }),
      makeTask({ id: '2', labels: [labelB] }),
    ];
    const result = filterTasks(tasks, new Set(['label-a', 'label-b']), '', 'AND');
    expect(result).toHaveLength(0);
  });

  it('AND is the default mode when no 4th arg is given', () => {
    const tasks = [
      makeTask({ id: '1', labels: [labelA, labelB] }),
      makeTask({ id: '2', labels: [labelA] }),
    ];
    const withDefault = filterTasks(tasks, new Set(['label-a', 'label-b']), '');
    const withExplicitAnd = filterTasks(tasks, new Set(['label-a', 'label-b']), '', 'AND');
    expect(withDefault.map((t) => t.id)).toEqual(withExplicitAnd.map((t) => t.id));
    expect(withDefault.map((t) => t.id)).toEqual(['1']);
  });
});

// ── search filter ─────────────────────────────────────────────────────────────

describe('filterTasks — search', () => {
  it('matches title case-insensitively', () => {
    const tasks = [
      makeTask({ id: '1', title: 'Buy groceries' }),
      makeTask({ id: '2', title: 'Send invoice' }),
    ];
    expect(filterTasks(tasks, new Set(), 'GROCERIES').map((t) => t.id)).toEqual(['1']);
  });

  it('matches notes case-insensitively', () => {
    const tasks = [
      makeTask({ id: '1', title: 'Task A', notes: 'Remember to call John' }),
      makeTask({ id: '2', title: 'Task B', notes: null }),
    ];
    expect(filterTasks(tasks, new Set(), 'call john').map((t) => t.id)).toEqual(['1']);
  });

  it('returns empty array when nothing matches', () => {
    const tasks = [makeTask({ id: '1', title: 'Buy groceries' })];
    expect(filterTasks(tasks, new Set(), 'xyz-no-match')).toHaveLength(0);
  });

  it('ignores leading/trailing whitespace in the query', () => {
    const tasks = [makeTask({ id: '1', title: 'Buy groceries' })];
    expect(filterTasks(tasks, new Set(), '  groceries  ')).toHaveLength(1);
  });
});

// ── label + search composition ────────────────────────────────────────────────

describe('filterTasks — label AND search', () => {
  it('applies both filters: task must match label AND search query', () => {
    const tasks = [
      makeTask({ id: '1', title: 'Buy groceries', labels: [labelA] }),
      makeTask({ id: '2', title: 'Send invoice', labels: [labelA] }),
      makeTask({ id: '3', title: 'Buy milk', labels: [] }),
    ];
    const result = filterTasks(tasks, new Set(['label-a']), 'buy');
    expect(result.map((t) => t.id)).toEqual(['1']);
  });
});

// ── filterBoards ─────────────────────────────────────────────────────────────

function makeBoard(overrides: Partial<FocusedBoard>): FocusedBoard {
  return {
    board_id: 'board-1',
    board_name: 'Board 1',
    board_color: null,
    tasks: [],
    ...overrides,
  };
}

describe('filterBoards', () => {
  it('returns boards unchanged for an empty query (reference equality preserved)', () => {
    const boards = [makeBoard({ board_id: '1', tasks: [makeTask({ id: 't1' })] })];
    expect(filterBoards(boards, '')).toBe(boards);
  });

  it('returns boards unchanged for a whitespace-only query', () => {
    const boards = [makeBoard({ board_id: '1', tasks: [makeTask({ id: 't1' })] })];
    expect(filterBoards(boards, '   ')).toBe(boards);
  });

  it('matches title/notes across multiple boards, keeping only matching tasks', () => {
    const boards = [
      makeBoard({
        board_id: '1',
        tasks: [
          makeTask({ id: 't1', title: 'Buy groceries' }),
          makeTask({ id: 't2', title: 'Send invoice' }),
        ],
      }),
      makeBoard({
        board_id: '2',
        tasks: [makeTask({ id: 't3', title: 'Task', notes: 'remember groceries' })],
      }),
    ];
    const result = filterBoards(boards, 'groceries');
    expect(result.map((b) => b.board_id)).toEqual(['1', '2']);
    expect(result[0].tasks.map((t) => t.id)).toEqual(['t1']);
    expect(result[1].tasks.map((t) => t.id)).toEqual(['t3']);
  });

  it('drops a board entirely when none of its tasks match', () => {
    const boards = [
      makeBoard({ board_id: '1', tasks: [makeTask({ id: 't1', title: 'Buy groceries' })] }),
      makeBoard({ board_id: '2', tasks: [makeTask({ id: 't2', title: 'Send invoice' })] }),
    ];
    const result = filterBoards(boards, 'groceries');
    expect(result.map((b) => b.board_id)).toEqual(['1']);
  });
});
