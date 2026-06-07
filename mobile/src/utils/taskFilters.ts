import type { Task } from '../types';

export function filterTasks(
  tasks: Task[],
  selectedLabelIds: Set<string>,
  searchQuery: string,
): Task[] {
  let result = tasks;
  if (selectedLabelIds.size > 0) {
    result = result.filter((task) => task.labels.some((l) => selectedLabelIds.has(l.id)));
  }
  if (searchQuery.trim()) {
    const q = searchQuery.trim().toLowerCase();
    result = result.filter(
      (task) =>
        task.title.toLowerCase().includes(q) ||
        (task.notes?.toLowerCase().includes(q) ?? false),
    );
  }
  return result;
}
