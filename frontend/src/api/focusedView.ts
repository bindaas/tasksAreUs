import { apiFetch } from './client';
import type { Task } from './tasks';

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
  day_range: 'today' | 'today_tomorrow' | 'today_plus_two';
  selected_board_ids: string[];
}): Promise<FocusedViewConfig> {
  return apiFetch<FocusedViewConfig>('/focused-view/config', {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

export async function getFocusedViewTasks(referenceDate?: string): Promise<{ boards: FocusedBoard[] }> {
  const qs = referenceDate ? `?reference_date=${referenceDate}` : '';
  return apiFetch<{ boards: FocusedBoard[] }>(`/focused-view/tasks${qs}`);
}
