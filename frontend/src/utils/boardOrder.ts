import type { Board } from '../api/boards';

/** Computes the sort_order for a board dropped into the list at a given position.
 *
 * `boards` must already be sorted ascending by sort_order. Trello-style
 * fractional indexing: a drop between two neighbors gets their midpoint; a
 * drop at either end gets `neighbor ± 1`.
 */
export function computeBoardInsertSortOrder(
  boards: Board[],
  draggedBoardId: string,
  targetBoardId: string | null,
  edge: 'above' | 'below' | null,
): number {
  const siblings = boards.filter((b) => b.id !== draggedBoardId);
  if (siblings.length === 0) return Date.now() / 1000;
  if (!targetBoardId || !edge) return siblings[siblings.length - 1].sort_order + 1;
  const idx = siblings.findIndex((b) => b.id === targetBoardId);
  if (idx === -1) return siblings[siblings.length - 1].sort_order + 1;
  const before = edge === 'above' ? siblings[idx - 1] ?? null : siblings[idx];
  const after = edge === 'above' ? siblings[idx] : siblings[idx + 1] ?? null;
  if (before && after) return (before.sort_order + after.sort_order) / 2;
  if (before) return before.sort_order + 1;
  if (after) return after.sort_order - 1;
  return Date.now() / 1000;
}
