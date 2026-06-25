export interface Label {
  id: string;
  category: 'frequency' | 'mode' | 'type';
  value: string;
}

export type LabelCategory = 'mode' | 'type';

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

export interface Conversation {
  id: string;
  created_at: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  suggested_questions: string[] | null;
  created_at: string;
}

export interface SendMessageResponse {
  message: Message;
  actions: unknown[];
}

export interface Settings {
  starter_questions: string[];
  high_priority_daily_limit: number;
}

export interface UpdateSettingsBody {
  starter_questions?: string[];
  high_priority_daily_limit?: number;
}

export interface CompletionRecord {
  task_id: string;
  title: string;
  completed_at: string;
  labels: Label[];
}

export interface CompletionsReport {
  completions: CompletionRecord[];
  total: number;
}
