import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('../firebase', () => ({ auth: { currentUser: null } }));

const mockApiFetch = vi.fn();
vi.mock('../api/client', () => ({ apiFetch: (...args: unknown[]) => mockApiFetch(...args) }));

import { createTask, updateTask, type CreateTaskBody, type UpdateTaskBody } from '../api/tasks';

describe('tasks API — board_id serialization', () => {
  beforeEach(() => {
    mockApiFetch.mockReset();
  });

  describe('createTask', () => {
    const body: CreateTaskBody = {
      title: 'Do the thing',
      label_ids: [],
      links: [],
      board_id: 'board-2',
    };

    it('serializes a caller-supplied board_id in the request body', async () => {
      mockApiFetch.mockResolvedValue({ id: 't1' });
      await createTask(body);
      expect(mockApiFetch).toHaveBeenCalledWith('/tasks', {
        method: 'POST',
        body: JSON.stringify(body),
      });
    });

    it('does not lose body.board_id when called with no second argument', async () => {
      mockApiFetch.mockResolvedValue({ id: 't1' });
      await createTask(body);
      const [, options] = mockApiFetch.mock.calls[0];
      const sent = JSON.parse((options as RequestInit).body as string);
      expect(sent.board_id).toBe('board-2');
    });
  });

  describe('updateTask', () => {
    it('serializes a caller-supplied board_id in the request body', async () => {
      const body: UpdateTaskBody = { board_id: 'board-3' };
      mockApiFetch.mockResolvedValue({ id: 't1' });
      await updateTask('t1', body);
      expect(mockApiFetch).toHaveBeenCalledWith('/tasks/t1', {
        method: 'PUT',
        body: JSON.stringify(body),
      });
    });
  });
});
