export type ViewMode = 'overdue' | 'focused' | 'today' | 'tomorrow' | 'all';

const VIEW_LABELS: Record<Exclude<ViewMode, 'all'>, string> = {
  overdue: 'Overdue',
  focused: 'Focused',
  today: 'Today',
  tomorrow: 'Tomorrow',
};

/** Header suffix for the Tasks page: the view name, or the active board's name when viewing All. */
export function viewLabel(viewMode: ViewMode, activeBoardName: string | undefined | null): string {
  if (viewMode === 'all') return activeBoardName ?? '';
  return VIEW_LABELS[viewMode];
}
