import { apiFetch } from './client';
import type { Label } from './tasks';

export type LabelCategory = 'mode' | 'type';

export async function listLabels(category?: LabelCategory, boardId?: string): Promise<{ labels: Label[] }> {
  const params = new URLSearchParams();
  if (category) params.set('category', category);
  if (boardId) params.set('board_id', boardId);
  const query = params.size ? `?${params}` : '';
  return apiFetch<{ labels: Label[] }>(`/labels${query}`);
}

export async function createLabel(category: 'mode' | 'type', value: string, boardId?: string): Promise<Label> {
  return apiFetch<Label>('/labels', {
    method: 'POST',
    body: JSON.stringify(boardId ? { category, value, board_id: boardId } : { category, value }),
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
