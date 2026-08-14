import type { PriorityTier } from '../api/tasks';
import type { ColumnKey } from './taskDateUtils';

/** Task card background tint by priority tier. */
export const PRIORITY_CARD_BG: Record<PriorityTier, string> = {
  high: 'bg-orange-50',
  medium: 'bg-blue-50',
  normal: 'bg-green-50',
};

/**
 * Task card background by column: overdue always reads as overdue regardless
 * of tier; Upcoming/No Date can never hold an assigned priority (see
 * isPriorityEligible), so they get no tint rather than a misleading one.
 */
export function taskCardBg(columnKey: ColumnKey, priority: PriorityTier): string {
  if (columnKey === 'overdue') return 'bg-red-50';
  if (columnKey === 'upcoming' || columnKey === 'nodate') return 'bg-white';
  return PRIORITY_CARD_BG[priority];
}
