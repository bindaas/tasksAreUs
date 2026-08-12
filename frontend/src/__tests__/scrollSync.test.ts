import { describe, it, expect } from 'vitest';
import { computeSyncedScrollTop } from '../utils/scrollSync';

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
