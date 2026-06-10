import { apiFetch } from './client';
import type { Settings, UpdateSettingsBody } from '../types';

export async function getSettings(): Promise<Settings> {
  return apiFetch<Settings>('/settings');
}

export async function updateSettings(body: UpdateSettingsBody): Promise<Settings> {
  return apiFetch<Settings>('/settings', {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}
