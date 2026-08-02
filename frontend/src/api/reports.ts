import { apiFetch } from './client';
import type { Label } from './tasks';

export interface CompletionRecord {
  task_id: string;
  title: string;
  completed_at: string;
  labels: Label[];
}

export interface BoardCompletions {
  board_id: string;
  board_name: string;
  board_color: string | null;
  completions: CompletionRecord[];
}

export interface CompletionsReport {
  completions: CompletionRecord[];
  total: number;
  boards?: BoardCompletions[] | null;
}

export interface GetCompletionsOptions {
  boardId?: string;
  allBoards?: boolean;
}

export async function getCompletions(
  from: string,
  to: string,
  options: GetCompletionsOptions = {}
): Promise<CompletionsReport> {
  const params = new URLSearchParams({ from, to });
  if (options.allBoards) {
    params.set('all_boards', 'true');
  } else if (options.boardId) {
    params.set('board_id', options.boardId);
  }
  return apiFetch<CompletionsReport>(`/reports/completions?${params}`);
}
