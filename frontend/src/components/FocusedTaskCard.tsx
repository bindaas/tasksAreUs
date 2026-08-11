import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Task } from '../api/tasks';
import { completeTask, deleteTask, updateTask } from '../api/tasks';
import { getEffectiveDate, getColumn, dateOnly } from '../utils/taskDateUtils';
import { isPriorityEligible, resolveShiftedPriorityTier, canAddHighPriority, highPriorityTasksInSameColumn } from '../utils/taskPriority';
import { TaskQuickEdit } from './TaskQuickEdit';
import { TaskCardBody } from './TaskCardBody';
import { PRIORITY_CARD_BG } from '../utils/priorityColor';

type DateFieldName = 'must_do_by' | 'target_date';

const LABEL_COLORS: Record<string, string> = {
  mode: 'bg-green-100 text-green-700',
  type: 'bg-purple-100 text-purple-700',
};

export function FocusedTaskCard({
  task,
  boardColor,
  onRefresh,
  tasksInView,
  highPriorityDailyLimit,
}: {
  task: Task;
  boardColor: string;
  onRefresh: () => void;
  tasksInView: Task[];
  highPriorityDailyLimit: number;
}) {
  const navigate = useNavigate();
  const effectiveDate = getEffectiveDate(task);
  const [isEditing, setIsEditing] = useState(false);
  const [editingDateField, setEditingDateField] = useState<DateFieldName | 'both' | null>(null);
  const [priorityError, setPriorityError] = useState<string | null>(null);

  const { today, tomorrow } = useMemo(() => {
    const now = new Date();
    const tom = new Date(now);
    tom.setDate(tom.getDate() + 1);
    return { today: dateOnly(now), tomorrow: dateOnly(tom) };
  }, []);
  const columnKey = useMemo(() => getColumn(task, today, tomorrow), [task, today, tomorrow]);
  const eligible = isPriorityEligible(columnKey);

  async function handlePriorityStep(steps: number) {
    const nextTier = resolveShiftedPriorityTier(task.priority, steps, columnKey);
    if (nextTier === task.priority) return;

    if (nextTier === 'high') {
      const highTasksSameColumn = highPriorityTasksInSameColumn(tasksInView, task, today, tomorrow);
      if (!canAddHighPriority(highTasksSameColumn, task, highPriorityDailyLimit)) {
        setPriorityError(`High priority is limited to ${highPriorityDailyLimit} tasks per day.`);
        return;
      }
    }

    try {
      await updateTask(task.id, { priority: nextTier });
      setPriorityError(null);
      onRefresh();
    } catch (err) {
      setPriorityError(err instanceof Error ? err.message : 'Failed to update priority');
    }
  }

  async function handleDateChange(field: DateFieldName, value: string | null) {
    try {
      await updateTask(task.id, { [field]: value });
      onRefresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update date');
    } finally {
      setEditingDateField(null);
    }
  }

  async function handleComplete() {
    try {
      await completeTask(task.id);
      onRefresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to complete task');
    }
  }

  async function handleDelete() {
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
      onClick={() => { if (!isEditing && !editingDateField) navigate(`/tasks/${task.id}`); }}
      className={`${isEditing ? 'bg-white' : PRIORITY_CARD_BG[task.priority]} rounded-lg border border-gray-200 shadow-sm transition-shadow overflow-hidden ${
        isEditing ? 'border-indigo-300 shadow-md' : 'cursor-pointer hover:shadow-md'
      }`}
      style={{ borderLeftColor: boardColor, borderLeftWidth: 4 }}
    >
      <div className="p-3">
        {isEditing ? (
          <TaskQuickEdit
            task={task}
            onSaved={() => { onRefresh(); setIsEditing(false); setEditingDateField(null); }}
            onCancel={() => { setIsEditing(false); setEditingDateField(null); }}
          />
        ) : (
          <>
            {priorityError && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="mb-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1"
              >
                {priorityError}
              </div>
            )}
            <TaskCardBody
              task={task}
              dateDisplay={{ mode: 'effective', effectiveDate }}
              onPriorityStep={eligible ? handlePriorityStep : undefined}
              editingDateField={editingDateField}
              onDateFieldClick={setEditingDateField}
              onDateFieldCancel={() => setEditingDateField(null)}
              onDateChange={handleDateChange}
              renderLabels={(labels) => {
                const sorted = [...labels].sort((a, b) => a.value.localeCompare(b.value));
                return sorted.length > 0 ? (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {sorted.map((label) => (
                      <span
                        key={label.id}
                        className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${LABEL_COLORS[label.category] ?? 'bg-gray-100 text-gray-600'}`}
                      >
                        {label.value}
                      </span>
                    ))}
                  </div>
                ) : null;
              }}
              onEdit={() => { setEditingDateField(null); setIsEditing(true); }}
              onComplete={handleComplete}
              onDelete={handleDelete}
            />
          </>
        )}
      </div>
    </div>
  );
}
