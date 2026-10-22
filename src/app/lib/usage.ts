/**
 * What a usage query needs from a key. `provider` is the display name the caller
 * resolved (a preset label or a custom provider name); the v2 payload keeps the
 * reference instead, and the mapping belongs to the UI layer.
 */
export interface UsageSubject {
  provider: string;
  endpoint: string;
  secret: string;
}

export interface UsageOptions {
  timeoutMs?: number;
  /**
   * Called with the exact URL before anything is sent. Usage queries leave the
   * device too, so they need the same consent a probe does.
   */
  authorize?: (url: string) => Promise<boolean>;
}

/** The URL a usage query for this subject would ask, or null when unknown. */
export function usageRequestUrl(subject: {
  provider: string;
  endpoint: string;
}): string | null {
  const source = USAGE_SOURCES[normalizeProvider(subject.provider)];
  if (!source) return null;
  return usageUrlFor(subject.endpoint, source);
}

/**
 * Usage and quota read straight from the provider's own metadata endpoint.
 *
 * Keya is not a gateway and never derives a financial figure: a provider either
 * states the remaining allowance or it says nothing, and nothing here is
 * persisted — a snapshot only lives in memory for the session that asked for
 * it, so a number can never be mistaken for live truth days later.
 */

export type UsageFailureKind =
  | 'unsupported'
  | 'unapproved'
  | 'auth'
  | 'forbidden'
  | 'rate_limited'
  | 'network'
  | 'timeout'
  | 'shape';

export interface UsageWindow {
  id: string;
  /** Human label for the window, e.g. "5 hours". */
  label: string;
  /** Percent of the window already used, 0-100, as the provider reports it. */
  percent_used: number;
  /** When the window renews. Absent when the provider's value is a placeholder. */
  resets_at: string | null;
}

export interface UsageSnapshot {
  provider: string;
  windows: UsageWindow[];
  checked_at: string;
}

export interface UsageFailure {
  kind: UsageFailureKind;
  message: string;
}

export type UsageResult =
  | { ok: true; snapshot: UsageSnapshot }
  | { ok: false; failure: UsageFailure };

export interface UsageEntry {
  state: 'loading' | 'ok' | 'failed';
  snapshot?: UsageSnapshot;
  failure?: UsageFailure;
  /** When the last attempt finished. */
  checked_at?: string;
  /** The vault the request was started from, so results stay bound to it. */
  vault_id: string;
}

interface UsageSource {
  /**
   * The vendor's own metadata URL, used when the key points at the vendor's
   * host. It is spelled out because the endpoint a key is saved with is an
   * inference base, which is not always where the metadata lives — or, as with
   * OpenCode Go, not always a host that answers a cross-origin preflight.
   */
  url: string;
  /** Host the `url` belongs to; other endpoints are asked at `path`. */
  hosts: string[];
  /** Path appended to a proxy or regional endpoint that is not the vendor's. */
  path: string;
  /** Reads the provider's reply into windows, or null when the shape is unknown. */
  read: (body: unknown) => UsageWindow[] | null;
}

const OPEN_CODE_GO_WINDOWS = [
  { id: 'rolling', label: '5 hours' },
  { id: 'weekly', label: '7 days' },
  { id: 'monthly', label: 'Month' },
] as const;

/**
 * OpenCode Go answers with three allowance windows:
 *
 *   {"usage":{"rolling":{"status":"ok","percent":37,"resetsAt":"…"},
 *             "weekly":{…},"monthly":{"status":"rate-limited","percent":100,…}}}
 *
 * The older flat reply (`rollingUsage`, `weeklyUsage`, `monthlyUsage`) is read
 * too, but only when it carries percentages of its own; anything else is an
 * unknown shape rather than a silent zero.
 *
 * A window at 0% hands back a placeholder reset (now plus the window length) at
 * a time nothing happens, so it is dropped: an idle window shows no reset.
 */
export function readOpenCodeGoUsage(body: unknown): UsageWindow[] | null {
  if (!body || typeof body !== 'object') return null;
  const reply = body as Record<string, unknown>;
  const windows: UsageWindow[] = [];

  for (const { id, label } of OPEN_CODE_GO_WINDOWS) {
    const source = pickWindow(reply, id);
    const percent = readPercent(source);
    if (percent === null) continue;

    const resetsAt = percent > 0 ? readResetTime(source) : null;
    windows.push({ id, label, percent_used: percent, resets_at: resetsAt });
  }

  return windows.length > 0 ? windows : null;
}

