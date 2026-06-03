import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getTask, updateTask, deleteTask, completeTask, createTask, listTasks } from '../api/tasks';
import type { Task, CreateTaskBody, UpdateTaskBody } from '../api/tasks';
import { useLabels } from '../hooks/useLabels';
import { useSettings } from '../hooks/useSettings';
import { TaskForm } from '../components/TaskForm';
import { useFilter } from '../context/FilterContext';
import { dateOnly, getColumn } from '../utils/taskDateUtils';
import { isHighPriorityEligible } from '../utils/taskPriority';

export function TaskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = id === 'new';

  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { labels, loading: labelsLoading } = useLabels();
  const { selectedLabelIds } = useFilter();
  const { highPriorityDailyLimit } = useSettings();
  const [allPendingTasks, setAllPendingTasks] = useState<Task[]>([]);

  useEffect(() => {
    if (isNew) return;
    let cancelled = false;

    async function fetch() {
      setLoading(true);
      setError(null);
      try {
        const t = await getTask(id!);
        if (!cancelled) setTask(t);
        if (!cancelled && t.is_high_priority) {
          const { tasks: pending } = await listTasks('pending');
          if (!cancelled) setAllPendingTasks(pending);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load task');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetch();
    return () => { cancelled = true; };
  }, [id, isNew]);

  const highPriorityWarning = useMemo(() => {
    if (!task?.is_high_priority) return null;
    const now = new Date();
    const tom = new Date(now);
    tom.setDate(tom.getDate() + 1);
    const todayStr = dateOnly(now);
    const tomorrowStr = dateOnly(tom);
    const col = getColumn(task, todayStr, tomorrowStr);
    if (!isHighPriorityEligible(col) && col !== 'overdue') return null;
    const highInCol = allPendingTasks.filter(
      (t) => t.is_high_priority && getColumn(t, todayStr, tomorrowStr) === col
    );
    if (highInCol.length >= highPriorityDailyLimit) {
      return `${highInCol.length} of ${highPriorityDailyLimit} high-priority tasks for ${col === 'overdue' ? 'overdue' : col} — limit exceeded.`;
    }
    return null;
  }, [task, allPendingTasks, highPriorityDailyLimit]);

  async function handleSubmit(data: CreateTaskBody | UpdateTaskBody) {
    setSaving(true);
    setError(null);
    try {
      if (isNew) {
        await createTask(data as CreateTaskBody);
      } else {
        await updateTask(id!, data as UpdateTaskBody);
      }
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save task');
      setSaving(false);
    }
  }

  async function handleComplete() {
    if (!task) return;
    setSaving(true);
    try {
      await completeTask(task.id);
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to complete task');
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!task) return;
    if (!confirm('Are you sure you want to delete this task?')) return;
    setSaving(true);
    try {
      await deleteTask(task.id);
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete task');
      setSaving(false);
    }
  }

  const pageLoading = loading || labelsLoading;

  return (
    <div className="p-4 max-w-xl mx-auto">
      {/* Back button */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-5"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Back
      </button>

      <h2 className="text-xl font-bold text-gray-900 mb-6">
        {isNew ? 'New Task' : 'Edit Task'}
      </h2>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm mb-4">
          {error}
        </div>
      )}

      {highPriorityWarning && (
        <div className="bg-amber-50 border border-amber-200 text-amber-700 rounded-lg px-4 py-3 text-sm mb-4 flex items-start gap-2">
          <span className="mt-0.5">⚠</span>
          <span>{highPriorityWarning}</span>
        </div>
      )}

      {pageLoading && (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
        </div>
      )}

      {!pageLoading && (isNew || task) && (
        <>
          <TaskForm
            initialValues={
              isNew
                ? { labels: labels.filter((l) => selectedLabelIds.has(l.id)) }
                : task ?? undefined
            }
            labels={labels}
            onSubmit={handleSubmit}
            onCancel={() => navigate(-1)}
            submitLabel={isNew ? 'Create Task' : 'Save Changes'}
            loading={saving}
          />

          {!isNew && task && task.state === 'pending' && (
            <div className="mt-6 pt-6 border-t border-gray-200 space-y-3">
              <button
                onClick={handleComplete}
                disabled={saving}
                className="w-full bg-green-600 text-white rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Mark as Complete
              </button>
              <button
                onClick={handleDelete}
                disabled={saving}
                className="w-full bg-white text-red-600 border border-red-300 rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Delete Task
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
