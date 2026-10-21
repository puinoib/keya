import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchUsage, usageRequestUrl } from '../usage';

const SUBJECT = {
  provider: 'OpenCode Go',
  endpoint: 'https://opencode.ai/inference/go',
  secret: 'synthetic-secret',
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('usage request policy', () => {
  it('refuses a plain http endpoint without asking for consent', async () => {
    const authorize = vi.fn(async () => true);

    // A vendor host is upgraded to its https metadata URL; any other endpoint
    // keeps the user's scheme, and http is where the key would travel in clear.
    const result = await fetchUsage(
      { ...SUBJECT, endpoint: 'http://proxy.example.test/v1' },
      { authorize }
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.failure.kind).toBe('network');
    expect(authorize).not.toHaveBeenCalled();
  });

  it('sends nothing until the request is approved', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchUsage(SUBJECT, {
      authorize: async () => false,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.failure.kind).toBe('unapproved');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('asks the approved URL with the stored key as a bearer token', async () => {
    const fetchMock = vi.fn(
      async (_url: string, _init: RequestInit) => ({
        status: 401,
        url: usageRequestUrl(SUBJECT),
        headers: { get: () => 'application/json' },
        json: async () => ({}),
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    await fetchUsage(SUBJECT, { authorize: async () => true });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(usageRequestUrl(SUBJECT));
    expect((init.headers as Record<string, string>).Authorization).toBe(
      'Bearer synthetic-secret'
    );
  });
});