function pickWindow(reply: Record<string, unknown>, id: string): unknown {
  const nested = reply.usage;
  if (nested && typeof nested === 'object') {
    const window = (nested as Record<string, unknown>)[id];
    if (window && typeof window === 'object') return window;
  }
  const flat = reply[`${id}Usage`];
  if (flat && typeof flat === 'object') return flat;
  return null;
}

function readPercent(window: unknown): number | null {
  if (!window || typeof window !== 'object') return null;
  const value = (window as Record<string, unknown>).percent;
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return clampPercent(value);
}

function readResetTime(window: unknown): string | null {
  if (!window || typeof window !== 'object') return null;
  const value = (window as Record<string, unknown>).resetsAt;
  if (typeof value !== 'string') return null;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
}

function clampPercent(value: number): number {
  if (value < 0) return 0;
  if (value > 100) return 100;
  return value;
}

/**
 * Measured in 2026-10 with `Origin: https://keya.app`. A browser can only read
 * an endpoint when the *preflight* passes — status, Allow-Origin, Allow-Methods
 * and Allow-Headers together. A GET that returns `Access-Control-Allow-Origin`
 * proves nothing on its own: `opencode.ai/zen/go/v1/usage` answers `*` but 404s
 * its preflight, so the GET never happens.
 *
 * Only OpenCode Go is usable today. Checked and rejected: OpenAI
 * `/v1/organization/costs` (needs an admin key), Anthropic `usage_report` (no
 * ACAO), `api.exa.ai/*` (no ACAO), `opencode.ai/zen/v1/usage` (404 — Zen has no
 * balance API). Prepaid balances (OpenRouter credits, DeepSeek, Moonshot,
 * SiliconFlow) look readable but are not implemented.
 *
 * Providers whose allowance Keya can read from a browser. Each entry must be a
 * read-only metadata endpoint that answers the CORS preflight and needs nothing
 * beyond the stored key.
 */
const USAGE_SOURCES: Record<string, UsageSource> = {
  'opencode go': {
    // Go answers on the inference host, which allows the preflight that an
    // Authorization header forces. Its older /zen/go/ gateway returns the same
    // report but answers OPTIONS with 404, so a browser can never read it.
    url: 'https://opencode.ai/inference/go/v1/usage',
    hosts: ['opencode.ai'],
    path: '/usage',
    read: readOpenCodeGoUsage,
  },
};

const UNSUPPORTED_REASONS: Record<string, string> = {
  'opencode zen':
    'OpenCode Zen has no usage or balance endpoint yet; its wallet is only shown in the OpenCode console.',
};

function normalizeProvider(provider: string): string {
  return provider.trim().toLowerCase();
}

/** True when Keya can ask this provider for an allowance. */
export function supportsUsage(provider: string): boolean {
  return normalizeProvider(provider) in USAGE_SOURCES;
}

/** Why a provider has no usage view, when it has a known explanation. */
export function unsupportedUsageReason(provider: string): string | null {
  return UNSUPPORTED_REASONS[normalizeProvider(provider)] ?? null;
}

/**
 * Build the metadata URL for a key. The vendor's own host gets the canonical
 * URL; anything else (a proxy, a regional gateway) gets the same path appended
 * to the endpoint the user configured.
 */
export function resolveUsageUrl(endpoint: string, path: string): string | null {
  const trimmed = endpoint.trim();
  if (!trimmed) return null;

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;

  const base = trimmed.replace(/\/+$/, '').replace(/\/models$/i, '');
  return `${base}${path}`;
}

/** The URL a source is actually asked at, given the key's endpoint. */
export function usageUrlFor(
  endpoint: string,
  source: Pick<UsageSource, 'url' | 'hosts' | 'path'>
): string | null {
  const derived = resolveUsageUrl(endpoint, source.path);
  if (!derived) return null;
  return source.hosts.includes(new URL(derived).host) ? source.url : derived;
}

const DEFAULT_TIMEOUT_MS = 10_000;

function failure(kind: UsageFailureKind, message: string): UsageResult {
  return { ok: false, failure: { kind, message } };
}

