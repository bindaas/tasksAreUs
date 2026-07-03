import { useState, useEffect, useRef } from 'react';
import { getSettings, updateSettings } from '../api/settings';
import { listLabels, createLabel, updateLabel, deleteLabel } from '../api/labels';
import type { Label } from '../api/tasks';
import { useAuth } from '../hooks/useAuth';
import { useBoard } from '../context/BoardContext';
import type { Board } from '../api/boards';

const MAX_QUESTIONS = 5;

function BoardEditor({
  boards,
  activeBoard,
  onRename,
  onSetDefault,
  onSetColor,
  onDelete,
  onAdd,
}: {
  boards: Board[];
  activeBoard: Board | null;
  onRename: (id: string, name: string) => Promise<void>;
  onSetDefault: (id: string) => Promise<void>;
  onSetColor: (id: string, color: string | null) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onAdd: (name: string) => Promise<Board>;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [addingNew, setAddingNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const colorInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const colorDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleSetColor(id: string, color: string | null) {
    if (colorDebounceRef.current) clearTimeout(colorDebounceRef.current);
    colorDebounceRef.current = setTimeout(async () => {
      setBusy(true);
      setErr(null);
      try {
        await onSetColor(id, color);
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Failed to set board color');
      } finally {
        setBusy(false);
      }
    }, 300);
  }

  async function handleRename(id: string) {
    const trimmed = editName.trim();
    if (!trimmed || trimmed === boards.find((b) => b.id === id)?.name) {
      setEditingId(null);
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await onRename(id, trimmed);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to rename board');
    } finally {
      setBusy(false);
      setEditingId(null);
    }
  }

  async function handleSetDefault(id: string) {
    setBusy(true);
    setErr(null);
    try {
      await onSetDefault(id);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to set default board');
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string) {
    setBusy(true);
    setErr(null);
    try {
      await onDelete(id);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to delete board');
    } finally {
      setBusy(false);
    }
  }

  async function handleAdd() {
    const trimmed = newName.trim();
    if (!trimmed) return;
    setBusy(true);
    setErr(null);
    try {
      await onAdd(trimmed);
      setNewName('');
      setAddingNew(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to create board');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-5">
      {err && <p className="text-xs text-red-600 mb-2">{err}</p>}
      <div className="space-y-1.5">
        {boards.map((board) => (
          <div key={board.id} className="flex items-center gap-2">
            <button
              onClick={() => !board.is_default && handleSetDefault(board.id)}
              disabled={busy || board.is_default}
              title={board.is_default ? 'Default board' : 'Set as default'}
              className={`shrink-0 ${board.is_default ? 'text-amber-400 cursor-default' : 'text-gray-300 hover:text-amber-400'} disabled:opacity-50`}
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            </button>

            {editingId === board.id ? (
              <>
                <input
                  autoFocus
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleRename(board.id);
                    if (e.key === 'Escape') setEditingId(null);
                  }}
                  className="flex-1 border border-indigo-400 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  disabled={busy}
                />
                <button onClick={() => handleRename(board.id)} disabled={busy} className="text-xs text-indigo-600 font-medium disabled:opacity-40">Save</button>
                <button onClick={() => setEditingId(null)} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
              </>
            ) : (
              <>
                <span className={`flex-1 text-sm ${board.id === activeBoard?.id ? 'font-medium text-indigo-700' : 'text-gray-700'}`}>
                  {board.name}
                </span>

                {/* Color swatch */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => colorInputRefs.current[board.id]?.click()}
                    disabled={busy}
                    title="Set board color"
                    className="w-5 h-5 rounded-full border border-gray-300 shrink-0 disabled:opacity-40"
                    style={{ backgroundColor: board.color ?? '#e5e7eb' }}
                  />
                  <input
                    ref={(el) => { colorInputRefs.current[board.id] = el; }}
                    type="color"
                    className="sr-only"
                    value={board.color ?? '#6366f1'}
                    onChange={(e) => handleSetColor(board.id, e.target.value)}
                  />
                  {board.color && (
                    <button
                      onClick={() => handleSetColor(board.id, null)}
                      disabled={busy}
                      title="Clear color"
                      className="text-gray-300 hover:text-gray-500 disabled:opacity-40 leading-none"
                    >
                      ×
                    </button>
                  )}
                </div>

                <button
                  onClick={() => { setEditingId(board.id); setEditName(board.name); setErr(null); }}
                  disabled={busy}
                  className="text-xs text-gray-400 hover:text-indigo-600 disabled:opacity-40"
                >
                  Rename
                </button>
                <button
                  onClick={() => handleDelete(board.id)}
                  disabled={busy || board.is_default || boards.length <= 1}
                  title={board.is_default ? 'Cannot delete the default board' : boards.length <= 1 ? 'Cannot delete the only board' : undefined}
                  className="text-xs text-red-400 hover:text-red-600 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Delete
                </button>
              </>
            )}
          </div>
        ))}

        {addingNew ? (
          <div className="flex items-center gap-2 mt-1">
            <input
              autoFocus
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAdd();
                if (e.key === 'Escape') { setAddingNew(false); setNewName(''); }
              }}
              placeholder="Board name"
              className="flex-1 border border-indigo-400 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              disabled={busy}
            />
            <button onClick={handleAdd} disabled={busy || !newName.trim()} className="text-xs text-indigo-600 font-medium disabled:opacity-40">Add</button>
            <button onClick={() => { setAddingNew(false); setNewName(''); }} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
          </div>
        ) : (
          <button
            onClick={() => { setAddingNew(true); setErr(null); }}
            disabled={busy}
            className="text-xs text-indigo-600 hover:text-indigo-800 font-medium disabled:opacity-40 mt-1"
          >
            + Add board
          </button>
        )}
      </div>
    </div>
  );
}

type ConfigurableCategory = 'mode' | 'type';

function LabelEditor({
  category,
  labels,
  onAdd,
  onRename,
  onDelete,
}: {
  category: ConfigurableCategory;
  labels: Label[];
  onAdd: (category: ConfigurableCategory, value: string) => Promise<void>;
  onRename: (id: string, value: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [addingNew, setAddingNew] = useState(false);
  const [newValue, setNewValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleRename(id: string) {
    const trimmed = editValue.trim();
    if (!trimmed || trimmed === labels.find((l) => l.id === id)?.value) {
      setEditingId(null);
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await onRename(id, trimmed);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to rename');
    } finally {
      setBusy(false);
      setEditingId(null);
    }
  }

  async function handleAdd() {
    const trimmed = newValue.trim();
    if (!trimmed) return;
    setBusy(true);
    setErr(null);
    try {
      await onAdd(category, trimmed);
      setNewValue('');
      setAddingNew(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to add label');
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string) {
    setBusy(true);
    setErr(null);
    try {
      await onDelete(id);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to delete');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-5">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide capitalize">
          {category}
        </h4>
        <button
          onClick={() => { setAddingNew(true); setNewValue(''); setErr(null); }}
          disabled={addingNew || busy}
          className="text-xs text-indigo-600 hover:text-indigo-800 font-medium disabled:opacity-40"
        >
          + Add
        </button>
      </div>

      {err && (
        <p className="text-xs text-red-600 mb-1">{err}</p>
      )}

      <div className="space-y-1">
        {labels.map((label) => (
          <div key={label.id} className="flex items-center gap-2">
            {editingId === label.id ? (
              <>
                <input
                  autoFocus
                  type="text"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleRename(label.id);
                    if (e.key === 'Escape') setEditingId(null);
                  }}
                  className="flex-1 border border-indigo-400 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  disabled={busy}
                />
                <button
                  onClick={() => handleRename(label.id)}
                  disabled={busy}
                  className="text-xs text-indigo-600 font-medium disabled:opacity-40"
                >
                  Save
                </button>
                <button
                  onClick={() => setEditingId(null)}
                  className="text-xs text-gray-400 hover:text-gray-600"
                >
                  Cancel
                </button>
              </>
            ) : (
              <>
                <span className="flex-1 text-sm text-gray-700">{label.value}</span>
                <button
                  onClick={() => { setEditingId(label.id); setEditValue(label.value); setErr(null); }}
                  disabled={busy}
                  className="text-xs text-gray-400 hover:text-indigo-600 disabled:opacity-40"
                  title="Rename"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(label.id)}
                  disabled={busy}
                  className="text-xs text-red-400 hover:text-red-600 disabled:opacity-40"
                  title="Delete"
                >
                  Delete
                </button>
              </>
            )}
          </div>
        ))}

        {addingNew && (
          <div className="flex items-center gap-2 mt-1">
            <input
              autoFocus
              type="text"
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAdd();
                if (e.key === 'Escape') { setAddingNew(false); setNewValue(''); }
              }}
              placeholder={`New ${category} label`}
              className="flex-1 border border-indigo-400 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              disabled={busy}
            />
            <button
              onClick={handleAdd}
              disabled={busy || !newValue.trim()}
              className="text-xs text-indigo-600 font-medium disabled:opacity-40"
            >
              Add
            </button>
            <button
              onClick={() => { setAddingNew(false); setNewValue(''); }}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function SettingsPage() {
  const { user, signInWithGoogle, sendMagicLink, signOut } = useAuth();
  const { boards, activeBoard, renameBoard, setDefaultBoard, setColorBoard, deleteBoard, createBoard } = useBoard();
  const isAnonymous = user?.isAnonymous === true;

  // Local to Settings — deliberately not synced to BoardContext's activeBoard,
  // so switching which board's labels you're editing here doesn't change the
  // board selected elsewhere in the app (Settings is otherwise board-neutral).
  const [labelsBoardId, setLabelsBoardId] = useState<string | undefined>(undefined);
  useEffect(() => {
    if (boards.length === 0) return;
    const stillExists = labelsBoardId && boards.some((b) => b.id === labelsBoardId);
    if (!stillExists) {
      setLabelsBoardId(activeBoard?.id ?? boards[0].id);
    }
  }, [boards, activeBoard, labelsBoardId]);
  const labelsBoard = boards.find((b) => b.id === labelsBoardId);

  const [questions, setQuestions] = useState<string[]>([]);
  const [highPriorityLimit, setHighPriorityLimit] = useState(3);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [magicLinkEmail, setMagicLinkEmail] = useState('');
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [showEmailInput, setShowEmailInput] = useState(false);

  const [modeLabels, setModeLabels] = useState<Label[]>([]);
  const [typeLabels, setTypeLabels] = useState<Label[]>([]);

  const [connStatus, setConnStatus] = useState<'idle' | 'testing' | 'ok' | 'error'>('idle');
  const [connLatency, setConnLatency] = useState<number | null>(null);
  const [connError, setConnError] = useState<string | null>(null);

  const isProduction = import.meta.env.PROD;
  const apiDisplayUrl = import.meta.env.DEV
    ? (import.meta.env.VITE_API_TARGET ?? 'http://localhost:8000')
    : window.location.origin;

  async function testConnection() {
    setConnStatus('testing');
    setConnLatency(null);
    setConnError(null);
    const start = Date.now();
    try {
      const res = await fetch('/api/v1/health');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setConnLatency(Date.now() - start);
      setConnStatus('ok');
    } catch (e) {
      setConnError(e instanceof Error ? e.message : 'Unreachable');
      setConnStatus('error');
    }
  }

  useEffect(() => {
    if (!labelsBoardId) return;
    async function fetch() {
      setLoading(true);
      setError(null);
      try {
        const [s, modeRes, typeRes] = await Promise.all([
          getSettings(),
          listLabels('mode', labelsBoardId),
          listLabels('type', labelsBoardId),
        ]);
        setQuestions(s.starter_questions ?? []);
        setHighPriorityLimit(s.high_priority_daily_limit ?? 3);
        setModeLabels(modeRes.labels);
        setTypeLabels(typeRes.labels);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load settings');
      } finally {
        setLoading(false);
      }
    }
    fetch();
  }, [labelsBoardId]);

  async function handleAddLabel(category: 'mode' | 'type', value: string) {
    const label = await createLabel(category, value, labelsBoardId);
    if (category === 'mode') setModeLabels((prev) => [...prev, label]);
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

  function updateQuestion(idx: number, value: string) {
    setQuestions((prev) => {
      const next = [...prev];
      next[idx] = value;
      return next;
    });
  }

  function addQuestion() {
    if (questions.length >= MAX_QUESTIONS) return;
    setQuestions((prev) => [...prev, '']);
  }

  function removeQuestion(idx: number) {
    setQuestions((prev) => prev.filter((_, i) => i !== idx));
  }

  function moveUp(idx: number) {
    if (idx === 0) return;
    setQuestions((prev) => {
      const next = [...prev];
      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
      return next;
    });
  }

  function moveDown(idx: number) {
    if (idx === questions.length - 1) return;
    setQuestions((prev) => {
      const next = [...prev];
      [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
      return next;
    });
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      await updateSettings({ starter_questions: questions.filter((q) => q.trim()), high_priority_daily_limit: Math.max(1, highPriorityLimit) });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  }

  async function handleGoogleSignIn() {
    setAccountError(null);
    try {
      await signInWithGoogle();
    } catch (err) {
      setAccountError(err instanceof Error ? err.message : 'Google sign-in failed');
    }
  }

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    if (!magicLinkEmail.trim()) return;
    setAccountError(null);
    try {
      await sendMagicLink(magicLinkEmail.trim());
      setMagicLinkSent(true);
    } catch (err) {
      setAccountError(err instanceof Error ? err.message : 'Failed to send sign-in link');
    }
  }

  async function handleSignOut() {
    setAccountError(null);
    try {
      await signOut();
    } catch (err) {
      setAccountError(err instanceof Error ? err.message : 'Sign-out failed');
    }
  }

  return (
    <div className="p-4 max-w-xl mx-auto">
      <h2 className="text-xl font-bold text-gray-900 mb-1">Settings</h2>
      <p className="text-sm text-gray-500 mb-6">Configure your labels, questions, and preferences</p>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm mb-4">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-3 text-sm mb-4">
          Settings saved successfully
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Boards */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-1">Boards</h3>
            <p className="text-xs text-gray-500 mb-3">
              Manage your boards. The starred board is your default — you return to it on every app open.
            </p>
            <div className="border border-gray-200 rounded-lg p-3">
              <BoardEditor
                boards={boards}
                activeBoard={activeBoard}
                onRename={renameBoard}
                onSetDefault={setDefaultBoard}
                onSetColor={setColorBoard}
                onDelete={deleteBoard}
                onAdd={createBoard}
              />
            </div>
          </div>

          {/* Labels */}
          <div className="mb-6">
            <div className="flex items-center justify-between gap-3 mb-1">
              <h3 className="text-sm font-semibold text-gray-700">Labels</h3>
              {boards.length > 1 && (
                <select
                  value={labelsBoardId ?? ''}
                  onChange={(e) => setLabelsBoardId(e.target.value)}
                  className="border border-gray-300 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  {boards.map((board) => (
                    <option key={board.id} value={board.id}>
                      {board.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <p className="text-xs text-gray-500 mb-3">
              Customise Mode and Type labels for {labelsBoard ? <span className="font-medium">{labelsBoard.name}</span> : 'the selected board'}.
            </p>
            <div className="border border-gray-200 rounded-lg p-3 space-y-1">
              <LabelEditor
                category="mode"
                labels={modeLabels}
                onAdd={handleAddLabel}
                onRename={handleRenameLabel}
                onDelete={handleDeleteLabel}
              />
              <LabelEditor
                category="type"
                labels={typeLabels}
                onAdd={handleAddLabel}
                onRename={handleRenameLabel}
                onDelete={handleDeleteLabel}
              />
            </div>
          </div>

          {/* High-priority limit */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-1">High Priority Daily Limit</h3>
            <p className="text-xs text-gray-500 mb-2">
              Max high-priority tasks allowed per day in Today and Tomorrow. A warning is shown when this is exceeded.
            </p>
            <input
              type="number"
              min={1}
              max={20}
              value={highPriorityLimit}
              onChange={(e) => setHighPriorityLimit(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-24 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          <div className="mb-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-700">
                Starter Questions
                <span className="ml-2 text-gray-400 font-normal">
                  ({questions.length}/{MAX_QUESTIONS})
                </span>
              </h3>
              <button
                onClick={addQuestion}
                disabled={questions.length >= MAX_QUESTIONS}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-medium disabled:opacity-40 disabled:cursor-not-allowed"
              >
                + Add question
              </button>
            </div>

            {questions.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-6 border border-dashed border-gray-200 rounded-lg">
                No starter questions yet. Add one above.
              </p>
            )}

            <div className="space-y-2">
              {questions.map((q, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <div className="flex flex-col gap-0.5 shrink-0">
                    <button
                      onClick={() => moveUp(idx)}
                      disabled={idx === 0}
                      className="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-20"
                      title="Move up"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                      </svg>
                    </button>
                    <button
                      onClick={() => moveDown(idx)}
                      disabled={idx === questions.length - 1}
                      className="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-20"
                      title="Move down"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>

                  <input
                    type="text"
                    value={q}
                    onChange={(e) => updateQuestion(idx, e.target.value)}
                    placeholder={`Question ${idx + 1}`}
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />

                  <button
                    onClick={() => removeQuestion(idx)}
                    className="shrink-0 p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                    title="Remove"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-indigo-600 text-white rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>

          {/* Connection */}
          <div className="mt-8 pt-6 border-t border-gray-100">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-sm font-semibold text-gray-700">Connection</h3>
              <span
                className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  isProduction ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                }`}
              >
                {isProduction ? 'Production' : 'Development'}
              </span>
            </div>
            <p className="text-xs text-gray-400 mb-3 truncate">
              {apiDisplayUrl}{import.meta.env.DEV && ' (proxied via Vite)'}
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={testConnection}
                disabled={connStatus === 'testing'}
                className="border border-gray-300 rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {connStatus === 'testing' ? 'Testing…' : 'Test Connection'}
              </button>
              {connStatus === 'ok' && (
                <span className="text-sm text-green-600 font-medium">Connected {connLatency ?? 0}ms</span>
              )}
              {connStatus === 'error' && (
                <span className="text-sm text-red-600 truncate">Failed: {connError}</span>
              )}
            </div>
          </div>
        </>
      )}

      {/* Account */}
      <div className="mt-8 pt-6 border-t border-gray-100">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Account</h3>

        {accountError && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm mb-3">
            {accountError}
          </div>
        )}

        {isAnonymous ? (
          <div className="space-y-3">
            <p className="text-sm text-gray-500">
              You're using anonymous mode. Sign in to access your account from other devices.
            </p>

            {magicLinkSent ? (
              <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-3 text-sm">
                Sign-in link sent to <span className="font-medium">{magicLinkEmail}</span>
              </div>
            ) : showEmailInput ? (
              <form onSubmit={handleMagicLink} className="space-y-2">
                <input
                  type="email"
                  value={magicLinkEmail}
                  onChange={(e) => setMagicLinkEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
                <button
                  type="submit"
                  disabled={!magicLinkEmail.trim()}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Send sign-in link
                </button>
              </form>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={handleGoogleSignIn}
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Sign in with Google
                </button>
                <button
                  onClick={() => setShowEmailInput(true)}
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Sign in with email
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-800">{user?.displayName || user?.email || 'Signed in'}</p>
              {user?.email && user?.displayName && (
                <p className="text-xs text-gray-500">{user.email}</p>
              )}
            </div>
            <button
              onClick={handleSignOut}
              className="text-sm text-red-600 hover:text-red-800 font-medium transition-colors"
            >
              Sign out
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
