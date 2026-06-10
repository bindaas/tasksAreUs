import { filterTasks } from '../utils/taskFilter';
import type { Task, Label } from '../types';

function makeLabel(overrides: Partial<Label> = {}): Label {
  return { id: 'lbl-1', category: 'mode', value: 'deep work', ...overrides };
}

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-' + Math.random(),
    title: 'Test task',
    notes: null,
    state: 'pending',
    must_do_by: null,
    target_date: null,
    completed_at: null,
    recurrence_group_id: null,
    labels: [],
    is_high_priority: false,
    is_deleted: false,
    created_at: '2026-06-01T00:00:00',
    updated_at: '2026-06-01T00:00:00',
    ...overrides,
  };
}

describe('filterTasks', () => {
  it('returns all tasks when no filters are active', () => {
    const tasks = [makeTask(), makeTask()];
    expect(filterTasks(tasks, { selectedLabelIds: new Set(), searchQuery: '' })).toEqual(tasks);
  });

  it('returns empty array for empty input', () => {
    expect(filterTasks([], { selectedLabelIds: new Set(['x']), searchQuery: 'foo' })).toEqual([]);
  });

  describe('label filter', () => {
    it('returns only tasks that have any selected label', () => {
      const label = makeLabel({ id: 'lbl-A' });
      const matching = makeTask({ labels: [label] });
      const nonMatching = makeTask({ labels: [] });
      const result = filterTasks([matching, nonMatching], {
        selectedLabelIds: new Set(['lbl-A']),
        searchQuery: '',
      });
      expect(result).toEqual([matching]);
    });

    it('matches if task has at least one selected label (OR logic)', () => {
      const labelA = makeLabel({ id: 'lbl-A' });
      const labelB = makeLabel({ id: 'lbl-B', value: 'shallow' });
      const task = makeTask({ labels: [labelA] });
      const result = filterTasks([task], {
        selectedLabelIds: new Set(['lbl-A', 'lbl-B']),
        searchQuery: '',
      });
      expect(result).toEqual([task]);
    });

    it('excludes tasks with no matching labels', () => {
      const label = makeLabel({ id: 'lbl-A' });
      const task = makeTask({ labels: [label] });
      const result = filterTasks([task], {
        selectedLabelIds: new Set(['lbl-Z']),
        searchQuery: '',
      });
      expect(result).toEqual([]);
    });
  });

  describe('search filter', () => {
    it('filters tasks by case-insensitive title substring', () => {
      const matching = makeTask({ title: 'Write quarterly report' });
      const nonMatching = makeTask({ title: 'Review pull request' });
      const result = filterTasks([matching, nonMatching], {
        selectedLabelIds: new Set(),
        searchQuery: 'quarterly',
      });
      expect(result).toEqual([matching]);
    });

    it('is case-insensitive', () => {
      const task = makeTask({ title: 'Deploy to Production' });
      const result = filterTasks([task], {
        selectedLabelIds: new Set(),
        searchQuery: 'production',
      });
      expect(result).toEqual([task]);
    });

    it('ignores whitespace-only search query', () => {
      const tasks = [makeTask(), makeTask()];
      const result = filterTasks(tasks, { selectedLabelIds: new Set(), searchQuery: '   ' });
      expect(result).toEqual(tasks);
    });
  });

  describe('combined filters', () => {
    it('applies both label and search filters (AND logic between filter types)', () => {
      const label = makeLabel({ id: 'lbl-A' });
      const matchBoth = makeTask({ title: 'Write report', labels: [label] });
      const matchLabelOnly = makeTask({ title: 'Read email', labels: [label] });
      const matchSearchOnly = makeTask({ title: 'Write report', labels: [] });
      const result = filterTasks([matchBoth, matchLabelOnly, matchSearchOnly], {
        selectedLabelIds: new Set(['lbl-A']),
        searchQuery: 'write',
      });
      expect(result).toEqual([matchBoth]);
    });
  });
});
