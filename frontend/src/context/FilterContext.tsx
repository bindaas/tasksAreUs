import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useAuthContext } from './AuthContext';
import { toggleLabelSelection, type FilterMode } from '../utils/taskFilters';

const EMPTY_LABEL_SET = new Set<string>();

interface FilterContextValue {
  matchMode: FilterMode;
  setMatchMode: (mode: FilterMode) => void;
  getBoardLabelSelection: (boardId: string) => Set<string>;
  toggleBoardLabel: (boardId: string, labelId: string) => void;
  clearBoardLabelSelection: (boardId: string) => void;
}

const FilterContext = createContext<FilterContextValue | null>(null);

export function FilterProvider({ children }: { children: ReactNode }) {
  const [boardLabelSelections, setBoardLabelSelections] = useState<Map<string, Set<string>>>(new Map());
  const [matchMode, setMatchMode] = useState<FilterMode>('SINGLE');
  const { user } = useAuthContext();

  useEffect(() => {
    // Clear on uid change (e.g. anon -> authenticated upgrade) so board-scoped
    // label selections from the previous identity don't leak into the new one.
    setBoardLabelSelections(new Map());
  }, [user?.uid]);

  function getBoardLabelSelection(boardId: string): Set<string> {
    return boardLabelSelections.get(boardId) ?? EMPTY_LABEL_SET;
  }

  function toggleBoardLabel(boardId: string, labelId: string) {
    setBoardLabelSelections((prev) => {
      const current = prev.get(boardId) ?? EMPTY_LABEL_SET;
      const next = toggleLabelSelection(current, labelId, matchMode);
      const nextMap = new Map(prev);
      if (next.size === 0) nextMap.delete(boardId);
      else nextMap.set(boardId, next);
      return nextMap;
    });
  }

  function clearBoardLabelSelection(boardId: string) {
    setBoardLabelSelections((prev) => {
      if (!prev.has(boardId)) return prev;
      const nextMap = new Map(prev);
      nextMap.delete(boardId);
      return nextMap;
    });
  }

  return (
    <FilterContext.Provider
      value={{ matchMode, setMatchMode, getBoardLabelSelection, toggleBoardLabel, clearBoardLabelSelection }}
    >
      {children}
    </FilterContext.Provider>
  );
}

export function useFilter() {
  const ctx = useContext(FilterContext);
  if (!ctx) throw new Error('useFilter must be used within FilterProvider');
  return ctx;
}
