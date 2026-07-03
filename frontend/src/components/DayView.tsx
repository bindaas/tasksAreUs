import { useState, useEffect } from 'react';
import { getDayViewTasks } from '../api/dayView';
import type { FocusedBoard } from '../api/focusedView';
import { BoardGroupedTasks } from './BoardGroupedTasks';

export function DayView({ referenceDate }: { referenceDate: string }) {
  const [boards, setBoards] = useState<FocusedBoard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const result = await getDayViewTasks(referenceDate);
      setBoards(result.boards);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [referenceDate]);

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
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
        <p className="text-sm">No tasks for this period</p>
        <button onClick={load} className="mt-4 text-xs text-indigo-500 hover:underline">Refresh</button>
      </div>
    );
  }

  return <BoardGroupedTasks boards={boards} />;
}
