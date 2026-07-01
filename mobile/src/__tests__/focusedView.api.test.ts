jest.mock('../firebase', () => ({ auth: { currentUser: null } }));

const mockApiFetch = jest.fn();
jest.mock('../api/client', () => ({ apiFetch: (...args: unknown[]) => mockApiFetch(...args) }));

import { getFocusedViewConfig, updateFocusedViewConfig, getFocusedViewTasks } from '../api/focusedView';

const makeConfig = (overrides = {}) => ({
  id: 'cfg1',
  user_id: 'u1',
  board_selection: 'all' as const,
  selected_board_ids: [],
  day_range: 'today' as const,
  ...overrides,
});

describe('focusedView API', () => {
  beforeEach(() => {
    mockApiFetch.mockReset();
  });

  describe('getFocusedViewConfig', () => {
    it('calls GET /focused-view/config', async () => {
      mockApiFetch.mockResolvedValue(makeConfig());
      await getFocusedViewConfig();
      expect(mockApiFetch).toHaveBeenCalledWith('/focused-view/config');
    });

    it('returns the config object', async () => {
      const cfg = makeConfig({ board_selection: 'selected', selected_board_ids: ['b1'] });
      mockApiFetch.mockResolvedValue(cfg);
      const result = await getFocusedViewConfig();
      expect(result.board_selection).toBe('selected');
      expect(result.selected_board_ids).toEqual(['b1']);
    });
  });

  describe('updateFocusedViewConfig', () => {
    it('calls PUT /focused-view/config with all required fields', async () => {
      mockApiFetch.mockResolvedValue(makeConfig({ day_range: 'today_tomorrow' }));
      await updateFocusedViewConfig({
        board_selection: 'all',
        selected_board_ids: [],
        day_range: 'today_tomorrow',
      });
      expect(mockApiFetch).toHaveBeenCalledWith('/focused-view/config', {
        method: 'PUT',
        body: JSON.stringify({
          board_selection: 'all',
          selected_board_ids: [],
          day_range: 'today_tomorrow',
        }),
      });
    });

    it('sends empty selected_board_ids when board_selection is all', async () => {
      mockApiFetch.mockResolvedValue(makeConfig());
      await updateFocusedViewConfig({
        board_selection: 'all',
        selected_board_ids: [],
        day_range: 'today',
      });
      const body = JSON.parse(mockApiFetch.mock.calls[0][1].body);
      expect(body.selected_board_ids).toEqual([]);
    });
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
