import type { ApiKey } from '../../core/types';

export interface TestResult {
  success: boolean;
  latency_ms: number;
  error?: string;
}

export class ApiTester {
  static async testKey(key: ApiKey): Promise<TestResult> {
    return this.testRaw(key.provider, key.endpoint, key.key);
  }

  static async testRaw(provider: string, endpoint: string, key: string): Promise<TestResult> {
    const start = performance.now();

    try {
      const result = await this.testByProvider(provider.toLowerCase(), endpoint, key);
      const latency = Math.round(performance.now() - start);
      return { ...result, latency_ms: latency };
    } catch (err) {
      return {
        success: false,
        latency_ms: Math.round(performance.now() - start),
        error: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  }

  private static async testByProvider(provider: string, endpoint: string, key: string): Promise<{ success: boolean; error?: string }> {
    // OpenAI-compatible providers (shared /models endpoint)
    const openaiCompatible = ['openai', 'groq', 'deepseek', 'moonshot', 'zhipu', 'mistral', 'together', 'openrouter', 'siliconflow'];
    if (openaiCompatible.includes(provider)) return this.testOpenAI(endpoint, key);
    if (provider === 'anthropic') return this.testAnthropic(endpoint, key);
    if (provider === 'google') return this.testGoogle(endpoint, key);
    if (provider === 'cohere') return this.testCohere(endpoint, key);
    if (provider === 'baidu') return this.testBaidu(endpoint, key);
    if (provider === 'azure') return this.testOpenAI(endpoint, key);
    return this.testGeneric(endpoint, key);
  }

  private static async testOpenAI(endpoint: string, key: string) {
    try {
      const url = endpoint.endsWith('/models') ? endpoint : `${endpoint}/models`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${key}` },
      });
      if (res.ok) return { success: true };
      return { success: false, error: `HTTP ${res.status}` };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  }

  private static async testAnthropic(endpoint: string, key: string) {
    try {
      const url = endpoint.endsWith('/messages') ? endpoint : `${endpoint}/messages`;
      const res = await fetch(url, {
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
      return { success: false, error: `HTTP ${res.status}` };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  }

  private static async testGoogle(endpoint: string, key: string) {
    try {
      const res = await fetch(`${endpoint}/models?key=${key}`);
      if (res.ok) return { success: true };
      return { success: false, error: `HTTP ${res.status}` };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  }

  private static async testCohere(endpoint: string, key: string) {
    try {
      const res = await fetch(`${endpoint}/v2/models`, {
        headers: { Authorization: `Bearer ${key}` },
      });
      if (res.ok) return { success: true };
      return { success: false, error: `HTTP ${res.status}` };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  }

  private static async testBaidu(endpoint: string, key: string) {
    // Baidu uses OAuth, try a lightweight check
    try {
      const res = await fetch(endpoint, {
        method: 'HEAD',
      });
      if (res.ok || res.status === 401) return { success: true };
      return { success: false, error: `HTTP ${res.status}` };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  }

  private static async testGeneric(endpoint: string, key: string) {
    try {
      const res = await fetch(endpoint, {
        method: 'HEAD',
        headers: { Authorization: `Bearer ${key}` },
      });
      if (res.ok) return { success: true };
      return { success: false, error: `HTTP ${res.status}` };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  }
}