function isTimeout(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

/** Provider-supplied explanation, if the body has one. */
function readErrorMessage(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  const reply = body as Record<string, unknown>;
  const error = reply.error;
  if (error && typeof error === 'object') {
    const message = (error as Record<string, unknown>).message;
    if (typeof message === 'string' && message.trim()) return message.trim();
  }
  if (typeof error === 'string' && error.trim()) return error.trim();
  const message = reply.message;
  if (typeof message === 'string' && message.trim()) return message.trim();
  return null;
}

async function readJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Ask the provider what is left. The key is sent to that provider's own
 * metadata endpoint and nowhere else; a redirect off the configured host is
 * refused rather than followed with the credential attached.
 */
export async function fetchUsage(
  key: UsageSubject,
  options: UsageOptions = {}
): Promise<UsageResult> {
  const provider = normalizeProvider(key.provider);
  const source = USAGE_SOURCES[provider];
  if (!source) {
    return failure(
      'unsupported',
      unsupportedUsageReason(key.provider) ??
        `${key.provider} has no usage endpoint Keya can read.`
    );
  }

  const url = usageUrlFor(key.endpoint, source);
  if (!url) {
    return failure(
      'network',
      key.endpoint.trim()
        ? 'Endpoint must be an absolute http(s) URL'
        : 'Endpoint is required before reading usage'
    );
  }

  if (new URL(url).protocol !== 'https:') {
    return failure(
      'network',
      'Usage needs an https endpoint: plain http would send the key in clear text.'
    );
  }

  if (options.authorize && !(await options.authorize(url))) {
    return failure(
      'unapproved',
      'This request needs approval before the key is sent.'
    );
  }

  const controller = new AbortController();
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${key.secret}` },
      signal: controller.signal,
    });

    const expectedHost = new URL(url).host;
    if (new URL(res.url || url).host !== expectedHost) {
      return failure(
        'network',
        'The request was redirected to another host, so Keya stopped without reading the reply.'
      );
    }

    const body = await readJson(res);

    if (res.status === 401) {
      return failure(
        'auth',
        readErrorMessage(body) ?? 'The provider rejected the key (HTTP 401).'
      );
    }
    if (res.status === 403) {
      return failure(
        'forbidden',
        readErrorMessage(body) ??
          'The key is not allowed to read usage (HTTP 403). It may be a key without this plan, or lack the permission.'
      );
    }
    if (res.status === 429) {
      return failure(
        'rate_limited',
        readErrorMessage(body) ??
          'The provider rate limited the request (HTTP 429).'
      );
    }
    if (!res.ok) {
      return failure('network', readErrorMessage(body) ?? `HTTP ${res.status}`);
    }

    const windows = source.read(body);
    if (!windows) {
      return failure(
        'shape',
        `${key.provider} answered with a shape Keya does not recognize, so no allowance is shown.`
      );
    }

    return {
      ok: true,
      snapshot: {
        provider: key.provider,
        windows,
        checked_at: new Date().toISOString(),
      },
    };
  } catch (error) {
    if (isTimeout(error)) {
      return failure('timeout', 'The provider did not answer in time.');
    }
    return failure(
      'network',
      'The request did not complete. The browser may have blocked the response, or the host may be unreachable.'
    );
  } finally {
    clearTimeout(timer);
  }
}

/** Most used window, which is the one worth showing at a glance. */
export function tightestWindow(
  snapshot: UsageSnapshot | undefined
): UsageWindow | null {
  if (!snapshot || snapshot.windows.length === 0) return null;
  return snapshot.windows.reduce((worst, window) =>
    window.percent_used > worst.percent_used ? window : worst
  );
}

/** "resets in 2h 14m" for a future reset, null when it has passed. */
export function describeReset(
  resetsAt: string | null,
  now: Date = new Date()
): string | null {
  if (!resetsAt) return null;
  const target = Date.parse(resetsAt);
  if (Number.isNaN(target)) return null;

  const minutes = Math.round((target - now.getTime()) / 60_000);
  if (minutes <= 0) return null;
  if (minutes < 60) return `resets in ${minutes}m`;

  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;
  if (hours < 24) {
    return restMinutes > 0
      ? `resets in ${hours}h ${restMinutes}m`
      : `resets in ${hours}h`;
  }

  const days = Math.floor(hours / 24);
  const restHours = hours % 24;
  return restHours > 0
    ? `resets in ${days}d ${restHours}h`
    : `resets in ${days}d`;
}

/** "just now", "4m ago", "2h ago" for a snapshot's age. */
export function describeAge(
  checkedAt: string | undefined,
  now: Date = new Date()
): string | null {
  if (!checkedAt) return null;
  const target = Date.parse(checkedAt);
  if (Number.isNaN(target)) return null;

  const seconds = Math.round((now.getTime() - target) / 1000);
  if (seconds < 45) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}
