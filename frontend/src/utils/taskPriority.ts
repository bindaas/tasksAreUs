import type { PriorityTier, Task } from '../api/tasks';
import { getColumn, type ColumnKey } from './taskDateUtils';

export const HIGH_PRIORITY_DAILY_LIMIT = 3;

/** Date-eligibility window shared by both High and Medium — Normal has no restriction. */
export function isPriorityEligible(columnKey: ColumnKey): boolean {
  return columnKey === 'today' || columnKey === 'tomorrow' || columnKey === 'day_after_tomorrow' || columnKey === 'monday';
}

/** Returns true if the form should offer the High/Medium tier options given the current date fields. */
export function isFormPriorityEligible(mustDoBy: string, targetDate: string, todayStr: string, tomorrowStr: string): boolean {
  const col = getColumn({ must_do_by: mustDoBy || null, target_date: targetDate || null }, todayStr, tomorrowStr);
  return col === 'overdue' || isPriorityEligible(col);
}

const TIER_ORDER: PriorityTier[] = ['normal', 'medium', 'high']; // ascending severity

/** Shifts `current` by `steps` positions along the ordered tier ladder, clamped at both ends. */
export function shiftPriorityTier(current: PriorityTier, steps: number): PriorityTier {
  const idx = TIER_ORDER.indexOf(current);
  const clamped = Math.min(TIER_ORDER.length - 1, Math.max(0, idx + steps));
  return TIER_ORDER[clamped];
}

/**
 * Resolves the stepper's target tier: shifts `current` by `steps`, then — for an
 * UPWARD shift only — demotes to Normal if the result isn't eligible for `columnKey`'s
 * date. Downward shifts are never gated: you already held an equal-or-higher tier, so
 * stepping down never newly requests an elevated tier that needs eligibility.
 */
export function resolveShiftedPriorityTier(current: PriorityTier, steps: number, columnKey: ColumnKey): PriorityTier {
  const next = shiftPriorityTier(current, steps);
  if (steps > 0 && (next === 'high' || next === 'medium') && !isPriorityEligible(columnKey)) {
    return 'normal';
  }
  return next;
}

/**
 * Resolves the tier a dropped task should actually land on: a High/Medium drop target
 * only sticks if `columnKey`'s date is eligible, otherwise it's demoted to Normal.
 */
export function resolveDropPriority(priority: PriorityTier, columnKey: ColumnKey): PriorityTier {
  if (priority !== 'normal' && !isPriorityEligible(columnKey)) {
    return 'normal';
  }
  return priority;
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

/**
 * Returns the high-priority tasks among `tasks` that share `target`'s date column —
 * the daily cap is per calendar day, so this is the scope `canAddHighPriority` must be
 * checked against, not every high-priority task in a possibly multi-day task list.
 */
export function highPriorityTasksInSameColumn(tasks: Task[], target: Task, today: string, tomorrow: string): Task[] {
  const columnKey = getColumn(target, today, tomorrow);
  return tasks.filter((t) => t.priority === 'high' && getColumn(t, today, tomorrow) === columnKey);
}
