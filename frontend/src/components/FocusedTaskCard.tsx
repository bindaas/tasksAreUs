import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Task } from '../api/tasks';
import { getEffectiveDate, formatDate, isOverdue } from '../utils/taskDateUtils';
import { TaskQuickEdit } from './TaskQuickEdit';

const LABEL_COLORS: Record<string, string> = {
  mode: 'bg-green-100 text-green-700',
  type: 'bg-purple-100 text-purple-700',
};

export function FocusedTaskCard({ task, boardColor, onRefresh }: { task: Task; boardColor: string; onRefresh: () => void }) {
  const navigate = useNavigate();
  const effectiveDate = getEffectiveDate(task);
  const [isEditing, setIsEditing] = useState(false);

  return (
    <div
      onClick={() => { if (!isEditing) navigate(`/tasks/${task.id}`); }}
      className={`bg-white rounded-lg border border-gray-200 shadow-sm transition-shadow overflow-hidden ${
        isEditing ? 'border-indigo-300 shadow-md' : 'cursor-pointer hover:shadow-md'
      }`}
      style={{ borderLeftColor: boardColor, borderLeftWidth: 4 }}
    >
      <div className="p-3">
        {isEditing ? (
          <TaskQuickEdit
            task={task}
            onSaved={() => { onRefresh(); setIsEditing(false); }}
            onCancel={() => setIsEditing(false)}
          />
        ) : (
          <>
            <div className="flex items-start justify-between gap-2 mb-1.5">
              {task.is_high_priority ? (
                <span className="inline-block text-xs font-semibold text-amber-600 bg-amber-50 rounded px-1.5 py-0.5">
                  ★ High
                </span>
              ) : <span />}
              <button
                onClick={(e) => { e.stopPropagation(); setIsEditing(true); }}
                className="p-1 -m-1 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors shrink-0"
                title="Edit"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 012.828 2.828L11.828 15.828a2 2 0 01-1.414.586H8v-2.414a2 2 0 01.586-1.414z" />
                </svg>
              </button>
            </div>
            <p className="text-sm font-medium text-gray-800 line-clamp-2 leading-snug mb-2">
              {task.title}
            </p>
            {effectiveDate && (
              <span
                className={`inline-block text-xs px-1.5 py-0.5 rounded ${
                  isOverdue(effectiveDate)
                    ? 'bg-red-50 text-red-600'
                    : 'bg-gray-100 text-gray-500'
                }`}
              >
                {formatDate(effectiveDate)}
              </span>
            )}
            {task.labels.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {task.labels.map((label) => (
                  <span
                    key={label.id}
                    className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${LABEL_COLORS[label.category] ?? 'bg-gray-100 text-gray-600'}`}
                  >
                    {label.value}
                  </span>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
