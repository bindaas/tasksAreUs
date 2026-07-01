import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Updates from 'expo-updates';
import Constants from 'expo-constants';
import { useAuth } from '../hooks/useAuth';
import { getSettings, updateSettings } from '../api/settings';
import { listLabels, createLabel, updateLabel, deleteLabel } from '../api/labels';
import {
  getFocusedViewConfig,
  updateFocusedViewConfig,
  type FocusedViewConfig,
} from '../api/focusedView';
import { API_BASE_URL, API_V1_URL } from '../api/client';
import { useBoard } from '../context/BoardContext';
import type { Label } from '../types';

const MAX_QUESTIONS = 5;
const MAX_BOARDS = 10;

const COLOR_PALETTE = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6'];

type StarterQuestion = { id: string; text: string };

function BoardSection() {
  const {
    boards,
    activeBoard,
    createBoard,
    renameBoard,
    setDefaultBoard,
    setColorBoard,
    deleteBoard,
  } = useBoard();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRename(id: string) {
    const trimmed = editValue.trim();
    if (!trimmed || trimmed === boards.find((b) => b.id === id)?.name) {
      setEditingId(null);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await renameBoard(id, trimmed);
      setEditingId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Rename failed');
    } finally {
      setBusy(false);
    }
  }

  async function handleSetDefault(id: string) {
    setBusy(true);
    setError(null);
    try {
      await setDefaultBoard(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to set default');
    } finally {
      setBusy(false);
    }
  }

  function confirmDelete(id: string, name: string) {
    Alert.alert('Delete board', `Delete "${name}"? All tasks and labels in this board will be removed.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          setError(null);
          try {
            await deleteBoard(id);
          } catch (e) {
            setError(e instanceof Error ? e.message : 'Delete failed');
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  }

  async function handleAdd() {
    const trimmed = newName.trim();
    if (!trimmed) return;
    setBusy(true);
    setError(null);
    try {
      await createBoard(trimmed);
      setNewName('');
      setAdding(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create board');
    } finally {
      setBusy(false);
    }
  }

  async function handleSetColor(id: string, color: string | null) {
    setBusy(true);
    setError(null);
    try {
      await setColorBoard(id, color);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to set board color');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View className="bg-white rounded-xl border border-gray-200 px-4 pt-4 pb-2 mb-4">
      <View className="flex-row items-center justify-between mb-0.5">
        <Text className="text-sm font-semibold text-gray-700">Boards</Text>
        <Text className="text-xs text-gray-400">{boards.length}/{MAX_BOARDS}</Text>
      </View>
      <Text className="text-xs text-gray-400 mb-3">
        Switch between boards to organize tasks by project or context.
      </Text>

      {error && <Text className="text-xs text-red-600 mb-2">{error}</Text>}

      {boards.map((board) => (
        <View key={board.id} className="mb-3">
          {editingId === board.id ? (
            <View className="flex-row items-center" style={{ gap: 8 }}>
              <TextInput
                value={editValue}
                onChangeText={setEditValue}
                onSubmitEditing={() => handleRename(board.id)}
                autoFocus
                editable={!busy}
                returnKeyType="done"
                className="flex-1 border border-indigo-400 rounded-lg px-3 py-1.5 text-sm text-gray-900 bg-white"
              />
              <TouchableOpacity onPress={() => setEditingId(null)}>
                <Text className="text-xs text-gray-400">Cancel</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <View className="flex-row items-center" style={{ gap: 8 }}>
                {board.is_default && (
                  <Text className="text-amber-400 text-xs">★</Text>
                )}
                <Text className="flex-1 text-sm text-gray-700">{board.name}</Text>
                {!board.is_default && (
                  <TouchableOpacity
                    onPress={() => handleSetDefault(board.id)}
                    disabled={busy}
                    style={{ opacity: busy ? 0.4 : 1 }}
                  >
                    <Text className="text-xs text-gray-400">Default</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  onPress={() => { setEditingId(board.id); setEditValue(board.name); setError(null); }}
                  disabled={busy}
                  style={{ opacity: busy ? 0.4 : 1 }}
                >
                  <Text className="text-xs text-gray-400">Edit</Text>
                </TouchableOpacity>
                {boards.length > 1 && (
                  <TouchableOpacity
                    onPress={() => confirmDelete(board.id, board.name)}
                    disabled={busy}
                    style={{ opacity: busy ? 0.4 : 1 }}
                  >
                    <Text className="text-xs text-red-400">Delete</Text>
                  </TouchableOpacity>
                )}
              </View>
              {/* Color swatches */}
              <View className="flex-row flex-wrap mt-1.5" style={{ gap: 6 }}>
                {/* None swatch */}
                <TouchableOpacity
                  onPress={() => handleSetColor(board.id, null)}
                  disabled={busy}
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 11,
                    backgroundColor: '#e5e7eb',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: board.color == null ? 2 : 1,
                    borderColor: board.color == null ? '#6366f1' : '#d1d5db',
                    opacity: busy ? 0.4 : 1,
                  }}
                >
                  <Text style={{ fontSize: 10, color: '#9ca3af', lineHeight: 14 }}>✕</Text>
                </TouchableOpacity>
                {COLOR_PALETTE.map((hex) => (
                  <TouchableOpacity
                    key={hex}
                    onPress={() => handleSetColor(board.id, board.color === hex ? null : hex)}
                    disabled={busy}
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 11,
                      backgroundColor: hex,
                      borderWidth: board.color === hex ? 2.5 : 0,
                      borderColor: '#ffffff',
                      shadowColor: board.color === hex ? hex : 'transparent',
                      shadowOpacity: board.color === hex ? 0.7 : 0,
                      shadowRadius: 3,
                      shadowOffset: { width: 0, height: 0 },
                      elevation: board.color === hex ? 3 : 0,
                      opacity: busy ? 0.4 : 1,
                    }}
                  />
                ))}
              </View>
            </>
          )}
        </View>
      ))}

      {adding ? (
        <View className="flex-row items-center mt-1 mb-1" style={{ gap: 8 }}>
          <TextInput
            value={newName}
            onChangeText={setNewName}
            onSubmitEditing={handleAdd}
            placeholder="Board name"
            placeholderTextColor="#9ca3af"
            autoFocus
            editable={!busy}
            returnKeyType="done"
            className="flex-1 border border-indigo-400 rounded-lg px-3 py-1.5 text-sm text-gray-900 bg-white"
          />
          <TouchableOpacity
            onPress={handleAdd}
            disabled={busy || !newName.trim()}
            style={{ opacity: busy || !newName.trim() ? 0.4 : 1 }}
          >
            <Text className="text-xs text-indigo-600 font-medium">Add</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { setAdding(false); setNewName(''); }}>
            <Text className="text-xs text-gray-400">Cancel</Text>
          </TouchableOpacity>
        </View>
      ) : boards.length < MAX_BOARDS ? (
        <TouchableOpacity
          onPress={() => { setAdding(true); setNewName(''); setError(null); }}
          disabled={busy}
          className="mt-1 mb-1"
          style={{ opacity: busy ? 0.4 : 1 }}
        >
          <Text className="text-xs text-indigo-600 font-medium">+ Add board</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

function FocusedViewConfigSection() {
  const { boards } = useBoard();
  const [config, setConfig] = useState<FocusedViewConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getFocusedViewConfig()
      .then(setConfig)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load focused view config'))
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    if (!config) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const updated = await updateFocusedViewConfig({
        board_selection: config.board_selection,
        selected_board_ids: config.selected_board_ids,
        day_range: config.day_range,
      });
      setConfig(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setBusy(false);
    }
  }

  function toggleBoard(id: string) {
    if (!config) return;
    const next = config.selected_board_ids.includes(id)
      ? config.selected_board_ids.filter((b) => b !== id)
      : [...config.selected_board_ids, id];
    setConfig({ ...config, selected_board_ids: next });
  }

  const DAY_RANGE_LABELS: Record<FocusedViewConfig['day_range'], string> = {
    today: 'Today only',
    today_tomorrow: 'Today + tomorrow',
    today_plus_two: 'Today + 2 days',
  };

  return (
    <View className="bg-white rounded-xl border border-gray-200 px-4 pt-4 pb-3 mb-4">
      <Text className="text-sm font-semibold text-gray-700 mb-0.5">Focused View</Text>
      <Text className="text-xs text-gray-400 mb-3">
        Configure which boards and date range appear in focused mode.
      </Text>

      {loading ? (
        <ActivityIndicator color="#6366f1" size="small" />
      ) : (
        <>
          {error && (
            <Text className="text-xs text-red-600 mb-2">{error}</Text>
          )}

          {config && (
            <>
              {/* Board selection */}
              <Text className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Board selection
              </Text>
              {(['all', 'selected'] as const).map((option) => (
                <TouchableOpacity
                  key={option}
                  onPress={() => setConfig({ ...config, board_selection: option })}
                  disabled={busy}
                  className="flex-row items-center mb-2"
                  style={{ gap: 8, opacity: busy ? 0.4 : 1 }}
                >
                  <View
                    className="w-4 h-4 rounded-full border-2 items-center justify-center"
                    style={{ borderColor: config.board_selection === option ? '#6366f1' : '#d1d5db' }}
                  >
                    {config.board_selection === option && (
                      <View className="w-2 h-2 rounded-full bg-indigo-600" />
                    )}
                  </View>
                  <Text className="text-sm text-gray-700">
                    {option === 'all' ? 'All boards' : 'Selected boards'}
                  </Text>
                </TouchableOpacity>
              ))}

              {config.board_selection === 'selected' && (
                <View className="ml-6 mb-2" style={{ gap: 4 }}>
                  {boards.map((board) => {
                    const checked = config.selected_board_ids.includes(board.id);
                    return (
                      <TouchableOpacity
                        key={board.id}
                        onPress={() => toggleBoard(board.id)}
                        disabled={busy}
                        className="flex-row items-center"
                        style={{ gap: 8, opacity: busy ? 0.4 : 1 }}
                      >
                        <View
                          className="w-4 h-4 rounded border-2 items-center justify-center"
                          style={{
                            borderColor: checked ? '#6366f1' : '#d1d5db',
                            backgroundColor: checked ? '#6366f1' : 'transparent',
                          }}
                        >
                          {checked && (
                            <Text style={{ color: '#fff', fontSize: 9, lineHeight: 12 }}>✓</Text>
                          )}
                        </View>
                        <Text className="text-sm text-gray-700">{board.name}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              {/* Day range */}
              <Text className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 mt-1">
                Day range
              </Text>
              {(Object.keys(DAY_RANGE_LABELS) as FocusedViewConfig['day_range'][]).map((option) => (
                <TouchableOpacity
                  key={option}
                  onPress={() => setConfig({ ...config, day_range: option })}
                  disabled={busy}
                  className="flex-row items-center mb-2"
                  style={{ gap: 8, opacity: busy ? 0.4 : 1 }}
                >
                  <View
                    className="w-4 h-4 rounded-full border-2 items-center justify-center"
                    style={{ borderColor: config.day_range === option ? '#6366f1' : '#d1d5db' }}
                  >
                    {config.day_range === option && (
                      <View className="w-2 h-2 rounded-full bg-indigo-600" />
                    )}
                  </View>
                  <Text className="text-sm text-gray-700">{DAY_RANGE_LABELS[option]}</Text>
                </TouchableOpacity>
              ))}

              {saved && (
                <Text className="text-xs text-green-600 mb-2">Saved</Text>
              )}

              <TouchableOpacity
                onPress={handleSave}
                disabled={busy}
                className="mt-1 bg-indigo-600 rounded-lg py-2 items-center"
                style={{ opacity: busy ? 0.5 : 1 }}
              >
                <Text className="text-white text-xs font-semibold">
                  {busy ? 'Saving…' : 'Save'}
                </Text>
              </TouchableOpacity>
            </>
          )}
        </>
      )}
    </View>
  );
}

function makeQuestion(text = ''): StarterQuestion {
  return { id: Math.random().toString(36).slice(2), text };
}

function LabelSection({
  category,
  labels,
  onAdd,
  onRename,
  onDelete,
}: {
  category: 'mode' | 'type';
  labels: Label[];
  onAdd: (category: 'mode' | 'type', value: string) => Promise<void>;
  onRename: (id: string, value: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [adding, setAdding] = useState(false);
  const [newValue, setNewValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRename(id: string) {
    const trimmed = editValue.trim();
    if (!trimmed || trimmed === labels.find((l) => l.id === id)?.value) {
      setEditingId(null);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onRename(id, trimmed);
      setEditingId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Rename failed');
    } finally {
      setBusy(false);
    }
  }

  async function handleAdd() {
    const trimmed = newValue.trim();
    if (!trimmed) return;
    setBusy(true);
    setError(null);
    try {
      await onAdd(category, trimmed);
      setNewValue('');
      setAdding(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Add failed');
    } finally {
      setBusy(false);
    }
  }

  function confirmDelete(id: string) {
    Alert.alert('Delete label', 'This removes the label from all tasks. Continue?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            await onDelete(id);
          } catch (e) {
            setError(e instanceof Error ? e.message : 'Delete failed');
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  }

  return (
    <View className="mb-4">
      <View className="flex-row items-center justify-between mb-2">
        <Text className="text-xs font-semibold text-gray-500 uppercase tracking-wider capitalize">
          {category}
        </Text>
        <TouchableOpacity
          onPress={() => { setAdding(true); setNewValue(''); setError(null); }}
          disabled={adding || busy}
          style={{ opacity: adding || busy ? 0.4 : 1 }}
        >
          <Text className="text-xs text-indigo-600 font-medium">+ Add</Text>
        </TouchableOpacity>
      </View>

      {error && <Text className="text-xs text-red-600 mb-1">{error}</Text>}

      {labels.map((label) => (
        <View key={label.id} className="flex-row items-center mb-1.5" style={{ gap: 8 }}>
          {editingId === label.id ? (
            <>
              <TextInput
                value={editValue}
                onChangeText={setEditValue}
                onSubmitEditing={() => handleRename(label.id)}
                autoFocus
                editable={!busy}
                returnKeyType="done"
                className="flex-1 border border-indigo-400 rounded-lg px-3 py-1.5 text-sm text-gray-900 bg-white"
              />
              <TouchableOpacity onPress={() => setEditingId(null)}>
                <Text className="text-xs text-gray-400">Cancel</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text className="flex-1 text-sm text-gray-700">{label.value}</Text>
              <TouchableOpacity
                onPress={() => { setEditingId(label.id); setEditValue(label.value); setError(null); }}
                disabled={busy}
                style={{ opacity: busy ? 0.4 : 1 }}
              >
                <Text className="text-xs text-gray-400">Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => confirmDelete(label.id)}
                disabled={busy}
                style={{ opacity: busy ? 0.4 : 1 }}
              >
                <Text className="text-xs text-red-400">Delete</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      ))}

      {adding && (
        <View className="flex-row items-center mt-1" style={{ gap: 8 }}>
          <TextInput
            value={newValue}
            onChangeText={setNewValue}
            onSubmitEditing={handleAdd}
            placeholder={`New ${category} label`}
            placeholderTextColor="#9ca3af"
            autoFocus
            editable={!busy}
            returnKeyType="done"
            className="flex-1 border border-indigo-400 rounded-lg px-3 py-1.5 text-sm text-gray-900 bg-white"
          />
          <TouchableOpacity
            onPress={handleAdd}
            disabled={busy || !newValue.trim()}
            style={{ opacity: busy || !newValue.trim() ? 0.4 : 1 }}
          >
            <Text className="text-xs text-indigo-600 font-medium">Add</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { setAdding(false); setNewValue(''); }}>
            <Text className="text-xs text-gray-400">Cancel</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

export function SettingsScreen() {
  const { user, signInWithGoogle, sendMagicLink, signOut } = useAuth();
  const { activeBoard } = useBoard();
  const isAnonymous = user?.isAnonymous ?? true;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [modeLabels, setModeLabels] = useState<Label[]>([]);
  const [typeLabels, setTypeLabels] = useState<Label[]>([]);
  const [highPriorityLimit, setHighPriorityLimit] = useState(3);
  const [questions, setQuestions] = useState<StarterQuestion[]>([]);

  const [emailInput, setEmailInput] = useState('');
  const [showEmailInput, setShowEmailInput] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [accountError, setAccountError] = useState<string | null>(null);

  const [connStatus, setConnStatus] = useState<'idle' | 'testing' | 'ok' | 'error'>('idle');
  const [connLatency, setConnLatency] = useState<number | null>(null);
  const [connError, setConnError] = useState<string | null>(null);

  const isProduction = API_BASE_URL.startsWith('https://');

  const gitHash = (Constants.expoConfig?.extra?.gitHash as string | undefined) ?? 'unknown';
  const updateId = Updates.updateId ? Updates.updateId.slice(0, 8) : 'embedded';
  const updateChannel = Updates.channel ?? '—';

  async function testConnection() {
    setConnStatus('testing');
    setConnLatency(null);
    setConnError(null);
    const start = Date.now();
    try {
      const res = await fetch(`${API_V1_URL}/health`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setConnLatency(Date.now() - start);
      setConnStatus('ok');
    } catch (e) {
      setConnError(e instanceof Error ? e.message : 'Unreachable');
      setConnStatus('error');
    }
  }

  useEffect(() => {
    async function load() {
      setLoading(true);
      setLoadError(null);
      try {
        const [settings, modeRes, typeRes] = await Promise.all([
          getSettings(),
          listLabels('mode', activeBoard?.id),
          listLabels('type', activeBoard?.id),
        ]);
        setHighPriorityLimit(settings.high_priority_daily_limit ?? 3);
        setQuestions((settings.starter_questions ?? []).map(makeQuestion));
        setModeLabels(modeRes.labels);
        setTypeLabels(typeRes.labels);
      } catch (e) {
        setLoadError(e instanceof Error ? e.message : 'Failed to load settings');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [activeBoard?.id]);

  async function handleAddLabel(cat: 'mode' | 'type', value: string) {
    const label = await createLabel(cat, value, activeBoard?.id);
    if (cat === 'mode') setModeLabels((prev) => [...prev, label]);
    else setTypeLabels((prev) => [...prev, label]);
  }

  async function handleRenameLabel(id: string, value: string) {
    const updated = await updateLabel(id, value);
    setModeLabels((prev) => prev.map((l) => (l.id === id ? updated : l)));
    setTypeLabels((prev) => prev.map((l) => (l.id === id ? updated : l)));
  }

  async function handleDeleteLabel(id: string) {
    await deleteLabel(id);
    setModeLabels((prev) => prev.filter((l) => l.id !== id));
    setTypeLabels((prev) => prev.filter((l) => l.id !== id));
  }

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      await updateSettings({
        starter_questions: questions.map((q) => q.text).filter((t) => t.trim()),
        high_priority_daily_limit: Math.max(1, highPriorityLimit),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  }

  async function handleGoogleSignIn() {
    setAccountError(null);
    try {
      await signInWithGoogle();
    } catch (e) {
      setAccountError(e instanceof Error ? e.message : 'Google sign-in failed');
    }
  }

  async function handleSendMagicLink() {
    if (!emailInput.trim()) return;
    setAccountError(null);
    try {
      await sendMagicLink(emailInput.trim());
      setMagicLinkSent(true);
    } catch (e) {
      setAccountError(e instanceof Error ? e.message : 'Failed to send sign-in link');
    }
  }

  function handleSignOut() {
    Alert.alert('Sign out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          try {
            await signOut();
          } catch (e) {
            setAccountError(e instanceof Error ? e.message : 'Sign-out failed');
          }
        },
      },
    ]);
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={['top']}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 48 }}
          keyboardShouldPersistTaps="handled"
        >
          <Text className="text-2xl font-bold text-gray-900 mb-6">Settings</Text>

          {loadError && (
            <View className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4">
              <Text className="text-red-700 text-sm">{loadError}</Text>
            </View>
          )}

          {loading ? (
            <View className="items-center py-16">
              <ActivityIndicator color="#6366f1" />
            </View>
          ) : (
            <>
              {/* Connection */}
              <View className="bg-white rounded-xl border border-gray-200 px-4 py-4 mb-4">
                <View className="flex-row items-center justify-between mb-1">
                  <Text className="text-sm font-semibold text-gray-700">Connection</Text>
                  <View
                    className="px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: isProduction ? '#dcfce7' : '#fef9c3' }}
                  >
                    <Text
                      className="text-xs font-medium"
                      style={{ color: isProduction ? '#15803d' : '#a16207' }}
                    >
                      {isProduction ? 'Production' : 'Development'}
                    </Text>
                  </View>
                </View>
                <Text className="text-xs text-gray-400" numberOfLines={1}>{API_BASE_URL}</Text>
                <Text className="text-xs text-gray-400 mb-3">
                  git: {gitHash} · update: {updateId} · ch: {updateChannel}
                </Text>
                <View className="flex-row items-center" style={{ gap: 12 }}>
                  <TouchableOpacity
                    onPress={testConnection}
                    disabled={connStatus === 'testing'}
                    className="border border-gray-300 rounded-lg px-4 py-2"
                    style={{ opacity: connStatus === 'testing' ? 0.5 : 1 }}
                  >
                    <Text className="text-sm font-medium text-gray-700">
                      {connStatus === 'testing' ? 'Testing…' : 'Test Connection'}
                    </Text>
                  </TouchableOpacity>
                  {connStatus === 'ok' && (
                    <Text className="text-sm text-green-600 font-medium">
                      Connected {connLatency}ms
                    </Text>
                  )}
                  {connStatus === 'error' && (
                    <Text className="text-sm text-red-600" numberOfLines={1}>
                      Failed: {connError}
                    </Text>
                  )}
                </View>
              </View>

              {/* Boards */}
              <BoardSection />

              {/* Focused View config */}
              <FocusedViewConfigSection />

              {/* Labels */}
              <View className="bg-white rounded-xl border border-gray-200 px-4 pt-4 pb-2 mb-4">
                <Text className="text-sm font-semibold text-gray-700 mb-0.5">Labels</Text>
                <Text className="text-xs text-gray-400 mb-3">
                  Manage Mode and Type labels for the active board.
                </Text>
                <LabelSection
                  category="mode"
                  labels={modeLabels}
                  onAdd={handleAddLabel}
                  onRename={handleRenameLabel}
                  onDelete={handleDeleteLabel}
                />
                <LabelSection
                  category="type"
                  labels={typeLabels}
                  onAdd={handleAddLabel}
                  onRename={handleRenameLabel}
                  onDelete={handleDeleteLabel}
                />
              </View>

              {/* High Priority Daily Limit */}
              <View className="bg-white rounded-xl border border-gray-200 px-4 py-4 mb-4">
                <Text className="text-sm font-semibold text-gray-700 mb-0.5">
                  High Priority Daily Limit
                </Text>
                <Text className="text-xs text-gray-400 mb-3">
                  Max high-priority tasks allowed for Today and Tomorrow.
                </Text>
                <View className="flex-row items-center" style={{ gap: 16 }}>
                  <TouchableOpacity
                    onPress={() => setHighPriorityLimit((v) => Math.max(1, v - 1))}
                    className="w-9 h-9 rounded-full bg-gray-100 items-center justify-center"
                  >
                    <Text className="text-gray-700 text-xl leading-none">−</Text>
                  </TouchableOpacity>
                  <Text className="text-2xl font-bold text-gray-900 w-8 text-center">
                    {highPriorityLimit}
                  </Text>
                  <TouchableOpacity
                    onPress={() => setHighPriorityLimit((v) => v + 1)}
                    className="w-9 h-9 rounded-full bg-gray-100 items-center justify-center"
                  >
                    <Text className="text-gray-700 text-xl leading-none">+</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Starter Questions */}
              <View className="bg-white rounded-xl border border-gray-200 px-4 py-4 mb-4">
                <View className="flex-row items-center justify-between mb-0.5">
                  <Text className="text-sm font-semibold text-gray-700">
                    Starter Questions{' '}
                    <Text className="text-gray-400 font-normal">
                      ({questions.length}/{MAX_QUESTIONS})
                    </Text>
                  </Text>
                  {questions.length < MAX_QUESTIONS && (
                    <TouchableOpacity
                      onPress={() => setQuestions((prev) => [...prev, makeQuestion()])}
                    >
                      <Text className="text-xs text-indigo-600 font-medium">+ Add</Text>
                    </TouchableOpacity>
                  )}
                </View>
                <Text className="text-xs text-gray-400 mb-3">
                  Shown as quick-start chips in the Chat screen.
                </Text>

                {questions.length === 0 ? (
                  <Text className="text-sm text-gray-400 text-center py-3">
                    No questions yet. Tap + Add above.
                  </Text>
                ) : (
                  <View style={{ gap: 8 }}>
                    {questions.map((q, idx) => (
                      <View key={q.id} className="flex-row items-center" style={{ gap: 8 }}>
                        <TextInput
                          value={q.text}
                          onChangeText={(v) =>
                            setQuestions((prev) =>
                              prev.map((item) => (item.id === q.id ? { ...item, text: v } : item)),
                            )
                          }
                          placeholder={`Question ${idx + 1}`}
                          placeholderTextColor="#9ca3af"
                          className="flex-1 border border-gray-300 rounded-xl px-3 py-2.5 text-sm text-gray-900 bg-white"
                        />
                        <TouchableOpacity
                          onPress={() =>
                            setQuestions((prev) => prev.filter((item) => item.id !== q.id))
                          }
                          className="p-1"
                        >
                          <Text className="text-red-400 text-base">✕</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}
              </View>

              {saveError && (
                <View className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-3">
                  <Text className="text-red-700 text-sm">{saveError}</Text>
                </View>
              )}
              {saved && (
                <View className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 mb-3">
                  <Text className="text-green-700 text-sm">Settings saved</Text>
                </View>
              )}

              <TouchableOpacity
                onPress={handleSave}
                disabled={saving}
                className="w-full bg-indigo-600 rounded-xl py-3.5 items-center mb-8"
                style={{ opacity: saving ? 0.5 : 1 }}
              >
                <Text className="text-white font-semibold text-sm">
                  {saving ? 'Saving…' : 'Save Settings'}
                </Text>
              </TouchableOpacity>

              {/* Account */}
              <View className="border-t border-gray-200 pt-6">
                <Text className="text-sm font-semibold text-gray-700 mb-3">Account</Text>

                {accountError && (
                  <View className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-3">
                    <Text className="text-red-700 text-sm">{accountError}</Text>
                  </View>
                )}

                {isAnonymous ? (
                  <View>
                    <Text className="text-sm text-gray-500 mb-3">
                      You're using anonymous mode. Sign in to access your account from other
                      devices.
                    </Text>
                    {magicLinkSent ? (
                      <View className="bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                        <Text className="text-green-700 text-sm">
                          Sign-in link sent to {emailInput}
                        </Text>
                      </View>
                    ) : showEmailInput ? (
                      <View style={{ gap: 8 }}>
                        <TextInput
                          value={emailInput}
                          onChangeText={setEmailInput}
                          placeholder="you@example.com"
                          placeholderTextColor="#9ca3af"
                          keyboardType="email-address"
                          autoCapitalize="none"
                          className="border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 bg-white"
                        />
                        <TouchableOpacity
                          onPress={handleSendMagicLink}
                          disabled={!emailInput.trim()}
                          className="border border-gray-300 rounded-xl py-3 items-center"
                          style={{ opacity: !emailInput.trim() ? 0.4 : 1 }}
                        >
                          <Text className="text-sm font-medium text-gray-700">
                            Send sign-in link
                          </Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <View className="flex-row" style={{ gap: 8 }}>
                        <TouchableOpacity
                          onPress={handleGoogleSignIn}
                          className="flex-1 border border-gray-300 rounded-xl py-3 items-center"
                        >
                          <Text className="text-sm font-medium text-gray-700">
                            Sign in with Google
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => setShowEmailInput(true)}
                          className="flex-1 border border-gray-300 rounded-xl py-3 items-center"
                        >
                          <Text className="text-sm font-medium text-gray-700">
                            Sign in with email
                          </Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                ) : (
                  <View className="flex-row items-center justify-between">
                    <View>
                      <Text className="text-sm font-medium text-gray-800">
                        {user?.displayName || user?.email || 'Signed in'}
                      </Text>
                      {user?.email && user?.displayName && (
                        <Text className="text-xs text-gray-500">{user.email}</Text>
                      )}
                    </View>
                    <TouchableOpacity onPress={handleSignOut}>
                      <Text className="text-sm text-red-600 font-medium">Sign out</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
