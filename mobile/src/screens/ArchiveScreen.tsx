import { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getCompletions } from '../api/reports';
import { ArchiveBoardTabs } from '../components/ArchiveBoardTabs';
import { ArchiveBoardGroups } from '../components/ArchiveBoardGroups';
import { dateOnly } from '../utils/taskDateUtils';
import { getPresetRange, PRESET_LABELS, type PresetKey } from '../utils/dateRangePresets';
import type { CompletionRecord, BoardCompletions } from '../types';

function todayISO(): string {
  return dateOnly(new Date());
}

function thirtyDaysAgoISO(): string {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return dateOnly(d);
}

function formatCompletedAt(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) +
    ' · ' +
    d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

const LABEL_CATEGORY_ORDER: Record<string, number> = { type: 0 };

function CompletionRow({ record }: { record: CompletionRecord }) {
  const sorted = [...record.labels].sort(
    (a, b) => (LABEL_CATEGORY_ORDER[a.category] ?? 9) - (LABEL_CATEGORY_ORDER[b.category] ?? 9)
  );
  return (
    <View className="bg-white border border-gray-200 rounded-xl px-4 py-3 mb-2 shadow-sm">
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

const PRESETS: PresetKey[] = ['this_month', 'last_month', 'last_three_months'];

export function ArchiveScreen() {
  const [from, setFrom] = useState(thirtyDaysAgoISO());
  const [to, setTo] = useState(todayISO());
  const [selectedBoardId, setSelectedBoardId] = useState<string | 'all'>('all');
  const [records, setRecords] = useState<CompletionRecord[]>([]);
  const [boards, setBoards] = useState<BoardCompletions[] | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetched, setFetched] = useState(false);
  const [collapsedBoardIds, setCollapsedBoardIds] = useState<Set<string>>(new Set());

  const runReport = useCallback(async () => {
    if (!from || !to) return;
    setLoading(true);
    setError(null);
    try {
      const options = selectedBoardId === 'all' ? { allBoards: true } : { boardId: selectedBoardId };
      const data = await getCompletions(from, to, options);
      setRecords(data.completions);
      setBoards(data.boards ?? null);
      setTotal(data.total);
      setFetched(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load report');
    } finally {
      setLoading(false);
    }
  }, [from, to, selectedBoardId]);

  function applyPreset(preset: PresetKey) {
    const range = getPresetRange(preset);
    setFrom(range.from);
    setTo(range.to);
  }

  function toggleBoard(id: string) {
    setCollapsedBoardIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function setAllCollapsed(ids: string[], collapse: boolean) {
    setCollapsedBoardIds(collapse ? new Set(ids) : new Set());
  }

  const dateInputClass =
    'flex-1 border border-gray-300 rounded-xl px-3 py-2 text-sm text-gray-900 bg-white';

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={['top']}>
      <View className="px-4 pt-2 pb-4 bg-gray-50">
        <Text className="text-2xl font-bold text-gray-900">Archive</Text>
      </View>

      <View className="px-4 pb-3">
        <ArchiveBoardTabs selectedBoardId={selectedBoardId} onSelect={setSelectedBoardId} />
      </View>

      <View className="px-4 pb-3">
        <View className="flex-row flex-wrap mb-3" style={{ gap: 6 }}>
          {PRESETS.map((preset) => (
            <TouchableOpacity
              key={preset}
              onPress={() => applyPreset(preset)}
              className="border border-gray-300 rounded-full px-3 py-1 bg-white"
            >
              <Text className="text-xs font-medium text-gray-600">{PRESET_LABELS[preset]}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View className="flex-row items-center" style={{ gap: 8 }}>
          <View className="flex-1">
            <Text className="text-xs text-gray-500 mb-1">From</Text>
            <TextInput
              value={from}
              onChangeText={setFrom}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#9ca3af"
              className={dateInputClass}
              autoCapitalize="none"
              keyboardType="numeric"
            />
          </View>
          <View className="flex-1">
            <Text className="text-xs text-gray-500 mb-1">To</Text>
            <TextInput
              value={to}
              onChangeText={setTo}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#9ca3af"
              className={dateInputClass}
              autoCapitalize="none"
              keyboardType="numeric"
            />
          </View>
          <View style={{ paddingTop: 16 }}>
            <TouchableOpacity
              onPress={runReport}
              disabled={loading || !from || !to}
              className="bg-indigo-600 rounded-xl px-4 py-2"
              style={{ opacity: loading || !from || !to ? 0.5 : 1 }}
            >
              <Text className="text-white text-sm font-medium">Go</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {error && (
        <View className="mx-4 mb-3 px-4 py-2 bg-red-50 border border-red-200 rounded-xl">
          <View className="flex-row items-center justify-between">
            <Text className="text-red-700 text-sm flex-1 mr-2">{error}</Text>
            <TouchableOpacity onPress={() => setError(null)}>
              <Text className="text-red-500 text-xs underline">Dismiss</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {loading && (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#6366f1" />
        </View>
      )}

      {!loading && fetched && (
        <>
          <View className="px-4 pb-3">
            <Text className="text-sm font-semibold text-indigo-700">
              {total === 1 ? '1 completion' : `${total} completions`}
            </Text>
          </View>

          {(boards ? boards.length === 0 : records.length === 0) ? (
            <View className="flex-1 items-center justify-center px-8">
              <Text className="text-4xl mb-3">📋</Text>
              <Text className="text-gray-400 text-base text-center">
                No completions in this range
              </Text>
            </View>
          ) : (
            <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingBottom: 24 }}>
              {boards ? (
                <ArchiveBoardGroups
                  boards={boards}
                  collapsedBoardIds={collapsedBoardIds}
                  onToggleBoard={toggleBoard}
                  onSetAllCollapsed={setAllCollapsed}
                />
              ) : (
                records.map((r) => <CompletionRow key={r.task_id} record={r} />)
              )}
            </ScrollView>
          )}
        </>
      )}

      {!loading && !fetched && !error && (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-4xl mb-3">📊</Text>
          <Text className="text-gray-400 text-base text-center">
            Set a date range and tap Go
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
}
