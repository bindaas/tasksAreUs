import { isValidLinkUrl, MAX_TASK_LINKS } from '../utils/taskLinks';

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
