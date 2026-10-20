import type { ApiKey, CustomProvider, Settings } from '../../core/types';
import { getCustomProvider, isPresetProvider } from '../../core/types';
import { buildCustomCheckRequest } from './custom-check';

/**
 * What a check established:
 * - `credential`: the request carried the key and the provider answered.
 * - `reachability`: the endpoint responded but the key was not sent.
 * - `unverifiable`: the browser or the provider prevents verification, so no
 *   conclusion about the credential can be recorded.
 */
export type TestKind = 'credential' | 'reachability' | 'unverifiable';

export interface TestResult {
  success: boolean;
  latency_ms: number;
  error?: string;
  kind: TestKind;
}

type CheckOutcome = {
  success: boolean;
  error?: string;
  kind?: TestKind;
};

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
  'together',
  'cerebras',
  'fireworks',
  'xiaomi mimo',
  'z.ai',
  'z.ai coding (china)',
  'moonshot ai (global)',
  'vercel ai gateway',
  'perplexity',
  'featherless',
  'chutes',
  'hyperbolic',
  'nebius',
  'deepinfra',
  'upstage',
  'reka',
  'gitee ai',
  'tencent hunyuan',
  'baidu qianfan',
  'baichuan',
  'stepfun',
  'opencode zen',
  'opencode go',
  'z.ai (general)',
]);

/**
 * Metadata endpoints that differ from the provider's API base. A value starting
 * with `/` is appended to the configured endpoint; an absolute URL replaces it
 * because the check lives on another host.
 */
const TEST_ENDPOINTS: Record<string, string> = {
  // The model list is public, so only these authenticated endpoints can verify
  // a token.
  openrouter: '/key',
  'hugging face': 'https://huggingface.co/api/whoami-v2',
  cohere: '/v1/models',
  'stability ai': '/v1/user/account',
  recraft: '/v1/users/me',
  firecrawl: '/v1/team/credit-usage',
  github: '/user',
  vercel: '/v2/user',
  stripe: '/v1/balance',
};

/**
 * Providers whose keys cannot be verified from a browser. Reported instead of
 * letting the request fail as a misleading network or CORS error.
 */
const UNSUPPORTED_PROVIDERS: Record<string, string> = {
  'amazon bedrock':
    'Amazon Bedrock uses AWS request signing and cannot be tested from the browser.',
  'nvidia nim':
    'NVIDIA NIM lists models without authentication and sends no CORS headers, so a key cannot be verified from the browser.',
  baseten:
    'Baseten sends no CORS headers, so the browser blocks the request before the key is checked.',
  exa: 'Exa sends no CORS headers, so the browser cannot read the response. The key is not verified, and this is not proof that it is invalid.',
};

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

/** Provider-supplied explanation, if the body has one. */
async function extractBodyMessage(res: Response): Promise<string | null> {
  try {
    const body = await res.json();
    const message = body?.error?.message || body?.error?.type || body?.message;
    return typeof message === 'string' && message.trim() ? message : null;
  } catch {
    return null;
  }
}

