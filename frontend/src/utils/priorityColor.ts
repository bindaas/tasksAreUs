import type { PriorityTier } from '../api/tasks';

/** Task card background tint by priority tier. */
export const PRIORITY_CARD_BG: Record<PriorityTier, string> = {
  high: 'bg-orange-50',
  medium: 'bg-blue-50',
  normal: 'bg-green-50',
};
