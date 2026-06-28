import { apiFetch } from './client';
import type { Label } from './tasks';

export interface CompletionRecord {
  task_id: string;
  title: string;
  completed_at: string;
  labels: Label[];
}

export interface CompletionsReport {
  completions: CompletionRecord[];
  total: number;
}

export async function getCompletions(from: string, to: string, boardId?: string): Promise<CompletionsReport> {
  const params = new URLSearchParams({ from, to });
  if (boardId) params.set('board_id', boardId);
  return apiFetch<CompletionsReport>(`/reports/completions?${params}`);
}
