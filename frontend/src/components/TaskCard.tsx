import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Task, Label } from '../api/tasks';
import { completeTask, deleteTask, updateTask } from '../api/tasks';
import { LabelBadge } from './LabelBadge';
import { formatDate, isOverdue } from '../utils/taskDateUtils';

interface TaskCardProps {
  task: Task;
  labels: Label[];
  onRefresh: () => void;
  draggable?: boolean;
}

const LABEL_CATEGORY_ORDER: Record<string, number> = { mode: 0, type: 1, frequency: 2 };
const EDIT_CATEGORY_ORDER = ['mode', 'type', 'frequency'] as const;

export function TaskCard({ task, labels, onRefresh, draggable: isDraggable = false }: TaskCardProps) {
  const navigate = useNavigate();
  const mustOverdue = isOverdue(task.must_do_by);
  const [dragging, setDragging] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editLabelIds, setEditLabelIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const sortedLabels = [...task.labels].sort(
    (a, b) => (LABEL_CATEGORY_ORDER[a.category] ?? 3) - (LABEL_CATEGORY_ORDER[b.category] ?? 3)
  );

  const labelsByCategory = useMemo(
    () => labels.reduce<Record<string, Label[]>>((acc, label) => {
      if (!acc[label.category]) acc[label.category] = [];
      acc[label.category].push(label);
      return acc;
    }, {}),
    [labels]
  );

  function startEdit(e: React.MouseEvent) {
    e.stopPropagation();
    setEditTitle(task.title);
    setEditLabelIds(new Set(task.labels.map((l) => l.id)));
    setIsEditing(true);
  }

  function cancelEdit(e: React.MouseEvent) {
    e.stopPropagation();
    setIsEditing(false);
  }

  async function saveEdit(e: React.MouseEvent | React.KeyboardEvent) {
    e.stopPropagation();
    if (!editTitle.trim()) return;
    setSaving(true);
    try {
      await updateTask(task.id, {
        title: editTitle.trim(),
        label_ids: Array.from(editLabelIds),
      });
      onRefresh();
      setIsEditing(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  function toggleEditLabel(id: string) {
    setEditLabelIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleComplete(e: React.MouseEvent) {
    e.stopPropagation();
    try {
      await completeTask(task.id);
      onRefresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to complete task');
    }
  }

  async function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm('Delete this task?')) return;
    try {
      await deleteTask(task.id);
      onRefresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete task');
    }
  }

  return (
    <div
      className={`bg-white border border-gray-200 rounded-lg p-3 transition-shadow select-none ${
        isEditing ? 'border-indigo-300 shadow-md' : 'cursor-pointer hover:shadow-md'
      } ${dragging ? 'opacity-40' : ''}`}
      draggable={!isEditing && isDraggable && task.state === 'pending'}
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', task.id);
        e.dataTransfer.effectAllowed = 'move';
        setDragging(true);
      }}
      onDragEnd={() => setDragging(false)}
      onClick={() => { if (!isEditing) navigate(`/tasks/${task.id}`); }}
    >
      {isEditing ? (
        <div onClick={(e) => e.stopPropagation()}>
          <input
            autoFocus
            type="text"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') saveEdit(e);
              if (e.key === 'Escape') cancelEdit(e as unknown as React.MouseEvent);
            }}
            className="w-full border border-gray-300 rounded px-2 py-1 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <div className="space-y-1.5 mb-3">
            {EDIT_CATEGORY_ORDER.map((cat) => {
              const catLabels = labelsByCategory[cat] ?? [];
              if (!catLabels.length) return null;
              return (
                <div key={cat} className="flex flex-wrap gap-1">
                  {catLabels.map((label) => {
                    const selected = editLabelIds.has(label.id);
                    return (
                      <button
                        key={label.id}
                        type="button"
                        onClick={() => toggleEditLabel(label.id)}
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
            })}
          </div>
          <div className="flex gap-2">
            <button
              onClick={saveEdit}
              disabled={saving || !editTitle.trim()}
              className="flex-1 bg-indigo-600 text-white rounded px-2 py-1 text-xs font-medium hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button
              onClick={cancelEdit}
              className="flex-1 bg-white text-gray-700 border border-gray-300 rounded px-2 py-1 text-xs font-medium hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              {task.is_high_priority && (
                <span className="inline-flex items-center text-[10px] font-semibold uppercase tracking-wide text-orange-600 bg-orange-50 border border-orange-200 rounded px-1.5 py-0.5 shrink-0">
                  High
                </span>
              )}
              <h3 className="text-gray-900 font-medium text-sm leading-snug">{task.title}</h3>
            </div>
            {task.must_do_by && (
              <p className={`text-xs mt-1 ${mustOverdue ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                {mustOverdue ? 'Overdue · Must do: ' : 'Must do: '}
                {formatDate(task.must_do_by)}
              </p>
            )}
            {task.target_date && task.target_date !== task.must_do_by && (
              <p className="text-xs mt-0.5 text-gray-400">
                Target: {formatDate(task.target_date)}
              </p>
            )}
            {sortedLabels.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {sortedLabels.map((label) => (
                  <LabelBadge key={label.id} label={label} small />
                ))}
              </div>
            )}
          </div>

          {task.state === 'pending' && (
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={startEdit}
                className="p-1.5 rounded-full bg-gray-50 hover:bg-gray-100 text-gray-500 transition-colors"
                title="Edit"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 012.828 2.828L11.828 15.828a2 2 0 01-1.414.586H8v-2.414a2 2 0 01.586-1.414z" />
                </svg>
              </button>
              <button
                onClick={handleComplete}
                className="p-1.5 rounded-full bg-green-50 hover:bg-green-100 text-green-600 transition-colors"
                title="Complete"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </button>
              <button
                onClick={handleDelete}
                className="p-1.5 rounded-full bg-red-50 hover:bg-red-100 text-red-600 transition-colors"
                title="Delete"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
