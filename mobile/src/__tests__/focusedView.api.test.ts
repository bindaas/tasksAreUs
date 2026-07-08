jest.mock('../firebase', () => ({ auth: { currentUser: null } }));

const mockApiFetch = jest.fn();
jest.mock('../api/client', () => ({ apiFetch: (...args: unknown[]) => mockApiFetch(...args) }));

import { getFocusedViewTasks } from '../api/focusedView';

describe('focusedView API', () => {
  beforeEach(() => {
    mockApiFetch.mockReset();
  });

  describe('getFocusedViewTasks', () => {
    it('calls GET /focused-view/tasks without reference_date when not provided', async () => {
      mockApiFetch.mockResolvedValue({ boards: [] });
      await getFocusedViewTasks();
      expect(mockApiFetch).toHaveBeenCalledWith('/focused-view/tasks');
    });

    it('calls GET /focused-view/tasks?reference_date=... when provided', async () => {
      mockApiFetch.mockResolvedValue({ boards: [] });
      await getFocusedViewTasks('2026-07-01');
      expect(mockApiFetch).toHaveBeenCalledWith('/focused-view/tasks?reference_date=2026-07-01');
    });

    it('returns boards array', async () => {
      const board = {
        board_id: 'b1',
        board_name: 'Work',
        board_color: '#6366f1',
        tasks: [],
      };
      mockApiFetch.mockResolvedValue({ boards: [board] });
      const result = await getFocusedViewTasks('2026-07-01');
      expect(result.boards).toHaveLength(1);
      expect(result.boards[0].board_id).toBe('b1');
    });
  });
});
