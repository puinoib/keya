import type { ApiKey } from '../../core/types';

export interface TestResult {
  success: boolean;
  latency_ms: number;
  error?: string;
}

const DEFAULT_TIMEOUT_MS = 10_000;

async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function extractError(res: Response): Promise<string> {
  try {
    const body = await res.json();
    return (
      body?.error?.message ||
      body?.error?.type ||
      body?.message ||
      `HTTP ${res.status}`
    );
  } catch {
    return `HTTP ${res.status}`;
  }
}

export class ApiTester {
  static async testKey(key: ApiKey): Promise<TestResult> {
    return ApiTester.testRaw(key.provider, key.endpoint, key.key);
  }

  static async testRaw(
    provider: string,
    endpoint: string,
    key: string
  ): Promise<TestResult> {
    const start = performance.now();

    try {
      const result = await ApiTester.testByProvider(
        provider.toLowerCase(),
        endpoint,
        key
      );
      const latency = Math.round(performance.now() - start);
      return { ...result, latency_ms: latency };
    } catch (err) {
      const latency = Math.round(performance.now() - start);
      if (err instanceof DOMException && err.name === 'AbortError') {
        return {
          success: false,
          latency_ms: latency,
          error: 'Request timed out',
        };
      }
      return {
        success: false,
        latency_ms: latency,
        error: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  }

  private static async testByProvider(
    provider: string,
    endpoint: string,
    key: string
  ): Promise<{ success: boolean; error?: string }> {
    const openaiCompatible = [
      'openai',
      'groq',
      'deepseek',
      'moonshot',
      'zhipu',
      'mistral',
      'together',
      'openrouter',
      'siliconflow',
    ];
    if (openaiCompatible.includes(provider))
      return ApiTester.testOpenAI(endpoint, key);
    if (provider === 'anthropic') return ApiTester.testAnthropic(endpoint, key);
    if (provider === 'google') return ApiTester.testGoogle(endpoint, key);
    if (provider === 'cohere') return ApiTester.testCohere(endpoint, key);
    if (provider === 'baidu') return ApiTester.testBaidu(endpoint, key);
    if (provider === 'azure') return ApiTester.testOpenAI(endpoint, key);
    return ApiTester.testGeneric(endpoint, key);
  }

  private static async testOpenAI(endpoint: string, key: string) {
    try {
      const url = endpoint.endsWith('/models')
        ? endpoint
        : `${endpoint}/models`;
      const res = await fetchWithTimeout(url, {
        headers: { Authorization: `Bearer ${key}` },
      });
      if (res.ok) return { success: true };
      return { success: false, error: await extractError(res) };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  }

  private static async testAnthropic(endpoint: string, key: string) {
    try {
      const url = endpoint.endsWith('/messages')
        ? endpoint
        : `${endpoint}/messages`;
      const res = await fetchWithTimeout(url, {
        method: 'POST',
        headers: {
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-3-haiku-20240307',
          max_tokens: 1,
          messages: [{ role: 'user', content: 'Hi' }],
        }),
      });
      if (res.ok) return { success: true };
      // 400 = valid key, just bad params — key itself is fine
      if (res.status === 400) return { success: true };
      return { success: false, error: await extractError(res) };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  }

  private static async testGoogle(endpoint: string, key: string) {
    try {
      const res = await fetchWithTimeout(`${endpoint}/models?key=${key}`);
      if (res.ok) return { success: true };
      return { success: false, error: await extractError(res) };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  }

  private static async testCohere(endpoint: string, key: string) {
    try {
      const res = await fetchWithTimeout(`${endpoint}/v2/models`, {
        headers: { Authorization: `Bearer ${key}` },
      });
      if (res.ok) return { success: true };
      return { success: false, error: await extractError(res) };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  }

  private static async testBaidu(endpoint: string, key: string) {
    try {
      const parts = key.split(':');
      if (parts.length === 2) {
        const [ak, sk] = parts;
        const tokenUrl = `https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=${ak}&client_secret=${sk}`;
        const res = await fetchWithTimeout(tokenUrl);
        if (res.ok) {
          const body = await res.json();
          if (body.access_token) return { success: true };
          return {
            success: false,
            error: body.error_description || 'Invalid credentials',
          };
        }
        return { success: false, error: await extractError(res) };
      }
      // Fallback: treat as access_token
      const res = await fetchWithTimeout(endpoint, {
        headers: { Authorization: `Bearer ${key}` },
      });
      if (res.ok) return { success: true };
      return { success: false, error: await extractError(res) };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  }

  private static async testGeneric(endpoint: string, key: string) {
    try {
      const res = await fetchWithTimeout(endpoint, {
        method: 'GET',
        headers: { Authorization: `Bearer ${key}` },
      });
      if (res.ok) return { success: true };
      if (res.status === 401 || res.status === 403) {
        return { success: false, error: 'Invalid API key' };
      }
      return { success: false, error: await extractError(res) };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  }
}
