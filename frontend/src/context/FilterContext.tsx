import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useAuthContext } from './AuthContext';

interface FilterContextValue {
  selectedLabelIds: Set<string>;
  toggleLabel: (id: string) => void;
  clearLabels: () => void;
  matchMode: 'AND' | 'OR';
  setMatchMode: (mode: 'AND' | 'OR') => void;
}

const FilterContext = createContext<FilterContextValue | null>(null);

export function FilterProvider({ children }: { children: ReactNode }) {
  const [selectedLabelIds, setSelectedLabelIds] = useState<Set<string>>(new Set());
  const [matchMode, setMatchMode] = useState<'AND' | 'OR'>('AND');
  const { user } = useAuthContext();

  useEffect(() => {
    // Clear on uid change (e.g. anon -> authenticated upgrade) so a label filter
    // scoped to the previous identity's board doesn't leak into the new one.
    setSelectedLabelIds(new Set());
  }, [user?.uid]);

  function toggleLabel(id: string) {
    setSelectedLabelIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function clearLabels() {
    setSelectedLabelIds(new Set());
  }

  return (
    <FilterContext.Provider value={{ selectedLabelIds, toggleLabel, clearLabels, matchMode, setMatchMode }}>
      {children}
    </FilterContext.Provider>
  );
}

export function useFilter() {
  const ctx = useContext(FilterContext);
  if (!ctx) throw new Error('useFilter must be used within FilterProvider');
  return ctx;
}
