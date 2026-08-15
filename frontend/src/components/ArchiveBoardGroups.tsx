import { useNavigate } from 'react-router-dom';
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

interface CompletionCardProps {
  item: CompletionRecord;
  color?: string;
  selected: boolean;
  onToggleSelect: (taskId: string) => void;
  onUncomplete: (taskId: string) => void;
  onDelete: (taskId: string) => void;
}

export function CompletionCard({ item, color, selected, onToggleSelect, onUncomplete, onDelete }: CompletionCardProps) {
  const navigate = useNavigate();
  const sortedLabels = [...item.labels].sort((a, b) => a.value.localeCompare(b.value));
  return (
    <div
      onClick={() => navigate(`/tasks/${item.task_id}`)}
      className={`bg-white border border-gray-200 rounded-lg p-4 cursor-pointer hover:shadow-md transition-shadow flex gap-3 ${color ? 'border-l-4' : ''}`}
      style={color ? { borderLeftColor: color } : undefined}
    >
      <input
        type="checkbox"
        checked={selected}
        onChange={() => onToggleSelect(item.task_id)}
        onClick={(e) => e.stopPropagation()}
        className="mt-1 shrink-0 w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{item.title}</p>
            <p className="text-xs text-gray-500 mt-0.5">Completed {formatDateTime(item.completed_at)}</p>
          </div>
          <div className="shrink-0 flex items-center gap-1.5">
            <button
              onClick={(e) => { e.stopPropagation(); onUncomplete(item.task_id); }}
              className="p-1.5 rounded-full bg-indigo-50 hover:bg-indigo-100 text-indigo-600 transition-colors"
              title="Mark as incomplete"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
              </svg>
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(item.task_id); }}
              className="p-1.5 rounded-full bg-red-50 hover:bg-red-100 text-red-600 transition-colors"
              title="Delete"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        {sortedLabels.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {sortedLabels.map((label) => (
              <LabelBadge key={label.id} label={label} small />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface ArchiveBoardGroupsProps {
  boards: BoardCompletions[];
  selectedIds: Set<string>;
  onToggleSelect: (taskId: string) => void;
  onUncomplete: (taskId: string) => void;
  onDelete: (taskId: string) => void;
}

export function ArchiveBoardGroups({ boards, selectedIds, onToggleSelect, onUncomplete, onDelete }: ArchiveBoardGroupsProps) {
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
                  <CompletionCard
                    key={item.task_id}
                    item={item}
                    color={color}
                    selected={selectedIds.has(item.task_id)}
                    onToggleSelect={onToggleSelect}
                    onUncomplete={onUncomplete}
                    onDelete={onDelete}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
