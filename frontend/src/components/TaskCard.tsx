import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Task, Label } from '../api/tasks';
import { completeTask, deleteTask } from '../api/tasks';
import { LabelBadge } from './LabelBadge';
import { TaskQuickEdit } from './TaskQuickEdit';
import { formatDate, isOverdue } from '../utils/taskDateUtils';

interface TaskCardProps {
  task: Task;
  labels: Label[];
  onRefresh: () => void;
  draggable?: boolean;
  onTogglePriority?: () => void;
}

const LABEL_CATEGORY_ORDER: Record<string, number> = { mode: 0, type: 1 };

export function TaskCard({ task, labels, onRefresh, draggable: isDraggable = false, onTogglePriority }: TaskCardProps) {
  const navigate = useNavigate();
  const mustOverdue = isOverdue(task.must_do_by);
  const [dragging, setDragging] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const sortedLabels = [...task.labels]
    .sort((a, b) => (LABEL_CATEGORY_ORDER[a.category] ?? 3) - (LABEL_CATEGORY_ORDER[b.category] ?? 3));

  function startEdit(e: React.MouseEvent) {
    e.stopPropagation();
    setIsEditing(true);
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
        <TaskQuickEdit
          task={task}
          labels={labels}
          onSaved={() => { onRefresh(); setIsEditing(false); }}
          onCancel={() => setIsEditing(false)}
        />
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
            {task.links.length > 0 && (
              <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
                {task.links.map((link) => (
                  <a
                    key={link.id}
                    href={link.url}
                    title={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-xs text-indigo-600 hover:text-indigo-800 hover:underline truncate max-w-[10rem]"
                  >
                    🔗 {link.description}
                  </a>
                ))}
              </div>
            )}
          </div>

          {task.state === 'pending' && (
            <div className="flex items-center gap-1 shrink-0">
              {onTogglePriority && (
                <button
                  onClick={(e) => { e.stopPropagation(); onTogglePriority(); }}
                  className={`p-1.5 rounded-full transition-colors ${
                    task.is_high_priority
                      ? 'bg-orange-50 hover:bg-orange-100 text-orange-500'
                      : 'bg-gray-50 hover:bg-gray-100 text-gray-400'
                  }`}
                  title={task.is_high_priority ? 'Remove high priority' : 'Set high priority'}
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill={task.is_high_priority ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                  </svg>
                </button>
              )}
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
