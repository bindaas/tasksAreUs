import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCompletions, type CompletionRecord, type BoardCompletions } from '../api/reports';
import { LabelBadge } from '../components/LabelBadge';
import { ArchiveBoardTabs } from '../components/ArchiveBoardTabs';
import { ArchiveBoardGroups } from '../components/ArchiveBoardGroups';
import { dateOnly } from '../utils/taskDateUtils';
import { getPresetRange, PRESET_LABELS, type PresetKey } from '../utils/dateRangePresets';

function formatDateTime(isoStr: string): string {
  const d = new Date(isoStr);
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const PRESETS: PresetKey[] = ['this_month', 'last_month', 'last_three_months'];

export function ArchivePage() {
  const navigate = useNavigate();
  const today = new Date();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(today.getDate() - 30);

  const [from, setFrom] = useState(dateOnly(thirtyDaysAgo));
  const [to, setTo] = useState(dateOnly(today));
  const [selectedBoardId, setSelectedBoardId] = useState<string | 'all'>('all');
  const [completions, setCompletions] = useState<CompletionRecord[]>([]);
  const [boards, setBoards] = useState<BoardCompletions[] | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchReport = useCallback(async () => {
    if (!from || !to) return;
    setLoading(true);
    setError(null);
    try {
      const options = selectedBoardId === 'all' ? { allBoards: true } : { boardId: selectedBoardId };
      const result = await getCompletions(from, to, options);
      setCompletions(result.completions);
      setBoards(result.boards ?? null);
      setTotal(result.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load report');
    } finally {
      setLoading(false);
    }
  }, [from, to, selectedBoardId]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  function applyPreset(preset: PresetKey) {
    const range = getPresetRange(preset);
    setFrom(range.from);
    setTo(range.to);
  }

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <h2 className="text-xl font-bold text-gray-900 mb-5">Archive</h2>

      <ArchiveBoardTabs selectedBoardId={selectedBoardId} onSelect={setSelectedBoardId} />

      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-5">
        <div className="flex flex-wrap gap-1.5 mb-3">
          {PRESETS.map((preset) => (
            <button
              key={preset}
              onClick={() => applyPreset(preset)}
              className="px-3 py-1 rounded-full text-xs font-medium border border-gray-300 bg-white text-gray-600 hover:border-indigo-400 transition-colors"
            >
              {PRESET_LABELS[preset]}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-32">
            <label className="block text-xs font-medium text-gray-600 mb-1">From</label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          <div className="flex-1 min-w-32">
            <label className="block text-xs font-medium text-gray-600 mb-1">To</label>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm mb-4">
          {error}
        </div>
      )}

      {loading && (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
        </div>
      )}

      {!loading && !error && (
        <>
          <div className="bg-indigo-50 border border-indigo-200 rounded-lg px-4 py-3 mb-4 flex items-center justify-between">
            <span className="text-sm text-indigo-700 font-medium">Total completions</span>
            <span className="text-2xl font-bold text-indigo-700">{total}</span>
          </div>

          {boards ? (
            boards.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <p className="text-sm">No tasks completed in this date range</p>
              </div>
            ) : (
              <ArchiveBoardGroups boards={boards} />
            )
          ) : completions.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <p className="text-sm">No tasks completed in this date range</p>
            </div>
          ) : (
            <div className="space-y-2">
              {completions.map((item) => {
                const sortedLabels = [...item.labels].sort((a, b) => a.value.localeCompare(b.value));
                return (
                  <div
                    key={item.task_id}
                    onClick={() => navigate(`/tasks/${item.task_id}`)}
                    className="bg-white border border-gray-200 rounded-lg p-4 cursor-pointer hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{item.title}</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Completed {formatDateTime(item.completed_at)}
                        </p>
                      </div>
                      <div className="shrink-0">
                        <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    </div>
                    {sortedLabels.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {sortedLabels.map((label) => (
                          <LabelBadge key={label.id} label={label} small />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
