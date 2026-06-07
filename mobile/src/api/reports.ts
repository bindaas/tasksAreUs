import { apiFetch } from './client';
import type { CompletionsReport } from '../types';

export async function getCompletions(from: string, to: string): Promise<CompletionsReport> {
  return apiFetch<CompletionsReport>(`/reports/completions?from=${from}&to=${to}`);
}
