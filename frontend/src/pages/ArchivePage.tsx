import { useState, useEffect, useCallback } from 'react';
import { getCompletions, type CompletionRecord, type BoardCompletions } from '../api/reports';
import { reopenTask, deleteTask } from '../api/tasks';
import { ArchiveBoardTabs } from '../components/ArchiveBoardTabs';
import { ArchiveBoardGroups, CompletionCard } from '../components/ArchiveBoardGroups';
import { useBoardCollapse } from '../context/BoardCollapseContext';
import { dateOnly } from '../utils/taskDateUtils';
import { getPresetRange, PRESET_LABELS, type PresetKey } from '../utils/dateRangePresets';

const PRESETS: PresetKey[] = ['this_month', 'last_month', 'last_three_months', 'all'];

export function ArchivePage() {
  const { setAllCollapsed } = useBoardCollapse();
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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);

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

  useEffect(() => {
    setSelectedIds(new Set());
  }, [completions]);

  function applyPreset(preset: PresetKey) {
    const range = getPresetRange(preset);
    setFrom(range.from);
    setTo(range.to);
  }

  function toggleSelect(taskId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  }

  const allSelected = completions.length > 0 && selectedIds.size === completions.length;

  function toggleSelectAll() {
    if (allSelected) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(new Set(completions.map((c) => c.task_id)));
    if (boards) {
      setAllCollapsed('archive', boards.map((b) => b.board_id), false);
    }
  }

  async function handleReopenIds(ids: string[]) {
    setBulkActionLoading(true);
    try {
      await Promise.all(ids.map((id) => reopenTask(id)));
      await fetchReport();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update task(s)');
    } finally {
      setBulkActionLoading(false);
    }
  }

  async function handleDeleteIds(ids: string[]) {
    const confirmed = confirm(ids.length === 1 ? 'Delete this task?' : `Delete ${ids.length} tasks?`);
    if (!confirmed) return;
    setBulkActionLoading(true);
    try {
      await Promise.all(ids.map((id) => deleteTask(id)));
      await fetchReport();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete task(s)');
    } finally {
      setBulkActionLoading(false);
    }
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

          {completions.length > 0 && (
            <div className="flex items-center justify-between mb-3">
              <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleSelectAll}
                  className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                Select all
              </label>
              {selectedIds.size > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">{selectedIds.size} selected</span>
                  <button
                    onClick={() => handleReopenIds([...selectedIds])}
                    disabled={bulkActionLoading}
                    className="px-3 py-1.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-600 hover:bg-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Un-complete
                  </button>
                  <button
                    onClick={() => handleDeleteIds([...selectedIds])}
                    disabled={bulkActionLoading}
                    className="px-3 py-1.5 rounded-full text-xs font-medium bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
          )}

          {boards ? (
            boards.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <p className="text-sm">No tasks completed in this date range</p>
              </div>
            ) : (
              <ArchiveBoardGroups
                boards={boards}
                selectedIds={selectedIds}
                onToggleSelect={toggleSelect}
                onUncomplete={(id) => handleReopenIds([id])}
                onDelete={(id) => handleDeleteIds([id])}
              />
            )
          ) : completions.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <p className="text-sm">No tasks completed in this date range</p>
            </div>
          ) : (
            <div className="space-y-2">
              {completions.map((item) => (
                <CompletionCard
                  key={item.task_id}
                  item={item}
                  selected={selectedIds.has(item.task_id)}
                  onToggleSelect={toggleSelect}
                  onUncomplete={(id) => handleReopenIds([id])}
                  onDelete={(id) => handleDeleteIds([id])}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
