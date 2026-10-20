import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Settings } from '../../../core/types';
import { ApiTester } from '../api-tester';

function jsonResponse(body: unknown = {}, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function htmlResponse(): Response {
  return new Response('<html><body>app</body></html>', {
    status: 200,
    headers: { 'content-type': 'text/html' },
  });
}

afterEach(() => vi.unstubAllGlobals());

describe('ApiTester endpoint validation', () => {
  it('rejects an empty endpoint without making a request', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const result = await ApiTester.testRaw('OpenAI', '', 'sk-test');

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Endpoint is required/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects relative and non-HTTP endpoints', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    for (const endpoint of ['/models', 'file:///tmp/key', 'javascript:1']) {
      const result = await ApiTester.testRaw('OpenAI', endpoint, 'sk-test');
      expect(result.success, endpoint).toBe(false);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not treat an HTML SPA fallback as a successful API response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => htmlResponse())
    );

    const result = await ApiTester.testRaw(
      'OpenAI',
      'https://api.openai.com/v1',
      'sk-test'
    );

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/HTML page/);
  });

  it('uses the OpenAI-compatible models endpoint', async () => {
    const fetchMock = vi.fn(async () => jsonResponse());
    vi.stubGlobal('fetch', fetchMock);

    const result = await ApiTester.testRaw(
      'Alibaba Cloud',
      'https://dashscope.aliyuncs.com/compatible-mode/v1',
      'sk-test'
    );

    expect(result.success).toBe(true);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe(
      'https://dashscope.aliyuncs.com/compatible-mode/v1/models'
    );
    expect((init.headers as Record<string, string>).Authorization).toBe(
      'Bearer sk-test'
    );
  });

  it('routes newer presets to their OpenAI-compatible models endpoint', async () => {
    const fetchMock = vi.fn(async () => jsonResponse());
    vi.stubGlobal('fetch', fetchMock);

    const cases: [string, string, string][] = [
      [
        'Cerebras',
        'https://api.cerebras.ai/v1',
        'https://api.cerebras.ai/v1/models',
      ],
      [
        'Fireworks',
        'https://api.fireworks.ai/inference/v1',
        'https://api.fireworks.ai/inference/v1/models',
      ],
      [
        'Vercel AI Gateway',
        'https://ai-gateway.vercel.sh/v1',
        'https://ai-gateway.vercel.sh/v1/models',
      ],
    ];

    for (const [provider, endpoint, expectedUrl] of cases) {
      fetchMock.mockClear();
      const result = await ApiTester.testRaw(provider, endpoint, 'sk-test');

      expect(result.success, provider).toBe(true);
      const [url] = fetchMock.mock.calls[0] as unknown as [string];
      expect(url, provider).toBe(expectedUrl);
    }
  });
});

