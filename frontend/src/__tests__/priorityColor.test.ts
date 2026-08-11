import { describe, it, expect } from 'vitest';
import { PRIORITY_CARD_BG } from '../utils/priorityColor';

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
