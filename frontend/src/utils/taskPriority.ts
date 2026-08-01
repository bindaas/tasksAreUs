import type { Task } from '../api/tasks';
import { getColumn, type ColumnKey } from './taskDateUtils';

export const HIGH_PRIORITY_DAILY_LIMIT = 3;

export function isHighPriorityEligible(columnKey: ColumnKey): boolean {
  return columnKey === 'today' || columnKey === 'tomorrow' || columnKey === 'day_after_tomorrow' || columnKey === 'monday';
}

/** Returns true if the form should offer the High priority checkbox given the current date fields. */
export function isFormHighPriorityEligible(mustDoBy: string, targetDate: string, todayStr: string, tomorrowStr: string): boolean {
  const col = getColumn({ must_do_by: mustDoBy || null, target_date: targetDate || null }, todayStr, tomorrowStr);
  return col === 'overdue' || isHighPriorityEligible(col);
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

/** Returns true if droppedTask can be added to the high-priority zone for this column. */
export function canAddHighPriority(highTasks: Task[], droppedTask: Task, limit: number = HIGH_PRIORITY_DAILY_LIMIT): boolean {
  if (highTasks.some((t) => t.id === droppedTask.id)) return true;
  return highTasks.length < limit;
}
