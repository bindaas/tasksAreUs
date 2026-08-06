import type { ReactNode } from 'react';
import type { Task, Label } from '../api/tasks';
import { formatDate, isOverdue } from '../utils/taskDateUtils';

interface TaskCardBodyProps {
  task: Task;
  dateDisplay:
    | { mode: 'split'; mustOverdue: boolean }
    | { mode: 'effective'; effectiveDate: string | null };
  layout: 'inline' | 'stacked';
  priorityBadge: 'toggle' | 'static';
  onTogglePriority?: () => void;
  renderLabels: (labels: Label[]) => ReactNode;
  onEdit: () => void;
  onComplete: () => void;
  onDelete: () => void;
}

export function TaskCardBody({
  task,
  dateDisplay,
  layout,
  priorityBadge,
  onTogglePriority,
  renderLabels,
  onEdit,
  onComplete,
  onDelete,
}: TaskCardBodyProps) {
  const priorityIndicator = task.is_high_priority
    ? priorityBadge === 'static'
      ? (
        <span className="inline-block text-xs font-semibold text-amber-600 bg-amber-50 rounded px-1.5 py-0.5">
          ★ High
        </span>
      )
      : (
        <span className="inline-flex items-center text-[10px] font-semibold uppercase tracking-wide text-orange-600 bg-orange-50 border border-orange-200 rounded px-1.5 py-0.5 shrink-0">
          High
        </span>
      )
    : null;

  const titleEl = (
    <h3
      className={
        layout === 'stacked'
          ? 'text-sm font-medium text-gray-800 line-clamp-2 leading-snug mb-2'
          : 'text-gray-900 font-medium text-sm leading-snug'
      }
    >
      {task.title}
    </h3>
  );

  const dateEl =
    dateDisplay.mode === 'split' ? (
      <>
        {task.must_do_by && (
          <p className={`text-xs mt-1 ${dateDisplay.mustOverdue ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
            {dateDisplay.mustOverdue ? 'Overdue · Must do: ' : 'Must do: '}
            {formatDate(task.must_do_by)}
          </p>
        )}
        {task.target_date && task.target_date !== task.must_do_by && (
          <p className="text-xs mt-0.5 text-gray-400">Target: {formatDate(task.target_date)}</p>
        )}
      </>
    ) : (
      dateDisplay.effectiveDate && (
        <span
          className={`inline-block text-xs px-1.5 py-0.5 rounded ${
            isOverdue(dateDisplay.effectiveDate) ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-500'
          }`}
        >
          {formatDate(dateDisplay.effectiveDate)}
        </span>
      )
    );

  const linksEl = task.links.length > 0 && (
    <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
      {task.links.map((link) => (
        <a
          key={link.id}
          href={link.url}
          title={link.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="text-xs text-indigo-600 hover:text-indigo-800 hover:underline break-words max-w-full"
        >
          🔗 {link.description}
        </a>
      ))}
    </div>
  );

  // Focused/Today/Tomorrow's backend queries (get_boards_with_tasks, shared by
  // focused_view_service.py and day_view.py) currently only ever return pending
  // tasks, so this gate is presently redundant for the 'stacked' layout — but
  // must be revisited if that query is ever loosened to include other states.
  const actionsEl = task.state === 'pending' && (
    <div className="flex items-center gap-1 shrink-0">
      {priorityBadge === 'toggle' && onTogglePriority && (
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
        onClick={(e) => { e.stopPropagation(); onEdit(); }}
        className="p-1.5 rounded-full bg-gray-50 hover:bg-gray-100 text-gray-500 transition-colors"
        title="Edit"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 012.828 2.828L11.828 15.828a2 2 0 01-1.414.586H8v-2.414a2 2 0 01.586-1.414z" />
        </svg>
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); onComplete(); }}
        className="p-1.5 rounded-full bg-green-50 hover:bg-green-100 text-green-600 transition-colors"
        title="Complete"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        className="p-1.5 rounded-full bg-red-50 hover:bg-red-100 text-red-600 transition-colors"
        title="Delete"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );

  if (layout === 'stacked') {
    return (
      <>
        {priorityIndicator && <div className="flex mb-1.5">{priorityIndicator}</div>}
        {titleEl}
        {dateEl}
        {renderLabels(task.labels)}
        {linksEl}
        {actionsEl && <div className="flex justify-end mt-2">{actionsEl}</div>}
      </>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <div className="flex-1 min-w-0 flex items-center gap-1.5 flex-wrap">
          {priorityIndicator}
          {titleEl}
        </div>
        {actionsEl}
      </div>
      {dateEl}
      {renderLabels(task.labels)}
      {linksEl}
    </>
  );
}
