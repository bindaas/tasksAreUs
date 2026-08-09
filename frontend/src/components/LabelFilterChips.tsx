import type { Label } from '../api/tasks';
import type { FilterMode } from '../utils/taskFilters';

type LabelCategory = 'type';
const CATEGORIES: LabelCategory[] = ['type'];

const CATEGORY_COLORS: Record<LabelCategory, { active: string; inactive: string }> = {
  type: {
    active: 'bg-purple-600 text-white border-purple-600',
    inactive: 'bg-white text-purple-700 border-purple-300 hover:bg-purple-50',
  },
};

const MODE_LABELS: Record<FilterMode, string> = {
  SINGLE: 'Single',
  AND: 'AND',
  OR: 'OR',
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
  matchMode: FilterMode;
  onMatchModeChange: (mode: FilterMode) => void;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
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
      <div className="flex items-center gap-1.5 shrink-0">
        <div className="flex rounded-full border border-gray-200 overflow-hidden text-xs font-medium">
          {(['SINGLE', 'AND', 'OR'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => onMatchModeChange(mode)}
              className={`px-2 py-1 transition-colors ${
                matchMode === mode ? 'bg-gray-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'
              }`}
            >
              {MODE_LABELS[mode]}
            </button>
          ))}
        </div>
        <button
          onClick={onClear}
          disabled={selectedLabelIds.size === 0}
          className="text-xs text-gray-500 hover:text-gray-700 underline disabled:opacity-40 disabled:cursor-not-allowed disabled:no-underline disabled:pointer-events-none"
        >
          Clear filters
        </button>
      </div>
    </div>
  );
}
