import { useNavigate } from 'react-router-dom';
import type { Task } from '../api/tasks';
import { completeTask, deleteTask } from '../api/tasks';
import { LabelBadge } from './LabelBadge';

interface TaskCardProps {
  task: Task;
  onRefresh: () => void;
}

function today0(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function isOverdue(dateStr: string | null): boolean {
  if (!dateStr) return false;
  return new Date(dateStr + 'T00:00:00') < today0();
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function TaskCard({ task, onRefresh }: TaskCardProps) {
  const navigate = useNavigate();
  const mustOverdue = isOverdue(task.must_do_by);

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
      className="bg-white border border-gray-200 rounded-lg p-4 cursor-pointer hover:shadow-md transition-shadow"
      onClick={() => navigate(`/tasks/${task.id}`)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-gray-900 font-medium text-sm truncate">{task.title}</h3>
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
          {task.labels.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {task.labels.map((label) => (
                <LabelBadge key={label.id} label={label} small />
              ))}
            </div>
          )}
        </div>

        {task.state === 'pending' && (
          <div className="flex items-center gap-1 shrink-0">
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
    </div>
  );
}
