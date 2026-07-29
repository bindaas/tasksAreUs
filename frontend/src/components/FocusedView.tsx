import { useState, useEffect } from 'react';
import { getFocusedViewTasks, type FocusedBoard } from '../api/focusedView';
import { dateOnly } from '../utils/taskDateUtils';
import { BoardGroupedTasks } from './BoardGroupedTasks';

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
      <div className="text-center py-16 text-gray-400">
        <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
        </svg>
        <p className="text-sm">No focused tasks for this period</p>
        <p className="text-xs text-gray-300 mt-1">High-priority tasks with dates in your configured range will appear here</p>
        <button onClick={load} className="mt-4 text-xs text-indigo-500 hover:underline">Refresh</button>
      </div>
    );
  }

  return <BoardGroupedTasks boards={boards} onRefresh={load} viewKey="focused" searchQuery={searchQuery} />;
}
