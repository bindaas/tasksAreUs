import { apiFetch } from './client';

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

export async function createConversation(): Promise<Conversation> {
  return apiFetch<Conversation>('/conversations', { method: 'POST' });
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
