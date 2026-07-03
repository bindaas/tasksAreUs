import { apiFetch } from './client';
import type { Task } from './tasks';

export interface FocusedBoard {
  board_id: string;
  board_name: string;
  board_color: string | null;
  tasks: Task[];
}

export async function getFocusedViewTasks(referenceDate?: string): Promise<{ boards: FocusedBoard[] }> {
  const qs = referenceDate ? `?reference_date=${referenceDate}` : '';
  return apiFetch<{ boards: FocusedBoard[] }>(`/focused-view/tasks${qs}`);
}
