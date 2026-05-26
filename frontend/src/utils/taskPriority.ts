import type { Task } from '../api/tasks';
import type { ColumnKey } from './taskDateUtils';

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
