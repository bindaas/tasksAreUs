import { View, Text } from 'react-native';
import type { FocusedBoard } from '../api/focusedView';
import { FocusedTaskCard } from './FocusedTaskCard';

const PALETTE = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6'];

function boardColor(board: FocusedBoard, index: number): string {
  return board.board_color ?? PALETTE[index % PALETTE.length];
}

export function BoardGroupedTasks({
  boards,
  onEditPress,
  onRefresh,
}: {
  boards: FocusedBoard[];
  onEditPress: (id: string) => void;
  onRefresh: () => void;
}) {
  return (
    <>
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
              <FocusedTaskCard
                key={task.id}
                task={task}
                boardColor={color}
                onPress={onEditPress}
                onRefresh={onRefresh}
              />
            ))}
          </View>
        );
      })}
    </>
  );
}
