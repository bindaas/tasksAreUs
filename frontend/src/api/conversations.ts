import { apiFetch } from './client';

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

export async function createConversation(boardId?: string): Promise<Conversation> {
  return apiFetch<Conversation>('/conversations', {
    method: 'POST',
    body: boardId ? JSON.stringify({ board_id: boardId }) : undefined,
  });
}

export async function sendMessage(
  conversationId: string,
  content: string
): Promise<SendMessageResponse> {
  return apiFetch<SendMessageResponse>(`/conversations/${conversationId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ content }),
  });
}

export async function getMessages(conversationId: string): Promise<{ messages: Message[] }> {
  return apiFetch<{ messages: Message[] }>(`/conversations/${conversationId}/messages`);
}
