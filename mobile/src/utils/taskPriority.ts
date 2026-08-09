import type { PriorityTier, Task } from '../types';
import { getColumn, type ColumnKey } from './taskDateUtils';

export const HIGH_PRIORITY_DAILY_LIMIT = 3;

/** Click-to-cycle order for the 3-state priority toggle (TaskCardBody). Mirrors web's cycle. */
export const PRIORITY_CYCLE: Record<PriorityTier, PriorityTier> = {
  normal: 'medium',
  medium: 'high',
  high: 'normal',
};

/** Date-eligibility window shared by both High and Medium — Normal has no restriction. */
export function isPriorityEligible(columnKey: ColumnKey): boolean {
  return columnKey === 'today' || columnKey === 'tomorrow' || columnKey === 'day_after_tomorrow';
}

/** Returns true if the form should offer the High/Medium tier options given the current date fields. */
export function isFormPriorityEligible(
  mustDoBy: string,
  targetDate: string,
  todayStr: string,
  tomorrowStr: string
): boolean {
  const col = getColumn({ must_do_by: mustDoBy || null, target_date: targetDate || null }, todayStr, tomorrowStr);
  return col === 'overdue' || isPriorityEligible(col);
}

/**
 * Resolves the click-to-cycle toggle's target tier: advances `current` one step around
 * `PRIORITY_CYCLE`, then demotes to Normal if the resulting tier isn't eligible for
 * `columnKey`'s date (defensive — the toggle is only wired up on eligible columns today,
 * but this keeps the resolution correct if that wiring ever changes).
 */
export function resolveNextPriorityTier(current: PriorityTier, columnKey: ColumnKey): PriorityTier {
  const next = PRIORITY_CYCLE[current];
  if ((next === 'high' || next === 'medium') && !isPriorityEligible(columnKey)) {
    return 'normal';
  }
  return next;
}

export function canAddHighPriority(
  highTasks: Task[],
  droppedTask: Task,
  limit: number = HIGH_PRIORITY_DAILY_LIMIT
): boolean {
  if (highTasks.some((t) => t.id === droppedTask.id)) return true;
  return highTasks.length < limit;
}
