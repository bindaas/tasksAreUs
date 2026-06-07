import { apiFetch } from './client';
import type { Conversation, Message, SendMessageResponse } from '../types';

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
