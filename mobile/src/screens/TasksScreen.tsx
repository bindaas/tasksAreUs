import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  SectionList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TextInput,
} from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, runOnJS } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import type { SharedValue } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import {
  listTasks,
  completeTask as apiCompleteTask,
  deleteTask as apiDeleteTask,
  updateTask,
} from '../api/tasks';
import { listLabels } from '../api/labels';
import { useBoard } from '../context/BoardContext';
import { getSettings } from '../api/settings';
import { groupTasksForList, type TaskSection } from '../utils/taskGrouping';
import { filterTasks } from '../utils/taskFilters';
import { resolveNextPriorityTier, isPriorityEligible, canAddHighPriority } from '../utils/taskPriority';
import {
  formatDate,
  getEffectiveDate,
  getDropDate,
  getColumn,
  dateOnly,
  type ColumnKey,
} from '../utils/taskDateUtils';
import { TaskFormScreen } from './TaskFormScreen';
import { FocusedView } from '../components/FocusedView';
import { DayView } from '../components/DayView';
import { BoardTabs } from '../components/BoardTabs';
import { TaskCardBody } from '../components/TaskCardBody';
import { getDayViewTasks } from '../api/dayView';
import type { Task, Label, LabelCategory, UpdateTaskBody } from '../types';
import { LABEL_BG, LABEL_TEXT } from '../utils/labelColors';

type ViewMode = 'overdue' | 'focused' | 'today' | 'tomorrow' | 'all';
type BoardViewKey = 'overdue' | 'focused' | 'today' | 'tomorrow';

const VIEW_LABELS: Record<ViewMode, string> = {
  overdue: 'Overdue',
  focused: 'Focused',
  today: 'Today',
  tomorrow: 'Tomorrow',
  all: 'All',
};

function LabelBadge({ label }: { label: Label }) {
  return (
    <View
      style={{ backgroundColor: LABEL_BG[label.category] ?? '#f3f4f6' }}
      className="rounded-full px-2 py-0.5 mr-1 mb-1"
    >
      <Text style={{ color: LABEL_TEXT[label.category] ?? '#4b5563' }} className="text-xs">
        {label.value}
      </Text>
    </View>
  );
}

function TaskRow({
  task,
  onComplete,
  onDeletePress,
  onEditPress,
  onTogglePriority,
}: {
  task: Task;
  onComplete: (id: string) => void;
  onDeletePress: (id: string, title: string) => void;
  onEditPress: (id: string) => void;
  onTogglePriority?: () => void;
}) {
  const effectiveDate = getEffectiveDate(task);
  const isDone = task.state === 'done';
  return (
    <TouchableOpacity
      onPress={() => onEditPress(task.id)}
      activeOpacity={0.7}
      className="bg-white mx-4 mb-2 rounded-xl border border-gray-100 overflow-hidden"
      style={isDone ? { opacity: 0.55 } : undefined}
    >
      <View className="p-4">
        <TaskCardBody
          task={task}
          layout="inline"
          dateDisplay={{ mode: 'effective', effectiveDate }}
          priorityBadge="toggle"
          onTogglePriority={onTogglePriority}
          renderLabels={(labels) =>
            labels.length > 0 ? (
              <View className="flex-row flex-wrap mt-1">
                {labels.map((label) => (
                  <LabelBadge key={label.id} label={label} />
                ))}
              </View>
            ) : null
          }
          onEdit={() => onEditPress(task.id)}
          onComplete={() => onComplete(task.id)}
          onDelete={() => onDeletePress(task.id, task.title)}
        />
      </View>
    </TouchableOpacity>
  );
}

