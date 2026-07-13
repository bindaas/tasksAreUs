import { useState, useEffect, useCallback, useRef } from 'react';
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
import { useBoard } from '../context/BoardContext';
import { dateOnly } from '../utils/taskDateUtils';
import { isFormHighPriorityEligible } from '../utils/taskPriority';
import { isValidLinkUrl, MAX_TASK_LINKS } from '../utils/taskLinks';
import { LABEL_BG, LABEL_TEXT } from '../utils/labelColors';
import type { Task, Label, TaskLink, CreateTaskBody, UpdateTaskBody } from '../types';

function newLinkId(): string {
  return `link-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

const CATEGORY_ORDER: Array<'type'> = ['type'];
const CATEGORY_LABELS: Record<string, string> = { type: 'Tags' };

interface Props {
  taskId?: string;
  onSave: () => void;
  onCancel: () => void;
  initialLabelIds?: string[];
  /** Board to preselect when creating a task (ignored in edit mode, where the
   * task's own board_id is used instead). */
  defaultBoardId?: string;
}

type DateField = 'mustDoBy' | 'targetDate' | null;

export function TaskFormScreen({ taskId, onSave, onCancel, initialLabelIds, defaultBoardId }: Props) {
  const { boards, activeBoard } = useBoard();
  const isEditMode = !!taskId;

  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [mustDoBy, setMustDoBy] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [isHighPriority, setIsHighPriority] = useState(false);
  const [selectedLabelIds, setSelectedLabelIds] = useState<Set<string>>(new Set());
  const [allLabels, setAllLabels] = useState<Label[]>([]);
  const [links, setLinks] = useState<TaskLink[]>([]);
  const [boardId, setBoardId] = useState('');
  const initialBoardIdRef = useRef<string | undefined>(undefined);

  const [activeDatePicker, setActiveDatePicker] = useState<DateField>(null);
  const [loadingInitial, setLoadingInitial] = useState(isEditMode);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const todayStr = dateOnly(new Date());
  const _tom = new Date();
  _tom.setDate(_tom.getDate() + 1);
  const tomorrowStr = dateOnly(_tom);
  const highPriorityEligible = isFormHighPriorityEligible(mustDoBy, targetDate, todayStr, tomorrowStr);
  const movingBoard = isEditMode && !!initialBoardIdRef.current && boardId !== initialBoardIdRef.current;

  const loadData = useCallback(async () => {
    try {
      const task = isEditMode ? await getTask(taskId) : null;
      if (task) {
        setTitle(task.title);
        setNotes(task.notes ?? '');
        setMustDoBy(task.must_do_by ?? '');
        setTargetDate(task.target_date ?? '');
        setIsHighPriority(task.is_high_priority);
        setSelectedLabelIds(new Set(task.labels.map((l) => l.id)));
        setLinks(task.links ?? []);
        initialBoardIdRef.current = task.board_id;
        setBoardId(task.board_id);
      } else {
        setSelectedLabelIds(new Set(initialLabelIds ?? []));
        setBoardId(defaultBoardId ?? activeBoard?.id ?? '');
      }
    } catch {
      setError('Failed to load data.');
    } finally {
      setLoadingInitial(false);
    }
  }, [isEditMode, taskId, initialLabelIds, defaultBoardId, activeBoard?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Labels are board-scoped — (re)fetch whenever the selected board changes,
  // including the initial resolution once boardId is known.
  useEffect(() => {
    if (!boardId) return;
    listLabels(undefined, boardId)
      .then((result) => setAllLabels(result.labels))
      .catch(() => {});
  }, [boardId]);

  // A genuine board switch (not the initial resolution above) invalidates
  // whatever labels were previously selected, since those ids won't exist on
  // the new board and would 422 on submit — mirrors the web TaskForm fix.
  const prevBoardIdRef = useRef('');
  useEffect(() => {
    const prev = prevBoardIdRef.current;
    prevBoardIdRef.current = boardId;
    if (prev && boardId && prev !== boardId) {
      setSelectedLabelIds(new Set());
    }
  }, [boardId]);

  function toggleLabel(id: string) {
    setSelectedLabelIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function addLinkRow() {
    if (links.length >= MAX_TASK_LINKS) return;
    setLinks((prev) => [...prev, { id: newLinkId(), url: '', description: '' }]);
  }

  function removeLinkRow(id: string) {
    setLinks((prev) => prev.filter((l) => l.id !== id));
  }

  function updateLinkRow(id: string, field: 'url' | 'description', value: string) {
    setLinks((prev) => prev.map((l) => (l.id === id ? { ...l, [field]: value } : l)));
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

    const validLinks: TaskLink[] = [];
    for (let i = 0; i < links.length; i++) {
      const link = links[i];
      const url = link.url.trim();
      const description = link.description.trim();
      if (!url && !description) continue; // skip fully-blank rows
      if (!url || !description) {
        setError(`Link ${i + 1}: needs both a URL and a description.`);
        return;
      }
      if (!isValidLinkUrl(url)) {
        setError(`Link ${i + 1}: must start with http:// or https://`);
        return;
      }
      validLinks.push({ id: link.id, url, description });
    }

    setError(null);
    setSaving(true);
    try {
      if (isEditMode) {
        const body: UpdateTaskBody = {
          title: title.trim(),
          notes: notes.trim(),
          label_ids: Array.from(selectedLabelIds),
          is_high_priority: highPriorityEligible && isHighPriority,
          must_do_by: mustDoBy || null,
          target_date: targetDate || null,
          links: validLinks,
          board_id: boardId,
        };
        await updateTask(taskId, body);
      } else {
        const body: CreateTaskBody = {
          title: title.trim(),
          notes: notes.trim(),
          label_ids: Array.from(selectedLabelIds),
          is_high_priority: highPriorityEligible && isHighPriority,
          links: validLinks,
        };
        if (mustDoBy) body.must_do_by = mustDoBy;
        if (targetDate) body.target_date = targetDate;
        await createTask(body, boardId || activeBoard?.id);
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
            numberOfLines={6}
            className="border border-gray-300 rounded-xl px-4 py-3 text-base text-gray-900"
            style={{ minHeight: 160, textAlignVertical: 'top' }}
          />
        </View>

        {/* Links */}
        <View className="mb-5">
          <View className="flex-row items-center justify-between mb-2">
            <Text className="text-sm font-medium text-gray-700">Links</Text>
            <TouchableOpacity
              onPress={addLinkRow}
              disabled={links.length >= MAX_TASK_LINKS}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text className={`text-xs font-medium ${links.length >= MAX_TASK_LINKS ? 'text-gray-300' : 'text-indigo-600'}`}>
                + Add link
              </Text>
            </TouchableOpacity>
          </View>
          <View className="gap-2">
            {links.map((link) => (
              <View key={link.id} className="flex-row items-start gap-2">
                <View className="flex-1 gap-1.5">
                  <TextInput
                    value={link.description}
                    onChangeText={(v) => updateLinkRow(link.id, 'description', v)}
                    placeholder="Description"
                    placeholderTextColor="#9ca3af"
                    className="border border-gray-300 rounded-xl px-3 py-2 text-sm text-gray-900"
                  />
                  <TextInput
                    value={link.url}
                    onChangeText={(v) => updateLinkRow(link.id, 'url', v)}
                    placeholder="https://..."
                    placeholderTextColor="#9ca3af"
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="url"
                    className="border border-gray-300 rounded-xl px-3 py-2 text-sm text-gray-900"
                  />
                </View>
                <TouchableOpacity
                  onPress={() => removeLinkRow(link.id)}
                  className="p-2"
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text className="text-gray-400 text-base">×</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
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

        {/* Board */}
        {boards.length > 0 && (
          <View className="mb-5">
            <Text className="text-sm font-medium text-gray-700 mb-2">Board</Text>
            <View className="flex-row flex-wrap gap-2">
              {boards.map((board) => {
                const selected = board.id === boardId;
                return (
                  <TouchableOpacity
                    key={board.id}
                    onPress={() => setBoardId(board.id)}
                    style={
                      selected
                        ? { backgroundColor: '#6366f1' }
                        : { backgroundColor: '#fff', borderColor: '#d1d5db', borderWidth: 1 }
                    }
                    className="rounded-full px-3 py-1.5"
                  >
                    <Text
                      style={{ color: selected ? '#ffffff' : '#374151' }}
                      className="text-xs font-medium"
                    >
                      {board.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {movingBoard && (
              <Text className="text-xs text-amber-600 mt-1.5">
                Moving to a different board will clear this task's labels.
              </Text>
            )}
          </View>
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
