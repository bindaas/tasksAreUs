import { useEffect, useMemo, useState } from 'react';
import type { FocusedBoard } from '../api/focusedView';
import { FocusedTaskCard } from './FocusedTaskCard';
import { useBoardCollapse, type ViewKey } from '../context/BoardCollapseContext';
import { filterBoards, filterTasks } from '../utils/taskFilters';
import { findSingleVisibleBoard } from '../utils/boardVisibility';
import { getBoardColor } from '../utils/boardColor';
import { EmptyState, FolderIcon } from './EmptyState';
import { LabelFilterChips } from './LabelFilterChips';
import { useLabels } from '../hooks/useLabels';

export function BoardGroupedTasks({
  boards,
  onRefresh,
  viewKey,
  searchQuery = '',
}: {
  boards: FocusedBoard[];
  onRefresh: () => void;
  viewKey: ViewKey;
  searchQuery?: string;
}) {
  const { isCollapsed, toggleBoard, setAllCollapsed, isPinned, pinBoard, unpinBoard, getPinnedBoardId } =
    useBoardCollapse();
  const filteredBoards = useMemo(() => filterBoards(boards, searchQuery), [boards, searchQuery]);

  const singleVisibleBoard = findSingleVisibleBoard(filteredBoards, (id) => isCollapsed(viewKey, id));
  const { labelsByCategory } = useLabels(singleVisibleBoard?.board_id ?? '');
  const [selectedLabelIds, setSelectedLabelIds] = useState<Set<string>>(new Set());

  // Resets local chip selection whenever the qualifying board changes (including
  // when it disappears), so a stale selection never silently applies to a
  // different board than the one the user picked labels against. Adjusted
  // during render (React's recommended pattern for this) rather than in an
  // effect, to avoid an extra render pass.
  const [labelResetKey, setLabelResetKey] = useState(singleVisibleBoard?.board_id ?? null);
  if (labelResetKey !== (singleVisibleBoard?.board_id ?? null)) {
    setLabelResetKey(singleVisibleBoard?.board_id ?? null);
    setSelectedLabelIds(new Set());
  }

  // Auto-recovery for a vanished pin target: if the pinned board is no longer
  // present in this view (deleted, or its tasks rescheduled out of the date
  // window), every remaining board would otherwise read as collapsed with no
  // per-board affordance to unpin. Clearing the pin here restores whatever
  // manual collapse layout existed before the pin.
  useEffect(() => {
    const pinnedBoardId = getPinnedBoardId(viewKey);
    if (pinnedBoardId !== null && !filteredBoards.some((b) => b.board_id === pinnedBoardId)) {
      unpinBoard(viewKey);
    }
  }, [viewKey, filteredBoards, getPinnedBoardId, unpinBoard]);

  function toggleLocalLabel(labelId: string) {
    setSelectedLabelIds((prev) => {
      const next = new Set(prev);
      if (next.has(labelId)) next.delete(labelId);
      else next.add(labelId);
      return next;
    });
  }

  if (boards.length > 0 && filteredBoards.length === 0) {
    return <EmptyState icon={<FolderIcon />} message="No tasks match this search" />;
  }

  const allCollapsed = filteredBoards.length > 0 && filteredBoards.every((b) => isCollapsed(viewKey, b.board_id));

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button
          onClick={() => setAllCollapsed(viewKey, filteredBoards.map((b) => b.board_id), !allCollapsed)}
          aria-expanded={!allCollapsed}
          className="text-xs text-indigo-500 hover:underline"
        >
          {allCollapsed ? 'Expand all' : 'Collapse all'}
        </button>
      </div>
      {singleVisibleBoard && (
        <LabelFilterChips
          labelsByCategory={labelsByCategory}
          selectedLabelIds={selectedLabelIds}
          onToggle={toggleLocalLabel}
          onClear={() => setSelectedLabelIds(new Set())}
        />
      )}
      {filteredBoards.map((board, idx) => {
        const color = getBoardColor(board.board_color, idx);
        const collapsed = isCollapsed(viewKey, board.board_id);
        const pinned = isPinned(viewKey, board.board_id);
        const displayTasks =
          board.board_id === singleVisibleBoard?.board_id
            ? filterTasks(board.tasks, selectedLabelIds, '')
            : board.tasks;
        return (
          <div key={board.board_id}>
            <div className="flex items-center gap-2 mb-3">
              <button
                onClick={() => toggleBoard(viewKey, board.board_id)}
                aria-expanded={!collapsed}
                className="flex-1 flex items-center gap-2 min-w-0"
              >
                <span className="text-gray-400 text-xs w-3 text-center shrink-0">{collapsed ? '▸' : '▾'}</span>
                <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: color }} />
                <h3 className="text-sm font-semibold text-gray-700 truncate">{board.board_name}</h3>
                <span className="text-xs text-gray-400 font-medium bg-gray-100 rounded-full px-1.5 py-0.5 shrink-0">
                  {board.tasks.length}
                </span>
              </button>
              <button
                onClick={() => (pinned ? unpinBoard(viewKey) : pinBoard(viewKey, board.board_id))}
                aria-pressed={pinned}
                title={pinned ? 'Unpin board' : 'Pin board'}
                className={`text-xs shrink-0 rounded-full w-6 h-6 flex items-center justify-center transition-all ${
                  pinned ? 'bg-indigo-100 ring-1 ring-indigo-300 opacity-100' : 'opacity-30 hover:opacity-60'
                }`}
              >
                📌
              </button>
            </div>
            {!collapsed && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {displayTasks.map((task) => (
                  <FocusedTaskCard key={task.id} task={task} boardColor={color} onRefresh={onRefresh} />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
