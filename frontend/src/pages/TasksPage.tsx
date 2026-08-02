import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTasks } from '../hooks/useTasks';
import { useLabels } from '../hooks/useLabels';
import { TaskCard } from '../components/TaskCard';
import { FocusedView } from '../components/FocusedView';
import { DayView } from '../components/DayView';
import { BoardTabs } from '../components/BoardTabs';
import { EmptyState, FolderIcon } from '../components/EmptyState';
import { updateTask } from '../api/tasks';
import { getDayViewTasks } from '../api/dayView';
import { useFilter } from '../context/FilterContext';
import { useBoard } from '../context/BoardContext';
import { useView } from '../context/ViewContext';
import { useColumnPriorityCollapse } from '../context/ColumnPriorityCollapseContext';
import type { Board } from '../api/boards';
import type { Label, Task } from '../api/tasks';
import { filterTasks } from '../utils/taskFilters';
import {
  type ColumnKey,
  dateOnly,
  getEffectiveDate,
  getColumn,
  getDropDate,
  formatDateWithDay,
  isFriday,
} from '../utils/taskDateUtils';
import { isHighPriorityEligible, splitByPriority, canAddHighPriority } from '../utils/taskPriority';
import { computeInsertSortOrder } from '../utils/taskOrder';
import { getBoardColor } from '../utils/boardColor';
import { useSettings } from '../hooks/useSettings';
import { viewLabel, type ViewMode } from '../utils/viewLabel';

type LabelCategory = 'type';
const CATEGORIES: LabelCategory[] = ['type'];

const CATEGORY_COLORS: Record<LabelCategory, { active: string; inactive: string }> = {
  type: {
    active: 'bg-purple-600 text-white border-purple-600',
    inactive: 'bg-white text-purple-700 border-purple-300 hover:bg-purple-50',
  },
};


