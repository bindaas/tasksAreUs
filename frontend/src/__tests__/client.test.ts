import { vi, describe, it, expect, beforeEach } from 'vitest';
import { apiFetch } from '../api/client';

// Mutable mock — tests can set currentUser before each call
const mockAuth = vi.hoisted(() => ({
  currentUser: null as { getIdToken: () => Promise<string> } | null,
}));

vi.mock('../firebase', () => ({ auth: mockAuth }));

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

function okResponse(body = {}) {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  } as Response);
}

function errorResponse(status: number, detail: string) {
  return Promise.resolve({
    ok: false,
    status,
    statusText: 'Error',
    text: () => Promise.resolve(JSON.stringify({ detail })),
  } as Response);
}

describe('apiFetch', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockAuth.currentUser = null;
  });

  it('attaches Authorization Bearer header when currentUser exists', async () => {
    mockAuth.currentUser = { getIdToken: vi.fn().mockResolvedValue('test-token-abc') };
    mockFetch.mockReturnValue(okResponse({ ok: true }));

    await apiFetch('/tasks');

    const [, options] = mockFetch.mock.calls[0];
    expect(options.headers['Authorization']).toBe('Bearer test-token-abc');
  });

  it('omits Authorization header when currentUser is null', async () => {
    mockAuth.currentUser = null;
    mockFetch.mockReturnValue(okResponse({ ok: true }));

    await apiFetch('/tasks');

    const [, options] = mockFetch.mock.calls[0];
    expect(options.headers['Authorization']).toBeUndefined();
  });

  it('always sets Content-Type to application/json', async () => {
    mockFetch.mockReturnValue(okResponse());

    await apiFetch('/tasks');

    const [, options] = mockFetch.mock.calls[0];
    expect(options.headers['Content-Type']).toBe('application/json');
  });

  it('calls the correct URL', async () => {
    mockFetch.mockReturnValue(okResponse());

    await apiFetch('/tasks');

    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe('/api/v1/tasks');
  });

  it('throws with the detail message on API error', async () => {
    mockFetch.mockReturnValue(errorResponse(401, 'Authentication required'));

    await expect(apiFetch('/tasks')).rejects.toThrow('Authentication required');
  });

  it('returns undefined for 204 No Content', async () => {
    mockFetch.mockReturnValue(
      Promise.resolve({ ok: true, status: 204, json: vi.fn(), text: vi.fn() } as unknown as Response)
    );

    const result = await apiFetch('/tasks/123/complete');
    expect(result).toBeUndefined();
  });
});