describe('ApiTester provider routing', () => {
  it('uses the Anthropic models endpoint with browser CORS header', async () => {
    const fetchMock = vi.fn(async () => jsonResponse());
    vi.stubGlobal('fetch', fetchMock);

    const result = await ApiTester.testRaw(
      'Anthropic',
      'https://api.anthropic.com/v1/messages',
      'sk-ant'
    );

    expect(result.success).toBe(true);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe('https://api.anthropic.com/v1/models');
    expect(init.method).toBeUndefined();
    expect(init.headers).toMatchObject({
      'x-api-key': 'sk-ant',
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    });
  });

  it('routes Azure OpenAI to its models endpoint with an api-key header', async () => {
    const fetchMock = vi.fn(async () => jsonResponse());
    vi.stubGlobal('fetch', fetchMock);

    const result = await ApiTester.testRaw(
      'Azure OpenAI',
      'https://resource.openai.azure.com',
      'azure-key'
    );

    expect(result.success).toBe(true);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe(
      'https://resource.openai.azure.com/openai/models?api-version=2024-10-21'
    );
    expect((init.headers as Record<string, string>)['api-key']).toBe(
      'azure-key'
    );
  });

  it('reports unsupported providers instead of pretending success', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const result = await ApiTester.testRaw(
      'Amazon Bedrock',
      'https://bedrock-runtime.us-east-1.amazonaws.com',
      'aws-key'
    );

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/AWS request signing/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('explains providers that cannot be tested from a browser', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const nvidia = await ApiTester.testRaw(
      'NVIDIA NIM',
      'https://integrate.api.nvidia.com/v1',
      'nvapi-key'
    );
    expect(nvidia.success).toBe(false);
    expect(nvidia.error).toMatch(/no CORS headers/i);

    const baseten = await ApiTester.testRaw(
      'Baseten',
      'https://inference.baseten.co/v1',
      'baseten-key'
    );
    expect(baseten.success).toBe(false);
    expect(baseten.error).toMatch(/no CORS headers/i);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('uses the authenticated metadata endpoint where the model list is public', async () => {
    const fetchMock = vi.fn(async () => jsonResponse());
    vi.stubGlobal('fetch', fetchMock);

    const cases: [string, string, string][] = [
      [
        'OpenRouter',
        'https://openrouter.ai/api/v1',
        'https://openrouter.ai/api/v1/key',
      ],
      [
        'Hugging Face',
        'https://router.huggingface.co/v1',
        'https://huggingface.co/api/whoami-v2',
      ],
      ['GitHub', 'https://api.github.com', 'https://api.github.com/user'],
      ['Vercel', 'https://api.vercel.com', 'https://api.vercel.com/v2/user'],
      ['Stripe', 'https://api.stripe.com', 'https://api.stripe.com/v1/balance'],
      ['Cohere', 'https://api.cohere.com', 'https://api.cohere.com/v1/models'],
      [
        'Stability AI',
        'https://api.stability.ai',
        'https://api.stability.ai/v1/user/account',
      ],
      [
        'Firecrawl',
        'https://api.firecrawl.dev',
        'https://api.firecrawl.dev/v1/team/credit-usage',
      ],
    ];

    for (const [provider, endpoint, expectedUrl] of cases) {
      fetchMock.mockClear();
      const result = await ApiTester.testRaw(provider, endpoint, 'probe-key');

      expect(result.success, provider).toBe(true);
      const [url, init] = fetchMock.mock.calls[0] as unknown as [
        string,
        RequestInit,
      ];
      expect(url, provider).toBe(expectedUrl);
      expect((init.headers as Record<string, string>).Authorization).toBe(
        'Bearer probe-key'
      );
    }
  });

  it('reports HTTP failures', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse({ error: { message: 'Unauthorized' } }, 401)
      )
    );

    const result = await ApiTester.testRaw(
      'OpenAI',
      'https://api.openai.com/v1',
      'bad-key'
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe('Unauthorized');
  });
});

function settingsWith(customProviders: Settings['custom_providers']): Settings {
  return {
    auto_lock_minutes: 5,
    auto_test_on_save: false,
    auto_test_daily: false,
    clipboard_detection_on_add: true,
    custom_providers: customProviders,
    disabled_providers: [],
  };
}

describe('ApiTester check kinds', () => {
  it('treats preset providers as credential checks', () => {
    expect(ApiTester.checkKindFor('GitHub')).toBe('credential');
    expect(ApiTester.checkKindFor('OpenAI')).toBe('credential');
  });

  it('reports presets that a browser cannot verify', () => {
    expect(ApiTester.checkKindFor('NVIDIA NIM')).toBe('unverifiable');
    expect(ApiTester.checkKindFor('Amazon Bedrock')).toBe('unverifiable');
  });

  it('uses reachability for custom providers without a configured check', () => {
    const settings = settingsWith([
      { name: 'Exa', endpoint: 'https://api.exa.ai' },
    ]);
    expect(ApiTester.checkKindFor('Exa', settings)).toBe('reachability');
  });

  it('uses a credential check when the custom provider configures one', () => {
    const settings = settingsWith([
      {
        name: 'Exa',
        endpoint: 'https://api.exa.ai',
        check: { auth: 'x-api-key', path: '/v1/models' },
      },
    ]);
    expect(ApiTester.checkKindFor('exa', settings)).toBe('credential');
  });
});

