import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { getTask, createTask, updateTask } from '../api/tasks';
import { ApiError } from '../api/client';
import { listLabels } from '../api/labels';
import { dateOnly } from '../utils/taskDateUtils';
import { isFormHighPriorityEligible } from '../utils/taskPriority';
import type { Task, Label, CreateTaskBody, UpdateTaskBody } from '../types';

const LABEL_BG: Record<string, string> = {
  frequency: '#dbeafe',
  mode: '#dcfce7',
  type: '#f3e8ff',
};
const LABEL_TEXT: Record<string, string> = {
  frequency: '#1d4ed8',
  mode: '#15803d',
  type: '#7e22ce',
};

const CATEGORY_ORDER: Array<'mode' | 'type' | 'frequency'> = ['mode', 'type', 'frequency'];
const CATEGORY_LABELS: Record<string, string> = { mode: 'Mode', type: 'Type', frequency: 'Frequency' };

interface Props {
  taskId?: string;
  onSave: () => void;
  onCancel: () => void;
  initialLabelIds?: string[];
}

type DateField = 'mustDoBy' | 'targetDate' | null;

export function TaskFormScreen({ taskId, onSave, onCancel, initialLabelIds }: Props) {
  const isEditMode = !!taskId;

  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [mustDoBy, setMustDoBy] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [isHighPriority, setIsHighPriority] = useState(false);
  const [selectedLabelIds, setSelectedLabelIds] = useState<Set<string>>(
    () => (!isEditMode && initialLabelIds ? new Set(initialLabelIds) : new Set()),
  );
  const [allLabels, setAllLabels] = useState<Label[]>([]);

  const [activeDatePicker, setActiveDatePicker] = useState<DateField>(null);
  const [loadingInitial, setLoadingInitial] = useState(isEditMode);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const todayStr = dateOnly(new Date());
  const _tom = new Date();
  _tom.setDate(_tom.getDate() + 1);
  const tomorrowStr = dateOnly(_tom);
  const highPriorityEligible = isFormHighPriorityEligible(mustDoBy, targetDate, todayStr, tomorrowStr);

  const loadData = useCallback(async () => {
    try {
      const [labelsResult, task] = await Promise.all([
        listLabels(),
        isEditMode ? getTask(taskId) : Promise.resolve(null),
      ]);
      setAllLabels(labelsResult.labels);
      if (task) {
        setTitle(task.title);
        setNotes(task.notes ?? '');
        setMustDoBy(task.must_do_by ?? '');
        setTargetDate(task.target_date ?? '');
        setIsHighPriority(task.is_high_priority);
        setSelectedLabelIds(new Set(task.labels.map((l) => l.id)));
      }
    } catch {
      setError('Failed to load data.');
    } finally {
      setLoadingInitial(false);
    }
  }, [isEditMode, taskId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function toggleLabel(id: string) {
    setSelectedLabelIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleDateChange(_event: unknown, selected?: Date) {
    if (Platform.OS === 'android') setActiveDatePicker(null);
    if (!selected) return;
    const str = dateOnly(selected);
    if (activeDatePicker === 'mustDoBy') setMustDoBy(str);
    else if (activeDatePicker === 'targetDate') setTargetDate(str);
  }

  async function handleSave() {
    if (!title.trim()) {
      setError('Title is required.');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      if (isEditMode) {
        const body: UpdateTaskBody = {
          title: title.trim(),
          label_ids: Array.from(selectedLabelIds),
          is_high_priority: highPriorityEligible && isHighPriority,
          must_do_by: mustDoBy || null,
          target_date: targetDate || null,
        };
        if (notes.trim()) body.notes = notes.trim();
        await updateTask(taskId, body);
      } else {
        const body: CreateTaskBody = {
          title: title.trim(),
          label_ids: Array.from(selectedLabelIds),
          is_high_priority: highPriorityEligible && isHighPriority,
        };
        if (notes.trim()) body.notes = notes.trim();
        if (mustDoBy) body.must_do_by = mustDoBy;
        if (targetDate) body.target_date = targetDate;
        await createTask(body);
      }
      onSave();
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 422) {
        Alert.alert('High priority limit reached', 'You already have the maximum number of high-priority tasks for today. Uncheck high priority and try again.');
        setIsHighPriority(false);
      } else {
        setError('Could not save task. Please try again.');
      }
    } finally {
      setSaving(false);
    }
  }

  const datePickerValue = activeDatePicker === 'mustDoBy'
    ? (mustDoBy ? new Date(mustDoBy + 'T00:00:00') : new Date())
    : (targetDate ? new Date(targetDate + 'T00:00:00') : new Date());

  const labelsByCategory = allLabels.reduce<Record<string, Label[]>>(
    (acc, label) => {
      if (!acc[label.category]) acc[label.category] = [];
      acc[label.category].push(label);
      return acc;
    },
    {}
  );

  if (loadingInitial) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator size="large" color="#4f46e5" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top', 'bottom']}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-3 border-b border-gray-100">
        <TouchableOpacity onPress={onCancel} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text className="text-indigo-600 text-base">Cancel</Text>
        </TouchableOpacity>
        <Text className="text-base font-semibold text-gray-900">
          {isEditMode ? 'Edit Task' : 'New Task'}
        </Text>
        <TouchableOpacity
          onPress={handleSave}
          disabled={saving}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#4f46e5" />
          ) : (
            <Text className="text-indigo-600 text-base font-semibold">Save</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        className="flex-1 px-4"
        contentContainerStyle={{ paddingVertical: 20, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
      >
        {error && (
          <View className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4">
            <Text className="text-red-700 text-sm">{error}</Text>
          </View>
        )}

        {/* Title */}
        <View className="mb-5">
          <Text className="text-sm font-medium text-gray-700 mb-1">
            Title <Text className="text-red-500">*</Text>
          </Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="What needs to be done?"
            placeholderTextColor="#9ca3af"
            className="border border-gray-300 rounded-xl px-4 py-3 text-base text-gray-900"
            autoFocus={!isEditMode}
            returnKeyType="next"
          />
        </View>

        {/* Notes */}
        <View className="mb-5">
          <Text className="text-sm font-medium text-gray-700 mb-1">Notes</Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Any additional details..."
            placeholderTextColor="#9ca3af"
            multiline
            numberOfLines={3}
            className="border border-gray-300 rounded-xl px-4 py-3 text-base text-gray-900"
            style={{ minHeight: 80, textAlignVertical: 'top' }}
          />
        </View>

        {/* Dates */}
        <View className="flex-row gap-3 mb-5">
          <View className="flex-1">
            <Text className="text-sm font-medium text-gray-700 mb-1">Must do by</Text>
            <View className="flex-row items-center border border-gray-300 rounded-xl overflow-hidden">
              <TouchableOpacity
                className="flex-1 px-3 py-3"
                onPress={() => setActiveDatePicker('mustDoBy')}
              >
                <Text className={mustDoBy ? 'text-gray-900 text-sm' : 'text-gray-400 text-sm'}>
                  {mustDoBy || 'Pick date'}
                </Text>
              </TouchableOpacity>
              {mustDoBy !== '' && (
                <TouchableOpacity
                  onPress={() => setMustDoBy('')}
                  className="px-3 py-3"
                  hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                >
                  <Text className="text-gray-400 text-base">×</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          <View className="flex-1">
            <Text className="text-sm font-medium text-gray-700 mb-1">Target date</Text>
            <View className="flex-row items-center border border-gray-300 rounded-xl overflow-hidden">
              <TouchableOpacity
                className="flex-1 px-3 py-3"
                onPress={() => setActiveDatePicker('targetDate')}
              >
                <Text className={targetDate ? 'text-gray-900 text-sm' : 'text-gray-400 text-sm'}>
                  {targetDate || 'Pick date'}
                </Text>
              </TouchableOpacity>
              {targetDate !== '' && (
                <TouchableOpacity
                  onPress={() => setTargetDate('')}
                  className="px-3 py-3"
                  hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                >
                  <Text className="text-gray-400 text-base">×</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>

        {/* iOS inline date picker */}
        {activeDatePicker !== null && Platform.OS === 'ios' && (
          <View className="mb-4 border border-gray-200 rounded-xl overflow-hidden">
            <View className="flex-row justify-between items-center px-4 py-2 bg-gray-50 border-b border-gray-200">
              <Text className="text-sm text-gray-500">
                {activeDatePicker === 'mustDoBy' ? 'Must do by' : 'Target date'}
              </Text>
              <TouchableOpacity onPress={() => setActiveDatePicker(null)}>
                <Text className="text-indigo-600 text-sm font-medium">Done</Text>
              </TouchableOpacity>
            </View>
            <DateTimePicker
              value={datePickerValue}
              mode="date"
              display="inline"
              onChange={handleDateChange}
              minimumDate={new Date(2020, 0, 1)}
            />
          </View>
        )}

        {/* Android date picker (modal) */}
        {activeDatePicker !== null && Platform.OS === 'android' && (
          <DateTimePicker
            value={datePickerValue}
            mode="date"
            display="default"
            onChange={handleDateChange}
          />
        )}

        {/* High priority */}
        {highPriorityEligible && (
          <TouchableOpacity
            onPress={() => setIsHighPriority((v) => !v)}
            className="flex-row items-center gap-3 mb-5 py-1"
            activeOpacity={0.7}
          >
            <View
              className={`w-5 h-5 rounded border-2 items-center justify-center ${
                isHighPriority ? 'bg-amber-500 border-amber-500' : 'border-gray-300 bg-white'
              }`}
            >
              {isHighPriority && <Text className="text-white text-xs font-bold">✓</Text>}
            </View>
            <Text className="text-sm font-medium text-gray-700">High priority</Text>
            <Text className="text-xs text-amber-500 font-medium">★ today / tomorrow</Text>
          </TouchableOpacity>
        )}

        {/* Labels */}
        {allLabels.length > 0 && (
          <View className="mb-5">
            <Text className="text-sm font-medium text-gray-700 mb-3">Labels</Text>
            <View className="gap-3">
              {CATEGORY_ORDER.map((cat) => {
                const catLabels = labelsByCategory[cat];
                if (!catLabels || catLabels.length === 0) return null;
                return (
                  <View key={cat}>
                    <Text className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                      {CATEGORY_LABELS[cat]}
                    </Text>
                    <View className="flex-row flex-wrap gap-2">
                      {catLabels.map((label) => {
                        const selected = selectedLabelIds.has(label.id);
                        return (
                          <TouchableOpacity
                            key={label.id}
                            onPress={() => toggleLabel(label.id)}
                            style={selected
                              ? { backgroundColor: LABEL_BG[label.category] ?? '#e5e7eb' }
                              : { backgroundColor: '#fff', borderColor: '#d1d5db', borderWidth: 1 }
                            }
                            className="rounded-full px-3 py-1.5"
                          >
                            <Text
                              style={{ color: selected ? (LABEL_TEXT[label.category] ?? '#374151') : '#6b7280' }}
                              className="text-xs font-medium"
                            >
                              {label.value}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
