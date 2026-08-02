import { ScrollView, TouchableOpacity, Text } from 'react-native';
import { useBoard } from '../context/BoardContext';

const PALETTE = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6'];
const ALL_BOARDS_COLOR = '#4f46e5';

function boardColor(color: string | null, index: number): string {
  return color ?? PALETTE[index % PALETTE.length];
}

export function ArchiveBoardTabs({
  selectedBoardId,
  onSelect,
}: {
  selectedBoardId: string | 'all';
  onSelect: (boardId: string | 'all') => void;
}) {
  const { boards } = useBoard();

  if (boards.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 6, paddingVertical: 2 }}
    >
      <TouchableOpacity
        onPress={() => onSelect('all')}
        className="flex-row items-center rounded-full px-3 py-1.5"
        style={{
          backgroundColor: selectedBoardId === 'all' ? ALL_BOARDS_COLOR : '#ffffff',
          borderWidth: 1,
          borderColor: selectedBoardId === 'all' ? ALL_BOARDS_COLOR : '#d1d5db',
        }}
      >
        <Text className="text-xs font-medium" style={{ color: selectedBoardId === 'all' ? '#ffffff' : '#4b5563' }}>
          All boards
        </Text>
      </TouchableOpacity>
      {boards.map((board, idx) => {
        const active = board.id === selectedBoardId;
        const color = boardColor(board.color, idx);
        return (
          <TouchableOpacity
            key={board.id}
            onPress={() => onSelect(board.id)}
            className="flex-row items-center rounded-full px-3 py-1.5"
            style={{
              backgroundColor: active ? color : '#ffffff',
              borderWidth: 1,
              borderColor: active ? color : '#d1d5db',
            }}
          >
            {!active && (
              <Text style={{ color, marginRight: 4, fontSize: 10 }}>●</Text>
            )}
            <Text className="text-xs font-medium" style={{ color: active ? '#ffffff' : '#4b5563' }}>
              {board.name}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}
