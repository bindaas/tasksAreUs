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
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { listTasks, completeTask as apiCompleteTask, deleteTask as apiDeleteTask } from '../api/tasks';
import { listLabels } from '../api/labels';
import { groupTasksForList, type TaskSection } from '../utils/taskGrouping';
import { filterTasks } from '../utils/taskFilter';
import { formatDate, getEffectiveDate } from '../utils/taskDateUtils';
import { TaskFormScreen } from './TaskFormScreen';
import type { Task, Label, LabelCategory } from '../types';

// Dynamic colors via inline style — safer than dynamic Tailwind class interpolation
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
      style={{ opacity: isDone ? 0.55 : 1 }}
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
  // Ref lets load() read the latest showDone without being in its dep array
  const showDoneRef = useRef(false);

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
    }, [load]),
  );

  useEffect(() => {
    listLabels()
      .then(({ labels }) => setAllLabels(labels))
      .catch(() => {});
  }, []);

  const allFilteredSections = useMemo(() => {
    const filtered = filterTasks(tasks, { selectedLabelIds, searchQuery });
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
      setExpandedSections(new Set(allFilteredSections.map((s) => s.key)));
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
        <TouchableOpacity
          onPress={() => load()}
          className="bg-indigo-600 rounded-xl px-6 py-3"
        >
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

      <SectionList<Task, DisplaySection>
        sections={displaySections}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TaskRow
            task={item}
            onComplete={handleComplete}
            onDeletePress={handleDeletePress}
            onEditPress={handleEditPress}
          />
        )}
        renderSectionHeader={({ section }) => {
          const isExpanded = expandedSections.has(section.key);
          const sectionColor = section.key === 'overdue' ? '#ef4444' : '#9ca3af';
          return (
            <TouchableOpacity
              onPress={() => toggleSection(section.key)}
              className="flex-row items-center px-4 py-2"
              activeOpacity={0.7}
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
    </SafeAreaView>
  );
}
