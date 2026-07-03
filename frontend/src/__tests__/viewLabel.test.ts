import { describe, it, expect } from 'vitest';
import { viewLabel } from '../utils/viewLabel';

describe('viewLabel', () => {
  it('returns Focused for the focused view', () => {
    expect(viewLabel('focused', 'General tasks')).toBe('Focused');
  });

  it('returns Today for the today view', () => {
    expect(viewLabel('today', 'General tasks')).toBe('Today');
  });

  it('returns Tomorrow for the tomorrow view', () => {
    expect(viewLabel('tomorrow', 'General tasks')).toBe('Tomorrow');
  });

  it('returns the active board name for the all view', () => {
    expect(viewLabel('all', 'Job search')).toBe('Job search');
  });

  it('returns an empty string for the all view when no board is active', () => {
    expect(viewLabel('all', undefined)).toBe('');
  });
});
