import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { getBoards, createBoard as apiCreateBoard, updateBoard, deleteBoard as apiDeleteBoard } from '../api/boards';
import type { Board } from '../types';

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

  const fetchBoards = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getBoards();
      setBoards(result.boards);
      setActiveBoardState((prev) => {
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
    fetchBoards();
  }, [fetchBoards]);

  function setActiveBoard(board: Board) {
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
