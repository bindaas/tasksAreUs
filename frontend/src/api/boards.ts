import { apiFetch } from './client';

export interface Board {
  id: string;
  name: string;
  is_default: boolean;
  is_deleted: boolean;
  color?: string | null;
  created_at: string;
  updated_at: string;
}

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
