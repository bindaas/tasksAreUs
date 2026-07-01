import { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { getFocusedViewTasks, type FocusedBoard } from '../api/focusedView';
import { dateOnly } from '../utils/taskDateUtils';
import { FocusedTaskCard } from './FocusedTaskCard';

const PALETTE = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6'];

function boardColor(board: FocusedBoard, index: number): string {
  return board.board_color ?? PALETTE[index % PALETTE.length];
}

export function FocusedView({ onEditPress }: { onEditPress: (id: string) => void }) {
  const [boards, setBoards] = useState<FocusedBoard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const result = await getFocusedViewTasks(dateOnly(new Date()));
      setBoards(result.boards);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load focused view');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center py-16">
        <ActivityIndicator color="#6366f1" />
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1">
        <View className="mx-4 mt-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex-row items-center justify-between">
          <Text className="text-red-700 text-sm flex-1 mr-3">{error}</Text>
          <TouchableOpacity onPress={load}>
            <Text className="text-red-700 text-sm font-semibold">Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (boards.length === 0) {
    return (
      <View className="flex-1 items-center justify-center py-16 px-8">
        <Text className="text-4xl mb-3">🎯</Text>
        <Text className="text-gray-500 text-base text-center mb-1">
          No focused tasks for this period
        </Text>
        <Text className="text-gray-400 text-xs text-center mb-4">
          High-priority tasks with dates in your configured range will appear here
        </Text>
        <TouchableOpacity onPress={load}>
          <Text className="text-indigo-500 text-sm">Refresh</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1"
      contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24 }}
    >
      {boards.map((board, idx) => {
        const color = boardColor(board, idx);
        return (
          <View key={board.board_id} className="mb-5">
            <View className="flex-row items-center mb-2" style={{ gap: 8 }}>
              <View className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
              <Text className="text-sm font-semibold text-gray-700 flex-1">{board.board_name}</Text>
              <View className="bg-gray-100 rounded-full px-2 py-0.5">
                <Text className="text-xs text-gray-500 font-medium">{board.tasks.length}</Text>
              </View>
            </View>
            {board.tasks.map((task) => (
              <FocusedTaskCard key={task.id} task={task} boardColor={color} onPress={onEditPress} />
            ))}
          </View>
        );
      })}
    </ScrollView>
  );
}
