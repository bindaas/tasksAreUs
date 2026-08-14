import { describe, it, expect } from 'vitest';
import { PRIORITY_CARD_BG, taskCardBg } from '../utils/priorityColor';

describe('PRIORITY_CARD_BG', () => {
  it('maps high to a light orange background', () => {
    expect(PRIORITY_CARD_BG.high).toBe('bg-orange-50');
  });

  it('maps medium to a light blue background', () => {
    expect(PRIORITY_CARD_BG.medium).toBe('bg-blue-50');
  });

  it('maps normal to a light green background', () => {
    expect(PRIORITY_CARD_BG.normal).toBe('bg-green-50');
  });
});

describe('taskCardBg', () => {
  it('shades overdue cards red regardless of priority', () => {
    expect(taskCardBg('overdue', 'high')).toBe('bg-red-50');
    expect(taskCardBg('overdue', 'medium')).toBe('bg-red-50');
    expect(taskCardBg('overdue', 'normal')).toBe('bg-red-50');
  });

  it('leaves Upcoming and No Date cards untinted regardless of priority', () => {
    expect(taskCardBg('upcoming', 'normal')).toBe('bg-white');
    expect(taskCardBg('nodate', 'normal')).toBe('bg-white');
  });

  it('falls through to the tier color for eligible columns', () => {
    for (const columnKey of ['today', 'tomorrow', 'day_after_tomorrow', 'monday'] as const) {
      expect(taskCardBg(columnKey, 'high')).toBe('bg-orange-50');
      expect(taskCardBg(columnKey, 'medium')).toBe('bg-blue-50');
      expect(taskCardBg(columnKey, 'normal')).toBe('bg-green-50');
    }
  });
});
