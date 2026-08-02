import type { BoardCompletions, CompletionRecord } from '../api/reports';
import { LabelBadge } from './LabelBadge';
import { useBoardCollapse } from '../context/BoardCollapseContext';
import { getBoardColor } from '../utils/boardColor';

function formatDateTime(isoStr: string): string {
  const d = new Date(isoStr);
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function CompletionCard({ item, color }: { item: CompletionRecord; color: string }) {
  return (
    <div
      className="bg-white border border-gray-200 rounded-lg p-4 border-l-4"
      style={{ borderLeftColor: color }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">{item.title}</p>
          <p className="text-xs text-gray-500 mt-0.5">Completed {formatDateTime(item.completed_at)}</p>
        </div>
        <div className="shrink-0">
          <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
      </div>
      {item.labels.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {item.labels.map((label) => (
            <LabelBadge key={label.id} label={label} small />
          ))}
        </div>
      )}
    </div>
  );
}

export function ArchiveBoardGroups({ boards }: { boards: BoardCompletions[] }) {
  const { isCollapsed, toggleBoard, setAllCollapsed } = useBoardCollapse();

  const allCollapsed = boards.length > 0 && boards.every((b) => isCollapsed('archive', b.board_id));

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button
          onClick={() => setAllCollapsed('archive', boards.map((b) => b.board_id), !allCollapsed)}
          aria-expanded={!allCollapsed}
          className="text-xs text-indigo-500 hover:underline"
        >
          {allCollapsed ? 'Expand all' : 'Collapse all'}
        </button>
      </div>
      {boards.map((board, idx) => {
        const color = getBoardColor(board.board_color, idx);
        const collapsed = isCollapsed('archive', board.board_id);
        return (
          <div key={board.board_id}>
            <button
              onClick={() => toggleBoard('archive', board.board_id)}
              aria-expanded={!collapsed}
              className="flex items-center gap-2 mb-3"
            >
              <span className="text-gray-400 text-xs w-3 text-center shrink-0">{collapsed ? '▸' : '▾'}</span>
              <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: color }} />
              <h3 className="text-sm font-semibold text-gray-700">{board.board_name}</h3>
              <span className="text-xs text-gray-400 font-medium bg-gray-100 rounded-full px-1.5 py-0.5">
                {board.completions.length}
              </span>
            </button>
            {!collapsed && (
              <div className="space-y-2">
                {board.completions.map((item) => (
                  <CompletionCard key={item.task_id} item={item} color={color} />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
