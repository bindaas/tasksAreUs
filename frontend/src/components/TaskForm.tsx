import { useState, useEffect, useRef } from 'react';
import type { Task, CreateTaskBody, UpdateTaskBody } from '../api/tasks';
import type { Label, TaskLink } from '../api/tasks';
import type { Board } from '../api/boards';
import { dateOnly } from '../utils/taskDateUtils';
import { isFormHighPriorityEligible } from '../utils/taskPriority';
import { isValidLinkUrl, MAX_TASK_LINKS } from '../utils/taskLinks';

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
  onSubmit: (data: CreateTaskBody | UpdateTaskBody) => Promise<void>;
  onCancel: () => void;
  submitLabel?: string;
  loading?: boolean;
}

type LabelCategory = 'mode' | 'type';

const CATEGORY_ORDER: LabelCategory[] = ['mode', 'type'];

export function TaskForm({
  initialValues,
  labels,
  labelsLoading = false,
  boards,
  defaultBoardId,
  onBoardIdChange,
  onSubmit,
  onCancel,
  submitLabel = 'Save',
  loading = false,
}: TaskFormProps) {
  const [title, setTitle] = useState(initialValues?.title ?? '');
  const [notes, setNotes] = useState(initialValues?.notes ?? '');
  const [mustDoBy, setMustDoBy] = useState(initialValues?.must_do_by ?? '');
  const [targetDate, setTargetDate] = useState(initialValues?.target_date ?? '');
  const [isHighPriority, setIsHighPriority] = useState(initialValues?.is_high_priority ?? false);
  const [selectedLabelIds, setSelectedLabelIds] = useState<Set<string>>(
    new Set(initialValues?.labels?.map((l) => l.id) ?? [])
  );
  const [links, setLinks] = useState<TaskLink[]>(initialValues?.links ?? []);
  const [boardId, setBoardId] = useState(initialValues?.board_id ?? defaultBoardId ?? '');
  const [error, setError] = useState<string | null>(null);

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

  const _tom = new Date();
  _tom.setDate(_tom.getDate() + 1);
  const tomorrowStr = dateOnly(_tom);
  const highPriorityEligible = isFormHighPriorityEligible(mustDoBy, targetDate, tomorrowStr);

  const labelsByCategory = labels.reduce<Record<LabelCategory, Label[]>>(
    (acc, label) => {
      if (label.category === 'mode' || label.category === 'type') {
        acc[label.category].push(label);
      }
      return acc;
    },
    { mode: [], type: [] }
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
      is_high_priority: highPriorityEligible && isHighPriority,
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
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={7}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
          placeholder="Any additional details..."
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="block text-sm font-medium text-gray-700">Links</label>
          <button
            type="button"
            onClick={addLinkRow}
            disabled={links.length >= MAX_TASK_LINKS}
            className="text-xs font-medium text-indigo-600 hover:text-indigo-800 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            + Add link
          </button>
        </div>
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
                <input
                  type="text"
                  value={link.url}
                  onChange={(e) => updateLinkRow(link.id, 'url', e.target.value)}
                  placeholder="https://..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
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

      {highPriorityEligible && (
        <div className="flex items-center gap-3 py-1">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={isHighPriority}
              onChange={(e) => setIsHighPriority(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-orange-500 focus:ring-orange-400 cursor-pointer"
            />
            <span className="text-sm font-medium text-gray-700">High priority</span>
          </label>
          <span className="text-xs text-orange-500 font-medium">
            ↑ shown above the line in Overdue / Today / Tomorrow
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
        <label className="block text-sm font-medium text-gray-700 mb-3">Labels</label>
        {labelsLoading ? (
          <p className="text-xs text-gray-400">Loading labels…</p>
        ) : (
        <div className="space-y-3">
          {CATEGORY_ORDER.map((cat) => {
            const catLabels = labelsByCategory[cat];
            if (!catLabels || catLabels.length === 0) return null;
            return (
              <div key={cat}>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 capitalize">
                  {cat}
                </p>
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
