import { useState, useCallback } from 'react';
import {
  View,
  Text,
  SectionList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { listTasks, completeTask as apiCompleteTask, deleteTask as apiDeleteTask } from '../api/tasks';
import { groupTasksForList } from '../utils/taskGrouping';
import { formatDate, getEffectiveDate } from '../utils/taskDateUtils';
import { TaskFormScreen } from './TaskFormScreen';
import type { Task, Label } from '../types';

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
  return (
    <TouchableOpacity
      onPress={() => onEditPress(task.id)}
      activeOpacity={0.7}
      className="bg-white mx-4 mb-2 rounded-xl border border-gray-100 overflow-hidden"
    >
      {task.is_high_priority && <View className="h-1 bg-amber-400" />}
      <View className="flex-row items-start p-4">
        <View className="flex-1 mr-3">
          <View className="flex-row items-start mb-1">
            {task.is_high_priority && (
              <Text className="text-amber-500 text-sm mr-1 mt-0.5">★</Text>
            )}
            <Text className="text-gray-900 text-base font-medium flex-1" numberOfLines={2}>
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
          <TouchableOpacity
            onPress={() => onComplete(task.id)}
            className="w-9 h-9 rounded-full bg-green-50 items-center justify-center"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text className="text-green-600 text-base font-semibold">✓</Text>
          </TouchableOpacity>
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

export function TasksScreen() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formVisible, setFormVisible] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | undefined>(undefined);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const { tasks: fetched } = await listTasks('pending');
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

  async function handleComplete(id: string) {
    try {
      await apiCompleteTask(id);
      // Optimistic remove; re-fetch surfaces the next recurring occurrence (if any)
      setTasks((prev) => prev.filter((t) => t.id !== id));
      load();
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

  const sections = groupTasksForList(tasks);

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="flex-row items-center justify-between px-4 pt-2 pb-4">
        <Text className="text-2xl font-bold text-gray-900">Tasks</Text>
        <TouchableOpacity
          onPress={handleCreatePress}
          className="w-9 h-9 rounded-full bg-indigo-600 items-center justify-center"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text className="text-white text-xl font-light leading-none">+</Text>
        </TouchableOpacity>
      </View>

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

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TaskRow
            task={item}
            onComplete={handleComplete}
            onDeletePress={handleDeletePress}
            onEditPress={handleEditPress}
          />
        )}
        renderSectionHeader={({ section }) => (
          <Text
            className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider ${
              section.key === 'overdue' ? 'text-red-500' : 'text-gray-400'
            }`}
          >
            {section.title}
          </Text>
        )}
        ListEmptyComponent={
          <View className="items-center justify-center pt-24">
            <Text className="text-4xl mb-3">✓</Text>
            <Text className="text-gray-400 text-base">No pending tasks</Text>
          </View>
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
