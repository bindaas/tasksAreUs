import type { Task } from '../api/tasks';
import type { FocusedBoard } from '../api/focusedView';

export function matchesSearch(task: Task, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return task.title.toLowerCase().includes(q) || (task.notes?.toLowerCase().includes(q) ?? false);
}

export function filterTasks(
  tasks: Task[],
  selectedLabelIds: Set<string>,
  searchQuery: string,
  matchMode: 'AND' | 'OR' = 'OR',
): Task[] {
  let result = tasks;
  if (selectedLabelIds.size > 0) {
    result = result.filter((task) =>
      matchMode === 'AND'
        ? [...selectedLabelIds].every((id) => task.labels.some((l) => l.id === id))
        : task.labels.some((l) => selectedLabelIds.has(l.id)),
    );
  }
  if (searchQuery.trim()) {
    result = result.filter((task) => matchesSearch(task, searchQuery));
  }
  return result;
}

export function filterBoards(boards: FocusedBoard[], searchQuery: string): FocusedBoard[] {
  if (!searchQuery.trim()) return boards;
  return boards
    .map((board) => ({ ...board, tasks: board.tasks.filter((task) => matchesSearch(task, searchQuery)) }))
    .filter((board) => board.tasks.length > 0);
}
