import { useState } from 'react';
import type { Task, CreateTaskBody, UpdateTaskBody } from '../api/tasks';
import type { Label } from '../api/tasks';
import { LabelBadge } from './LabelBadge';
import { dateOnly } from '../utils/taskDateUtils';
import { isFormHighPriorityEligible } from '../utils/taskPriority';

interface TaskFormProps {
  initialValues?: Partial<Task>;
  labels: Label[];
  onSubmit: (data: CreateTaskBody | UpdateTaskBody) => Promise<void>;
  onCancel: () => void;
  submitLabel?: string;
  loading?: boolean;
}

type LabelCategory = 'frequency' | 'mode' | 'type';

const CATEGORY_ORDER: LabelCategory[] = ['mode', 'type', 'frequency'];

export function TaskForm({
  initialValues,
  labels,
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
  const [error, setError] = useState<string | null>(null);

  const todayStr = dateOnly(new Date());
  const _tom = new Date();
  _tom.setDate(_tom.getDate() + 1);
  const tomorrowStr = dateOnly(_tom);
  const highPriorityEligible = isFormHighPriorityEligible(mustDoBy, targetDate, tomorrowStr);

  const labelsByCategory = labels.reduce<Record<LabelCategory, Label[]>>(
    (acc, label) => {
      const cat = label.category as LabelCategory;
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(label);
      return acc;
    },
    { frequency: [], mode: [], type: [] }
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
    setError(null);

    const isEditMode = !!initialValues;

    const data: CreateTaskBody | UpdateTaskBody = {
      title: title.trim(),
      label_ids: Array.from(selectedLabelIds),
      is_high_priority: highPriorityEligible && isHighPriority,
    };
    if (notes.trim()) data.notes = notes.trim();

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
          rows={3}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
          placeholder="Any additional details..."
        />
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

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">Labels</label>
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

        {selectedLabelIds.size > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {Array.from(selectedLabelIds).map((id) => {
              const label = labels.find((l) => l.id === id);
              if (!label) return null;
              return <LabelBadge key={id} label={label} />;
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
