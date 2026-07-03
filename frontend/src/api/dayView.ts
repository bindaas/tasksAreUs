import { apiFetch } from './client';
import type { FocusedBoard } from './focusedView';

export async function getDayViewTasks(referenceDate: string): Promise<{ boards: FocusedBoard[] }> {
  return apiFetch<{ boards: FocusedBoard[] }>(`/day-view/tasks?reference_date=${referenceDate}`);
}
