import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import type { ColumnKey } from '../utils/taskDateUtils';

type PriorityTier = 'high' | 'medium' | 'normal';

type CollapseKey = `${ColumnKey}:${PriorityTier}`;

function collapseKey(columnKey: ColumnKey, tier: PriorityTier): CollapseKey {
  return `${columnKey}:${tier}`;
}

interface ColumnPriorityCollapseContextValue {
  isCollapsed: (columnKey: ColumnKey, tier: PriorityTier) => boolean;
  toggleColumn: (columnKey: ColumnKey, tier: PriorityTier) => void;
}

const ColumnPriorityCollapseContext = createContext<ColumnPriorityCollapseContextValue | null>(null);

export function ColumnPriorityCollapseProvider({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState<Partial<Record<CollapseKey, boolean>>>({});

  function isCollapsed(columnKey: ColumnKey, tier: PriorityTier) {
    return collapsed[collapseKey(columnKey, tier)] ?? false;
  }

  function toggleColumn(columnKey: ColumnKey, tier: PriorityTier) {
    const key = collapseKey(columnKey, tier);
    setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  return (
    <ColumnPriorityCollapseContext.Provider value={{ isCollapsed, toggleColumn }}>
      {children}
    </ColumnPriorityCollapseContext.Provider>
  );
}

export function useColumnPriorityCollapse() {
  const ctx = useContext(ColumnPriorityCollapseContext);
  if (!ctx) throw new Error('useColumnPriorityCollapse must be used within ColumnPriorityCollapseProvider');
  return ctx;
}
