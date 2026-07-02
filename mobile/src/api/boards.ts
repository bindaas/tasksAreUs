import { apiFetch } from './client';
import type { Board } from '../types';

export async function getBoards(): Promise<{ boards: Board[] }> {
  return apiFetch<{ boards: Board[] }>('/boards');
}

export async function createBoard(name: string): Promise<Board> {
  return apiFetch<Board>('/boards', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}

export async function updateBoard(
  id: string,
  body: { name?: string; is_default?: boolean; color?: string | null }
): Promise<Board> {
  return apiFetch<Board>(`/boards/${id}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

export async function deleteBoard(id: string): Promise<void> {
  await apiFetch<void>(`/boards/${id}`, { method: 'DELETE' });
}