function TaskGhost({ task }: { task: Task }) {
  const effectiveDate = getEffectiveDate(task);
  const barColor = task.priority === 'high' ? '#fbbf24' : task.priority === 'medium' ? '#60a5fa' : undefined;
  const starColor = task.priority === 'high' ? '#f59e0b' : task.priority === 'medium' ? '#3b82f6' : undefined;
  return (
    <View
      className="bg-white mx-4 rounded-xl border border-indigo-300 overflow-hidden"
      style={{
        shadowColor: '#000',
        shadowOpacity: 0.2,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 5 },
        elevation: 8,
      }}
    >
      {barColor && <View className="h-1" style={{ backgroundColor: barColor }} />}
      <View className="p-4">
        {starColor && (
          <Text className="text-sm mb-0.5" style={{ color: starColor }}>★</Text>
        )}
        <Text className="text-gray-900 text-base font-medium" numberOfLines={2}>
          {task.title}
        </Text>
        {effectiveDate && (
          <Text className="text-gray-400 text-xs mt-1">{formatDate(effectiveDate)}</Text>
        )}
      </View>
    </View>
  );
}

function DraggableTaskRow({
  task,
  isBeingDragged,
  ghostY,
  ghostVisible,
  onDragActivate,
  onDragMove,
  onDragEnd,
  onComplete,
  onDeletePress,
  onEditPress,
  onTogglePriority,
}: {
  task: Task;
  isBeingDragged: boolean;
  ghostY: SharedValue<number>;
  ghostVisible: SharedValue<boolean>;
  onDragActivate: (task: Task, absX: number, absY: number) => void;
  onDragMove: (absX: number, absY: number) => void;
  onDragEnd: (dropped: boolean) => void;
  onComplete: (id: string) => void;
  onDeletePress: (id: string, title: string) => void;
  onEditPress: (id: string) => void;
  onTogglePriority?: () => void;
}) {
  const panGesture = Gesture.Pan()
    .activateAfterLongPress(500)
    .enabled(task.state !== 'done')
    .onStart((e) => {
      'worklet';
      ghostY.value = e.absoluteY - 50;
      ghostVisible.value = true;
      runOnJS(onDragActivate)(task, e.absoluteX, e.absoluteY);
    })
    .onUpdate((e) => {
      'worklet';
      ghostY.value = e.absoluteY - 50;
      runOnJS(onDragMove)(e.absoluteX, e.absoluteY);
    })
    .onEnd(() => {
      'worklet';
      ghostVisible.value = false;
      runOnJS(onDragEnd)(true);
    })
    .onFinalize((_, success) => {
      'worklet';
      if (!success) {
        ghostVisible.value = false;
        runOnJS(onDragEnd)(false);
      }
    });

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View style={{ opacity: isBeingDragged ? 0.3 : 1 }}>
        <TaskRow
          task={task}
          onComplete={onComplete}
          onDeletePress={onDeletePress}
          onEditPress={onEditPress}
          onTogglePriority={onTogglePriority}
        />
      </Animated.View>
    </GestureDetector>
  );
}

type DisplaySection = TaskSection & { totalCount: number };

