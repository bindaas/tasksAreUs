import { apiFetch } from './client';

export interface Settings {
  starter_questions: string[];
}

export async function getSettings(): Promise<Settings> {
  return apiFetch<Settings>('/settings');
}

export async function updateSettings(body: Settings): Promise<Settings> {
  return apiFetch<Settings>('/settings', {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}
