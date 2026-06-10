import type { Task } from '../types';

export interface TaskFilterOptions {
  selectedLabelIds: Set<string>;
  searchQuery: string;
}

export function filterTasks(tasks: Task[], opts: TaskFilterOptions): Task[] {
  let result = tasks;

  if (opts.selectedLabelIds.size > 0) {
    result = result.filter((t) => t.labels.some((l) => opts.selectedLabelIds.has(l.id)));
  }

  const q = opts.searchQuery.trim().toLowerCase();
  if (q) {
    result = result.filter((t) => t.title.toLowerCase().includes(q));
  }

  return result;
}
