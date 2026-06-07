import { apiFetch } from './client';
import type { Task, CreateTaskBody, UpdateTaskBody, CompleteTaskBody, CompleteTaskResponse } from '../types';

export async function listTasks(state?: 'pending' | 'done'): Promise<{ tasks: Task[] }> {
  const query = state ? `?state=${state}` : '';
  return apiFetch<{ tasks: Task[] }>(`/tasks${query}`);
}

export async function getTask(id: string): Promise<Task> {
  return apiFetch<Task>(`/tasks/${id}`);
}

export async function createTask(body: CreateTaskBody): Promise<Task> {
  return apiFetch<Task>('/tasks', {
    method: 'POST',
    body: JSON.stringify(body),
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
