import { apiFetch } from './client';

export interface Label {
  id: string;
  category: 'type';
  value: string;
}

export interface TaskLink {
  id: string;
  url: string;
  description: string;
}

export interface Task {
  id: string;
  board_id: string;
  title: string;
  notes: string | null;
  state: 'pending' | 'done';
  must_do_by: string | null;
  target_date: string | null;
  completed_at: string | null;
  labels: Label[];
  is_high_priority: boolean;
  is_deleted: boolean;
  links: TaskLink[];
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
  links: TaskLink[];
  board_id?: string;
}

export interface UpdateTaskBody {
  title?: string;
  notes?: string;
  must_do_by?: string | null;
  target_date?: string | null;
  label_ids?: string[];
  is_high_priority?: boolean;
  // Omit entirely to leave links unchanged (full-replace semantics — the backend
  // treats "field absent" as unchanged and any list, including [], as a replace).
  // TaskForm (full save) must always include this; partial updates (drag-drop,
  // quick-edit, priority toggle) should omit it.
  links?: TaskLink[];
  // Omitting leaves the task's board unchanged; any value (including the current
  // board) triggers the backend's move logic, which clears labels on an actual move.
  board_id?: string;
}

export interface CompleteTaskBody {
  notes?: string;
}

export interface CompleteTaskResponse {
  completed_task: Task;
  next_task: Task | null;
}

export async function listTasks(state?: 'pending' | 'done', boardId?: string): Promise<{ tasks: Task[] }> {
  const params = new URLSearchParams();
  if (state) params.set('state', state);
  if (boardId) params.set('board_id', boardId);
  const query = params.size ? `?${params}` : '';
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
