import { apiFetch } from './client';
import type { CompletionsReport } from '../types';

export async function getCompletions(from: string, to: string, boardId?: string): Promise<CompletionsReport> {
  const params = new URLSearchParams({ from, to });
  if (boardId) params.set('board_id', boardId);
  return apiFetch<CompletionsReport>(`/reports/completions?${params.toString()}`);
}
