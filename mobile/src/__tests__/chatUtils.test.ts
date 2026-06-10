import { buildOptimisticMessage, confirmMessages, rollbackMessage } from '../utils/chatUtils';
import type { Message } from '../types';

const makeMsg = (id: string, role: 'user' | 'assistant', content = 'text'): Message => ({
  id,
  role,
  content,
  suggested_questions: null,
  created_at: '2026-06-09T10:00:00Z',
});

describe('buildOptimisticMessage', () => {
  it('returns a user message with the given tempId and content', () => {
    const msg = buildOptimisticMessage('hello', 'temp-1');
    expect(msg.id).toBe('temp-1');
    expect(msg.role).toBe('user');
    expect(msg.content).toBe('hello');
    expect(msg.suggested_questions).toBeNull();
  });

  it('sets created_at to a recent ISO string', () => {
    const before = Date.now();
    const msg = buildOptimisticMessage('hi', 'temp-2');
    const after = Date.now();
    const ts = new Date(msg.created_at).getTime();
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(after);
  });
});

describe('confirmMessages', () => {
  it('removes the temp message and appends confirmed user + assistant', () => {
    const prev: Message[] = [makeMsg('temp-1', 'user', 'hello')];
    const assistant = makeMsg('asst-99', 'assistant', 'world');
    const result = confirmMessages(prev, 'temp-1', 'hello', assistant);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('user-asst-99');
    expect(result[0].role).toBe('user');
    expect(result[0].content).toBe('hello');
    expect(result[1]).toBe(assistant);
  });

  it('preserves earlier messages before the confirmed pair', () => {
    const prev: Message[] = [
      makeMsg('u1', 'user', 'first'),
      makeMsg('a1', 'assistant', 'reply'),
      makeMsg('temp-2', 'user', 'second'),
    ];
    const assistant = makeMsg('asst-100', 'assistant', 'reply2');
    const result = confirmMessages(prev, 'temp-2', 'second', assistant);
    expect(result).toHaveLength(4);
    expect(result[0].id).toBe('u1');
    expect(result[1].id).toBe('a1');
    expect(result[2].id).toBe('user-asst-100');
    expect(result[3]).toBe(assistant);
  });

  it('is a no-op on message ordering when tempId is not found', () => {
    const prev: Message[] = [makeMsg('u1', 'user')];
    const assistant = makeMsg('asst-1', 'assistant');
    const result = confirmMessages(prev, 'temp-missing', 'text', assistant);
    expect(result[0].id).toBe('u1');
    expect(result[result.length - 1]).toBe(assistant);
  });

  it('confirmed user message has null suggested_questions', () => {
    const assistant = makeMsg('asst-1', 'assistant');
    const result = confirmMessages([], 'temp-1', 'q', assistant);
    expect(result[0].suggested_questions).toBeNull();
  });
});

describe('rollbackMessage', () => {
  it('removes the temp message on error', () => {
    const prev: Message[] = [makeMsg('temp-1', 'user'), makeMsg('u2', 'user')];
    const result = rollbackMessage(prev, 'temp-1');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('u2');
  });

  it('returns all messages unchanged when tempId is not present', () => {
    const prev: Message[] = [makeMsg('u1', 'user'), makeMsg('a1', 'assistant')];
    const result = rollbackMessage(prev, 'temp-missing');
    expect(result).toHaveLength(2);
  });

  it('returns empty array when the only message is the temp one', () => {
    const result = rollbackMessage([makeMsg('temp-1', 'user')], 'temp-1');
    expect(result).toHaveLength(0);
  });
});
