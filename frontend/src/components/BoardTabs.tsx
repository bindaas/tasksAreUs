import { useBoard } from '../context/BoardContext';
import { getBoardColor } from '../utils/boardColor';
import type { Board } from '../api/boards';

export function BoardTabs({ onSelect }: { onSelect?: (board: Board) => void }) {
  const { boards, activeBoard, setActiveBoard } = useBoard();

  if (boards.length === 0) return null;

  return (
    <div className="overflow-x-auto mb-4 -mx-1 px-1">
      <div className="flex justify-end gap-1.5 min-w-full w-max">
        {boards.map((board, idx) => {
          const active = board.id === activeBoard?.id;
          const color = getBoardColor(board.color, idx);
          return (
            <button
              key={board.id}
              onClick={() => {
                setActiveBoard(board);
                onSelect?.(board);
              }}
              style={active ? { backgroundColor: color, borderColor: color } : undefined}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                active
                  ? 'text-white'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-indigo-400'
              }`}
            >
              {!active && <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />}
              {board.is_default && (
                <svg className={`w-3 h-3 shrink-0 ${active ? 'text-white drop-shadow' : 'text-amber-400'}`} fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              )}
              {board.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
