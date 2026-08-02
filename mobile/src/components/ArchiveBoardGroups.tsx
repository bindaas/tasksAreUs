import { View, Text, TouchableOpacity } from 'react-native';
import type { BoardCompletions, CompletionRecord } from '../types';

const PALETTE = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6'];

function boardColor(board: BoardCompletions, index: number): string {
  return board.board_color ?? PALETTE[index % PALETTE.length];
}

function formatCompletedAt(iso: string): string {
  const d = new Date(iso);
  return (
    d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) +
    ' · ' +
    d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  );
}

const LABEL_CATEGORY_ORDER: Record<string, number> = { type: 0 };

function CompletionCard({ record, color }: { record: CompletionRecord; color: string }) {
  const sorted = [...record.labels].sort(
    (a, b) => (LABEL_CATEGORY_ORDER[a.category] ?? 9) - (LABEL_CATEGORY_ORDER[b.category] ?? 9)
  );
  return (
    <View
      className="bg-white border border-gray-200 rounded-xl px-4 py-3 mb-2 shadow-sm"
      style={{ borderLeftWidth: 4, borderLeftColor: color }}
    >
      <Text className="text-sm font-medium text-gray-900 mb-1" numberOfLines={2}>
        {record.title}
      </Text>
      <Text className="text-xs text-gray-400 mb-2">{formatCompletedAt(record.completed_at)}</Text>
      {sorted.length > 0 && (
        <View className="flex-row flex-wrap" style={{ gap: 4 }}>
          {sorted.map((l) => (
            <View key={l.id} className="bg-gray-100 rounded-full px-2 py-0.5">
              <Text className="text-xs text-gray-600">{l.value}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

export function ArchiveBoardGroups({
  boards,
  collapsedBoardIds,
  onToggleBoard,
  onSetAllCollapsed,
}: {
  boards: BoardCompletions[];
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
          accessibilityRole="button"
          accessibilityState={{ expanded: !allCollapsed }}
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
              accessibilityRole="button"
              accessibilityState={{ expanded: !collapsed }}
            >
              <Text className="text-gray-400 text-xs w-3 text-center">{collapsed ? '▸' : '▾'}</Text>
              <View className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
              <Text className="text-sm font-semibold text-gray-700 flex-1">{board.board_name}</Text>
              <View className="bg-gray-100 rounded-full px-2 py-0.5">
                <Text className="text-xs text-gray-500 font-medium">{board.completions.length}</Text>
              </View>
            </TouchableOpacity>
            {!collapsed &&
              board.completions.map((record) => (
                <CompletionCard key={record.task_id} record={record} color={color} />
              ))}
          </View>
        );
      })}
    </>
  );
}
