export function effectiveCollapsed(
  pinnedBoardId: string | null,
  collapsedSet: Set<string>,
  boardId: string,
): boolean {
  if (pinnedBoardId !== null) return boardId !== pinnedBoardId;
  return collapsedSet.has(boardId);
}

export function findSingleVisibleBoard<T extends { board_id: string; tasks: unknown[] }>(
  boards: T[],
  isCollapsed: (boardId: string) => boolean,
): T | null {
  const visible = boards.filter((b) => !isCollapsed(b.board_id) && b.tasks.length > 0);
  return visible.length === 1 ? visible[0] : null;
}
