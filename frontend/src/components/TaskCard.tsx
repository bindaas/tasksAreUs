import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Task, Label } from '../api/tasks';
import { completeTask, deleteTask } from '../api/tasks';
import { LabelBadge } from './LabelBadge';
import { TaskQuickEdit } from './TaskQuickEdit';
import { TaskCardBody } from './TaskCardBody';
import { isOverdue } from '../utils/taskDateUtils';

interface TaskCardProps {
  task: Task;
  labels: Label[];
  onRefresh: () => void;
  draggable?: boolean;
  onTogglePriority?: () => void;
}

const LABEL_CATEGORY_ORDER: Record<string, number> = { type: 0 };

export function TaskCard({ task, labels, onRefresh, draggable: isDraggable = false, onTogglePriority }: TaskCardProps) {
  const navigate = useNavigate();
  const mustOverdue = isOverdue(task.must_do_by);
  const [dragging, setDragging] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

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
        <TaskCardBody
          task={task}
          layout="inline"
          dateDisplay={{ mode: 'split', mustOverdue }}
          priorityBadge="toggle"
          onTogglePriority={onTogglePriority}
          renderLabels={(taskLabels) => {
            const sorted = [...taskLabels].sort(
              (a, b) => (LABEL_CATEGORY_ORDER[a.category] ?? 3) - (LABEL_CATEGORY_ORDER[b.category] ?? 3)
            );
            return (
              <div className="flex flex-wrap gap-1 mt-2 min-h-[2.75rem]">
                {sorted.map((label) => (
                  <LabelBadge key={label.id} label={label} small />
                ))}
              </div>
            );
          }}
          onEdit={() => setIsEditing(true)}
          onComplete={handleComplete}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}
