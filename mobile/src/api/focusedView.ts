import { apiFetch } from './client';
import type { Task } from '../types';

export interface FocusedBoard {
  board_id: string;
  board_name: string;
  board_color: string | null;
  tasks: Task[];
}

export async function getFocusedViewTasks(referenceDate?: string): Promise<{ boards: FocusedBoard[] }> {
  const url = referenceDate
    ? `/focused-view/tasks?reference_date=${referenceDate}`
    : '/focused-view/tasks';
  return apiFetch<{ boards: FocusedBoard[] }>(url);
}
