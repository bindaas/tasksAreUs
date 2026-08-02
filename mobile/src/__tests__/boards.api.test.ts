jest.mock('../firebase', () => ({ auth: { currentUser: null } }));

const mockApiFetch = jest.fn();
jest.mock('../api/client', () => ({ apiFetch: (...args: unknown[]) => mockApiFetch(...args) }));

import { getBoards, createBoard, updateBoard, deleteBoard } from '../api/boards';

const makeBoard = (overrides = {}) => ({
  id: 'b1',
  name: 'General tasks',
  is_default: true,
  is_deleted: false,
  created_at: '',
  updated_at: '',
  ...overrides,
});

describe('boards API', () => {
  beforeEach(() => {
    mockApiFetch.mockReset();
  });

  it('getBoards calls GET /boards', async () => {
    mockApiFetch.mockResolvedValue({ boards: [] });
    await getBoards();
    expect(mockApiFetch).toHaveBeenCalledWith('/boards');
  });

  it('getBoards returns the boards array', async () => {
    const board = makeBoard();
    mockApiFetch.mockResolvedValue({ boards: [board] });
    const result = await getBoards();
    expect(result.boards).toHaveLength(1);
    expect(result.boards[0].id).toBe('b1');
  });

  it('createBoard calls POST /boards with the name', async () => {
    mockApiFetch.mockResolvedValue(makeBoard({ id: 'b2', name: 'Job search', is_default: false }));
    await createBoard('Job search');
    expect(mockApiFetch).toHaveBeenCalledWith('/boards', {
      method: 'POST',
      body: JSON.stringify({ name: 'Job search' }),
    });
  });

  it('updateBoard calls PUT /boards/:id with name', async () => {
    mockApiFetch.mockResolvedValue(makeBoard({ name: 'Renamed' }));
    await updateBoard('b1', { name: 'Renamed' });
    expect(mockApiFetch).toHaveBeenCalledWith('/boards/b1', {
      method: 'PUT',
      body: JSON.stringify({ name: 'Renamed' }),
    });
  });

  it('updateBoard calls PUT /boards/:id with a hex color', async () => {
    mockApiFetch.mockResolvedValue(makeBoard({ color: '#6366f1' }));
    await updateBoard('b1', { color: '#6366f1' });
    expect(mockApiFetch).toHaveBeenCalledWith('/boards/b1', {
      method: 'PUT',
      body: JSON.stringify({ color: '#6366f1' }),
    });
  });

  it('updateBoard calls PUT /boards/:id with null to clear the color', async () => {
    mockApiFetch.mockResolvedValue(makeBoard({ color: null }));
    await updateBoard('b1', { color: null });
    expect(mockApiFetch).toHaveBeenCalledWith('/boards/b1', {
      method: 'PUT',
      body: JSON.stringify({ color: null }),
    });
  });

  it('deleteBoard calls DELETE /boards/:id', async () => {
    mockApiFetch.mockResolvedValue(undefined);
    await deleteBoard('b1');
    expect(mockApiFetch).toHaveBeenCalledWith('/boards/b1', { method: 'DELETE' });
  });

  it('getBoards returns empty boards array when user has no boards', async () => {
    mockApiFetch.mockResolvedValue({ boards: [] });
    const result = await getBoards();
    expect(result.boards).toEqual([]);
  });
});
