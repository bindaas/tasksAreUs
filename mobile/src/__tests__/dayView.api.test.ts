jest.mock('../firebase', () => ({ auth: { currentUser: null } }));

const mockApiFetch = jest.fn();
jest.mock('../api/client', () => ({ apiFetch: (...args: unknown[]) => mockApiFetch(...args) }));

import { getDayViewTasks } from '../api/dayView';

describe('dayView API', () => {
  beforeEach(() => {
    mockApiFetch.mockReset();
  });

  describe('getDayViewTasks', () => {
    it('calls GET /day-view/tasks?reference_date=...', async () => {
      mockApiFetch.mockResolvedValue({ boards: [] });
      await getDayViewTasks('2026-07-01');
      expect(mockApiFetch).toHaveBeenCalledWith('/day-view/tasks?reference_date=2026-07-01');
    });

    it('returns boards array', async () => {
      const board = {
        board_id: 'b1',
        board_name: 'Work',
        board_color: '#6366f1',
        tasks: [],
      };
      mockApiFetch.mockResolvedValue({ boards: [board] });
      const result = await getDayViewTasks('2026-07-01');
      expect(result.boards).toHaveLength(1);
      expect(result.boards[0].board_id).toBe('b1');
    });
  });
});
