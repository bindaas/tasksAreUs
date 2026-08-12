import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Task, CreateTaskBody, UpdateTaskBody, PriorityTier } from '../api/tasks';
import type { Label, TaskLink } from '../api/tasks';
import type { Board } from '../api/boards';
import { dateOnly } from '../utils/taskDateUtils';
import { isFormPriorityEligible } from '../utils/taskPriority';
import { isValidLinkUrl, withReadyLinkRow } from '../utils/taskLinks';
import { computeSyncedScrollTop } from '../utils/scrollSync';

function newLinkId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `link-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

interface TaskFormProps {
  initialValues?: Partial<Task>;
  labels: Label[];
  labelsLoading?: boolean;
  boards: Board[];
  defaultBoardId?: string;
  onBoardIdChange?: (boardId: string) => void;
  onCreateLabel?: (value: string) => Promise<Label>;
  onSubmit: (data: CreateTaskBody | UpdateTaskBody) => Promise<void>;
  onCancel: () => void;
  submitLabel?: string;
  loading?: boolean;
}

type LabelCategory = 'type';

const CATEGORY_ORDER: LabelCategory[] = ['type'];
const CATEGORY_DISPLAY_NAMES: Record<LabelCategory, string> = {
  type: 'Tags',
};

export function TaskForm({
  initialValues,
  labels,
  labelsLoading = false,
  boards,
  defaultBoardId,
  onBoardIdChange,
  onCreateLabel,
  onSubmit,
  onCancel,
  submitLabel = 'Save',
  loading = false,
}: TaskFormProps) {
  const [title, setTitle] = useState(initialValues?.title ?? '');
  const [notes, setNotes] = useState(initialValues?.notes ?? '');
  const [mustDoBy, setMustDoBy] = useState(initialValues?.must_do_by ?? '');
  const [targetDate, setTargetDate] = useState(initialValues?.target_date ?? '');
  const [priority, setPriority] = useState<PriorityTier>(initialValues?.priority ?? 'normal');
  const [selectedLabelIds, setSelectedLabelIds] = useState<Set<string>>(
    new Set(initialValues?.labels?.map((l) => l.id) ?? [])
  );
  const [links, setLinks] = useState<TaskLink[]>(initialValues?.links ?? []);
  const [boardId, setBoardId] = useState(initialValues?.board_id ?? defaultBoardId ?? '');
  const [error, setError] = useState<string | null>(null);
  const [addingTag, setAddingTag] = useState(false);
  const [newTagValue, setNewTagValue] = useState('');
  const [addTagBusy, setAddTagBusy] = useState(false);
  const [addTagError, setAddTagError] = useState<string | null>(null);

  const notesTextareaRef = useRef<HTMLTextAreaElement>(null);
  const notesPreviewRef = useRef<HTMLDivElement>(null);
  const syncingScrollRef = useRef(false);

  function syncScroll(source: HTMLElement, target: HTMLElement) {
    if (syncingScrollRef.current) return;
    const scrollTop = computeSyncedScrollTop(source, target);
    if (scrollTop === null) return;
    syncingScrollRef.current = true;
    target.scrollTop = scrollTop;
    // The scrollTop write above dispatches target's own `scroll` event
    // asynchronously, not inline — resetting the guard on the next frame
    // (rather than synchronously here) keeps it set until that reciprocal
    // event fires, so it actually suppresses the reciprocal syncScroll call.
    requestAnimationFrame(() => {
      syncingScrollRef.current = false;
    });
  }

  const isEditMode = !!initialValues;
  const movingBoard = isEditMode && !!initialValues?.board_id && boardId !== initialValues.board_id;

  // defaultBoardId can arrive after mount (BoardContext loads asynchronously) —
  // pick it up once it's available if the form hasn't already been given a
  // board (initialValues) or had one chosen by the user.
  useEffect(() => {
    if (!initialValues?.board_id && !boardId && defaultBoardId) {
      setBoardId(defaultBoardId);
    }
  }, [defaultBoardId, initialValues?.board_id, boardId]);

  // Let the parent rescope its labels fetch to whichever board is currently
  // selected in this form (labels are board-scoped; the parent doesn't
  // otherwise see live changes to this local boardId state).
  useEffect(() => {
    if (boardId) onBoardIdChange?.(boardId);
  }, [boardId, onBoardIdChange]);

  // Labels are board-scoped server-side — a genuine board switch (not the
  // initial resolution above) invalidates whatever was previously selected,
  // since those label ids won't exist on the new board and would 422 on submit.
  const prevBoardIdRef = useRef(boardId);
  useEffect(() => {
    const prev = prevBoardIdRef.current;
    prevBoardIdRef.current = boardId;
    if (prev && boardId && prev !== boardId) {
      setSelectedLabelIds(new Set());
    }
  }, [boardId]);

  // Always keep one blank, ready-to-fill link row at the end while under the
  // cap, so the user can start typing a link without an explicit "+ Add" step.
  // Decides inside the updater (not from the `links` closure) so StrictMode's
  // double-invoked effect can't append two rows for one state transition.
  useEffect(() => {
    setLinks((prev) => withReadyLinkRow(prev, newLinkId));
  }, [links]);

  function removeLinkRow(id: string) {
    setLinks((prev) => prev.filter((l) => l.id !== id));
  }

  function updateLinkRow(id: string, field: 'url' | 'description', value: string) {
    setLinks((prev) => prev.map((l) => (l.id === id ? { ...l, [field]: value } : l)));
  }

  const _today = new Date();
  const todayStr = dateOnly(_today);
  const _tom = new Date(_today);
  _tom.setDate(_tom.getDate() + 1);
  const tomorrowStr = dateOnly(_tom);
  const priorityEligible = isFormPriorityEligible(mustDoBy, targetDate, todayStr, tomorrowStr);

  const labelsByCategory = labels.reduce<Record<LabelCategory, Label[]>>(
    (acc, label) => {
      if (label.category === 'type') {
        acc[label.category].push(label);
      }
      return acc;
    },
    { type: [] }
  );

  function toggleLabel(id: string) {
    setSelectedLabelIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function cancelAddTag() {
    setAddingTag(false);
    setNewTagValue('');
    setAddTagError(null);
  }

  async function handleAddTag() {
    const trimmed = newTagValue.trim();
    if (!trimmed || !onCreateLabel) return;
    setAddTagBusy(true);
    setAddTagError(null);
    try {
      const label = await onCreateLabel(trimmed);
      setSelectedLabelIds((prev) => new Set(prev).add(label.id));
      setAddingTag(false);
      setNewTagValue('');
    } catch (err) {
      setAddTagError(err instanceof Error ? err.message : 'Failed to add tag');
    } finally {
      setAddTagBusy(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setError('Title is required');
      return;
    }

    const validLinks: TaskLink[] = [];
    for (const link of links) {
      const url = link.url.trim();
      const description = link.description.trim();
      if (!url && !description) continue; // skip fully-blank rows
      if (!url || !description) {
        setError('Each link needs both a URL and a description');
        return;
      }
      if (!isValidLinkUrl(url)) {
        setError('Links must start with http:// or https://');
        return;
      }
      validLinks.push({ id: link.id, url, description });
    }

    setError(null);

    const data: CreateTaskBody | UpdateTaskBody = {
      title: title.trim(),
      label_ids: Array.from(selectedLabelIds),
      priority: priorityEligible ? priority : 'normal',
      links: validLinks,
    };
    if (boardId) data.board_id = boardId;
    data.notes = notes.trim();

    if (mustDoBy !== '') {
      data.must_do_by = mustDoBy;
    } else if (isEditMode && initialValues?.must_do_by) {
      (data as UpdateTaskBody).must_do_by = null;
    }

    if (targetDate !== '') {
      data.target_date = targetDate;
    } else if (isEditMode && initialValues?.target_date) {
      (data as UpdateTaskBody).target_date = null;
    }

    await onSubmit(data);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Title <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          placeholder="What needs to be done?"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-stretch">
          <textarea
            ref={notesTextareaRef}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onScroll={(e) => {
              if (notesPreviewRef.current) {
                syncScroll(e.currentTarget, notesPreviewRef.current);
              }
            }}
            rows={7}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
            placeholder="Any additional details..."
          />
          <div
            ref={notesPreviewRef}
            onScroll={(e) => {
              if (notesTextareaRef.current) {
                syncScroll(e.currentTarget, notesTextareaRef.current);
              }
            }}
            className="h-full max-h-80 overflow-y-auto border border-gray-200 rounded-lg px-3 py-2 bg-gray-50"
          >
            {notes.trim() === '' ? (
              <p className="text-sm text-gray-400 italic">Nothing to preview yet</p>
            ) : (
              <div className="prose prose-sm max-w-none">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    a: ({ ...props }) => (
                      <a {...props} target="_blank" rel="noopener noreferrer" />
                    ),
                    input: ({ ...props }) => <input {...props} disabled />,
                  }}
                >
                  {notes}
                </ReactMarkdown>
              </div>
            )}
          </div>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Links</label>
        <div className="space-y-2">
          {links.map((link) => (
            <div key={link.id} className="flex gap-2 items-start">
              <div className="flex-1 space-y-1.5">
                <input
                  type="text"
                  value={link.description}
                  onChange={(e) => updateLinkRow(link.id, 'description', e.target.value)}
                  placeholder="Description"
                  className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
                <div className="flex gap-1.5 items-center">
                  <input
                    type="text"
                    value={link.url}
                    onChange={(e) => updateLinkRow(link.id, 'url', e.target.value)}
                    placeholder="https://..."
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                  {isValidLinkUrl(link.url) && (
                    <a
                      href={link.url.trim()}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded-full text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors shrink-0"
                      aria-label="Open link in new tab"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => removeLinkRow(link.id)}
                className="p-1.5 rounded-full bg-gray-50 hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors shrink-0"
                aria-label="Remove link"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Must do by</label>
          <div className="relative">
            <input
              type="date"
              value={mustDoBy}
              onChange={(e) => setMustDoBy(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 pr-8"
            />
            {mustDoBy !== '' && (
              <button
                type="button"
                onClick={() => setMustDoBy('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 leading-none"
                aria-label="Clear must do by date"
              >
                ×
              </button>
            )}
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Target date</label>
          <div className="relative">
            <input
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 pr-8"
            />
            {targetDate !== '' && (
              <button
                type="button"
                onClick={() => setTargetDate('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 leading-none"
                aria-label="Clear target date"
              >
                ×
              </button>
            )}
          </div>
        </div>
      </div>

      {priorityEligible && (
        <div className="flex items-center gap-3 py-1 flex-wrap">
          <span className="text-sm font-medium text-gray-700">Priority</span>
          <div className="inline-flex rounded-lg border border-gray-300 overflow-hidden text-xs font-medium">
            {(['normal', 'medium', 'high'] as const).map((tier, idx) => (
              <button
                key={tier}
                type="button"
                onClick={() => setPriority(tier)}
                className={`px-3 py-1.5 capitalize transition-colors ${idx > 0 ? 'border-l border-gray-300' : ''} ${
                  priority === tier
                    ? tier === 'high'
                      ? 'bg-orange-500 text-white'
                      : tier === 'medium'
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-600 text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                {tier}
              </button>
            ))}
          </div>
          <span className="text-xs text-orange-500 font-medium">
            ↑ High/Medium shown above the line in Overdue / Today / Tomorrow / Day After Tomorrow / Monday
          </span>
        </div>
      )}

      {boards.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Board</label>
          <select
            value={boardId}
            onChange={(e) => setBoardId(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          >
            {boards.map((board) => (
              <option key={board.id} value={board.id}>
                {board.name}
              </option>
            ))}
          </select>
          {movingBoard && (
            <p className="mt-1.5 text-xs text-amber-600">
              Moving to a different board will clear this task's labels.
            </p>
          )}
        </div>
      )}

      <div>
        {labelsLoading ? (
          <p className="text-xs text-gray-400">Loading labels…</p>
        ) : (
          <div className="space-y-3">
            {CATEGORY_ORDER.map((cat) => {
              const catLabels = [...(labelsByCategory[cat] ?? [])].sort((a, b) =>
                a.value.localeCompare(b.value)
              );
              return (
                <div key={cat}>
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-xs font-semibold text-gray-500 tracking-wide">
                      {CATEGORY_DISPLAY_NAMES[cat]}
                    </p>
                    {onCreateLabel && !addingTag && (
                      <button
                        type="button"
                        onClick={() => setAddingTag(true)}
                        className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                      >
                        + Add
                      </button>
                    )}
                  </div>

                  {addingTag && (
                    <div className="mb-2">
                      <div className="flex gap-1.5 items-center">
                        <input
                          autoFocus
                          type="text"
                          value={newTagValue}
                          onChange={(e) => setNewTagValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddTag();
                            } else if (e.key === 'Escape') {
                              cancelAddTag();
                            }
                          }}
                          placeholder="New tag"
                          className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        />
                        <button
                          type="button"
                          onClick={handleAddTag}
                          disabled={addTagBusy || !newTagValue.trim()}
                          className="text-xs bg-indigo-600 text-white rounded-lg px-3 py-1.5 font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          Add
                        </button>
                        <button
                          type="button"
                          onClick={cancelAddTag}
                          className="text-xs text-gray-500 hover:text-gray-700 font-medium px-2 py-1.5"
                        >
                          Cancel
                        </button>
                      </div>
                      {addTagError && (
                        <p className="mt-1 text-xs text-red-600">{addTagError}</p>
                      )}
                    </div>
                  )}

                  {catLabels.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {catLabels.map((label) => {
                        const selected = selectedLabelIds.has(label.id);
                        return (
                          <button
                            key={label.id}
                            type="button"
                            onClick={() => toggleLabel(label.id)}
                            className={`inline-flex items-center rounded-full text-xs px-3 py-1.5 font-medium border transition-colors ${
                              selected
                                ? 'bg-indigo-600 text-white border-indigo-600'
                                : 'bg-white text-gray-600 border-gray-300 hover:border-indigo-400'
                            }`}
                          >
                            {label.value}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={loading}
          className="flex-1 bg-indigo-600 text-white rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Saving...' : submitLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 bg-white text-gray-700 border border-gray-300 rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
