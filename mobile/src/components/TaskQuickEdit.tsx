import { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import type { Task, Label } from '../types';
import { updateTask } from '../api/tasks';
import { listLabels } from '../api/labels';

const EDIT_CATEGORY_ORDER = ['type'] as const;

const LABEL_BG: Record<string, string> = { type: '#f3e8ff' };
const LABEL_TEXT: Record<string, string> = { type: '#7e22ce' };

interface TaskQuickEditProps {
  task: Task;
  /** Already board-scoped labels, if the caller has them on hand. When omitted,
   * labels are fetched for task.board_id — needed by callers (Focused/Day views)
   * that group tasks across multiple boards and don't hold a single board-scoped
   * label list. */
  labels?: Label[];
  onSaved: () => void;
  onCancel: () => void;
}

export function TaskQuickEdit({ task, labels: labelsProp, onSaved, onCancel }: TaskQuickEditProps) {
  const [title, setTitle] = useState(task.title);
  const [labelIds, setLabelIds] = useState<Set<string>>(new Set(task.labels.map((l) => l.id)));
  const [fetchedLabels, setFetchedLabels] = useState<Label[]>([]);
  const [labelsLoading, setLabelsLoading] = useState(labelsProp === undefined);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (labelsProp !== undefined) return;
    let cancelled = false;
    setLabelsLoading(true);
    listLabels(undefined, task.board_id)
      .then((result) => {
        if (!cancelled) setFetchedLabels(result.labels);
      })
      .finally(() => {
        if (!cancelled) setLabelsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [labelsProp, task.board_id]);

  const labels = labelsProp ?? fetchedLabels;
  const labelsByCategory = labels.reduce<Record<string, Label[]>>((acc, label) => {
    if (!acc[label.category]) acc[label.category] = [];
    acc[label.category].push(label);
    return acc;
  }, {});

  function toggleLabel(id: string) {
    setLabelIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function save() {
    if (!title.trim()) return;
    setSaving(true);
    try {
      await updateTask(task.id, { title: title.trim(), label_ids: Array.from(labelIds) });
      onSaved();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to save');
      setSaving(false);
    }
  }

  return (
    <View>
      <TextInput
        autoFocus
        value={title}
        onChangeText={setTitle}
        returnKeyType="done"
        onSubmitEditing={save}
        className="border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm text-gray-900 mb-2"
      />
      <View className="mb-3" style={{ gap: 6 }}>
        {labelsLoading ? (
          <Text className="text-xs text-gray-400">Loading labels…</Text>
        ) : (
          EDIT_CATEGORY_ORDER.map((cat) => {
            const catLabels = labelsByCategory[cat] ?? [];
            if (!catLabels.length) return null;
            return (
              <View key={cat} className="flex-row flex-wrap" style={{ gap: 4 }}>
                {catLabels.map((label) => {
                  const selected = labelIds.has(label.id);
                  return (
                    <TouchableOpacity
                      key={label.id}
                      onPress={() => toggleLabel(label.id)}
                      className="rounded-full px-2.5 py-1"
                      style={{
                        backgroundColor: selected ? (LABEL_BG[cat] ?? '#e5e7eb') : '#fff',
                        borderWidth: selected ? 0 : 1,
                        borderColor: '#d1d5db',
                      }}
                    >
                      <Text
                        className="text-xs font-medium"
                        style={{ color: selected ? (LABEL_TEXT[cat] ?? '#374151') : '#6b7280' }}
                      >
                        {label.value}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            );
          })
        )}
      </View>
      <View className="flex-row" style={{ gap: 8 }}>
        <TouchableOpacity
          onPress={save}
          disabled={saving || !title.trim()}
          className="flex-1 bg-indigo-600 rounded-lg py-2 items-center"
          style={{ opacity: saving || !title.trim() ? 0.5 : 1 }}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text className="text-white text-xs font-semibold">Save</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onCancel}
          className="flex-1 bg-white border border-gray-300 rounded-lg py-2 items-center"
        >
          <Text className="text-xs font-medium text-gray-700">Cancel</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
