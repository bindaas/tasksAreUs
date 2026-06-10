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
import type { CompletionRecord } from '../types';

function toLocalISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function todayISO(): string {
  return toLocalISO(new Date());
}

function sevenDaysAgoISO(): string {
  const d = new Date();
  d.setDate(d.getDate() - 6);
  return toLocalISO(d);
}

function formatCompletedAt(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) +
    ' · ' +
    d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

const LABEL_CATEGORY_ORDER = { mode: 0, type: 1, frequency: 2 };

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

export function ReportsScreen() {
  const [from, setFrom] = useState(sevenDaysAgoISO);
  const [to, setTo] = useState(todayISO);
  const [records, setRecords] = useState<CompletionRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetched, setFetched] = useState(false);

  const runReport = useCallback(async () => {
    if (!from || !to) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getCompletions(from, to);
      setRecords(data.completions);
      setTotal(data.total);
      setFetched(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load report');
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  const dateInputClass =
    'flex-1 border border-gray-300 rounded-xl px-3 py-2 text-sm text-gray-900 bg-white';

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={['top']}>
      <View className="px-4 pt-2 pb-4 bg-gray-50">
        <Text className="text-2xl font-bold text-gray-900">Reports</Text>
      </View>

      <View className="px-4 pb-3">
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

          {records.length === 0 ? (
            <View className="flex-1 items-center justify-center px-8">
              <Text className="text-4xl mb-3">📋</Text>
              <Text className="text-gray-400 text-base text-center">
                No completions in this range
              </Text>
            </View>
          ) : (
            <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingBottom: 24 }}>
              {records.map((r) => (
                <CompletionRow key={r.task_id} record={r} />
              ))}
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
