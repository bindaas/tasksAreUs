import { apiFetch } from './client';
import type { Task } from '../types';

export interface FocusedViewConfig {
  id: string;
  user_id: string;
  board_selection: 'all' | 'selected';
  selected_board_ids: string[];
  day_range: 'today' | 'today_tomorrow' | 'today_plus_two';
}

export interface FocusedBoard {
  board_id: string;
  board_name: string;
  board_color: string | null;
  tasks: Task[];
}

export async function getFocusedViewConfig(): Promise<FocusedViewConfig> {
  return apiFetch<FocusedViewConfig>('/focused-view/config');
}

export async function updateFocusedViewConfig(body: {
  board_selection: 'all' | 'selected';
  selected_board_ids: string[];
  day_range: 'today' | 'today_tomorrow' | 'today_plus_two';
}): Promise<FocusedViewConfig> {
  return apiFetch<FocusedViewConfig>('/focused-view/config', {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

export async function getFocusedViewTasks(referenceDate?: string): Promise<{ boards: FocusedBoard[] }> {
  const url = referenceDate
    ? `/focused-view/tasks?reference_date=${referenceDate}`
    : '/focused-view/tasks';
  return apiFetch<{ boards: FocusedBoard[] }>(url);
}
