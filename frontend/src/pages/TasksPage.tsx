import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTasks } from '../hooks/useTasks';
import { useLabels } from '../hooks/useLabels';
import { TaskCard } from '../components/TaskCard';
import type { Label } from '../api/tasks';

type LabelCategory = 'frequency' | 'mode' | 'type';
const CATEGORIES: LabelCategory[] = ['frequency', 'mode', 'type'];

const CATEGORY_COLORS: Record<LabelCategory, { active: string; inactive: string }> = {
  frequency: {
    active: 'bg-blue-600 text-white border-blue-600',
    inactive: 'bg-white text-blue-700 border-blue-300 hover:bg-blue-50',
  },
  mode: {
    active: 'bg-green-600 text-white border-green-600',
    inactive: 'bg-white text-green-700 border-green-300 hover:bg-green-50',
  },
  type: {
    active: 'bg-purple-600 text-white border-purple-600',
    inactive: 'bg-white text-purple-700 border-purple-300 hover:bg-purple-50',
  },
};

export function TasksPage() {
  const navigate = useNavigate();
  const [showDone, setShowDone] = useState(false);
  const [selectedLabelIds, setSelectedLabelIds] = useState<Set<string>>(new Set());

  const { tasks, loading, error, refetch } = useTasks(showDone ? 'done' : 'pending');
  const { labelsByCategory } = useLabels();

  function toggleLabel(id: string) {
    setSelectedLabelIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  const filteredTasks = useMemo(() => {
    if (selectedLabelIds.size === 0) return tasks;
    return tasks.filter((task) =>
      task.labels.some((l) => selectedLabelIds.has(l.id))
    );
  }, [tasks, selectedLabelIds]);

  return (
    <div className="p-4 max-w-2xl mx-auto">
      {/* Header row */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-900">
          {showDone ? 'Completed Tasks' : 'My Tasks'}
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowDone((v) => !v)}
            className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
          >
            {showDone ? 'Show pending' : 'Show done'}
          </button>
        </div>
      </div>

      {/* Filter chips */}
      <div className="mb-4 space-y-2">
        {CATEGORIES.map((cat) => {
          const catLabels = (labelsByCategory[cat] ?? []) as Label[];
          if (catLabels.length === 0) return null;
          const colors = CATEGORY_COLORS[cat];
          return (
            <div key={cat} className="flex flex-wrap gap-1.5 items-center">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide w-16 shrink-0 capitalize">
                {cat}
              </span>
              {catLabels.map((label) => {
                const active = selectedLabelIds.has(label.id);
                return (
                  <button
                    key={label.id}
                    onClick={() => toggleLabel(label.id)}
                    className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-colors ${
                      active ? colors.active : colors.inactive
                    }`}
                  >
                    {label.value}
                  </button>
                );
              })}
            </div>
          );
        })}
        {selectedLabelIds.size > 0 && (
          <button
            onClick={() => setSelectedLabelIds(new Set())}
            className="text-xs text-gray-500 hover:text-gray-700 underline"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Task list */}
      {loading && (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {!loading && !error && filteredTasks.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <p className="text-sm">
            {selectedLabelIds.size > 0
              ? 'No tasks match the selected filters'
              : showDone
              ? 'No completed tasks yet'
              : 'No pending tasks — great job!'}
          </p>
        </div>
      )}

      {!loading && !error && filteredTasks.length > 0 && (
        <div className="space-y-2">
          {filteredTasks.map((task) => (
            <TaskCard key={task.id} task={task} onRefresh={refetch} />
          ))}
        </div>
      )}

      {/* FAB */}
      {!showDone && (
        <button
          onClick={() => navigate('/tasks/new')}
          className="fixed bottom-20 right-4 md:bottom-8 md:right-8 w-14 h-14 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full shadow-lg flex items-center justify-center transition-colors z-10"
          title="New task"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
        </button>
      )}
    </div>
  );
}