export function TasksPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { selectedLabelIds, toggleLabel, clearLabels } = useFilter();
  const { boards, activeBoard, setActiveBoard } = useBoard();
  const activeBoardColor = useMemo(
    () => getBoardColor(activeBoard?.color, Math.max(0, boards.findIndex((b) => b.id === activeBoard?.id))),
    [activeBoard, boards],
  );
  const { viewMode, setViewMode } = useView();
  const { isCollapsed: isPriorityCollapsed, toggleColumn: togglePriorityCollapse } = useColumnPriorityCollapse();
  const [searchQuery, setSearchQuery] = useState('');
  const [dragOverColumn, setDragOverColumn] = useState<ColumnKey | null>(null);
  const [dragOverPriority, setDragOverPriority] = useState<'high' | 'normal' | null>(null);
  const [dragOverTaskId, setDragOverTaskId] = useState<string | null>(null);
  const [dragOverEdge, setDragOverEdge] = useState<'above' | 'below' | null>(null);

  const { tasks, loading, error, refetch } = useTasks('pending');
  const { labels, labelsByCategory } = useLabels();
  const { highPriorityDailyLimit } = useSettings();
  const [dropError, setDropError] = useState<string | null>(null);
  const [hasOverdueTasks, setHasOverdueTasks] = useState(false);
  const [overdueChecked, setOverdueChecked] = useState(false);
  const appliedDefaultRef = useRef(false);

  const VIEW_ORDER = useMemo<{ key: ViewMode; title: string }[]>(() => [
    ...(hasOverdueTasks ? [{ key: 'overdue' as const, title: 'Overdue' }] : []),
    { key: 'focused', title: 'Focused' },
    { key: 'today', title: 'Today' },
    { key: 'tomorrow', title: 'Tomorrow' },
    { key: 'all', title: 'All' },
  ], [hasOverdueTasks]);

  const { today, tomorrow } = useMemo(() => {
    const now = new Date();
    const tom = new Date(now);
    tom.setDate(tom.getDate() + 1);
    return { today: dateOnly(now), tomorrow: dateOnly(tom) };
  }, []);

  const isFridayToday = useMemo(() => isFriday(), []);
  const monday = useMemo(() => {
    if (!isFridayToday) return null;
    const m = new Date(tomorrow + 'T00:00:00');
    m.setDate(m.getDate() + 2);
    return dateOnly(m);
  }, [isFridayToday, tomorrow]);

  const COLUMNS = useMemo<{ key: ColumnKey; title: string; dateLabel?: string }[]>(() => {
    const dayAfterTomorrow = (() => {
      const dat = new Date(tomorrow + 'T00:00:00');
      dat.setDate(dat.getDate() + 1);
      return dateOnly(dat);
    })();
    const base = [
      { key: 'overdue' as const, title: 'Overdue' },
      { key: 'today' as const, title: 'Today', dateLabel: formatDateWithDay(today) },
      { key: 'tomorrow' as const, title: 'Tomorrow', dateLabel: formatDateWithDay(tomorrow) },
      { key: 'day_after_tomorrow' as const, title: 'Day After Tomorrow', dateLabel: formatDateWithDay(dayAfterTomorrow) },
      ...(isFridayToday && monday ? [{ key: 'monday' as const, title: 'Monday', dateLabel: formatDateWithDay(monday) }] : []),
      { key: 'upcoming' as const, title: 'Upcoming' },
      { key: 'nodate' as const, title: 'No Date' },
    ];
    return base;
  }, [today, tomorrow, isFridayToday, monday]);

  // Restore viewMode from the URL's ?view= param (hard reload / shared link).
  // No-ops once the context already matches, so it doesn't fight in-app view changes.
  useEffect(() => {
    const viewParam = searchParams.get('view');
    if (
      (viewParam === 'overdue' || viewParam === 'today' || viewParam === 'tomorrow' || viewParam === 'all') &&
      viewParam !== viewMode
    ) {
      setViewMode(viewParam);
    }
  }, [searchParams, viewMode, setViewMode]);

  // Restore activeBoard from the URL's ?board= param once boards have loaded
  // (BoardProvider's fetchBoards is async — boards starts as [] on mount).
  useEffect(() => {
    if (boards.length === 0) return;
    const boardParam = searchParams.get('board');
    if (!boardParam) return;
    const found = boards.find((b) => b.id === boardParam);
    if (found && found.id !== activeBoard?.id) {
      setActiveBoard(found);
    }
  }, [boards, searchParams, activeBoard, setActiveBoard]);

  // Check for overdue tasks once on mount: drives the Overdue pill's visibility and
  // (when no explicit ?view= param already won) the Focused vs. Overdue default.
  // The ref is only ever set inside the .then() continuation — i.e. only once the
  // real value is known — so there's no synchronous code path that can consume the
  // one-shot default-application guard before the fetch resolves.
  useEffect(() => {
    getDayViewTasks(dateOnly(new Date()), true)
      .then((result) => {
        const hasAny = result.boards.length > 0;
        setHasOverdueTasks(hasAny);
        if (!appliedDefaultRef.current) {
          appliedDefaultRef.current = true;
          if (!searchParams.get('view') && hasAny) {
            setView('overdue');
          }
        }
      })
      .catch(() => setHasOverdueTasks(false))
      .finally(() => setOverdueChecked(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setView(v: ViewMode) {
    setViewMode(v);
    const next = new URLSearchParams(searchParams);
    next.set('view', v);
    if (v === 'all' && activeBoard) next.set('board', activeBoard.id);
    setSearchParams(next);
  }

  function handleBoardTabSelect(board: Board) {
    const next = new URLSearchParams(searchParams);
    next.set('board', board.id);
    setSearchParams(next);
  }

  function handleFabClick() {
    if (viewMode === 'all' && activeBoard) {
      navigate(`/tasks/new?board=${activeBoard.id}`);
      return;
    }
    const defaultBoard = boards.find((b) => b.is_default);
    navigate(defaultBoard ? `/tasks/new?board=${defaultBoard.id}` : '/tasks/new');
  }

  const filteredTasks = useMemo(
    () => filterTasks(tasks, selectedLabelIds, searchQuery),
    [tasks, selectedLabelIds, searchQuery],
  );

  const columnTasks = useMemo(() => {
    const map: Record<ColumnKey, Task[]> = { overdue: [], today: [], tomorrow: [], day_after_tomorrow: [], monday: [], upcoming: [], nodate: [] };
    for (const task of filteredTasks) {
      map[getColumn(task, today, tomorrow)].push(task);
    }
    for (const key of Object.keys(map) as ColumnKey[]) {
      if (key === 'overdue') {
        map[key].sort((a, b) => {
          if (a.is_high_priority !== b.is_high_priority) {
            return a.is_high_priority ? -1 : 1;
          }
          const aDate = getEffectiveDate(a);
          const bDate = getEffectiveDate(b);
          if (!aDate && !bDate) return 0;
          if (!aDate) return 1;
          if (!bDate) return -1;
          return aDate < bDate ? -1 : aDate > bDate ? 1 : 0;
        });
      } else if (key === 'upcoming') {
        map[key].sort((a, b) => {
          if (!a.target_date && !b.target_date) return 0;
          if (!a.target_date) return 1;
          if (!b.target_date) return -1;
          return a.target_date < b.target_date ? -1 : a.target_date > b.target_date ? 1 : 0;
        });
      } else {
        map[key].sort((a, b) => {
          if (a.is_high_priority !== b.is_high_priority) {
            return a.is_high_priority ? -1 : 1;
          }
          return a.sort_order - b.sort_order;
        });
      }
    }
    return map;
  }, [filteredTasks, today, tomorrow]);

  async function handleTogglePriority(taskId: string, columnKey: ColumnKey) {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    if (!task.is_high_priority) {
      const allHighForColumn = tasks.filter(
        (t) => t.is_high_priority && getColumn(t, today, tomorrow) === columnKey,
      );
      if (!canAddHighPriority(allHighForColumn, task, highPriorityDailyLimit)) {
        setDropError(`High priority is limited to ${highPriorityDailyLimit} tasks per day.`);
        return;
      }
    }

    try {
      await updateTask(taskId, { is_high_priority: !task.is_high_priority });
      setDropError(null);
      refetch();
    } catch (err) {
      setDropError(err instanceof Error ? err.message : 'Failed to update priority');
    }
  }

  async function handleDrop(taskId: string, columnKey: ColumnKey, priority: 'high' | 'normal' = 'normal') {
    if (columnKey === 'overdue' || columnKey === 'upcoming') return;

    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    if (priority === 'high' && isHighPriorityEligible(columnKey)) {
      const allHighForColumn = tasks.filter(
        (t) => t.is_high_priority && getColumn(t, today, tomorrow) === columnKey,
      );
      if (!canAddHighPriority(allHighForColumn, task, highPriorityDailyLimit)) {
        setDropError(`High priority is limited to ${highPriorityDailyLimit} tasks per day.`);
        return;
      }
    }

    const newDate = getDropDate(columnKey);
    const isHighPriority = isHighPriorityEligible(columnKey) && priority === 'high';

    const { high, normal } = splitByPriority(columnTasks[columnKey]);
    const zoneTasks = priority === 'high' ? high : normal;
    const sortOrder = computeInsertSortOrder(zoneTasks, taskId, dragOverTaskId, dragOverEdge);

    try {
      if (columnKey === 'nodate') {
        await updateTask(taskId, { must_do_by: null, target_date: null, is_high_priority: false, sort_order: sortOrder });
      } else {
        await updateTask(taskId, { target_date: newDate, is_high_priority: isHighPriority, sort_order: sortOrder });
      }
      refetch();
    } catch (err) {
      setDropError(err instanceof Error ? err.message : 'Failed to move task');
    }
  }

  function clearDragState() {
    setDragOverColumn(null);
    setDragOverPriority(null);
    setDragOverTaskId(null);
    setDragOverEdge(null);
  }

  return (
    <div className="p-4">
      {/* Search box — topmost element, all views */}
      <div className="flex justify-end mb-3">
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
      </div>

      {/* Header */}
      <div className="flex items-center justify-between mb-4 max-w-full gap-3 flex-wrap">
        <h2 className="text-xl font-bold text-gray-900">
          Tasks Are Us - {viewLabel(viewMode, activeBoard?.name)}
        </h2>
        {overdueChecked && (
          <div className="flex items-center gap-3 flex-wrap">
            {/* view toggle */}
            <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs font-medium">
              {VIEW_ORDER.map((v, idx) => (
                <button
                  key={v.key}
                  onClick={() => setView(v.key)}
                  className={`px-3 py-1.5 transition-colors ${idx > 0 ? 'border-l border-gray-200' : ''} ${
                    viewMode === v.key
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  {v.title}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {!overdueChecked ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Board tabs — only under All */}
          {viewMode === 'all' && <BoardTabs onSelect={handleBoardTabSelect} />}

          {/* Label filter chips — only shown for the All (kanban) view */}
          {viewMode === 'all' && (
            <div className="mb-4 space-y-2">
              {CATEGORIES.map((cat) => {
                const catLabels = ((labelsByCategory[cat] ?? []) as Label[]).slice().sort((a, b) => a.value.localeCompare(b.value));
                if (catLabels.length === 0) return null;
                const colors = CATEGORY_COLORS[cat];
                return (
                  <div key={cat} className="flex flex-wrap gap-1.5 items-center justify-end">
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
                <div className="flex justify-end">
                  <button
                    onClick={clearLabels}
                    className="text-xs text-gray-500 hover:text-gray-700 underline"
                  >
                    Clear filters
                  </button>
                </div>
              )}
            </div>
          )}

          {loading && viewMode === 'all' && (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
            </div>
          )}

          {(error || dropError) && viewMode === 'all' && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
              {error ?? dropError}
            </div>
          )}

          {viewMode === 'overdue' && (
            <DayView referenceDate={today} viewKey="overdue" overdue onLoaded={setHasOverdueTasks} searchQuery={searchQuery} />
          )}
          {viewMode === 'focused' && <FocusedView searchQuery={searchQuery} />}
          {viewMode === 'today' && <DayView referenceDate={today} viewKey="today" searchQuery={searchQuery} />}
          {viewMode === 'tomorrow' && <DayView referenceDate={tomorrow} viewKey="tomorrow" searchQuery={searchQuery} />}

          {!loading && !error && viewMode === 'all' && (
            filteredTasks.length === 0 ? (
              <EmptyState
                icon={<FolderIcon />}
                message={selectedLabelIds.size > 0 || searchQuery.trim() ? 'No tasks match this filter' : 'No pending tasks'}
              />
            ) : (
              /* Pending tasks: 6-column kanban board */
              <div className="overflow-x-auto -mx-4 px-4 pb-4">
                <div className="flex gap-3" style={{ minWidth: 'max-content' }}>
              {COLUMNS.map((col) => {
                const colTasks = columnTasks[col.key];
                if (col.key === 'overdue' && colTasks.length === 0) return null;
                const isOver = dragOverColumn === col.key;
                const isOverdueCol = col.key === 'overdue';
                const isPriorityColumn = isHighPriorityEligible(col.key) || isOverdueCol;

                if (isPriorityColumn) {
                  const { high: highTasks, normal: normalTasks } = splitByPriority(colTasks);
                  const isHighZoneOver = isOver && dragOverPriority === 'high';
                  const isNormalZoneOver = isOver && dragOverPriority === 'normal';

                  return (
                    <div
                      key={col.key}
                      className={`w-52 sm:w-60 flex-shrink-0 rounded-xl border-2 transition-colors ${
                        isOver
                          ? 'border-indigo-400 bg-indigo-50'
                          : isOverdueCol
                          ? 'border-red-200 bg-red-50'
                          : 'border-gray-200 bg-gray-50'
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
                        <span className={`text-sm font-semibold ${isOverdueCol ? 'text-red-700' : 'text-gray-700'}`}>
                          {col.title}
                          {col.dateLabel && (
                            <span className="block text-xs text-gray-400 font-normal">{col.dateLabel}</span>
                          )}
                        </span>
                        <span className="text-xs text-gray-400 font-medium bg-gray-200 rounded-full px-1.5 py-0.5">
                          {colTasks.length}
                        </span>
                        {highTasks.length >= highPriorityDailyLimit && (
                          <span className="ml-auto text-xs text-amber-600 font-medium flex items-center gap-1" title="High-priority limit exceeded">
                            ⚠ {highTasks.length}/{highPriorityDailyLimit} high
                          </span>
                        )}
                      </div>

                      {/* High-priority zone header with collapse toggle — whole strip is clickable */}
                      <div
                        onClick={() => togglePriorityCollapse(col.key)}
                        className="px-2 py-1 flex items-center gap-1.5 bg-orange-100 border-b border-orange-200 cursor-pointer"
                        title={isPriorityCollapsed(col.key) ? 'Expand' : 'Collapse'}
                      >
                        <button
                          aria-label={isPriorityCollapsed(col.key) ? 'Expand high priority tasks' : 'Collapse high priority tasks'}
                          className="text-orange-600 hover:text-orange-700 transition-colors p-0.5 pointer-events-none"
                        >
                          <svg className={`w-4 h-4 transition-transform ${isPriorityCollapsed(col.key) ? 'rotate-180' : ''}`} fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 6l7 12H5z" />
                          </svg>
                        </button>
                        <span className="text-xs font-semibold text-orange-700">High Priority ({highTasks.length})</span>
                      </div>

                      {/* High-priority zone — onDragOver sets priority intent; onDrop is on the outer div */}
                      {!isPriorityCollapsed(col.key) && (
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
                              {isOverdueCol ? 'High priority' : 'Drop for high priority ↑'}
                            </div>
                          ) : (
                            highTasks.map((task) => (
                              <TaskCard key={task.id} task={task} labels={labels} onRefresh={refetch} draggable
                                boardColor={activeBoardColor}
                                onTogglePriority={isHighPriorityEligible(col.key) ? () => handleTogglePriority(task.id, col.key) : undefined}
                                onCardDragOver={(edge) => { setDragOverTaskId(task.id); setDragOverEdge(edge); }}
                                dropIndicator={dragOverTaskId === task.id ? dragOverEdge : null}
                              />
                            ))
                          )}
                        </div>
                      )}

                      {/* Divider */}
                      {!isPriorityCollapsed(col.key) && (
                        <div className="flex items-center gap-1 px-2 py-0.5 select-none">
                          <div className="flex-1 h-px bg-orange-200" />
                          <span className="text-[10px] text-orange-400 font-semibold uppercase tracking-wide whitespace-nowrap">
                            high · normal
                          </span>
                          <div className="flex-1 h-px bg-gray-200" />
                        </div>
                      )}

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
                            {isOverdueCol ? 'Normal priority' : 'Drop here'}
                          </div>
                        ) : (
                          normalTasks.map((task) => (
                            <TaskCard key={task.id} task={task} labels={labels} onRefresh={refetch} draggable
                              boardColor={activeBoardColor}
                              onTogglePriority={isHighPriorityEligible(col.key) ? () => handleTogglePriority(task.id, col.key) : undefined}
                              onCardDragOver={(edge) => { setDragOverTaskId(task.id); setDragOverEdge(edge); }}
                              dropIndicator={dragOverTaskId === task.id ? dragOverEdge : null}
                            />
                          ))
                        )}
                      </div>
                    </div>
                  );
                }

                // Upcoming / No Date columns — no priority split
                const isDroppable = col.key !== 'upcoming';
                return (
                  <div
                    key={col.key}
                    className={`w-52 sm:w-60 flex-shrink-0 rounded-xl border-2 transition-colors ${
                      isOver && isDroppable ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200 bg-gray-50'
                    }`}
                    onDragOver={(e) => {
                      e.preventDefault();
                      if (isDroppable) {
                        setDragOverColumn(col.key);
                        setDragOverPriority(null);
                      }
                    }}
                    onDragLeave={(e) => {
                      if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                        clearDragState();
                      }
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      clearDragState();
                      if (!isDroppable) return;
                      const taskId = e.dataTransfer.getData('text/plain');
                      if (taskId) handleDrop(taskId, col.key, 'normal');
                    }}
                  >
                    <div className="px-3 py-2.5 border-b border-gray-200 flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-700">
                        {col.title}
                        {col.dateLabel && (
                          <span className="block text-xs text-gray-400 font-normal">{col.dateLabel}</span>
                        )}
                      </span>
                      <span className="text-xs text-gray-400 font-medium bg-gray-200 rounded-full px-1.5 py-0.5">
                        {colTasks.length}
                      </span>
                    </div>
                    <div className="p-2 space-y-2 min-h-[120px]">
                      {colTasks.length === 0 ? (
                        <div className="text-center py-8 text-gray-300 text-xs select-none">
                          {isDroppable ? 'Drop here' : 'Read-only'}
                        </div>
                      ) : (
                        colTasks.map((task) => (
                          <TaskCard key={task.id} task={task} labels={labels} onRefresh={refetch} draggable
                            boardColor={activeBoardColor}
                            onCardDragOver={(edge) => { setDragOverTaskId(task.id); setDragOverEdge(edge); }}
                            dropIndicator={dragOverTaskId === task.id ? dragOverEdge : null}
                          />
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
        </>
      )}

      {/* FAB */}
      <button
        onClick={handleFabClick}
        className="fixed bottom-20 right-4 md:bottom-8 md:right-8 w-14 h-14 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full shadow-lg flex items-center justify-center transition-colors z-10"
        title="New task"
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
      </button>
    </div>
  );
}

