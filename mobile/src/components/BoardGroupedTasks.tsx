import { View, Text, TouchableOpacity } from 'react-native';
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
  collapsedBoardIds,
  onToggleBoard,
  onSetAllCollapsed,
}: {
  boards: FocusedBoard[];
  onEditPress: (id: string) => void;
  onRefresh: () => void;
  collapsedBoardIds: Set<string>;
  onToggleBoard: (id: string) => void;
  onSetAllCollapsed: (ids: string[], collapsed: boolean) => void;
}) {
  const allCollapsed = boards.length > 0 && boards.every((b) => collapsedBoardIds.has(b.board_id));

  return (
    <>
      <View className="flex-row justify-end mb-2">
        <TouchableOpacity
          onPress={() => onSetAllCollapsed(boards.map((b) => b.board_id), !allCollapsed)}
        >
          <Text className="text-indigo-500 text-xs">{allCollapsed ? 'Expand all' : 'Collapse all'}</Text>
        </TouchableOpacity>
      </View>
      {boards.map((board, idx) => {
        const color = boardColor(board, idx);
        const collapsed = collapsedBoardIds.has(board.board_id);
        return (
          <View key={board.board_id} className="mb-5">
            <TouchableOpacity
              onPress={() => onToggleBoard(board.board_id)}
              className="flex-row items-center mb-2"
              style={{ gap: 8 }}
            >
              <Text className="text-gray-400 text-xs w-3 text-center">{collapsed ? '▸' : '▾'}</Text>
              <View className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
              <Text className="text-sm font-semibold text-gray-700 flex-1">{board.board_name}</Text>
              <View className="bg-gray-100 rounded-full px-2 py-0.5">
                <Text className="text-xs text-gray-500 font-medium">{board.tasks.length}</Text>
              </View>
            </TouchableOpacity>
            {!collapsed &&
              board.tasks.map((task) => (
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
