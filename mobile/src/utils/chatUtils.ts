import type { Message } from '../types';

export function buildOptimisticMessage(content: string, tempId: string): Message {
  return {
    id: tempId,
    role: 'user',
    content,
    suggested_questions: null,
    created_at: new Date().toISOString(),
  };
}

// The API only returns the assistant message ID; we derive the confirmed user-message
// key from it. The real user-message ID is not exposed by POST /conversations/:id/messages.
export function confirmMessages(
  messages: Message[],
  tempId: string,
  content: string,
  assistantMsg: Message,
): Message[] {
  return [
    ...messages.filter((m) => m.id !== tempId),
    {
      id: `user-${assistantMsg.id}`,
      role: 'user' as const,
      content,
      suggested_questions: null,
      created_at: assistantMsg.created_at,
    },
    assistantMsg,
  ];
}

export function rollbackMessage(messages: Message[], tempId: string): Message[] {
  return messages.filter((m) => m.id !== tempId);
}
