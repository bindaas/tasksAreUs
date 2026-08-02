import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';

export type ViewKey = 'overdue' | 'focused' | 'today' | 'tomorrow' | 'archive';

interface BoardCollapseContextValue {
  isCollapsed: (view: ViewKey, boardId: string) => boolean;
  toggleBoard: (view: ViewKey, boardId: string) => void;
  setAllCollapsed: (view: ViewKey, boardIds: string[], collapsed: boolean) => void;
}

const BoardCollapseContext = createContext<BoardCollapseContextValue | null>(null);

export function BoardCollapseProvider({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState<Record<ViewKey, Set<string>>>({
    overdue: new Set(),
    focused: new Set(),
    today: new Set(),
    tomorrow: new Set(),
    archive: new Set(),
  });

  // No identity-reset effect (unlike FilterContext): board ids are UUIDs scoped
  // to the owning account, so a stale id surviving an identity switch can't
  // collide with a different account's board — worst case is a harmless no-op.

  function isCollapsed(view: ViewKey, boardId: string) {
    return collapsed[view].has(boardId);
  }

  function toggleBoard(view: ViewKey, boardId: string) {
    setCollapsed((prev) => {
      const next = new Set(prev[view]);
      if (next.has(boardId)) next.delete(boardId);
      else next.add(boardId);
      return { ...prev, [view]: next };
    });
  }

  // Ids left in a view's Set after a board is deleted/renamed are inert
  // (never matched again) rather than actively cleaned up.
  function setAllCollapsed(view: ViewKey, boardIds: string[], collapse: boolean) {
    setCollapsed((prev) => ({ ...prev, [view]: collapse ? new Set(boardIds) : new Set() }));
  }

  return (
    <BoardCollapseContext.Provider value={{ isCollapsed, toggleBoard, setAllCollapsed }}>
      {children}
    </BoardCollapseContext.Provider>
  );
}

export function useBoardCollapse() {
  const ctx = useContext(BoardCollapseContext);
  if (!ctx) throw new Error('useBoardCollapse must be used within BoardCollapseProvider');
  return ctx;
}
