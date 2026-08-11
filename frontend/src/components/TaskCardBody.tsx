import { useEffect, useRef, type ReactNode } from 'react';
import type { Task, Label, PriorityTier } from '../api/tasks';
import { formatDate, isOverdue, shouldShowTargetDate, bothDatesSetAndDistinct } from '../utils/taskDateUtils';

type DateFieldName = 'must_do_by' | 'target_date';

const TIER_ACCENT: Record<PriorityTier, { button: string }> = {
  high: { button: 'bg-orange-50 hover:bg-orange-100 text-orange-600' },
  medium: { button: 'bg-blue-50 hover:bg-blue-100 text-blue-600' },
  normal: { button: 'bg-gray-50 hover:bg-gray-100 text-gray-500' },
};

interface TaskCardBodyProps {
  task: Task;
  dateDisplay:
    | { mode: 'split'; mustOverdue: boolean }
    | { mode: 'effective'; effectiveDate: string | null };
  onPriorityStep?: (steps: number) => void;
  renderLabels: (labels: Label[]) => ReactNode;
  onEdit: () => void;
  onComplete: () => void;
  onDelete: () => void;
  editingDateField: DateFieldName | 'both' | null;
  onDateFieldClick: (field: DateFieldName | 'both') => void;
  onDateFieldCancel: () => void;
  onDateChange: (field: DateFieldName, value: string | null) => Promise<void>;
}

function DateInput({
  field,
  value,
  className,
  onDateChange,
  onCancel,
}: {
  field: DateFieldName;
  value: string | null;
  className: string;
  onDateChange: (field: DateFieldName, value: string | null) => Promise<void>;
  onCancel: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const input = inputRef.current;
    if (input && typeof input.showPicker === 'function') {
      try {
        input.showPicker();
      } catch {
        // Best-effort UX polish only — input still has focus and its native
        // calendar affordance is clickable even if showPicker() throws here.
      }
    }
  }, []);

  return (
    <input
      ref={inputRef}
      type="date"
      autoFocus
      defaultValue={value ?? ''}
      className={className}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => {
        e.stopPropagation();
        onDateChange(field, e.target.value || null);
      }}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Escape') onCancel();
      }}
      onBlur={(e) => { e.stopPropagation(); onCancel(); }}
    />
  );
}

function DateFieldLine({
  field,
  editing,
  value,
  label,
  overdue,
  buttonClassName,
  inputClassName,
  onFieldClick,
  onDateChange,
  onCancel,
}: {
  field: DateFieldName;
  editing: boolean;
  value: string;
  label: string;
  overdue: boolean;
  buttonClassName: string;
  inputClassName: string;
  onFieldClick: (field: DateFieldName) => void;
  onDateChange: (field: DateFieldName, value: string | null) => Promise<void>;
  onCancel: () => void;
}) {
  if (editing) {
    return (
      <div className={inputClassName}>
        {overdue ? `Overdue · ${label}: ` : `${label}: `}
        <DateInput field={field} value={value} className="ml-1" onDateChange={onDateChange} onCancel={onCancel} />
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onFieldClick(field); }}
      onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); onCancel(); } }}
      className={`${buttonClassName} block text-left underline-offset-2 hover:underline`}
    >
      {overdue ? `Overdue · ${label}: ` : `${label}: `}
      {formatDate(value)}
    </button>
  );
}

