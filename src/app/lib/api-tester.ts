import type { ApiKey } from '../../core/types';

export interface TestResult {
  success: boolean;
  latency_ms: number;
  error?: string;
}

const DEFAULT_TIMEOUT_MS = 10_000;
const AZURE_API_VERSION = '2024-10-21';

type ProviderKind =
  | 'openai'
  | 'anthropic'
  | 'azure'
  | 'google'
  | 'generic'
  | 'unsupported';

// Providers that expose an OpenAI-compatible /models endpoint.
const OPENAI_COMPATIBLE_PROVIDERS = new Set([
  'openai',
  'deepseek',
  'moonshot',
  'zhipu',
  'mistral',
  'siliconflow',
  'xai',
  'minimax',
  'alibaba cloud',
  'groq',
  'openrouter',
  'together',
  'nvidia nim',
  'cerebras',
  'fireworks',
  'baseten',
  'hugging face',
  'xiaomi mimo',
  'z.ai',
  'z.ai coding (china)',
  'moonshot ai (global)',
  'vercel ai gateway',
]);

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

function describeError(error: unknown): string {
  if (error instanceof DOMException && error.name === 'AbortError') {
    return 'Request timed out';
  }
  if (error instanceof Error) {
    if (/failed to fetch|load failed|networkerror/i.test(error.message)) {
      return 'Network or CORS error. The provider may not allow browser requests.';
    }
    return error.message;
  }
  return 'Unknown error';
}

/** Return a normalized absolute HTTP(S) endpoint, or null when invalid. */
function normalizeEndpoint(endpoint: string): string | null {
  const trimmed = endpoint.trim();
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  } catch {
    return null;
  }

  return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
}

function getProviderKind(provider: string): ProviderKind {
  const normalized = provider.trim().toLowerCase();

  if (normalized === 'anthropic') return 'anthropic';
  if (normalized === 'google' || normalized === 'gemini') return 'google';
  if (normalized === 'azure openai') return 'azure';
  if (normalized === 'amazon bedrock' || normalized === 'bedrock')
    return 'unsupported';
  if (OPENAI_COMPATIBLE_PROVIDERS.has(normalized)) return 'openai';
  return 'generic';
}

/** A successful HTTP status is not enough: SPA fallbacks often return HTML. */
async function verifyReachable(
  res: Response,
  providerLabel: string
): Promise<{ success: boolean; error?: string }> {
  if (!res.ok) return { success: false, error: await extractError(res) };

  const contentType = res.headers.get('content-type') ?? '';
  if (/text\/html/i.test(contentType)) {
    return {
      success: false,
      error: `${providerLabel} returned an HTML page. Check the endpoint URL.`,
    };
  }

  return { success: true };
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
    const normalizedEndpoint = normalizeEndpoint(endpoint);

    if (!normalizedEndpoint) {
      return {
        success: false,
        latency_ms: Math.round(performance.now() - start),
        error: endpoint.trim()
          ? 'Endpoint must be an absolute http(s) URL'
          : 'Endpoint is required before testing',
      };
    }

    try {
      const result = await ApiTester.testByProvider(
        getProviderKind(provider),
        normalizedEndpoint,
        key
      );
      return {
        ...result,
        latency_ms: Math.round(performance.now() - start),
      };
    } catch (error) {
      return {
        success: false,
        latency_ms: Math.round(performance.now() - start),
        error: describeError(error),
      };
    }
  }

  private static async testByProvider(
    kind: ProviderKind,
    endpoint: string,
    key: string
  ): Promise<{ success: boolean; error?: string }> {
    if (kind === 'openai') return ApiTester.testOpenAI(endpoint, key);
    if (kind === 'anthropic') return ApiTester.testAnthropic(endpoint, key);
    if (kind === 'azure') return ApiTester.testAzure(endpoint, key);
    if (kind === 'google') return ApiTester.testGoogle(endpoint, key);
    if (kind === 'unsupported') {
      return {
        success: false,
        error:
          'Amazon Bedrock uses AWS request signing and cannot be tested from the browser.',
      };
    }
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
      return verifyReachable(res, 'OpenAI-compatible endpoint');
    } catch (error) {
      return { success: false, error: describeError(error) };
    }
  }

  private static async testAnthropic(endpoint: string, key: string) {
    try {
      // Metadata endpoint, so testing does not invoke a billable model.
      const base = endpoint.replace(/\/messages\/?$/i, '');
      const url = base.endsWith('/models') ? base : `${base}/models`;
      const res = await fetchWithTimeout(url, {
        headers: {
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
          // Required for browser CORS requests.
          'anthropic-dangerous-direct-browser-access': 'true',
        },
      });
      return verifyReachable(res, 'Anthropic');
    } catch (error) {
      return { success: false, error: describeError(error) };
    }
  }

  private static async testAzure(endpoint: string, key: string) {
    try {
      let url: string;
      if (/\/openai\/models(?:\?|$)/i.test(endpoint)) {
        url = endpoint.includes('?')
          ? endpoint
          : `${endpoint}?api-version=${AZURE_API_VERSION}`;
      } else if (/\/openai$/i.test(endpoint)) {
        url = `${endpoint}/models?api-version=${AZURE_API_VERSION}`;
      } else {
        url = `${endpoint}/openai/models?api-version=${AZURE_API_VERSION}`;
      }

      const res = await fetchWithTimeout(url, {
        headers: { 'api-key': key },
      });
      return verifyReachable(res, 'Azure OpenAI');
    } catch (error) {
      return { success: false, error: describeError(error) };
    }
  }

  private static async testGoogle(endpoint: string, key: string) {
    try {
      const url = endpoint.endsWith('/models')
        ? `${endpoint}?key=${encodeURIComponent(key)}`
        : `${endpoint}/models?key=${encodeURIComponent(key)}`;
      const res = await fetchWithTimeout(url);
      return verifyReachable(res, 'Google Gemini');
    } catch (error) {
      return { success: false, error: describeError(error) };
    }
  }

  private static async testGeneric(endpoint: string, key: string) {
    try {
      const res = await fetchWithTimeout(endpoint, {
        method: 'GET',
        headers: { Authorization: `Bearer ${key}` },
      });
      if (res.status === 401 || res.status === 403) {
        return { success: false, error: 'Invalid API key' };
      }
      return verifyReachable(res, 'Endpoint');
    } catch (error) {
      return { success: false, error: describeError(error) };
    }
  }
}
