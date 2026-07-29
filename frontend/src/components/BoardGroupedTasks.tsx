import type { FocusedBoard } from '../api/focusedView';
import { FocusedTaskCard } from './FocusedTaskCard';
import { useBoardCollapse, type ViewKey } from '../context/BoardCollapseContext';
import { filterBoards } from '../utils/taskFilters';

const PALETTE = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6'];

function boardColor(board: FocusedBoard, index: number): string {
  return board.board_color ?? PALETTE[index % PALETTE.length];
}

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
  const { isCollapsed, toggleBoard, setAllCollapsed } = useBoardCollapse();
  const filteredBoards = filterBoards(boards, searchQuery);

  if (boards.length > 0 && filteredBoards.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400">
        <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
        <p className="text-sm">No tasks match this search</p>
      </div>
    );
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
      {filteredBoards.map((board, idx) => {
        const color = boardColor(board, idx);
        const collapsed = isCollapsed(viewKey, board.board_id);
        return (
          <div key={board.board_id}>
            <button
              onClick={() => toggleBoard(viewKey, board.board_id)}
              aria-expanded={!collapsed}
              className="flex items-center gap-2 mb-3"
            >
              <span className="text-gray-400 text-xs w-3 text-center shrink-0">{collapsed ? '▸' : '▾'}</span>
              <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: color }} />
              <h3 className="text-sm font-semibold text-gray-700">{board.board_name}</h3>
              <span className="text-xs text-gray-400 font-medium bg-gray-100 rounded-full px-1.5 py-0.5">
                {board.tasks.length}
              </span>
            </button>
            {!collapsed && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {board.tasks.map((task) => (
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
