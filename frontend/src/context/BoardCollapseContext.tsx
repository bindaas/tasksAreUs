import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import { effectiveCollapsed } from '../utils/boardVisibility';

export type ViewKey = 'overdue' | 'focused' | 'today' | 'tomorrow' | 'archive';

interface BoardCollapseContextValue {
  isCollapsed: (view: ViewKey, boardId: string) => boolean;
  toggleBoard: (view: ViewKey, boardId: string) => void;
  setAllCollapsed: (view: ViewKey, boardIds: string[], collapsed: boolean) => void;
  isPinned: (view: ViewKey, boardId: string) => boolean;
  pinBoard: (view: ViewKey, boardId: string) => void;
  unpinBoard: (view: ViewKey) => void;
  getPinnedBoardId: (view: ViewKey) => string | null;
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

  const [pinned, setPinned] = useState<Record<ViewKey, string | null>>({
    overdue: null,
    focused: null,
    today: null,
    tomorrow: null,
    archive: null,
  });

  // No identity-reset effect (unlike FilterContext): board ids are UUIDs scoped
  // to the owning account, so a stale id surviving an identity switch can't
  // collide with a different account's board — worst case is a harmless no-op.
  // That framing holds for `collapsed` but not for `pinned` — a stray pinned id
  // collapses every other board in the view, not just itself — so `pinned` gets
  // its own explicit recovery path (BoardGroupedTasks' auto-unpin effect) rather
  // than being left inert.

  function isCollapsed(view: ViewKey, boardId: string) {
    return effectiveCollapsed(pinned[view], collapsed[view], boardId);
  }

  function toggleBoard(view: ViewKey, boardId: string) {
    if (pinned[view] !== null) {
      setPinned((prev) => ({ ...prev, [view]: null }));
      return;
    }
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
    setPinned((prev) => ({ ...prev, [view]: null }));
    setCollapsed((prev) => ({ ...prev, [view]: collapse ? new Set(boardIds) : new Set() }));
  }

  function isPinned(view: ViewKey, boardId: string) {
    return pinned[view] === boardId;
  }

  function pinBoard(view: ViewKey, boardId: string) {
    setPinned((prev) => ({ ...prev, [view]: boardId }));
  }

  function unpinBoard(view: ViewKey) {
    setPinned((prev) => ({ ...prev, [view]: null }));
  }

  function getPinnedBoardId(view: ViewKey) {
    return pinned[view];
  }

  return (
    <BoardCollapseContext.Provider
      value={{ isCollapsed, toggleBoard, setAllCollapsed, isPinned, pinBoard, unpinBoard, getPinnedBoardId }}
    >
      {children}
    </BoardCollapseContext.Provider>
  );
}

export function useBoardCollapse() {
  const ctx = useContext(BoardCollapseContext);
  if (!ctx) throw new Error('useBoardCollapse must be used within BoardCollapseProvider');
  return ctx;
}
