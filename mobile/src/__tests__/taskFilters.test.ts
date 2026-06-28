import { filterTasks } from '../utils/taskFilters';
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
    is_high_priority: false,
    is_deleted: false,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

const labelA = { id: 'label-a', category: 'mode' as const, value: 'Work' };
const labelB = { id: 'label-b', category: 'type' as const, value: 'Errand' };

describe('filterTasks', () => {
  const tasks: Task[] = [
    makeTask({ id: '1', title: 'Buy groceries', labels: [labelA] }),
    makeTask({ id: '2', title: 'Send invoice', notes: 'check email', labels: [labelB] }),
    makeTask({ id: '3', title: 'Walk the dog', labels: [] }),
  ];

  it('returns all tasks when no filters are active', () => {
    expect(filterTasks(tasks, new Set(), '')).toHaveLength(3);
  });

  it('filters by label — AND semantics (task must have at least one selected label)', () => {
    const result = filterTasks(tasks, new Set(['label-a']), '');
    expect(result.map((t) => t.id)).toEqual(['1']);
  });

  it('filters by search query matching title', () => {
    const result = filterTasks(tasks, new Set(), 'invoice');
    expect(result.map((t) => t.id)).toEqual(['2']);
  });

  it('filters by search query matching notes', () => {
    const result = filterTasks(tasks, new Set(), 'email');
    expect(result.map((t) => t.id)).toEqual(['2']);
  });

  it('search is case-insensitive', () => {
    const result = filterTasks(tasks, new Set(), 'GROCERIES');
    expect(result.map((t) => t.id)).toEqual(['1']);
  });

  it('composes label and search filters with AND semantics', () => {
    const result = filterTasks(tasks, new Set(['label-a']), 'groceries');
    expect(result.map((t) => t.id)).toEqual(['1']);
  });

  it('returns empty when no task matches combined filters', () => {
    const result = filterTasks(tasks, new Set(['label-a']), 'invoice');
    expect(result).toHaveLength(0);
  });

  it('ignores whitespace-only search query', () => {
    expect(filterTasks(tasks, new Set(), '   ')).toHaveLength(3);
  });
});
