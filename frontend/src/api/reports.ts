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

export async function getCompletions(from: string, to: string): Promise<CompletionsReport> {
  return apiFetch<CompletionsReport>(`/reports/completions?from=${from}&to=${to}`);
}
