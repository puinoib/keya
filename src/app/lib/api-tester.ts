import type { ApiKey } from '../../core/types';

export interface TestResult {
  success: boolean;
  latency_ms: number;
  error?: string;
}

export class ApiTester {
  static async testKey(key: ApiKey): Promise<TestResult> {
    const start = performance.now();

    try {
      const result = await this.testByProvider(key);
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

  private static async testByProvider(key: ApiKey): Promise<{ success: boolean; error?: string }> {
    const p = key.provider.toLowerCase();

    if (p === 'openai') return this.testOpenAI(key.endpoint, key.key);
    if (p === 'anthropic') return this.testAnthropic(key.endpoint, key.key);
    return this.testGeneric(key.endpoint, key.key);
  }

  private static async testOpenAI(endpoint: string, key: string) {
    try {
      const res = await fetch(`${endpoint}/models`, {
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
      const res = await fetch(`${endpoint}/messages`, {
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