function isTimeout(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

/**
 * A rejected fetch covers CORS, DNS, TLS, offline, and browser blocking. None
 * of them justify calling the credential invalid.
 */
function isBrowserBlocked(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return /failed to fetch|load failed|networkerror|cors/i.test(error.message);
}

function describeError(error: unknown): string {
  if (isTimeout(error)) return 'Request timed out';
  if (error instanceof Error) return error.message;
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
  if (normalized === 'bedrock' || isUnsupportedProvider(normalized))
    return 'unsupported';
  if (OPENAI_COMPATIBLE_PROVIDERS.has(normalized)) return 'openai';
  return 'generic';
}

function isUnsupportedProvider(normalized: string): boolean {
  return normalized in UNSUPPORTED_PROVIDERS;
}

function getUnsupportedReason(provider: string): string {
  const normalized = provider.trim().toLowerCase();
  return (
    UNSUPPORTED_PROVIDERS[normalized] ??
    'This provider cannot be tested from the browser.'
  );
}

/** Resolve the URL a connectivity test calls, honouring per-provider overrides. */
function getTestUrl(provider: string, endpoint: string): string {
  const override = TEST_ENDPOINTS[provider.trim().toLowerCase()];
  if (!override) return endpoint;
  if (/^https?:\/\//i.test(override)) return override;
  return `${endpoint}${override}`;
}

/** A successful HTTP status is not enough: SPA fallbacks often return HTML. */
async function verifyCredentialResponse(
  res: Response,
  providerLabel: string
): Promise<CheckOutcome> {
  if (!res.ok) {
    const bodyMessage = await extractBodyMessage(res);
    if (bodyMessage) return { success: false, error: bodyMessage };

    if (res.status === 401) {
      return {
        success: false,
        error: 'The provider rejected the credential (HTTP 401).',
      };
    }
    if (res.status === 403) {
      return {
        success: false,
        error:
          'The provider refused the request (HTTP 403). The key may lack permission, or the request was rate limited.',
      };
    }
    return { success: false, error: `HTTP ${res.status}` };
  }

  const contentType = res.headers.get('content-type') ?? '';
  if (/text\/html/i.test(contentType)) {
    return {
      success: false,
      error: `${providerLabel} returned an HTML page instead of an API response. Check the endpoint path.`,
    };
  }

  return { success: true };
}

/**
 * Reachability probe. It never sends the key and uses a CORS-free request, so a
 * missing Access-Control-Allow-Origin header cannot be mistaken for downtime.
 */
async function probeReachability(endpoint: string): Promise<CheckOutcome> {
  try {
    await fetchWithTimeout(endpoint, {
      method: 'GET',
      mode: 'no-cors',
      redirect: 'follow',
    });
    return { success: true };
  } catch (error) {
    if (isTimeout(error)) {
      return {
        success: false,
        error: 'The endpoint did not respond in time. The key was not sent.',
      };
    }
    // A CORS-free request cannot fail because of a missing ACAO header, so any
    // other rejection means the host itself could not be reached.
    return {
      success: false,
      error: 'The endpoint could not be reached. The key was not sent.',
    };
  }
}

export class ApiTester {
  /** Which kind of check Keya can perform for this provider. */
  static checkKindFor(provider: string, settings?: Settings): TestKind {
    if (isUnsupportedProvider(provider.trim().toLowerCase()))
      return 'unverifiable';
    if (isPresetProvider(provider)) return 'credential';
    if (getCustomProvider(provider, settings)?.check) return 'credential';
    return 'reachability';
  }

  /** Human-readable reason for a provider that cannot be verified. */
  static unverifiableReason(provider: string): string {
    return getUnsupportedReason(provider);
  }

  static async testKey(key: ApiKey, settings?: Settings): Promise<TestResult> {
    return ApiTester.testRaw(key.provider, key.endpoint, key.key, settings);
  }

  static async testRaw(
    provider: string,
    endpoint: string,
    key: string,
    settings?: Settings
  ): Promise<TestResult> {
    const start = performance.now();
    const kind = ApiTester.checkKindFor(provider, settings);
    const finish = (outcome: CheckOutcome): TestResult => ({
      ...outcome,
      kind: outcome.kind ?? kind,
      latency_ms: Math.round(performance.now() - start),
    });

    const normalizedEndpoint = normalizeEndpoint(endpoint);
    if (!normalizedEndpoint) {
      return finish({
        success: false,
        error: endpoint.trim()
          ? 'Endpoint must be an absolute http(s) URL'
          : 'Endpoint is required before testing',
      });
    }

    if (kind === 'unverifiable') {
      return finish({
        success: false,
        kind: 'unverifiable',
        error: getUnsupportedReason(provider),
      });
    }

    try {
      if (kind === 'reachability') {
        return finish(await probeReachability(normalizedEndpoint));
      }

      const custom = getCustomProvider(provider, settings);
      if (custom?.check) {
        return finish(
          await ApiTester.testCustomCheck(custom, normalizedEndpoint, key)
        );
      }

      return finish(
        await ApiTester.testByProvider(
          getProviderKind(provider),
          provider,
          normalizedEndpoint,
          key
        )
      );
    } catch (error) {
      if (isTimeout(error)) {
        return finish({ success: false, error: 'Request timed out' });
      }
      if (isBrowserBlocked(error)) {
        return finish({
          success: false,
          kind: 'unverifiable',
          error:
            'The browser blocked the response, most likely due to CORS. The key could not be verified, and this is not proof that it is invalid.',
        });
      }
      return finish({ success: false, error: describeError(error) });
    }
  }

  private static async testCustomCheck(
    custom: CustomProvider,
    endpoint: string,
    key: string
  ): Promise<CheckOutcome> {
    if (!custom.check) return { success: true };
    const { url, headers } = buildCustomCheckRequest(
      custom.check,
      endpoint,
      key
    );
    const res = await fetchWithTimeout(url, { method: 'GET', headers });
    return verifyCredentialResponse(res, custom.name);
  }

  private static async testByProvider(
    kind: ProviderKind,
    provider: string,
    endpoint: string,
    key: string
  ): Promise<CheckOutcome> {
    if (kind === 'unsupported') {
      return {
        success: false,
        kind: 'unverifiable',
        error: getUnsupportedReason(provider),
      };
    }
    if (kind === 'openai') return ApiTester.testOpenAI(endpoint, key);
    if (kind === 'anthropic') return ApiTester.testAnthropic(endpoint, key);
    if (kind === 'azure') return ApiTester.testAzure(endpoint, key);
    if (kind === 'google') return ApiTester.testGoogle(endpoint, key);
    return ApiTester.testGeneric(getTestUrl(provider, endpoint), key);
  }

  private static async testOpenAI(endpoint: string, key: string) {
    const url = endpoint.endsWith('/models') ? endpoint : `${endpoint}/models`;
    const res = await fetchWithTimeout(url, {
      headers: { Authorization: `Bearer ${key}` },
    });
    return verifyCredentialResponse(res, 'OpenAI-compatible endpoint');
  }

  private static async testAnthropic(endpoint: string, key: string) {
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
    return verifyCredentialResponse(res, 'Anthropic');
  }

  private static async testAzure(endpoint: string, key: string) {
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
    return verifyCredentialResponse(res, 'Azure OpenAI');
  }

  private static async testGoogle(endpoint: string, key: string) {
    const url = endpoint.endsWith('/models')
      ? `${endpoint}?key=${encodeURIComponent(key)}`
      : `${endpoint}/models?key=${encodeURIComponent(key)}`;
    const res = await fetchWithTimeout(url);
    return verifyCredentialResponse(res, 'Google Gemini');
  }

  private static async testGeneric(endpoint: string, key: string) {
    const res = await fetchWithTimeout(endpoint, {
      method: 'GET',
      headers: { Authorization: `Bearer ${key}` },
    });
    return verifyCredentialResponse(res, 'Endpoint');
  }
}
