import { apiFetch } from './client';
import type { CompletionsReport } from '../types';

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
  return apiFetch<CompletionsReport>(`/reports/completions?${params.toString()}`);
}
