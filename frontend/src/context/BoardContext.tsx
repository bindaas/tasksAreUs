import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { getBoards, createBoard as apiCreateBoard, updateBoard, deleteBoard as apiDeleteBoard, type Board } from '../api/boards';
import { useFilter } from './FilterContext';
import { useAuthContext } from './AuthContext';

interface BoardContextValue {
  boards: Board[];
  activeBoard: Board | null;
  setActiveBoard: (board: Board) => void;
  createBoard: (name: string) => Promise<Board>;
  renameBoard: (id: string, name: string) => Promise<void>;
  setDefaultBoard: (id: string) => Promise<void>;
  setColorBoard: (id: string, color: string | null) => Promise<void>;
  deleteBoard: (id: string) => Promise<void>;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

const BoardContext = createContext<BoardContextValue | null>(null);

export function BoardProvider({ children }: { children: ReactNode }) {
  const [boards, setBoards] = useState<Board[]>([]);
  const [activeBoard, setActiveBoardState] = useState<Board | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { clearLabels } = useFilter();
  const { user } = useAuthContext();

  const fetchBoards = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getBoards();
      setBoards(result.boards);
      setActiveBoardState((prev) => {
        // Preserve the current board if it still exists after the refresh
        if (prev) {
          const stillExists = result.boards.find((b) => b.id === prev.id);
          if (stillExists) return stillExists;
        }
        return result.boards.find((b) => b.is_default) ?? result.boards[0] ?? null;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load boards');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Re-run on uid change (e.g. anon -> authenticated upgrade) so board state
    // never leaks across identities. Reset first so a stale board isn't briefly
    // shown while the new identity's boards are in flight.
    setBoards([]);
    setActiveBoardState(null);
    fetchBoards();
  }, [user?.uid, fetchBoards]);

  function setActiveBoard(board: Board) {
    if (board.id !== activeBoard?.id) {
      clearLabels();
    }
    setActiveBoardState(board);
  }

  async function createBoard(name: string): Promise<Board> {
    const board = await apiCreateBoard(name);
    await fetchBoards();
    return board;
  }

  async function renameBoard(id: string, name: string): Promise<void> {
    await updateBoard(id, { name });
    await fetchBoards();
  }

  async function setDefaultBoard(id: string): Promise<void> {
    await updateBoard(id, { is_default: true });
    await fetchBoards();
  }

  async function setColorBoard(id: string, color: string | null): Promise<void> {
    await updateBoard(id, { color });
    await fetchBoards();
  }

  async function deleteBoard(id: string): Promise<void> {
    await apiDeleteBoard(id);
    // If deleting the active board, fetchBoards will reset to the new default
    await fetchBoards();
  }

  return (
    <BoardContext.Provider
      value={{
        boards,
        activeBoard,
        setActiveBoard,
        createBoard,
        renameBoard,
        setDefaultBoard,
        setColorBoard,
        deleteBoard,
        loading,
        error,
        refetch: fetchBoards,
      }}
    >
      {children}
    </BoardContext.Provider>
  );
}

export function useBoard(): BoardContextValue {
  const ctx = useContext(BoardContext);
  if (!ctx) throw new Error('useBoard must be used within BoardProvider');
  return ctx;
}
