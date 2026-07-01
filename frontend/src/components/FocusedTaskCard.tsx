import { useNavigate } from 'react-router-dom';
import type { Task } from '../api/tasks';
import { getEffectiveDate, formatDate, isOverdue } from '../utils/taskDateUtils';

const LABEL_COLORS: Record<string, string> = {
  mode: 'bg-green-100 text-green-700',
  type: 'bg-purple-100 text-purple-700',
};

export function FocusedTaskCard({ task, boardColor }: { task: Task; boardColor: string }) {
  const navigate = useNavigate();
  const effectiveDate = getEffectiveDate(task);

  return (
    <div
      onClick={() => navigate(`/tasks/${task.id}`)}
      className="bg-white rounded-lg border border-gray-200 shadow-sm cursor-pointer hover:shadow-md transition-shadow overflow-hidden"
      style={{ borderLeftColor: boardColor, borderLeftWidth: 4 }}
    >
      <div className="p-3">
        {task.is_high_priority && (
          <span className="inline-block text-xs font-semibold text-amber-600 bg-amber-50 rounded px-1.5 py-0.5 mb-1.5">
            ★ High
          </span>
        )}
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
      </div>
    </div>
  );
}
