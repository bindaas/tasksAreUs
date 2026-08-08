import type { PriorityTier, Task } from '../api/tasks';
import { getColumn, type ColumnKey } from './taskDateUtils';

export const HIGH_PRIORITY_DAILY_LIMIT = 3;

/** Click-to-cycle order for the 3-state priority toggle (TaskCardBody, TasksPage). */
export const PRIORITY_CYCLE: Record<PriorityTier, PriorityTier> = {
  normal: 'medium',
  medium: 'high',
  high: 'normal',
};

/** Date-eligibility window shared by both High and Medium — Normal has no restriction. */
export function isPriorityEligible(columnKey: ColumnKey): boolean {
  return columnKey === 'today' || columnKey === 'tomorrow' || columnKey === 'day_after_tomorrow' || columnKey === 'monday';
}

/** Returns true if the form should offer the High/Medium tier options given the current date fields. */
export function isFormPriorityEligible(mustDoBy: string, targetDate: string, todayStr: string, tomorrowStr: string): boolean {
  const col = getColumn({ must_do_by: mustDoBy || null, target_date: targetDate || null }, todayStr, tomorrowStr);
  return col === 'overdue' || isPriorityEligible(col);
}

export function splitByPriority(tasks: Task[]): { high: Task[]; medium: Task[]; normal: Task[] } {
  const high: Task[] = [];
  const medium: Task[] = [];
  const normal: Task[] = [];
  for (const task of tasks) {
    if (task.priority === 'high') {
      high.push(task);
    } else if (task.priority === 'medium') {
      medium.push(task);
    } else {
      normal.push(task);
    }
  }
  return { high, medium, normal };
}

/** Returns true if droppedTask can be added to the high-priority zone for this column. Only High is capped. */
export function canAddHighPriority(highTasks: Task[], droppedTask: Task, limit: number = HIGH_PRIORITY_DAILY_LIMIT): boolean {
  if (highTasks.some((t) => t.id === droppedTask.id)) return true;
  return highTasks.length < limit;
}
