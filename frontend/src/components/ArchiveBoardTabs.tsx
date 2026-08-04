import { useBoard } from '../context/BoardContext';
import { getBoardColor } from '../utils/boardColor';

const ALL_BOARDS_COLOR = '#4f46e5';

export function ArchiveBoardTabs({
  selectedBoardId,
  onSelect,
}: {
  selectedBoardId: string | 'all';
  onSelect: (boardId: string | 'all') => void;
}) {
  const { boards } = useBoard();

  if (boards.length === 0) return null;

  return (
    <div className="overflow-x-auto mb-4 -mx-1 px-1">
      <div className="flex justify-end gap-1.5 min-w-full w-max">
        <button
          onClick={() => onSelect('all')}
          style={selectedBoardId === 'all' ? { backgroundColor: ALL_BOARDS_COLOR, borderColor: ALL_BOARDS_COLOR } : undefined}
          className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
            selectedBoardId === 'all'
              ? 'text-white'
              : 'bg-white text-gray-600 border-gray-300 hover:border-indigo-400'
          }`}
        >
          All boards
        </button>
        {boards.map((board, idx) => {
          const active = board.id === selectedBoardId;
          const color = getBoardColor(board.color, idx);
          return (
            <button
              key={board.id}
              onClick={() => onSelect(board.id)}
              style={active ? { backgroundColor: color, borderColor: color } : undefined}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                active
                  ? 'text-white'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-indigo-400'
              }`}
            >
              {!active && <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />}
              {board.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
