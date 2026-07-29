import { useState, useEffect } from 'react';
import { getFocusedViewTasks, type FocusedBoard } from '../api/focusedView';
import { dateOnly } from '../utils/taskDateUtils';
import { BoardGroupedTasks } from './BoardGroupedTasks';
import { EmptyState, StarIcon } from './EmptyState';

export function FocusedView({ searchQuery = '' }: { searchQuery?: string } = {}) {
  const [boards, setBoards] = useState<FocusedBoard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const result = await getFocusedViewTasks(dateOnly(new Date()));
      setBoards(result.boards);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load focused view');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

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
        icon={<StarIcon />}
        message="No focused tasks for this period"
        subMessage="High-priority tasks with dates in your configured range will appear here"
        onRefresh={load}
      />
    );
  }

  return <BoardGroupedTasks boards={boards} onRefresh={load} viewKey="focused" searchQuery={searchQuery} />;
}
