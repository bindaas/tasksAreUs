import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';

interface FilterContextValue {
  selectedLabelIds: Set<string>;
  toggleLabel: (id: string) => void;
  clearLabels: () => void;
}

const FilterContext = createContext<FilterContextValue | null>(null);

export function FilterProvider({ children }: { children: ReactNode }) {
  const [selectedLabelIds, setSelectedLabelIds] = useState<Set<string>>(new Set());

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
    <FilterContext.Provider value={{ selectedLabelIds, toggleLabel, clearLabels }}>
      {children}
    </FilterContext.Provider>
  );
}

export function useFilter() {
  const ctx = useContext(FilterContext);
  if (!ctx) throw new Error('useFilter must be used within FilterProvider');
  return ctx;
}
