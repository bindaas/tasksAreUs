import type { Task, Label } from '../api/tasks';
import type { FocusedBoard } from '../api/focusedView';

export function matchesSearch(task: Task, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return task.title.toLowerCase().includes(q) || (task.notes?.toLowerCase().includes(q) ?? false);
}

export type FilterMode = 'SINGLE' | 'AND' | 'OR';

export function toggleLabelSelection(prev: Set<string>, id: string, mode: FilterMode): Set<string> {
  if (mode === 'SINGLE') {
    if (prev.has(id) && prev.size === 1) return new Set();
    return new Set([id]);
  }
  const next = new Set(prev);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

export function filterTasks(
  tasks: Task[],
  selectedLabelIds: Set<string>,
  searchQuery: string,
  matchMode: FilterMode = 'SINGLE',
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

/** Selected labels sort first (left side of the filter row), each group alphabetical. */
export function sortLabelsForFilter(labels: Label[], selectedLabelIds: Set<string>): Label[] {
  return labels.slice().sort((a, b) => {
    const aSel = selectedLabelIds.has(a.id) ? 0 : 1;
    const bSel = selectedLabelIds.has(b.id) ? 0 : 1;
    if (aSel !== bSel) return aSel - bSel;
    return a.value.localeCompare(b.value);
  });
}

export function filterBoards(boards: FocusedBoard[], searchQuery: string): FocusedBoard[] {
  if (!searchQuery.trim()) return boards;
  return boards
    .map((board) => ({ ...board, tasks: board.tasks.filter((task) => matchesSearch(task, searchQuery)) }))
    .filter((board) => board.tasks.length > 0);
}
