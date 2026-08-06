import type { Label } from '../api/tasks';

type LabelCategory = 'type';
const CATEGORIES: LabelCategory[] = ['type'];

const CATEGORY_COLORS: Record<LabelCategory, { active: string; inactive: string }> = {
  type: {
    active: 'bg-purple-600 text-white border-purple-600',
    inactive: 'bg-white text-purple-700 border-purple-300 hover:bg-purple-50',
  },
};

export function LabelFilterChips({
  labelsByCategory,
  selectedLabelIds,
  onToggle,
  onClear,
  matchMode,
  onMatchModeChange,
}: {
  labelsByCategory: Record<string, Label[]>;
  selectedLabelIds: Set<string>;
  onToggle: (labelId: string) => void;
  onClear: () => void;
  matchMode: 'AND' | 'OR';
  onMatchModeChange: (mode: 'AND' | 'OR') => void;
}) {
  return (
    <div className="mb-4 flex flex-wrap gap-1.5 items-center justify-start">
      {selectedLabelIds.size > 1 && (
        <div className="flex rounded-full border border-gray-200 overflow-hidden text-xs font-medium">
          {(['AND', 'OR'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => onMatchModeChange(mode)}
              className={`px-2 py-1 transition-colors ${
                matchMode === mode ? 'bg-gray-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
      )}
      {selectedLabelIds.size > 0 && (
        <button onClick={onClear} className="text-xs text-gray-500 hover:text-gray-700 underline">
          Clear filters
        </button>
      )}
      {CATEGORIES.map((cat) => {
        const catLabels = ((labelsByCategory[cat] ?? []) as Label[]).slice().sort((a, b) => a.value.localeCompare(b.value));
        if (catLabels.length === 0) return null;
        const colors = CATEGORY_COLORS[cat];
        return catLabels.map((label) => {
          const active = selectedLabelIds.has(label.id);
          return (
            <button
              key={label.id}
              onClick={() => onToggle(label.id)}
              className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-colors ${
                active ? colors.active : colors.inactive
              }`}
            >
              {label.value}
            </button>
          );
        });
      })}
    </div>
  );
}
