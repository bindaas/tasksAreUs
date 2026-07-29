import { useState, useEffect } from 'react';
import { getDayViewTasks } from '../api/dayView';
import type { FocusedBoard } from '../api/focusedView';
import { BoardGroupedTasks } from './BoardGroupedTasks';
import { EmptyState, FolderIcon } from './EmptyState';
import type { ViewKey } from '../context/BoardCollapseContext';

export function DayView({
  referenceDate,
  viewKey,
  overdue = false,
  onLoaded,
  searchQuery = '',
}: {
  referenceDate: string;
  viewKey: Extract<ViewKey, 'today' | 'tomorrow' | 'overdue'>;
  overdue?: boolean;
  onLoaded?: (hasAny: boolean) => void;
  searchQuery?: string;
}) {
  const [boards, setBoards] = useState<FocusedBoard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const result = await getDayViewTasks(referenceDate, overdue);
      setBoards(result.boards);
      onLoaded?.(result.boards.length > 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [referenceDate, overdue]);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto py-8">
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm flex items-center justify-between gap-4">
          <span>{error}</span>
          <button onClick={load} className="text-red-700 font-medium hover:underline shrink-0">
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (boards.length === 0) {
    return (
      <EmptyState
        icon={<FolderIcon />}
        message={overdue ? 'No overdue tasks' : 'No tasks for this period'}
        onRefresh={load}
      />
    );
  }

  return <BoardGroupedTasks boards={boards} onRefresh={load} viewKey={viewKey} searchQuery={searchQuery} />;
}
