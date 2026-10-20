import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ApiKey } from '../../../core/types';
import {
  type UsageResult,
  describeAge,
  describeReset,
  fetchUsage,
  readOpenCodeGoUsage,
  resolveUsageUrl,
  supportsUsage,
  usageUrlFor,
  tightestWindow,
  unsupportedUsageReason,
} from '../usage';

function jsonResponse(body: unknown = {}, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function makeKey(overrides: Partial<ApiKey> = {}): ApiKey {
  return {
    id: 'key-1',
    name: 'Go subscription',
    description: '',
    provider: 'OpenCode Go',
    endpoint: 'https://opencode.ai/zen/go/v1',
    key: 'sk-go-test',
    group_id: null,
    expires_at: null,
    archived_at: null,
    connection_check: {
      status: 'untested',
      checked_at: null,
      latency_ms: null,
      error_message: null,
    },
    created_at: '2026-10-01T00:00:00.000Z',
    updated_at: '2026-10-01T00:00:00.000Z',
    ...overrides,
  };
}

function expectFailure(result: UsageResult) {
  if (result.ok) throw new Error('expected a failure result');
  return result.failure;
}

afterEach(() => vi.unstubAllGlobals());

describe('OpenCode Go usage parsing', () => {
  it('reads the three allowance windows', () => {
    const windows = readOpenCodeGoUsage({
      usage: {
        rolling: {
          status: 'ok',
          percent: 0,
          resetsAt: '2026-09-25T20:00:00.000Z',
        },
        weekly: {
          status: 'ok',
          percent: 62,
          resetsAt: '2026-09-28T00:00:00.000Z',
        },
        monthly: {
          status: 'rate-limited',
          percent: 100,
          resetsAt: '2026-10-11T00:00:00.000Z',
        },
      },
    });

    expect(windows).toEqual([
      // A window at 0% carries a placeholder reset, so it is dropped.
      { id: 'rolling', label: '5 hours', percent_used: 0, resets_at: null },
      {
        id: 'weekly',
        label: '7 days',
        percent_used: 62,
        resets_at: '2026-09-28T00:00:00.000Z',
      },
      {
        id: 'monthly',
        label: 'Month',
        percent_used: 100,
        resets_at: '2026-10-11T00:00:00.000Z',
      },
    ]);
  });

  it('keeps windows that the provider leaves out of the reply', () => {
    const windows = readOpenCodeGoUsage({
      usage: { weekly: { status: 'ok', percent: 12.5, resetsAt: '' } },
    });

    expect(windows).toEqual([
      { id: 'weekly', label: '7 days', percent_used: 12.5, resets_at: null },
    ]);
  });

  it('reads the older flat reply when it carries percentages', () => {
    const windows = readOpenCodeGoUsage({
      useBalance: false,
      rollingUsage: { percent: 30 },
      weeklyUsage: { percent: 10 },
    });

    expect(windows?.map((window) => window.percent_used)).toEqual([30, 10]);
  });

  it('refuses an unknown shape instead of reporting zero', () => {
    expect(readOpenCodeGoUsage({ rollingUsage: {} })).toBeNull();
    expect(readOpenCodeGoUsage({ data: { usage: 1 } })).toBeNull();
    expect(readOpenCodeGoUsage(null)).toBeNull();
    expect(readOpenCodeGoUsage('nope')).toBeNull();
  });

  it('clamps impossible percentages', () => {
    const windows = readOpenCodeGoUsage({
      usage: {
        rolling: { percent: -4 },
        weekly: { percent: 180 },
      },
    });

    expect(windows?.map((window) => window.percent_used)).toEqual([0, 100]);
  });
});

describe('usage support', () => {
  it('knows which providers can be asked', () => {
    expect(supportsUsage('OpenCode Go')).toBe(true);
    expect(supportsUsage('  opencode go ')).toBe(true);
    expect(supportsUsage('OpenAI')).toBe(false);
    expect(supportsUsage('OpenCode Zen')).toBe(false);
  });

  it('explains the providers it cannot read', () => {
    expect(unsupportedUsageReason('OpenCode Zen')).toMatch(/no usage/i);
    expect(unsupportedUsageReason('OpenAI')).toBeNull();
  });

  it('routes the vendor host to the URL a browser can read', () => {
    const source = {
      url: 'https://opencode.ai/inference/go/v1/usage',
      hosts: ['opencode.ai'],
      path: '/usage',
    };

    for (const endpoint of [
      'https://opencode.ai/zen/go/v1',
      'https://opencode.ai/inference/go/v1',
      'https://opencode.ai/inference/go/v1/models',
      'https://opencode.ai/zen/go',
    ]) {
      expect(usageUrlFor(endpoint, source), endpoint).toBe(
        'https://opencode.ai/inference/go/v1/usage'
      );
    }
  });

  it('keeps a proxy or regional endpoint that is not the vendor host', () => {
    const source = {
      url: 'https://opencode.ai/inference/go/v1/usage',
      hosts: ['opencode.ai'],
      path: '/usage',
    };

    expect(usageUrlFor('https://llm-proxy.internal/go/v1', source)).toBe(
      'https://llm-proxy.internal/go/v1/usage'
    );
    expect(usageUrlFor('nope', source)).toBeNull();
  });

  it('derives the metadata URL from the configured endpoint', () => {
    expect(resolveUsageUrl('https://opencode.ai/zen/go/v1', '/usage')).toBe(
      'https://opencode.ai/zen/go/v1/usage'
    );
    expect(resolveUsageUrl('https://opencode.ai/zen/go/v1/', '/usage')).toBe(
      'https://opencode.ai/zen/go/v1/usage'
    );
    expect(
      resolveUsageUrl('https://opencode.ai/zen/go/v1/models', '/usage')
    ).toBe('https://opencode.ai/zen/go/v1/usage');
    expect(resolveUsageUrl('opencode.ai/zen/go/v1', '/usage')).toBeNull();
  });
});

describe('fetchUsage', () => {
  it('sends the key to the provider metadata endpoint only', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        usage: { monthly: { status: 'ok', percent: 7, resetsAt: '' } },
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchUsage(makeKey());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.snapshot.provider).toBe('OpenCode Go');
    expect(result.snapshot.windows).toHaveLength(1);
    expect(Date.parse(result.snapshot.checked_at)).not.toBeNaN();

    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    // The inference host answers the preflight an Authorization header forces;
    // the /zen/go/ gateway does not, and a browser can never read it.
    expect(url).toBe('https://opencode.ai/inference/go/v1/usage');
    expect(init.method).toBe('GET');
    expect((init.headers as Record<string, string>).Authorization).toBe(
      'Bearer sk-go-test'
    );
  });

  it('reports a rejected key as an auth failure, not as zero usage', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse(
          {
            type: 'error',
            error: { type: 'AuthError', message: 'Unauthorized' },
          },
          401
        )
      )
    );

    const failure = expectFailure(await fetchUsage(makeKey()));
    expect(failure.kind).toBe('auth');
    expect(failure.message).toBe('Unauthorized');
  });

  it('distinguishes a key without the plan from a bad key', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse(
          {
            type: 'error',
            error: {
              type: 'EntitlementError',
              message: 'OpenCode Go subscription required.',
            },
          },
          403
        )
      )
    );

    const failure = expectFailure(await fetchUsage(makeKey()));
    expect(failure.kind).toBe('forbidden');
    expect(failure.message).toMatch(/subscription required/i);
  });

  it('reports rate limiting and other HTTP failures', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({}, 429))
    );
    expect(expectFailure(await fetchUsage(makeKey())).kind).toBe(
      'rate_limited'
    );

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({}, 503))
    );
    const server = expectFailure(await fetchUsage(makeKey()));
    expect(server.kind).toBe('network');
    expect(server.message).toBe('HTTP 503');
  });

  it('reports an unrecognized reply as a shape failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ ok: true }))
    );

    const failure = expectFailure(await fetchUsage(makeKey()));
    expect(failure.kind).toBe('shape');
  });

  it('does not follow a redirect to another host with the key attached', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        url: 'https://elsewhere.example/usage',
        json: async () => ({ usage: { weekly: { percent: 5 } } }),
      }))
    );

    const failure = expectFailure(await fetchUsage(makeKey()));
    expect(failure.kind).toBe('network');
    expect(failure.message).toMatch(/redirected/i);
  });

  it('reports a blocked or unreachable request without blaming the key', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch');
      })
    );

    const failure = expectFailure(await fetchUsage(makeKey()));
    expect(failure.kind).toBe('network');
    expect(failure.message).not.toMatch(/invalid/i);
  });

  it('times out instead of hanging', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener('abort', () => {
              reject(new DOMException('aborted', 'AbortError'));
            });
          })
      )
    );

    const failure = expectFailure(
      await fetchUsage(makeKey(), { timeoutMs: 5 })
    );
    expect(failure.kind).toBe('timeout');
  });

  it('refuses providers without a usage source', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const failure = expectFailure(
      await fetchUsage(makeKey({ provider: 'OpenAI' }))
    );
    expect(failure.kind).toBe('unsupported');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('usage display helpers', () => {
  const now = new Date('2026-10-20T12:00:00.000Z');

  it('picks the tightest window', () => {
    expect(
      tightestWindow({
        provider: 'OpenCode Go',
        checked_at: now.toISOString(),
        windows: [
          {
            id: 'rolling',
            label: '5 hours',
            percent_used: 12,
            resets_at: null,
          },
          { id: 'weekly', label: '7 days', percent_used: 62, resets_at: null },
          { id: 'monthly', label: 'Month', percent_used: 40, resets_at: null },
        ],
      })?.label
    ).toBe('7 days');
    expect(tightestWindow(undefined)).toBeNull();
  });

  it('describes a reset at the right scale', () => {
    expect(describeReset('2026-10-20T12:14:00.000Z', now)).toBe(
      'resets in 14m'
    );
    expect(describeReset('2026-10-20T14:24:00.000Z', now)).toBe(
      'resets in 2h 24m'
    );
    expect(describeReset('2026-10-22T14:00:00.000Z', now)).toBe(
      'resets in 2d 2h'
    );
    expect(describeReset('2026-10-20T11:00:00.000Z', now)).toBeNull();
    expect(describeReset(null, now)).toBeNull();
  });

  it('describes how old a snapshot is', () => {
    expect(describeAge('2026-10-20T11:59:50.000Z', now)).toBe('just now');
    expect(describeAge('2026-10-20T11:56:00.000Z', now)).toBe('4m ago');
    expect(describeAge('2026-10-20T09:00:00.000Z', now)).toBe('3h ago');
    expect(describeAge(undefined, now)).toBeNull();
  });
});
