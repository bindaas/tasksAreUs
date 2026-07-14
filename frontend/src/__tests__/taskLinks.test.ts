import { describe, it, expect } from 'vitest';
import { isValidLinkUrl, MAX_TASK_LINKS, withReadyLinkRow } from '../utils/taskLinks';

describe('isValidLinkUrl', () => {
  it('accepts http URLs', () => {
    expect(isValidLinkUrl('http://example.com')).toBe(true);
  });

  it('accepts https URLs', () => {
    expect(isValidLinkUrl('https://example.com')).toBe(true);
  });

  it('accepts URLs with surrounding whitespace', () => {
    expect(isValidLinkUrl('  https://example.com  ')).toBe(true);
  });

  it('rejects javascript: URLs', () => {
    expect(isValidLinkUrl('javascript:alert(1)')).toBe(false);
  });

  it('rejects data: URLs', () => {
    expect(isValidLinkUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
  });

  it('rejects mailto: URLs', () => {
    expect(isValidLinkUrl('mailto:test@example.com')).toBe(false);
  });

  it('rejects schemeless input', () => {
    expect(isValidLinkUrl('example.com')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(isValidLinkUrl('')).toBe(false);
  });
});

describe('MAX_TASK_LINKS', () => {
  it('is 3', () => {
    expect(MAX_TASK_LINKS).toBe(3);
  });
});

describe('withReadyLinkRow', () => {
  function makeId() {
    let n = 0;
    return () => `new-${n++}`;
  }

  it('appends a blank row to an empty list', () => {
    const result = withReadyLinkRow([], makeId());
    expect(result).toEqual([{ id: 'new-0', url: '', description: '' }]);
  });

  it('appends a trailing blank row once the last row is filled', () => {
    const links = [{ id: 'a', url: 'https://example.com', description: 'Example' }];
    const result = withReadyLinkRow(links, makeId());
    expect(result).toEqual([
      { id: 'a', url: 'https://example.com', description: 'Example' },
      { id: 'new-0', url: '', description: '' },
    ]);
  });

  it('does not append when the last row is already blank', () => {
    const links = [
      { id: 'a', url: 'https://example.com', description: 'Example' },
      { id: 'b', url: '', description: '' },
    ];
    const result = withReadyLinkRow(links, makeId());
    expect(result).toBe(links);
  });

  it('does not append once at MAX_TASK_LINKS', () => {
    const links = [
      { id: 'a', url: 'https://a.com', description: 'A' },
      { id: 'b', url: 'https://b.com', description: 'B' },
      { id: 'c', url: 'https://c.com', description: 'C' },
    ];
    const result = withReadyLinkRow(links, makeId());
    expect(result).toBe(links);
  });

  it('collapses duplicate blank rows down to the first, preserving its id', () => {
    // Reproduces: user fills the trailing blank row (spawning a new blank
    // row after it), then clears the filled row back to blank — without
    // dedup this would leave two blank rows side by side.
    const links = [
      { id: 'a', url: 'https://example.com', description: 'Example' },
      { id: 'b', url: '', description: '' },
      { id: 'c', url: '', description: '' },
    ];
    const result = withReadyLinkRow(links, makeId());
    expect(result).toEqual([
      { id: 'a', url: 'https://example.com', description: 'Example' },
      { id: 'b', url: '', description: '' },
    ]);
  });

  it('treats a row with only whitespace as blank', () => {
    const links = [{ id: 'a', url: '   ', description: '  ' }];
    const result = withReadyLinkRow(links, makeId());
    expect(result).toBe(links);
  });
});
