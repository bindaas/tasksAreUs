import { View, Text, TouchableOpacity } from 'react-native';
import type { Task } from '../types';
import { getEffectiveDate, formatDate, isOverdue } from '../utils/taskDateUtils';

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
}: {
  task: Task;
  boardColor: string;
  onPress: (id: string) => void;
}) {
  const effectiveDate = getEffectiveDate(task);

  return (
    <TouchableOpacity
      onPress={() => onPress(task.id)}
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
        {task.is_high_priority && (
          <View className="bg-amber-50 rounded px-1.5 py-0.5 mb-1.5 self-start">
            <Text className="text-xs font-semibold text-amber-600">★ High</Text>
          </View>
        )}
        <Text className="text-sm font-medium text-gray-800 leading-snug mb-2" numberOfLines={2}>
          {task.title}
        </Text>
        {effectiveDate && (
          <View
            className="rounded px-1.5 py-0.5 mb-1.5 self-start"
            style={{ backgroundColor: isOverdue(effectiveDate) ? '#fef2f2' : '#f3f4f6' }}
          >
            <Text
              className="text-xs"
              style={{ color: isOverdue(effectiveDate) ? '#dc2626' : '#6b7280' }}
            >
              {formatDate(effectiveDate)}
            </Text>
          </View>
        )}
        {task.labels.length > 0 && (
          <View className="flex-row flex-wrap" style={{ gap: 4 }}>
            {task.labels.map((label) => (
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
        )}
      </View>
    </TouchableOpacity>
  );
}