export function TasksScreen() {
  const { boards, activeBoard } = useBoard();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formVisible, setFormVisible] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | undefined>(undefined);
  const [createBoardId, setCreateBoardId] = useState<string | undefined>(undefined);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['today', 'overdue']),
  );
  // Ids left in a view's Set after a board is deleted/renamed are inert
  // (never matched again) rather than actively cleaned up.
  const [collapsedBoards, setCollapsedBoards] = useState<Record<BoardViewKey, Set<string>>>({
    overdue: new Set(),
    focused: new Set(),
    today: new Set(),
    tomorrow: new Set(),
  });
  const [filterOpen, setFilterOpen] = useState(false);
  const [allLabels, setAllLabels] = useState<Label[]>([]);
  const [selectedLabelIds, setSelectedLabelIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  const [viewMode, setViewMode] = useState<ViewMode>('focused');
  const [focusedViewKey, setFocusedViewKey] = useState(0);
  const [hasOverdueTasks, setHasOverdueTasks] = useState(false);
  const [initialGateResolved, setInitialGateResolved] = useState(false);
  const appliedDefaultViewRef = useRef(false);

  const [highPriorityLimit, setHighPriorityLimit] = useState(3);
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const [dragTargetSection, setDragTargetSection] = useState<ColumnKey | null>(null);

  const draggingTaskRef = useRef<Task | null>(null);
  const currentDragTargetRef = useRef<ColumnKey | null>(null);
  const sectionContentYRef = useRef<Record<string, number>>({});
  const sectionHeaderRefs = useRef<Record<string, View | null>>({});
  const listContainerRef = useRef<View>(null);
  const listAbsoluteTopRef = useRef(0);
  const listHeightRef = useRef(0);
  const scrollOffsetRef = useRef(0);
  const autoScrollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastFingerYRef = useRef(0);
  const listRef = useRef<SectionList<Task, DisplaySection>>(null);

  const ghostY = useSharedValue(0);
  const ghostVisible = useSharedValue(false);

  const ghostAnimatedStyle = useAnimatedStyle(() => ({
    position: 'absolute' as const,
    top: ghostY.value,
    left: 0,
    right: 0,
    opacity: ghostVisible.value ? 1 : 0,
    zIndex: 999,
  }));

  const load = useCallback(async (silent = false, boardId?: string) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const { tasks: fetched } = await listTasks('pending', boardId);
      setTasks(fetched);
    } catch {
      if (!silent) setError('Failed to load tasks.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Clear label filters when the active board changes
  useEffect(() => {
    setSelectedLabelIds(new Set());
    setSearchQuery('');
  }, [activeBoard?.id]);

  useFocusEffect(
    useCallback(() => {
      if (!activeBoard) return;
      load(false, activeBoard.id);
      // Re-fetch labels on every focus so chips stay current after Settings changes
      listLabels(undefined, activeBoard.id)
        .then(({ labels }) => setAllLabels(labels))
        .catch(() => {});
      getSettings()
        .then((s) => setHighPriorityLimit(s.high_priority_daily_limit))
        .catch(() => {});
      // Force FocusedView/DayView remount on every tab re-focus so config/board-tab
      // changes are reflected without needing a manual Retry.
      setFocusedViewKey((k) => k + 1);

      // Drives the Overdue pill's visibility and (on the very first focus only) the
      // Focused vs. Overdue default. appliedDefaultViewRef is only ever set inside the
      // .then() continuation — after the real value is known — so there's no
      // synchronous code path that can consume the one-shot default-application guard
      // before the fetch resolves.
      getDayViewTasks(dateOnly(new Date()), true)
        .then((result) => {
          const hasAny = result.boards.length > 0;
          setHasOverdueTasks(hasAny);
          if (!appliedDefaultViewRef.current) {
            appliedDefaultViewRef.current = true;
            if (hasAny) setViewMode('overdue');
          }
        })
        .catch(() => {})
        .finally(() => setInitialGateResolved(true));
    }, [load, activeBoard?.id]),
  );

  const allFilteredSections = useMemo(() => {
    const filtered = filterTasks(tasks, selectedLabelIds, searchQuery);
    return groupTasksForList(filtered);
  }, [tasks, selectedLabelIds, searchQuery]);

  const displaySections: DisplaySection[] = useMemo(
    () =>
      allFilteredSections.map((section) => ({
        ...section,
        totalCount: section.data.length,
        data: expandedSections.has(section.key) ? section.data : [],
      })),
    [allFilteredSections, expandedSections],
  );

  const labelsByCategory = useMemo(() => {
    const groups: Record<LabelCategory, Label[]> = { type: [] };
    for (const label of allLabels) {
      if (label.category === 'type') {
        groups[label.category].push(label);
      }
    }
    return groups;
  }, [allLabels]);

  const hasActiveFilters = selectedLabelIds.size > 0 || searchQuery.trim().length > 0;

  const allSectionsExpanded =
    allFilteredSections.length > 0 &&
    allFilteredSections.every((s) => expandedSections.has(s.key));

  async function handleComplete(id: string) {
    try {
      await apiCompleteTask(id);
      setTasks((prev) => prev.filter((t) => t.id !== id));
      load(true, activeBoard?.id);
    } catch {
      Alert.alert('Error', 'Could not complete task. Please try again.');
    }
  }

  function handleEditPress(id: string) {
    setEditingTaskId(id);
    setFormVisible(true);
  }

  function handleCreatePress() {
    setEditingTaskId(undefined);
    // Focused/Today/Tomorrow have no board tabs, so default to the user's
    // default (starred) board; All view defaults to the currently selected tab.
    setCreateBoardId(
      viewMode === 'all' ? activeBoard?.id : boards.find((b) => b.is_default)?.id ?? activeBoard?.id,
    );
    setFormVisible(true);
  }

  function handleFormSave() {
    setFormVisible(false);
    load(true, activeBoard?.id);
  }

  function handleFormCancel() {
    setFormVisible(false);
  }

  function handleDeletePress(id: string, title: string) {
    Alert.alert('Delete task?', `"${title}" will be removed from your task list.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await apiDeleteTask(id);
            setTasks((prev) => prev.filter((t) => t.id !== id));
            load(true, activeBoard?.id);
          } catch {
            Alert.alert('Error', 'Could not delete task. Please try again.');
          }
        },
      },
    ]);
  }

  async function handleTogglePriority(task: Task, columnKey: ColumnKey) {
    const nextTier = resolveNextPriorityTier(task.priority, columnKey);

    if (nextTier === 'high') {
      const freshLimit = await getSettings()
        .then((s) => s.high_priority_daily_limit)
        .catch(() => highPriorityLimit);
      const todayStr = dateOnly(new Date());
      const tomDate = new Date();
      tomDate.setDate(tomDate.getDate() + 1);
      const tomStr = dateOnly(tomDate);
      const allHighForColumn = tasks.filter(
        (t) => t.priority === 'high' && t.state === 'pending' && getColumn(t, todayStr, tomStr) === columnKey,
      );
      if (!canAddHighPriority(allHighForColumn, task, freshLimit)) {
        Alert.alert(
          'High Priority Limit',
          `You already have ${freshLimit} high-priority tasks for ${
            columnKey === 'today' ? 'Today' : columnKey === 'tomorrow' ? 'Tomorrow' : 'this day'
          }.`,
        );
        return;
      }
    }

    const original = task;
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, priority: nextTier } : t)));
    try {
      await updateTask(task.id, { priority: nextTier });
    } catch {
      setTasks((prev) => prev.map((t) => (t.id === task.id ? original : t)));
      Alert.alert('Error', 'Could not update priority. Please try again.');
    }
  }

  function toggleSection(key: string) {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function handleToggleAllSections() {
    if (allSectionsExpanded) {
      setExpandedSections(new Set());
    } else {
      setExpandedSections(
        new Set(['overdue', 'today', 'tomorrow', 'day_after_tomorrow', 'upcoming', 'nodate']),
      );
    }
  }

  function toggleBoardCollapse(view: BoardViewKey, boardId: string) {
    setCollapsedBoards((prev) => {
      const next = new Set(prev[view]);
      if (next.has(boardId)) next.delete(boardId);
      else next.add(boardId);
      return { ...prev, [view]: next };
    });
  }

  function setAllBoardsCollapsed(view: BoardViewKey, boardIds: string[], collapsed: boolean) {
    setCollapsedBoards((prev) => ({ ...prev, [view]: collapsed ? new Set(boardIds) : new Set() }));
  }

  function toggleLabel(id: string) {
    setSelectedLabelIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function clearFilters() {
    setSelectedLabelIds(new Set());
    setSearchQuery('');
  }

  // ── drag-drop ─────────────────────────────────────────────────────────────

  function stopAutoScroll() {
    if (autoScrollRef.current) {
      clearInterval(autoScrollRef.current);
      autoScrollRef.current = null;
    }
  }

  function updateDragTarget(fingerAbsY: number) {
    const fingerContentY =
      fingerAbsY - listAbsoluteTopRef.current + scrollOffsetRef.current;

    const sortedKeys = (Object.keys(sectionContentYRef.current) as ColumnKey[]).sort(
      (a, b) => sectionContentYRef.current[a] - sectionContentYRef.current[b],
    );

    let newTarget: ColumnKey | null = null;
    for (let i = 0; i < sortedKeys.length; i++) {
      const key = sortedKeys[i];
      const sectionStart = sectionContentYRef.current[key];
      const sectionEnd =
        i + 1 < sortedKeys.length
          ? sectionContentYRef.current[sortedKeys[i + 1]]
          : sectionStart + 300;
      if (fingerContentY >= sectionStart && fingerContentY < sectionEnd) {
        newTarget = (key === 'overdue' || key === 'upcoming') ? null : key;
        break;
      }
    }

    if (newTarget !== currentDragTargetRef.current) {
      currentDragTargetRef.current = newTarget;
      setDragTargetSection(newTarget);
    }
  }

  function startAutoScroll(direction: 1 | -1) {
    if (autoScrollRef.current) return;
    autoScrollRef.current = setInterval(() => {
      const newOffset = Math.max(0, scrollOffsetRef.current + direction * 6);
      scrollOffsetRef.current = newOffset;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      // getScrollResponder is an internal RN API; typed workaround for arbitrary-offset scroll
      // since SectionList.scrollToLocation does not support free-form offsets.
      (listRef.current as any)?.getScrollResponder()?.scrollTo({ y: newOffset, animated: false });
      updateDragTarget(lastFingerYRef.current);
    }, 16);
  }

  function onDragActivate(task: Task, _absX: number, absY: number) {
    draggingTaskRef.current = task;
    setDraggingTaskId(task.id);
    lastFingerYRef.current = absY;
    listContainerRef.current?.measure((_x, _y, _w, height, _px, listPageY) => {
      listAbsoluteTopRef.current = listPageY;
      listHeightRef.current = height;
      // onLayout inside SectionList gives Y relative to RN's internal CellContainer
      // wrapper (always ~0), not the scroll content. Use measure() on refs instead to
      // get true absolute positions, then convert to content-relative.
      const keys = Object.keys(sectionHeaderRefs.current);
      let pending = keys.length;
      if (pending === 0) {
        updateDragTarget(absY);
        return;
      }
      for (const key of keys) {
        const ref = sectionHeaderRefs.current[key];
        if (!ref) {
          pending--;
          if (pending === 0) updateDragTarget(absY);
          continue;
        }
        ref.measure((_x2, _y2, _w2, _h2, _px2, headerPageY) => {
          sectionContentYRef.current[key] = headerPageY - listPageY + scrollOffsetRef.current;
          pending--;
          if (pending === 0) updateDragTarget(absY);
        });
      }
    });
  }

  function onDragMove(_absX: number, absY: number) {
    lastFingerYRef.current = absY;
    const listTop = listAbsoluteTopRef.current;
    const listBottom = listTop + listHeightRef.current;
    const edge = 80;

    if (absY < listTop + edge && absY > listTop) {
      if (!autoScrollRef.current) startAutoScroll(-1);
    } else if (absY > listBottom - edge && absY < listBottom) {
      if (!autoScrollRef.current) startAutoScroll(1);
    } else {
      stopAutoScroll();
    }

    updateDragTarget(absY);
  }

  function handleDragEnd(dropped: boolean) {
    stopAutoScroll();
    if (dropped && draggingTaskRef.current && currentDragTargetRef.current) {
      void performDrop(draggingTaskRef.current, currentDragTargetRef.current);
    }
    draggingTaskRef.current = null;
    currentDragTargetRef.current = null;
    setDraggingTaskId(null);
    setDragTargetSection(null);
  }

  async function performDrop(task: Task, targetSection: ColumnKey) {
    if (targetSection === 'overdue' || targetSection === 'upcoming') return;

    // HP check: only fires for already-HP tasks. Mobile has no HP zone, so a drag
    // cannot promote a non-HP task — the limit only matters when moving an existing
    // HP task into a section that may already be at capacity. Medium is uncapped
    // (locked-in decision), so this check stays High-specific.
    if (task.priority === 'high' && (targetSection === 'today' || targetSection === 'tomorrow')) {
      // Fetch fresh HP limit to ensure Settings changes are reflected
      const freshLimit = await getSettings()
        .then((s) => s.high_priority_daily_limit)
        .catch(() => highPriorityLimit);

      const todayStr = dateOnly(new Date());
      const tomDate = new Date();
      tomDate.setDate(tomDate.getDate() + 1);
      const tomStr = dateOnly(tomDate);
      const hpCount = tasks.filter(
        (t) =>
          t.id !== task.id &&
          t.priority === 'high' &&
          t.state === 'pending' &&
          getColumn(t, todayStr, tomStr) === targetSection,
      ).length;
      if (hpCount >= freshLimit) {
        Alert.alert(
          'High Priority Limit',
          `You already have ${freshLimit} high-priority tasks for ${
            targetSection === 'today' ? 'Today' : 'Tomorrow'
          }.`,
        );
        return;
      }
    }

    // Only target_date is cleared on a no-date drop; must_do_by and priority
    // are left untouched (matches web behaviour and architecture spec).
    const newDate = getDropDate(targetSection);
    const body: UpdateTaskBody = { target_date: newDate };

    const original = task;
    setTasks((prev) =>
      prev.map((t) => (t.id !== task.id ? t : { ...t, target_date: newDate })),
    );

    try {
      await updateTask(task.id, body);
    } catch {
      setTasks((prev) => prev.map((t) => (t.id === task.id ? original : t)));
      Alert.alert('Error', 'Could not move task. Please try again.');
    }
  }

  // ── render ─────────────────────────────────────────────────────────────────

  if (loading || !initialGateResolved) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 items-center justify-center">
        <ActivityIndicator size="large" color="#4f46e5" />
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 items-center justify-center px-8">
        <Text className="text-gray-500 text-center mb-4">{error}</Text>
        <TouchableOpacity onPress={() => load(false, activeBoard?.id)} className="bg-indigo-600 rounded-xl px-6 py-3">
          <Text className="text-white font-semibold">Retry</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const todayStr = dateOnly(new Date());
  const tomDate = new Date();
  tomDate.setDate(tomDate.getDate() + 1);
  const tomorrowStr = dateOnly(tomDate);

  const pillModes: readonly ViewMode[] = hasOverdueTasks
    ? (['overdue', 'focused', 'today', 'tomorrow', 'all'] as const)
    : (['focused', 'today', 'tomorrow', 'all'] as const);

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="px-4 pt-2 pb-2">
        <View className="flex-row items-center justify-between">
          <Text className="text-2xl font-bold text-gray-900">
            Tasks Are Us - {viewMode === 'all' ? (activeBoard?.name || VIEW_LABELS['all']) : VIEW_LABELS[viewMode]}
          </Text>
          <TouchableOpacity
            onPress={handleCreatePress}
            className="w-9 h-9 rounded-full bg-indigo-600 items-center justify-center"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text className="text-white text-xl font-light leading-none">+</Text>
          </TouchableOpacity>
        </View>

        {/* View-mode pills + (All view only) Collapse/Expand + filter toggle */}
        <View className="flex-row items-center justify-between mt-2">
          <View
            className="flex-row rounded-full overflow-hidden"
            style={{ backgroundColor: '#f3f4f6' }}
          >
            {pillModes.map((mode) => (
              <TouchableOpacity
                key={mode}
                onPress={() => {
                  setViewMode(mode);
                  if (mode !== 'all') setFilterOpen(false);
                }}
                className="px-3 py-1.5"
                style={{
                  backgroundColor: viewMode === mode ? '#6366f1' : 'transparent',
                }}
                hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
              >
                <Text
                  className="text-xs font-medium"
                  style={{ color: viewMode === mode ? '#ffffff' : '#6b7280' }}
                >
                  {VIEW_LABELS[mode]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {viewMode === 'all' && (
            <View className="flex-row items-center" style={{ gap: 8 }}>
              <TouchableOpacity
                onPress={handleToggleAllSections}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text className="text-xs font-medium" style={{ color: '#6b7280' }}>
                  {allSectionsExpanded ? 'Collapse' : 'Expand'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setFilterOpen((o) => !o)}
                className="w-9 h-9 rounded-full items-center justify-center"
                style={{ backgroundColor: hasActiveFilters ? '#eef2ff' : '#f3f4f6' }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text className="text-base" style={{ color: hasActiveFilters ? '#4f46e5' : '#9ca3af' }}>
                  ☰
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Board tabs — only under All */}
        {viewMode === 'all' && (
          <View className="mt-2">
            <BoardTabs />
          </View>
        )}
      </View>

      {/* Filter panel */}
      {filterOpen && (
        <View className="bg-white border-b border-gray-100 px-4 pt-2 pb-3">
          <TextInput
            placeholder="Search tasks..."
            placeholderTextColor="#9ca3af"
            value={searchQuery}
            onChangeText={setSearchQuery}
            className="bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-900 border border-gray-200"
          />
          {(['type'] as LabelCategory[])
            .filter((cat) => labelsByCategory[cat].length > 0)
            .map((cat) => (
              <View key={cat}>
                <Text className="text-xs text-gray-400 uppercase tracking-wider mt-2 mb-1">
                  {cat}
                </Text>
                <View className="flex-row flex-wrap">
                  {labelsByCategory[cat].map((label) => {
                    const selected = selectedLabelIds.has(label.id);
                    return (
                      <TouchableOpacity
                        key={label.id}
                        onPress={() => toggleLabel(label.id)}
                        style={{
                          backgroundColor: selected ? (LABEL_BG[cat] ?? '#f3f4f6') : '#f3f4f6',
                        }}
                        className="rounded-full px-3 py-1 mr-2 mb-2"
                      >
                        <Text
                          className="text-xs"
                          style={{ color: selected ? (LABEL_TEXT[cat] ?? '#4b5563') : '#6b7280' }}
                        >
                          {label.value}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ))}
          {hasActiveFilters && (
            <TouchableOpacity onPress={clearFilters} className="mt-2 self-start">
              <Text className="text-xs text-indigo-600 font-medium">Clear filters</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      <Modal
        visible={formVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={handleFormCancel}
      >
        <TaskFormScreen
          taskId={editingTaskId}
          onSave={handleFormSave}
          onCancel={handleFormCancel}
          initialLabelIds={editingTaskId ? undefined : [...selectedLabelIds]}
          defaultBoardId={createBoardId}
        />
      </Modal>

      {/* Overdue */}
      {viewMode === 'overdue' && (
        <DayView
          key={focusedViewKey}
          referenceDate={todayStr}
          overdue
          onLoaded={setHasOverdueTasks}
          onEditPress={handleEditPress}
          collapsedBoardIds={collapsedBoards.overdue}
          onToggleBoard={(id) => toggleBoardCollapse('overdue', id)}
          onSetAllCollapsed={(ids, collapsed) => setAllBoardsCollapsed('overdue', ids, collapsed)}
        />
      )}

      {/* Focused view */}
      {viewMode === 'focused' && (
        <FocusedView
          key={focusedViewKey}
          onEditPress={handleEditPress}
          collapsedBoardIds={collapsedBoards.focused}
          onToggleBoard={(id) => toggleBoardCollapse('focused', id)}
          onSetAllCollapsed={(ids, collapsed) => setAllBoardsCollapsed('focused', ids, collapsed)}
        />
      )}

      {/* Today / Tomorrow */}
      {viewMode === 'today' && (
        <DayView
          key={focusedViewKey}
          referenceDate={todayStr}
          onEditPress={handleEditPress}
          collapsedBoardIds={collapsedBoards.today}
          onToggleBoard={(id) => toggleBoardCollapse('today', id)}
          onSetAllCollapsed={(ids, collapsed) => setAllBoardsCollapsed('today', ids, collapsed)}
        />
      )}
      {viewMode === 'tomorrow' && (
        <DayView
          key={focusedViewKey}
          referenceDate={tomorrowStr}
          onEditPress={handleEditPress}
          collapsedBoardIds={collapsedBoards.tomorrow}
          onToggleBoard={(id) => toggleBoardCollapse('tomorrow', id)}
          onSetAllCollapsed={(ids, collapsed) => setAllBoardsCollapsed('tomorrow', ids, collapsed)}
        />
      )}

      {/* List + ghost container */}
      <View ref={listContainerRef} style={{ flex: 1, display: viewMode === 'all' ? 'flex' : 'none' }}>
        <SectionList<Task, DisplaySection>
          ref={listRef}
          sections={displaySections}
          keyExtractor={(item) => item.id}
          scrollEnabled={draggingTaskId === null}
          onScroll={(e) => {
            scrollOffsetRef.current = e.nativeEvent.contentOffset.y;
          }}
          scrollEventThrottle={16}
          renderItem={({ item, section }) => (
            <DraggableTaskRow
              task={item}
              isBeingDragged={item.id === draggingTaskId}
              ghostY={ghostY}
              ghostVisible={ghostVisible}
              onDragActivate={onDragActivate}
              onDragMove={onDragMove}
              onDragEnd={handleDragEnd}
              onComplete={handleComplete}
              onDeletePress={handleDeletePress}
              onEditPress={handleEditPress}
              onTogglePriority={
                isPriorityEligible(section.key) ? () => handleTogglePriority(item, section.key) : undefined
              }
            />
          )}
          renderSectionHeader={({ section }) => {
            const isExpanded = expandedSections.has(section.key);
            const isDragTarget = dragTargetSection === section.key;
            const sectionColor =
              section.key === 'overdue'
                ? '#ef4444'
                : isDragTarget
                  ? '#4f46e5'
                  : '#9ca3af';
            return (
              <View
                ref={(ref) => {
                  sectionHeaderRefs.current[section.key] = ref;
                }}
              >
                <TouchableOpacity
                  onPress={() => toggleSection(section.key)}
                  className="flex-row items-center px-4 py-2"
                  activeOpacity={0.7}
                  style={
                    isDragTarget
                      ? { backgroundColor: '#e0e7ff', borderLeftWidth: 3, borderLeftColor: '#4f46e5' }
                      : undefined
                  }
                >
                  <Text
                    className="text-xs font-semibold uppercase tracking-wider flex-1"
                    style={{ color: sectionColor }}
                  >
                    {section.title}
                    {!isExpanded && section.totalCount > 0 ? ` (${section.totalCount})` : ''}
                  </Text>
                  <Text className="text-xs ml-2" style={{ color: sectionColor }}>
                    {isExpanded ? '▾' : '▸'}
                  </Text>
                </TouchableOpacity>
              </View>
            );
          }}
          // SectionList's built-in empty check sees collapsed sections as non-empty
          // (data: [] but sections array is non-empty), so we guard manually.
          ListEmptyComponent={
            allFilteredSections.length === 0 ? (
              <View className="items-center justify-center pt-24">
                <Text className="text-4xl mb-3">✓</Text>
                <Text className="text-gray-400 text-base">
                  {hasActiveFilters ? 'No tasks match your filters' : 'No pending tasks'}
                </Text>
              </View>
            ) : null
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load(true, activeBoard?.id);
              }}
              tintColor="#4f46e5"
            />
          }
          contentContainerStyle={{ paddingBottom: 24 }}
          stickySectionHeadersEnabled={false}
        />

        {/* Floating ghost — follows finger during drag */}
        <Animated.View style={ghostAnimatedStyle} pointerEvents="none">
          {draggingTaskRef.current && <TaskGhost task={draggingTaskRef.current} />}
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}
