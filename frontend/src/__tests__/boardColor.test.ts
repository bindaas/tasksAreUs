import { describe, it, expect } from 'vitest';
import { getBoardColor, PALETTE } from '../utils/boardColor';

describe('getBoardColor', () => {
  it('returns the explicit color as-is when set', () => {
    expect(getBoardColor('#123456', 0)).toBe('#123456');
    expect(getBoardColor('#123456', 5)).toBe('#123456');
  });

  it('falls back to the palette by index when color is null', () => {
    expect(getBoardColor(null, 0)).toBe(PALETTE[0]);
    expect(getBoardColor(null, 2)).toBe(PALETTE[2]);
  });

  it('falls back to the palette by index when color is undefined', () => {
    expect(getBoardColor(undefined, 1)).toBe(PALETTE[1]);
  });

  it('wraps the index past the palette length', () => {
    expect(getBoardColor(null, PALETTE.length)).toBe(PALETTE[0]);
    expect(getBoardColor(null, PALETTE.length + 3)).toBe(PALETTE[3]);
  });
});
