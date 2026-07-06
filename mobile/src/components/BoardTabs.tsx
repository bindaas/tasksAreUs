import { ScrollView, TouchableOpacity, Text } from 'react-native';
import { useBoard } from '../context/BoardContext';

export function BoardTabs() {
  const { boards, activeBoard, setActiveBoard } = useBoard();

  if (boards.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 6, paddingVertical: 2 }}
    >
      {boards.map((board) => {
        const active = board.id === activeBoard?.id;
        return (
          <TouchableOpacity
            key={board.id}
            onPress={() => setActiveBoard(board)}
            className="flex-row items-center rounded-full px-3 py-1.5"
            style={{
              backgroundColor: active ? '#4f46e5' : '#ffffff',
              borderWidth: 1,
              borderColor: active ? '#4f46e5' : '#d1d5db',
            }}
          >
            {board.is_default && (
              <Text style={{ color: active ? '#fcd34d' : '#f59e0b', marginRight: 4, fontSize: 11 }}>★</Text>
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
