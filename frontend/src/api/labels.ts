import { apiFetch } from './client';
import type { Label } from './tasks';

export type LabelCategory = 'frequency' | 'mode' | 'type';

export async function listLabels(category?: LabelCategory): Promise<{ labels: Label[] }> {
  const query = category ? `?category=${category}` : '';
  return apiFetch<{ labels: Label[] }>(`/labels${query}`);
}

export async function createLabel(category: 'mode' | 'type', value: string): Promise<Label> {
  return apiFetch<Label>('/labels', {
    method: 'POST',
    body: JSON.stringify({ category, value }),
  });
}

export async function updateLabel(id: string, value: string): Promise<Label> {
  return apiFetch<Label>(`/labels/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ value }),
  });
}

export async function deleteLabel(id: string): Promise<void> {
  await apiFetch<void>(`/labels/${id}`, { method: 'DELETE' });
}
