import { useState, useCallback, useMemo, useRef } from 'react';
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
  Switch,
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
import { getSettings } from '../api/settings';
import { groupTasksForList, type TaskSection } from '../utils/taskGrouping';
import { filterTasks } from '../utils/taskFilters';
import {
  formatDate,
  getEffectiveDate,
  getDropDate,
  getColumn,
  dateOnly,
  type ColumnKey,
} from '../utils/taskDateUtils';
import { TaskFormScreen } from './TaskFormScreen';
import type { Task, Label, LabelCategory, UpdateTaskBody } from '../types';

const LABEL_BG: Record<string, string> = {
  frequency: '#dbeafe',
  mode: '#dcfce7',
  type: '#f3e8ff',
};
const LABEL_TEXT: Record<string, string> = {
  frequency: '#1d4ed8',
  mode: '#15803d',
  type: '#7e22ce',
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
}: {
  task: Task;
  onComplete: (id: string) => void;
  onDeletePress: (id: string, title: string) => void;
  onEditPress: (id: string) => void;
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
      {task.is_high_priority && !isDone && <View className="h-1 bg-amber-400" />}
      <View className="flex-row items-start p-4">
        <View className="flex-1 mr-3">
          <View className="flex-row items-start mb-1">
            {task.is_high_priority && !isDone && (
              <Text className="text-amber-500 text-sm mr-1 mt-0.5">★</Text>
            )}
            <Text
              className="text-gray-900 text-base font-medium flex-1"
              numberOfLines={2}
              style={isDone ? { textDecorationLine: 'line-through', color: '#9ca3af' } : undefined}
            >
              {task.title}
            </Text>
          </View>
          {effectiveDate && (
            <Text className="text-gray-400 text-xs mb-2">{formatDate(effectiveDate)}</Text>
          )}
          {task.labels.length > 0 && (
            <View className="flex-row flex-wrap">
              {task.labels.map((label) => (
                <LabelBadge key={label.id} label={label} />
              ))}
            </View>
          )}
        </View>
        <View className="flex-row items-center">
          {!isDone && (
            <TouchableOpacity
              onPress={() => onComplete(task.id)}
              className="w-9 h-9 rounded-full bg-green-50 items-center justify-center"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text className="text-green-600 text-base font-semibold">✓</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={() => onDeletePress(task.id, task.title)}
            className="w-9 h-9 rounded-full bg-red-50 items-center justify-center ml-2"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text className="text-red-400 text-sm">🗑</Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function TaskGhost({ task }: { task: Task }) {
  const effectiveDate = getEffectiveDate(task);
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
      {task.is_high_priority && <View className="h-1 bg-amber-400" />}
      <View className="p-4">
        {task.is_high_priority && (
          <Text className="text-amber-500 text-sm mb-0.5">★</Text>
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
        />
      </Animated.View>
    </GestureDetector>
  );
}

type DisplaySection = TaskSection & { totalCount: number };

export function TasksScreen() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formVisible, setFormVisible] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | undefined>(undefined);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['today', 'overdue']),
  );
  const [filterOpen, setFilterOpen] = useState(false);
  const [allLabels, setAllLabels] = useState<Label[]>([]);
  const [selectedLabelIds, setSelectedLabelIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [showDone, setShowDone] = useState(false);
  const showDoneRef = useRef(false);

  const [highPriorityLimit, setHighPriorityLimit] = useState(3);
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const [dragTargetSection, setDragTargetSection] = useState<ColumnKey | null>(null);

  const draggingTaskRef = useRef<Task | null>(null);
  const currentDragTargetRef = useRef<ColumnKey | null>(null);
  const sectionContentYRef = useRef<Record<string, number>>({});
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

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const { tasks: fetched } = await listTasks(showDoneRef.current ? undefined : 'pending');
      setTasks(fetched);
    } catch {
      if (!silent) setError('Failed to load tasks.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
      listLabels()
        .then(({ labels }) => setAllLabels(labels))
        .catch(() => {});
      getSettings()
        .then((s) => setHighPriorityLimit(s.high_priority_daily_limit))
        .catch(() => {});
    }, [load]),
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
    const groups: Record<LabelCategory, Label[]> = { frequency: [], mode: [], type: [] };
    for (const label of allLabels) {
      groups[label.category].push(label);
    }
    return groups;
  }, [allLabels]);

  const hasActiveFilters =
    selectedLabelIds.size > 0 || searchQuery.trim().length > 0 || showDone;

  const allSectionsExpanded =
    allFilteredSections.length > 0 &&
    allFilteredSections.every((s) => expandedSections.has(s.key));

  async function handleComplete(id: string) {
    try {
      await apiCompleteTask(id);
      setTasks((prev) => prev.filter((t) => t.id !== id));
      load(true);
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
    setFormVisible(true);
  }

  function handleFormSave() {
    setFormVisible(false);
    load(true);
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
          } catch {
            Alert.alert('Error', 'Could not delete task. Please try again.');
          }
        },
      },
    ]);
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

  function toggleLabel(id: string) {
    setSelectedLabelIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleShowDone() {
    const next = !showDone;
    showDoneRef.current = next;
    setShowDone(next);
    load(true);
  }

  function clearFilters() {
    setSelectedLabelIds(new Set());
    setSearchQuery('');
    if (showDone) {
      showDoneRef.current = false;
      setShowDone(false);
      load(true);
    }
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
        newTarget = key === 'overdue' ? null : key;
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
      (listRef.current as any)?.getScrollResponder()?.scrollTo({ y: newOffset, animated: false });
      updateDragTarget(lastFingerYRef.current);
    }, 16);
  }

  function onDragActivate(task: Task, _absX: number, absY: number) {
    draggingTaskRef.current = task;
    setDraggingTaskId(task.id);
    lastFingerYRef.current = absY;
    listContainerRef.current?.measure((_x, _y, _w, height, _px, pageY) => {
      listAbsoluteTopRef.current = pageY;
      listHeightRef.current = height;
    });
    updateDragTarget(absY);
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
    if (targetSection === 'overdue') return;

    if (task.is_high_priority && (targetSection === 'today' || targetSection === 'tomorrow')) {
      const todayStr = dateOnly(new Date());
      const tomDate = new Date();
      tomDate.setDate(tomDate.getDate() + 1);
      const tomStr = dateOnly(tomDate);
      const hpCount = tasks.filter(
        (t) =>
          t.id !== task.id &&
          t.is_high_priority &&
          t.state === 'pending' &&
          getColumn(t, todayStr, tomStr) === targetSection,
      ).length;
      if (hpCount >= highPriorityLimit) {
        Alert.alert(
          'High Priority Limit',
          `You already have ${highPriorityLimit} high-priority tasks for ${
            targetSection === 'today' ? 'Today' : 'Tomorrow'
          }.`,
        );
        return;
      }
    }

    const isNoDate = targetSection === 'nodate';
    const newDate = getDropDate(targetSection);
    const body: UpdateTaskBody = isNoDate
      ? { target_date: null, must_do_by: null, is_high_priority: false }
      : { target_date: newDate };

    const original = task;
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== task.id) return t;
        if (isNoDate) return { ...t, target_date: null, must_do_by: null, is_high_priority: false };
        return { ...t, target_date: newDate };
      }),
    );

    try {
      await updateTask(task.id, body);
    } catch {
      setTasks((prev) => prev.map((t) => (t.id === task.id ? original : t)));
      Alert.alert('Error', 'Could not move task. Please try again.');
    }
  }

  // ── render ─────────────────────────────────────────────────────────────────

  if (loading) {
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
        <TouchableOpacity onPress={() => load()} className="bg-indigo-600 rounded-xl px-6 py-3">
          <Text className="text-white font-semibold">Retry</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 pt-2 pb-2">
        <Text className="text-2xl font-bold text-gray-900">Tasks</Text>
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
          <TouchableOpacity
            onPress={handleCreatePress}
            className="w-9 h-9 rounded-full bg-indigo-600 items-center justify-center"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text className="text-white text-xl font-light leading-none">+</Text>
          </TouchableOpacity>
        </View>
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
          {(['mode', 'type', 'frequency'] as LabelCategory[])
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
          <View className="flex-row items-center justify-between mt-2">
            <Text className="text-sm text-gray-700">Show completed</Text>
            <Switch
              value={showDone}
              onValueChange={toggleShowDone}
              trackColor={{ false: '#e5e7eb', true: '#6366f1' }}
              thumbColor="#ffffff"
            />
          </View>
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
        />
      </Modal>

      {/* List + ghost container */}
      <View ref={listContainerRef} style={{ flex: 1 }}>
        <SectionList<Task, DisplaySection>
          ref={listRef}
          sections={displaySections}
          keyExtractor={(item) => item.id}
          scrollEnabled={draggingTaskId === null}
          onScroll={(e) => {
            scrollOffsetRef.current = e.nativeEvent.contentOffset.y;
          }}
          scrollEventThrottle={16}
          renderItem={({ item }) => (
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
              <TouchableOpacity
                onPress={() => toggleSection(section.key)}
                className="flex-row items-center px-4 py-2"
                activeOpacity={0.7}
                onLayout={(e) => {
                  sectionContentYRef.current[section.key] = e.nativeEvent.layout.y;
                }}
                style={isDragTarget ? { backgroundColor: '#eef2ff' } : undefined}
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
                load(true);
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
