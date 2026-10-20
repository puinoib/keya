import { afterEach, describe, expect, it, vi } from 'vitest';
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
