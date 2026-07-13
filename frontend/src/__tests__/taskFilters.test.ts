import { describe, it, expect } from 'vitest';
import { filterTasks } from '../utils/taskFilters';
import type { Task } from '../api/tasks';

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
    const result = filterTasks(tasks, new Set(['label-a', 'label-b']), '');
    expect(result.map((t) => t.id)).toEqual(['1', '2']);
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
