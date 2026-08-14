import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Task, Label } from '../api/tasks';
import { completeTask, deleteTask, updateTask } from '../api/tasks';
import { LabelBadge } from './LabelBadge';
import { TaskQuickEdit } from './TaskQuickEdit';
import { TaskCardBody } from './TaskCardBody';
import { isOverdue, type ColumnKey } from '../utils/taskDateUtils';
import { taskCardBg } from '../utils/priorityColor';

type DateFieldName = 'must_do_by' | 'target_date';

interface TaskCardProps {
  task: Task;
  labels: Label[];
  onRefresh: () => void;
  boardColor: string;
  columnKey: ColumnKey;
  draggable?: boolean;
  onPriorityStep?: (steps: number) => void;
  onCardDragOver?: (edge: 'above' | 'below') => void;
  dropIndicator?: 'above' | 'below' | null;
}

const LABEL_CATEGORY_ORDER: Record<string, number> = { type: 0 };

export function TaskCard({
  task, labels, onRefresh, boardColor, columnKey, draggable: isDraggable = false, onPriorityStep,
  onCardDragOver, dropIndicator = null,
}: TaskCardProps) {
  const navigate = useNavigate();
  const mustOverdue = isOverdue(task.must_do_by);
  const [dragging, setDragging] = useState(false);
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
      className={`${isEditing ? 'bg-white' : taskCardBg(columnKey, task.priority)} border border-gray-200 rounded-lg p-3 transition-shadow select-none ${
        isEditing ? 'border-indigo-300 shadow-md' : 'cursor-pointer hover:shadow-md'
      } ${dragging ? 'opacity-40' : ''} ${
        dropIndicator === 'above' ? 'border-t-2 border-t-indigo-500' : ''
      } ${dropIndicator === 'below' ? 'border-b-2 border-b-indigo-500' : ''}`}
      style={{ borderLeftColor: boardColor, borderLeftWidth: 4 }}
      draggable={!isEditing && !editingDateField && isDraggable && task.state === 'pending'}
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', task.id);
        e.dataTransfer.effectAllowed = 'move';
        setDragging(true);
      }}
      onDragEnd={() => setDragging(false)}
      onDragOver={
        isDraggable && !isEditing
          ? (e) => {
              e.preventDefault();
              const rect = e.currentTarget.getBoundingClientRect();
              const edge = e.clientY < rect.top + rect.height / 2 ? 'above' : 'below';
              onCardDragOver?.(edge);
            }
          : undefined
      }
      onClick={() => { if (!isEditing && !editingDateField) navigate(`/tasks/${task.id}`); }}
    >
      {isEditing ? (
        <TaskQuickEdit
          task={task}
          labels={labels}
          onSaved={() => { onRefresh(); setIsEditing(false); setEditingDateField(null); }}
          onCancel={() => { setIsEditing(false); setEditingDateField(null); }}
        />
      ) : (
        <TaskCardBody
          task={task}
          dateDisplay={{ mode: 'split', mustOverdue }}
          onPriorityStep={onPriorityStep}
          editingDateField={editingDateField}
          onDateFieldClick={setEditingDateField}
          onDateFieldCancel={() => setEditingDateField(null)}
          onDateChange={handleDateChange}
          renderLabels={(taskLabels) => {
            const sorted = [...taskLabels].sort((a, b) => {
              const catDiff = (LABEL_CATEGORY_ORDER[a.category] ?? 3) - (LABEL_CATEGORY_ORDER[b.category] ?? 3);
              return catDiff !== 0 ? catDiff : a.value.localeCompare(b.value);
            });
            return (
              <div className="flex flex-wrap gap-1 mt-2 min-h-[2.75rem]">
                {sorted.map((label) => (
                  <LabelBadge key={label.id} label={label} small />
                ))}
              </div>
            );
          }}
          onEdit={() => { setEditingDateField(null); setIsEditing(true); }}
          onComplete={handleComplete}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}
