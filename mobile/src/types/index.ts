export interface Board {
  id: string;
  name: string;
  is_default: boolean;
  is_deleted: boolean;
  color: string | null;
  created_at: string;
  updated_at: string;
}

export interface Label {
  id: string;
  category: 'mode' | 'type';
  value: string;
}

export type LabelCategory = 'mode' | 'type';

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
}

export interface UpdateTaskBody {
  title?: string;
  notes?: string;
  must_do_by?: string | null;
  target_date?: string | null;
  label_ids?: string[];
  is_high_priority?: boolean;
  // Omit entirely to leave links unchanged (full-replace semantics). TaskFormScreen
  // (full save) must always include this; partial updates should omit it.
  links?: TaskLink[];
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
  board_id: string;
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