export function TaskCardBody({
  task,
  dateDisplay,
  onPriorityStep,
  renderLabels,
  onEdit,
  onComplete,
  onDelete,
  editingDateField,
  onDateFieldClick,
  onDateFieldCancel,
  onDateChange,
}: TaskCardBodyProps) {
  const titleEl = (
    <h3 className="text-sm font-medium text-gray-800 line-clamp-2 leading-snug mb-2">
      {task.title}
    </h3>
  );

  let dateEl: ReactNode;
  if (dateDisplay.mode === 'split') {
    dateEl = (
      <>
        {task.must_do_by && (
          <DateFieldLine
            field="must_do_by"
            editing={editingDateField === 'must_do_by'}
            value={task.must_do_by}
            label="Must do"
            overdue={dateDisplay.mustOverdue}
            buttonClassName={`text-xs mt-1 ${dateDisplay.mustOverdue ? 'text-red-600 font-medium' : 'text-gray-500'}`}
            inputClassName={`text-xs mt-1 ${dateDisplay.mustOverdue ? 'text-red-600 font-medium' : 'text-gray-500'}`}
            onFieldClick={onDateFieldClick}
            onDateChange={onDateChange}
            onCancel={onDateFieldCancel}
          />
        )}
        {shouldShowTargetDate(task) && (
          <DateFieldLine
            field="target_date"
            editing={editingDateField === 'target_date'}
            value={task.target_date}
            label="Target"
            overdue={false}
            buttonClassName="text-xs mt-0.5 text-gray-400"
            inputClassName="text-xs mt-0.5 text-gray-400"
            onFieldClick={onDateFieldClick}
            onDateChange={onDateChange}
            onCancel={onDateFieldCancel}
          />
        )}
      </>
    );
  } else if (editingDateField) {
    // Both-fields-set case (or a field already selected mid-edit): show each
    // set field as its own line, same layout 'split' mode uses, so the user
    // picks which field to change instead of the badge guessing for them.
    dateEl = (
      <>
        {task.must_do_by && (
          <DateFieldLine
            field="must_do_by"
            editing={editingDateField === 'must_do_by'}
            value={task.must_do_by}
            label="Must do"
            overdue={isOverdue(task.must_do_by)}
            buttonClassName={`text-xs mt-1 ${isOverdue(task.must_do_by) ? 'text-red-600 font-medium' : 'text-gray-500'}`}
            inputClassName={`text-xs mt-1 ${isOverdue(task.must_do_by) ? 'text-red-600 font-medium' : 'text-gray-500'}`}
            onFieldClick={onDateFieldClick}
            onDateChange={onDateChange}
            onCancel={onDateFieldCancel}
          />
        )}
        {shouldShowTargetDate(task) && (
          <DateFieldLine
            field="target_date"
            editing={editingDateField === 'target_date'}
            value={task.target_date}
            label="Target"
            overdue={false}
            buttonClassName="text-xs mt-0.5 text-gray-400"
            inputClassName="text-xs mt-0.5 text-gray-400"
            onFieldClick={onDateFieldClick}
            onDateChange={onDateChange}
            onCancel={onDateFieldCancel}
          />
        )}
      </>
    );
  } else {
    dateEl = dateDisplay.effectiveDate && (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDateFieldClick(bothDatesSetAndDistinct(task) ? 'both' : task.must_do_by ? 'must_do_by' : 'target_date');
        }}
        className={`inline-block text-xs px-1.5 py-0.5 rounded underline-offset-2 hover:underline ${
          isOverdue(dateDisplay.effectiveDate) ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-500'
        }`}
      >
        {formatDate(dateDisplay.effectiveDate)}
      </button>
    );
  }

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
      {onPriorityStep && (
        <div className="flex items-center gap-0.5 shrink-0">
          {(task.priority === 'normal'
            ? [{ steps: 1, dir: 'up' as const, double: false, toTier: 'medium' as const }, { steps: 2, dir: 'up' as const, double: true, toTier: 'high' as const }]
            : task.priority === 'medium'
              ? [{ steps: 1, dir: 'up' as const, double: false, toTier: 'high' as const }, { steps: -1, dir: 'down' as const, double: false, toTier: 'normal' as const }]
              : [{ steps: -1, dir: 'down' as const, double: false, toTier: 'medium' as const }, { steps: -2, dir: 'down' as const, double: true, toTier: 'normal' as const }]
          ).map(({ steps, dir, double, toTier }) => (
            <button
              key={steps}
              onClick={(e) => { e.stopPropagation(); onPriorityStep(steps); }}
              className={`p-1 rounded-full transition-colors ${TIER_ACCENT[toTier].button}`}
              title={`Priority: ${task.priority} — ${dir === 'up' ? 'raise' : 'lower'} to ${toTier}`}
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                {dir === 'up' ? (
                  double
                    ? <><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 18.75l7.5-7.5 7.5 7.5" /><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l7.5-7.5 7.5 7.5" /></>
                    : <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
                ) : (
                  double
                    ? <><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 5.25l7.5 7.5 7.5-7.5" /><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 11.25l7.5 7.5 7.5-7.5" /></>
                    : <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                )}
              </svg>
            </button>
          ))}
        </div>
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

  return (
    <>
      {actionsEl && <div className="flex justify-end mb-1.5">{actionsEl}</div>}
      {titleEl}
      {dateEl}
      {renderLabels(task.labels)}
      {linksEl}
    </>
  );
}
