import { apiFetch } from './client';
import type { Conversation, Message, SendMessageResponse } from '../types';

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
