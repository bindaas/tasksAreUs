import { useState } from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import type { Task } from '../types';
import { completeTask, deleteTask } from '../api/tasks';
import { getEffectiveDate } from '../utils/taskDateUtils';
import { TaskQuickEdit } from './TaskQuickEdit';
import { TaskCardBody } from './TaskCardBody';

const LABEL_BG: Record<string, string> = {
  mode: '#dcfce7',
  type: '#f3e8ff',
};
const LABEL_TEXT: Record<string, string> = {
  mode: '#15803d',
  type: '#7e22ce',
};

export function FocusedTaskCard({
  task,
  boardColor,
  onPress,
  onRefresh,
}: {
  task: Task;
  boardColor: string;
  onPress: (id: string) => void;
  onRefresh: () => void;
}) {
  const effectiveDate = getEffectiveDate(task);
  const [isEditing, setIsEditing] = useState(false);

  async function handleComplete() {
    try {
      await completeTask(task.id);
      onRefresh();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to complete task');
    }
  }

  function handleDelete() {
    Alert.alert('Delete task?', `"${task.title}" will be removed from your task list.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteTask(task.id);
            onRefresh();
          } catch (err) {
            Alert.alert('Error', err instanceof Error ? err.message : 'Failed to delete task');
          }
        },
      },
    ]);
  }

  return (
    <TouchableOpacity
      onPress={() => {
        if (!isEditing) onPress(task.id);
      }}
      activeOpacity={0.7}
      className="bg-white rounded-xl mb-2 overflow-hidden"
      style={{
        borderColor: '#e5e7eb',
        borderWidth: 1,
        borderLeftColor: boardColor,
        borderLeftWidth: 4,
      }}
    >
      <View className="p-3">
        {isEditing ? (
          <TaskQuickEdit
            task={task}
            onSaved={() => {
              onRefresh();
              setIsEditing(false);
            }}
            onCancel={() => setIsEditing(false)}
          />
        ) : (
          <TaskCardBody
            task={task}
            layout="stacked"
            dateDisplay={{ mode: 'effective', effectiveDate }}
            priorityBadge="static"
            renderLabels={(labels) =>
              labels.length > 0 ? (
                <View className="flex-row flex-wrap" style={{ gap: 4 }}>
                  {labels.map((label) => (
                    <View
                      key={label.id}
                      className="rounded-full px-2 py-0.5"
                      style={{ backgroundColor: LABEL_BG[label.category] ?? '#f3f4f6' }}
                    >
                      <Text
                        className="text-xs font-medium"
                        style={{ color: LABEL_TEXT[label.category] ?? '#4b5563' }}
                      >
                        {label.value}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null
            }
            onEdit={() => setIsEditing(true)}
            onComplete={handleComplete}
            onDelete={handleDelete}
          />
        )}
      </View>
    </TouchableOpacity>
  );
}