describe('reachability checks', () => {
  const settings = settingsWith([
    { name: 'Exa', endpoint: 'https://api.exa.ai' },
  ]);

  it('never sends the key and avoids CORS preflight', async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await ApiTester.testRaw(
      'Exa',
      'https://api.exa.ai',
      'exa-key',
      settings
    );

    expect(result.success).toBe(true);
    expect(result.kind).toBe('reachability');

    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe('https://api.exa.ai');
    expect(init.method).toBe('GET');
    expect(init.mode).toBe('no-cors');
    expect(init.headers).toBeUndefined();
  });

  it('does not blame the credential when the host is unreachable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch');
      })
    );

    const result = await ApiTester.testRaw(
      'Exa',
      'https://api.exa.ai',
      'exa-key',
      settings
    );

    expect(result.success).toBe(false);
    expect(result.kind).toBe('reachability');
    expect(result.error).toMatch(/key was not sent/i);
    expect(result.error).not.toMatch(/invalid api key/i);
  });
});

describe('configured custom checks', () => {
  it('sends the key with the configured header and path', async () => {
    const fetchMock = vi.fn(async () => jsonResponse());
    vi.stubGlobal('fetch', fetchMock);
    const settings = settingsWith([
      {
        name: 'Exa',
        endpoint: 'https://api.exa.ai',
        check: { auth: 'x-api-key', path: '/v1/models' },
      },
    ]);

    const result = await ApiTester.testRaw(
      'Exa',
      'https://api.exa.ai',
      'exa-key',
      settings
    );

    expect(result.success).toBe(true);
    expect(result.kind).toBe('credential');

    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe('https://api.exa.ai/v1/models');
    expect(init.method).toBe('GET');
    expect((init.headers as Record<string, string>)['x-api-key']).toBe(
      'exa-key'
    );
  });

  it('reports a rejected credential without inventing a verdict', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('', { status: 401 }))
    );
    const settings = settingsWith([
      {
        name: 'Exa',
        endpoint: 'https://api.exa.ai',
        check: { auth: 'bearer' },
      },
    ]);

    const result = await ApiTester.testRaw(
      'Exa',
      'https://api.exa.ai',
      'exa-key',
      settings
    );

    expect(result.success).toBe(false);
    expect(result.kind).toBe('credential');
    expect(result.error).toBe(
      'The provider rejected the credential (HTTP 401).'
    );
  });

  it('treats a browser-blocked response as unverifiable, not invalid', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch');
      })
    );
    const settings = settingsWith([
      {
        name: 'Exa',
        endpoint: 'https://api.exa.ai',
        check: { auth: 'bearer' },
      },
    ]);

    const result = await ApiTester.testRaw(
      'Exa',
      'https://api.exa.ai',
      'exa-key',
      settings
    );

    expect(result.success).toBe(false);
    expect(result.kind).toBe('unverifiable');
    expect(result.error).toMatch(/CORS/);
    expect(result.error).toMatch(/not proof that it is invalid/);
  });
});

describe('preset error copy', () => {
  it('explains a 403 without claiming the key is invalid', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('', { status: 403 }))
    );

    const result = await ApiTester.testRaw(
      'GitHub',
      'https://api.github.com',
      'gh-token'
    );

    expect(result.kind).toBe('credential');
    expect(result.error).toMatch(/HTTP 403/);
    expect(result.error).toMatch(/lack permission|rate limited/);
    expect(result.error).not.toMatch(/invalid api key/i);
  });

  it('never reports an unverifiable preset as a failed credential', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const result = await ApiTester.testRaw(
      'NVIDIA NIM',
      'https://integrate.api.nvidia.com/v1',
      'nvapi-key'
    );

    expect(result.success).toBe(false);
    expect(result.kind).toBe('unverifiable');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
