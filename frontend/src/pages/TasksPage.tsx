import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTasks } from '../hooks/useTasks';
import { useLabels } from '../hooks/useLabels';
import { TaskCard } from '../components/TaskCard';
import { updateTask } from '../api/tasks';
import { useFilter } from '../context/FilterContext';
import type { Label, Task } from '../api/tasks';
import { filterTasks } from '../utils/taskFilters';
import {
  type ColumnKey,
  dateOnly,
  getEffectiveDate,
  getColumn,
  getDropDate,
  getEffectiveDateField,
} from '../utils/taskDateUtils';
import { isHighPriorityEligible, splitByPriority, canAddHighPriority, HIGH_PRIORITY_DAILY_LIMIT } from '../utils/taskPriority';

type LabelCategory = 'frequency' | 'mode' | 'type';
const CATEGORIES: LabelCategory[] = ['mode', 'type', 'frequency'];

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

const COLUMNS: { key: ColumnKey; title: string }[] = [
  { key: 'today', title: 'Today' },
  { key: 'tomorrow', title: 'Tomorrow' },
  { key: 'upcoming', title: 'Upcoming' },
  { key: 'nodate', title: 'No Date' },
];

export function TasksPage() {
  const navigate = useNavigate();
  const { selectedLabelIds, toggleLabel, clearLabels } = useFilter();
  const [showDone, setShowDone] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [dragOverColumn, setDragOverColumn] = useState<ColumnKey | null>(null);
  const [dragOverPriority, setDragOverPriority] = useState<'high' | 'normal' | null>(null);

  const { tasks, loading, error, refetch } = useTasks(showDone ? 'done' : 'pending');
  const { labels, labelsByCategory } = useLabels();
  const [dropError, setDropError] = useState<string | null>(null);

  const { today, tomorrow } = useMemo(() => {
    const now = new Date();
    const tom = new Date(now);
    tom.setDate(tom.getDate() + 1);
    return { today: dateOnly(now), tomorrow: dateOnly(tom) };
  }, []);

  const filteredTasks = useMemo(
    () => filterTasks(tasks, selectedLabelIds, searchQuery),
    [tasks, selectedLabelIds, searchQuery],
  );

  const columnTasks = useMemo(() => {
    const map: Record<ColumnKey, Task[]> = { today: [], tomorrow: [], upcoming: [], nodate: [] };
    for (const task of filteredTasks) {
      map[getColumn(task, today, tomorrow)].push(task);
    }
    for (const key of Object.keys(map) as ColumnKey[]) {
      map[key].sort((a, b) => {
        const aDate = getEffectiveDate(a);
        const bDate = getEffectiveDate(b);
        if (!aDate && !bDate) return 0;
        if (!aDate) return 1;
        if (!bDate) return -1;
        return aDate < bDate ? -1 : aDate > bDate ? 1 : 0;
      });
    }
    return map;
  }, [filteredTasks, today, tomorrow]);

  async function handleDrop(taskId: string, columnKey: ColumnKey, priority: 'high' | 'normal' = 'normal') {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    if (priority === 'high' && isHighPriorityEligible(columnKey)) {
      const allHighForColumn = tasks.filter(
        (t) => t.is_high_priority && getColumn(t, today, tomorrow) === columnKey,
      );
      if (!canAddHighPriority(allHighForColumn, task)) {
        setDropError(`High priority is limited to ${HIGH_PRIORITY_DAILY_LIMIT} tasks per day.`);
        return;
      }
    }

    const newDate = getDropDate(columnKey);
    const field = getEffectiveDateField(task);
    const isHighPriority = isHighPriorityEligible(columnKey) && priority === 'high';

    try {
      if (columnKey === 'nodate') {
        await updateTask(taskId, { must_do_by: null, target_date: null, is_high_priority: false });
      } else if (field === 'target_date') {
        await updateTask(taskId, { target_date: newDate, is_high_priority: isHighPriority });
      } else {
        await updateTask(taskId, { must_do_by: newDate, is_high_priority: isHighPriority });
      }
      refetch();
    } catch (err) {
      setDropError(err instanceof Error ? err.message : 'Failed to move task');
    }
  }

  function clearDragState() {
    setDragOverColumn(null);
    setDragOverPriority(null);
  }

  return (
    <div className="p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 max-w-full">
        <h2 className="text-xl font-bold text-gray-900">
          {showDone ? 'Completed Tasks' : 'My Tasks'}
        </h2>
        <div className="flex items-center gap-3">
          <div className="relative">
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tasks…"
              className="pl-8 pr-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 w-44"
            />
          </div>
          <button
            onClick={() => setShowDone((v) => !v)}
            className="text-sm text-indigo-600 hover:text-indigo-800 font-medium whitespace-nowrap"
          >
            {showDone ? 'Show pending' : 'Show done'}
          </button>
        </div>
      </div>

      {/* Label filter chips — only shown for pending (kanban) view */}
      {!showDone && (
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
              onClick={clearLabels}
              className="text-xs text-gray-500 hover:text-gray-700 underline"
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      {loading && (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
        </div>
      )}

      {(error || dropError) && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
          {error ?? dropError}
        </div>
      )}

      {!loading && !error && (
        showDone ? (
          /* Done tasks: flat list */
          <div className="space-y-2 max-w-2xl mx-auto">
            {filteredTasks.length === 0 ? (
              <EmptyState msg={searchQuery.trim() || selectedLabelIds.size > 0 ? 'No completed tasks match this filter' : 'No completed tasks yet'} />
            ) : (
              filteredTasks.map((task) => (
                <TaskCard key={task.id} task={task} labels={labels} onRefresh={refetch} />
              ))
            )}
          </div>
        ) : filteredTasks.length === 0 ? (
          <EmptyState msg={selectedLabelIds.size > 0 || searchQuery.trim() ? 'No tasks match this filter' : 'No pending tasks'} />
        ) : (
          /* Pending tasks: 4-column kanban board */
          <div className="overflow-x-auto -mx-4 px-4 pb-4">
            <div className="flex gap-3" style={{ minWidth: 'max-content' }}>
              {COLUMNS.map((col) => {
                const colTasks = columnTasks[col.key];
                const isOver = dragOverColumn === col.key;
                const isPriorityColumn = isHighPriorityEligible(col.key);

                if (isPriorityColumn) {
                  const { high: highTasks, normal: normalTasks } = splitByPriority(colTasks);
                  const isHighZoneOver = isOver && dragOverPriority === 'high';
                  const isNormalZoneOver = isOver && dragOverPriority === 'normal';

                  return (
                    <div
                      key={col.key}
                      className={`w-52 sm:w-60 flex-shrink-0 rounded-xl border-2 transition-colors ${
                        isOver ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200 bg-gray-50'
                      }`}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setDragOverColumn(col.key);
                      }}
                      onDragLeave={(e) => {
                        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                          clearDragState();
                        }
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        const taskId = e.dataTransfer.getData('text/plain');
                        const priority = dragOverPriority ?? 'normal';
                        clearDragState();
                        if (taskId) handleDrop(taskId, col.key, priority);
                      }}
                    >
                      <div className="px-3 py-2.5 border-b border-gray-200 flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-700">{col.title}</span>
                        <span className="text-xs text-gray-400 font-medium bg-gray-200 rounded-full px-1.5 py-0.5">
                          {colTasks.length}
                        </span>
                      </div>

                      {/* High-priority zone — onDragOver sets priority intent; onDrop is on the outer div */}
                      <div
                        className={`p-2 space-y-2 min-h-[60px] transition-colors rounded-t-lg ${
                          isHighZoneOver ? 'bg-orange-50' : ''
                        }`}
                        onDragOver={(e) => {
                          e.preventDefault();
                          setDragOverColumn(col.key);
                          setDragOverPriority('high');
                        }}
                      >
                        {highTasks.length === 0 ? (
                          <div className={`text-center py-4 text-xs select-none transition-colors ${
                            isHighZoneOver ? 'text-orange-400' : 'text-gray-300'
                          }`}>
                            Drop for high priority ↑
                          </div>
                        ) : (
                          highTasks.map((task) => (
                            <TaskCard key={task.id} task={task} labels={labels} onRefresh={refetch} draggable />
                          ))
                        )}
                      </div>

                      {/* Divider */}
                      <div className="flex items-center gap-1 px-2 py-0.5 select-none">
                        <div className="flex-1 h-px bg-orange-200" />
                        <span className="text-[10px] text-orange-400 font-semibold uppercase tracking-wide whitespace-nowrap">
                          high · normal
                        </span>
                        <div className="flex-1 h-px bg-gray-200" />
                      </div>

                      {/* Normal-priority zone — onDragOver sets priority intent; onDrop is on the outer div */}
                      <div
                        className={`p-2 space-y-2 min-h-[60px] transition-colors rounded-b-lg ${
                          isNormalZoneOver ? 'bg-indigo-50' : ''
                        }`}
                        onDragOver={(e) => {
                          e.preventDefault();
                          setDragOverColumn(col.key);
                          setDragOverPriority('normal');
                        }}
                      >
                        {normalTasks.length === 0 ? (
                          <div className={`text-center py-4 text-xs select-none transition-colors ${
                            isNormalZoneOver ? 'text-indigo-400' : 'text-gray-300'
                          }`}>
                            Drop here
                          </div>
                        ) : (
                          normalTasks.map((task) => (
                            <TaskCard key={task.id} task={task} labels={labels} onRefresh={refetch} draggable />
                          ))
                        )}
                      </div>
                    </div>
                  );
                }

                // Upcoming / No Date columns — no priority split
                return (
                  <div
                    key={col.key}
                    className={`w-52 sm:w-60 flex-shrink-0 rounded-xl border-2 transition-colors ${
                      isOver ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200 bg-gray-50'
                    }`}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOverColumn(col.key);
                      setDragOverPriority(null);
                    }}
                    onDragLeave={(e) => {
                      if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                        clearDragState();
                      }
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      clearDragState();
                      const taskId = e.dataTransfer.getData('text/plain');
                      if (taskId) handleDrop(taskId, col.key, 'normal');
                    }}
                  >
                    <div className="px-3 py-2.5 border-b border-gray-200 flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-700">{col.title}</span>
                      <span className="text-xs text-gray-400 font-medium bg-gray-200 rounded-full px-1.5 py-0.5">
                        {colTasks.length}
                      </span>
                    </div>
                    <div className="p-2 space-y-2 min-h-[120px]">
                      {colTasks.length === 0 ? (
                        <div className="text-center py-8 text-gray-300 text-xs select-none">
                          Drop here
                        </div>
                      ) : (
                        colTasks.map((task) => (
                          <TaskCard key={task.id} task={task} labels={labels} onRefresh={refetch} draggable />
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )
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

function EmptyState({ msg }: { msg: string }) {
  return (
    <div className="text-center py-16 text-gray-400">
      <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
      <p className="text-sm">{msg}</p>
    </div>
  );
}
