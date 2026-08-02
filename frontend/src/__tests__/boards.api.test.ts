import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('../firebase', () => ({ auth: { currentUser: null } }));

const mockApiFetch = vi.fn();
vi.mock('../api/client', () => ({ apiFetch: (...args: unknown[]) => mockApiFetch(...args) }));

import { getBoards, createBoard, updateBoard, deleteBoard } from '../api/boards';

describe('boards API', () => {
  beforeEach(() => {
    mockApiFetch.mockReset();
  });

  describe('getBoards', () => {
    it('calls GET /boards', async () => {
      mockApiFetch.mockResolvedValue({ boards: [] });
      await getBoards();
      expect(mockApiFetch).toHaveBeenCalledWith('/boards');
    });

    it('returns the boards array', async () => {
      const board = { id: 'b1', name: 'General tasks', is_default: true, is_deleted: false, created_at: '', updated_at: '' };
      mockApiFetch.mockResolvedValue({ boards: [board] });
      const result = await getBoards();
      expect(result.boards).toHaveLength(1);
      expect(result.boards[0].id).toBe('b1');
    });
  });

  describe('createBoard', () => {
    it('calls POST /boards with the name', async () => {
      const board = { id: 'b2', name: 'Job search', is_default: false, is_deleted: false, created_at: '', updated_at: '' };
      mockApiFetch.mockResolvedValue(board);
      await createBoard('Job search');
      expect(mockApiFetch).toHaveBeenCalledWith('/boards', {
        method: 'POST',
        body: JSON.stringify({ name: 'Job search' }),
      });
    });

    it('returns the created board', async () => {
      const board = { id: 'b2', name: 'Job search', is_default: false, is_deleted: false, created_at: '', updated_at: '' };
      mockApiFetch.mockResolvedValue(board);
      const result = await createBoard('Job search');
      expect(result.id).toBe('b2');
      expect(result.name).toBe('Job search');
    });
  });

  describe('updateBoard', () => {
    it('calls PUT /boards/{id} with name', async () => {
      mockApiFetch.mockResolvedValue({ id: 'b1', name: 'Renamed', is_default: true, is_deleted: false, created_at: '', updated_at: '' });
      await updateBoard('b1', { name: 'Renamed' });
      expect(mockApiFetch).toHaveBeenCalledWith('/boards/b1', {
        method: 'PUT',
        body: JSON.stringify({ name: 'Renamed' }),
      });
    });

    it('calls PUT /boards/{id} with sort_order', async () => {
      mockApiFetch.mockResolvedValue({ id: 'b2', name: 'Job search', is_default: false, is_deleted: false, sort_order: 1.5, created_at: '', updated_at: '' });
      await updateBoard('b2', { sort_order: 1.5 });
      expect(mockApiFetch).toHaveBeenCalledWith('/boards/b2', {
        method: 'PUT',
        body: JSON.stringify({ sort_order: 1.5 }),
      });
    });

    it('calls PUT /boards/{id} with a hex color', async () => {
      mockApiFetch.mockResolvedValue({ id: 'b1', name: 'General tasks', is_default: true, is_deleted: false, color: '#6366f1', created_at: '', updated_at: '' });
      await updateBoard('b1', { color: '#6366f1' });
      expect(mockApiFetch).toHaveBeenCalledWith('/boards/b1', {
        method: 'PUT',
        body: JSON.stringify({ color: '#6366f1' }),
      });
    });

    it('calls PUT /boards/{id} with null to clear the color', async () => {
      mockApiFetch.mockResolvedValue({ id: 'b1', name: 'General tasks', is_default: true, is_deleted: false, color: null, created_at: '', updated_at: '' });
      await updateBoard('b1', { color: null });
      expect(mockApiFetch).toHaveBeenCalledWith('/boards/b1', {
        method: 'PUT',
        body: JSON.stringify({ color: null }),
      });
    });
  });

  describe('deleteBoard', () => {
    it('calls DELETE /boards/{id}', async () => {
      mockApiFetch.mockResolvedValue(undefined);
      await deleteBoard('b2');
      expect(mockApiFetch).toHaveBeenCalledWith('/boards/b2', { method: 'DELETE' });
    });
  });
});
