import { apiFetch } from './client';
import type { Label } from './tasks';

export type LabelCategory = 'frequency' | 'mode' | 'type';

export async function listLabels(category?: LabelCategory): Promise<{ labels: Label[] }> {
  const query = category ? `?category=${category}` : '';
  return apiFetch<{ labels: Label[] }>(`/labels${query}`);
}
