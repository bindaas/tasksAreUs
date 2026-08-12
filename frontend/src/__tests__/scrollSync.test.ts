import { describe, it, expect } from 'vitest';
import { computeSyncedScrollTop, shouldApplySync } from '../utils/scrollSync';

describe('computeSyncedScrollTop', () => {
  it('maps a mid-scroll fraction onto a differently-sized target', () => {
    const source = { scrollTop: 50, scrollHeight: 200, clientHeight: 100 }; // 50/100 = 0.5
    const target = { scrollHeight: 400, clientHeight: 200 }; // range 200
    expect(computeSyncedScrollTop(source, target)).toBe(100);
  });

  it('maps scrolled-to-top to scrolled-to-top', () => {
    const source = { scrollTop: 0, scrollHeight: 200, clientHeight: 100 };
    const target = { scrollHeight: 400, clientHeight: 200 };
    expect(computeSyncedScrollTop(source, target)).toBe(0);
  });

  it('maps scrolled-to-bottom to scrolled-to-bottom', () => {
    const source = { scrollTop: 100, scrollHeight: 200, clientHeight: 100 };
    const target = { scrollHeight: 400, clientHeight: 200 };
    expect(computeSyncedScrollTop(source, target)).toBe(200);
  });

  it('returns null when the source has no scrollable range', () => {
    const source = { scrollTop: 0, scrollHeight: 100, clientHeight: 100 };
    const target = { scrollHeight: 400, clientHeight: 200 };
    expect(computeSyncedScrollTop(source, target)).toBeNull();
  });

  it('returns null when the target has no scrollable range', () => {
    const source = { scrollTop: 50, scrollHeight: 200, clientHeight: 100 };
    const target = { scrollHeight: 100, clientHeight: 100 };
    expect(computeSyncedScrollTop(source, target)).toBeNull();
  });
});

describe('shouldApplySync', () => {
  it('applies when the computed position differs meaningfully from the current one', () => {
    expect(shouldApplySync(0, 100)).toBe(true);
  });

  it('skips when the computed position already matches the current one', () => {
    expect(shouldApplySync(100, 100)).toBe(false);
  });

  it('skips sub-pixel drift below the epsilon', () => {
    expect(shouldApplySync(100, 100.4)).toBe(false);
  });

  it('applies at exactly the epsilon boundary', () => {
    expect(shouldApplySync(100, 101)).toBe(true);
  });

  it('breaks a mutual-listener feedback loop: reciprocal call naturally no-ops', () => {
    // Pane A syncs pane B to 100 (a real move)...
    expect(shouldApplySync(0, 100)).toBe(true);
    // ...pane B's own scroll listener then recomputes a value for pane A
    // that lands back within epsilon of A's actual (unchanged) position,
    // so the reciprocal write is skipped instead of ping-ponging forever.
    expect(shouldApplySync(50, 50.2)).toBe(false);
  });
});
