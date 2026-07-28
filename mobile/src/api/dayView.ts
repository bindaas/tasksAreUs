import { apiFetch } from './client';
import type { FocusedBoard } from './focusedView';

export async function getDayViewTasks(referenceDate: string, overdue = false): Promise<{ boards: FocusedBoard[] }> {
  const qs = overdue ? '&overdue=true' : '';
  return apiFetch<{ boards: FocusedBoard[] }>(`/day-view/tasks?reference_date=${referenceDate}${qs}`);
}
