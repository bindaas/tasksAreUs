import { useState, useEffect } from 'react';
import type { Task, Label } from '../api/tasks';
import { updateTask } from '../api/tasks';
import { listLabels } from '../api/labels';

const EDIT_CATEGORY_ORDER = ['type'] as const;

interface TaskQuickEditProps {
  task: Task;
  /** Already board-scoped labels, if the caller has them on hand. When omitted,
   * labels are fetched for task.board_id — needed by callers (e.g. Focused/Day
   * views) that group tasks across multiple boards and don't hold a single
   * board-scoped label list. */
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
    async function load() {
      setLabelsLoading(true);
      try {
        const result = await listLabels(undefined, task.board_id);
        if (!cancelled) setFetchedLabels(result.labels);
      } finally {
        if (!cancelled) setLabelsLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
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

  async function save(e: React.MouseEvent | React.KeyboardEvent) {
    e.stopPropagation();
    if (!title.trim()) return;
    setSaving(true);
    try {
      await updateTask(task.id, { title: title.trim(), label_ids: Array.from(labelIds) });
      onSaved();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save');
      setSaving(false);
    }
  }

  function cancel(e: React.MouseEvent) {
    e.stopPropagation();
    onCancel();
  }

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <input
        autoFocus
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') save(e);
          if (e.key === 'Escape') cancel(e as unknown as React.MouseEvent);
        }}
        className="w-full border border-gray-300 rounded px-2 py-1 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
      <div className="space-y-1.5 mb-3">
        {labelsLoading ? (
          <p className="text-xs text-gray-400">Loading labels…</p>
        ) : (
          EDIT_CATEGORY_ORDER.map((cat) => {
            const catLabels = labelsByCategory[cat] ?? [];
            if (!catLabels.length) return null;
            return (
              <div key={cat} className="flex flex-wrap gap-1">
                {catLabels.map((label) => {
                  const selected = labelIds.has(label.id);
                  return (
                    <button
                      key={label.id}
                      type="button"
                      onClick={() => toggleLabel(label.id)}
                      className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
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
            );
          })
        )}
      </div>
      <div className="flex gap-2">
        <button
          onClick={save}
          disabled={saving || !title.trim()}
          className="flex-1 bg-indigo-600 text-white rounded px-2 py-1 text-xs font-medium hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button
          onClick={cancel}
          className="flex-1 bg-white text-gray-700 border border-gray-300 rounded px-2 py-1 text-xs font-medium hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
