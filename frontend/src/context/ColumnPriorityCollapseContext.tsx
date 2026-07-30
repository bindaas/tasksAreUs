import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import type { ColumnKey } from '../utils/taskDateUtils';

interface ColumnPriorityCollapseContextValue {
  isCollapsed: (columnKey: ColumnKey) => boolean;
  toggleColumn: (columnKey: ColumnKey) => void;
}

const ColumnPriorityCollapseContext = createContext<ColumnPriorityCollapseContextValue | null>(null);

export function ColumnPriorityCollapseProvider({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState<Partial<Record<ColumnKey, boolean>>>({});

  function isCollapsed(columnKey: ColumnKey) {
    return collapsed[columnKey] ?? false;
  }

  function toggleColumn(columnKey: ColumnKey) {
    setCollapsed((prev) => ({ ...prev, [columnKey]: !prev[columnKey] }));
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
