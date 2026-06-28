import { apiFetch } from './client';
import type { Task, CreateTaskBody, UpdateTaskBody, CompleteTaskBody, CompleteTaskResponse } from '../types';

export async function listTasks(state?: 'pending' | 'done', boardId?: string): Promise<{ tasks: Task[] }> {
  const params = new URLSearchParams();
  if (state) params.set('state', state);
  if (boardId) params.set('board_id', boardId);
  const query = params.toString() ? `?${params.toString()}` : '';
  return apiFetch<{ tasks: Task[] }>(`/tasks${query}`);
}

export async function getTask(id: string): Promise<Task> {
  return apiFetch<Task>(`/tasks/${id}`);
}

export async function createTask(body: CreateTaskBody, boardId?: string): Promise<Task> {
  return apiFetch<Task>('/tasks', {
    method: 'POST',
    body: JSON.stringify(boardId ? { ...body, board_id: boardId } : body),
  });
}

export async function updateTask(id: string, body: UpdateTaskBody): Promise<Task> {
  return apiFetch<Task>(`/tasks/${id}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

export async function deleteTask(id: string): Promise<void> {
  return apiFetch<void>(`/tasks/${id}`, { method: 'DELETE' });
}

export async function completeTask(
  id: string,
  body: CompleteTaskBody = {}
): Promise<CompleteTaskResponse> {
  return apiFetch<CompleteTaskResponse>(`/tasks/${id}/complete`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
