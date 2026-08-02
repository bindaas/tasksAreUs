import type { Task } from '../api/tasks';

/** Computes the sort_order for a task dropped into a zone at a given position.
 *
 * `zoneTasks` must already be sorted ascending by sort_order. Trello-style
 * fractional indexing: a drop between two neighbors gets their midpoint; a
 * drop at either end gets `neighbor ± 1`.
 */
export function computeInsertSortOrder(
  zoneTasks: Task[],
  draggedTaskId: string,
  targetTaskId: string | null,
  edge: 'above' | 'below' | null,
): number {
  const siblings = zoneTasks.filter((t) => t.id !== draggedTaskId);
  if (siblings.length === 0) return Date.now() / 1000;
  if (!targetTaskId || !edge) return siblings[siblings.length - 1].sort_order + 1;
  const idx = siblings.findIndex((t) => t.id === targetTaskId);
  if (idx === -1) return siblings[siblings.length - 1].sort_order + 1;
  const before = edge === 'above' ? siblings[idx - 1] ?? null : siblings[idx];
  const after = edge === 'above' ? siblings[idx] : siblings[idx + 1] ?? null;
  if (before && after) return (before.sort_order + after.sort_order) / 2;
  if (before) return before.sort_order + 1;
  if (after) return after.sort_order - 1;
  return Date.now() / 1000;
}
