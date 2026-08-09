import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Task } from '../api/tasks';
import { completeTask, deleteTask, updateTask } from '../api/tasks';
import { getEffectiveDate } from '../utils/taskDateUtils';
import { TaskQuickEdit } from './TaskQuickEdit';
import { TaskCardBody } from './TaskCardBody';

type DateFieldName = 'must_do_by' | 'target_date';

const LABEL_COLORS: Record<string, string> = {
  mode: 'bg-green-100 text-green-700',
  type: 'bg-purple-100 text-purple-700',
};

export function FocusedTaskCard({ task, boardColor, onRefresh }: { task: Task; boardColor: string; onRefresh: () => void }) {
  const navigate = useNavigate();
  const effectiveDate = getEffectiveDate(task);
  const [isEditing, setIsEditing] = useState(false);
  const [editingDateField, setEditingDateField] = useState<DateFieldName | 'both' | null>(null);

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
      className={`bg-white rounded-lg border border-gray-200 shadow-sm transition-shadow overflow-hidden ${
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
          <TaskCardBody
            task={task}
            layout="stacked"
            dateDisplay={{ mode: 'effective', effectiveDate }}
            priorityBadge="static"
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
        )}
      </div>
    </div>
  );
}
