import type { Task } from '../types';
import type { ColumnKey } from './taskDateUtils';

export const HIGH_PRIORITY_DAILY_LIMIT = 3;

export function isHighPriorityEligible(columnKey: ColumnKey): boolean {
  return columnKey === 'today' || columnKey === 'tomorrow';
}

export function splitByPriority(tasks: Task[]): { high: Task[]; normal: Task[] } {
  const high: Task[] = [];
  const normal: Task[] = [];
  for (const task of tasks) {
    if (task.is_high_priority) {
      high.push(task);
    } else {
      normal.push(task);
    }
  }
  return { high, normal };
}

export function canAddHighPriority(
  highTasks: Task[],
  droppedTask: Task,
  limit: number = HIGH_PRIORITY_DAILY_LIMIT
): boolean {
  if (highTasks.some((t) => t.id === droppedTask.id)) return true;
  return highTasks.length < limit;
}
