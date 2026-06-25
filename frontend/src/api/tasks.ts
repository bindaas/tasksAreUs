import { apiFetch } from './client';

export interface Label {
  id: string;
  category: 'mode' | 'type';
  value: string;
}

export interface Task {
  id: string;
  title: string;
  notes: string | null;
  state: 'pending' | 'done';
  must_do_by: string | null;
  target_date: string | null;
  completed_at: string | null;
  recurrence_group_id: string | null;
  labels: Label[];
  is_high_priority: boolean;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateTaskBody {
  title: string;
  notes?: string;
  must_do_by?: string;
  target_date?: string;
  label_ids: string[];
  is_high_priority?: boolean;
}

export interface UpdateTaskBody {
  title?: string;
  notes?: string;
  must_do_by?: string | null;
  target_date?: string | null;
  label_ids?: string[];
  is_high_priority?: boolean;
}

export interface CompleteTaskBody {
  notes?: string;
}

export interface CompleteTaskResponse {
  completed_task: Task;
  next_task: Task | null;
}

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
