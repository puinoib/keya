/**
 * URL rules — three distinct types that share only two rules.
 *
 * - `endpoint` / `default_endpoint`: a **base address**. Absolute http(s),
 *   no userinfo, no fragment, **no query**.
 * - `probe.target`: a **request address**. May be relative; when absolute it is
 *   http(s), no userinfo, no fragment, **query allowed** (Azure's
 *   `?api-version=…` is why).
 *
 * Never write a single `isValidUrl()` used by both: they disagree precisely on
 * the case that motivated allowing queries in targets.
 */

export interface UrlProblem {
  code:
    | 'bad_url'
    | 'unsupported_scheme'
    | 'has_userinfo'
    | 'has_fragment'
    | 'has_query';
  detail?: string;
}

/** Resolve a base address, returning a problem instead of throwing. */
export function checkBaseUrl(value: string): UrlProblem | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return { code: 'bad_url' };
  }
  if (!isHttpScheme(url))
    return { code: 'unsupported_scheme', detail: url.protocol };
  if (url.username || url.password) return { code: 'has_userinfo' };
  if (url.hash) return { code: 'has_fragment' };
  if (url.search) return { code: 'has_query' };
  return null;
}

/**
 * Absolute or relative target. Relative targets are only checked for shape;
 * whether they are *executable* depends on the key's endpoint (§9.1).
 */
export function checkTarget(value: string): UrlProblem | null {
  // A fragment never reaches the server, so accepting one would make the
  // fingerprinted URL differ from the request. Applies to relative targets too.
  if (value.includes('#')) return { code: 'has_fragment' };

  const absolute = tryAbsolute(value);
  if (!absolute) return null;

  if (!isHttpScheme(absolute)) {
    return { code: 'unsupported_scheme', detail: absolute.protocol };
  }
  if (absolute.username || absolute.password) return { code: 'has_userinfo' };
  if (absolute.hash) return { code: 'has_fragment' };
  return null;
}

/** "Absolute" has exactly one definition: `new URL(target)` succeeds. */
export function tryAbsolute(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function isHttpScheme(url: URL): boolean {
  return url.protocol === 'http:' || url.protocol === 'https:';
}

export interface ResolveResult {
  ok: boolean;
  url: URL | null;
  reason:
    | 'ok'
    | 'missing_endpoint'
    | 'unsupported_scheme'
    | 'has_userinfo'
    | 'has_fragment'
    | 'bad_target';
}

/**
 * The single target-resolution algorithm (§9.1). `resolved.href` is the only
 * accepted string form: it lowercases the host, drops default ports and
 * normalises `..`, so fingerprints agree across implementations.
 */
export function resolveTarget(
  endpoint: string | null,
  target: string
): ResolveResult {
  const absolute = tryAbsolute(target);

  if (!absolute) {
    if (endpoint === null) {
      return { ok: false, url: null, reason: 'missing_endpoint' };
    }
    let base: URL;
    try {
      base = new URL(endpoint);
    } catch {
      return { ok: false, url: null, reason: 'missing_endpoint' };
    }
    if (!base.pathname.endsWith('/')) base.pathname += '/';
    const resolved = new URL(target, base);
    return finish(resolved);
  }

  return finish(absolute);
}

function finish(resolved: URL): ResolveResult {
  if (!isHttpScheme(resolved)) {
    return { ok: false, url: null, reason: 'unsupported_scheme' };
  }
  if (resolved.username || resolved.password) {
    return { ok: false, url: null, reason: 'has_userinfo' };
  }
  if (resolved.hash) {
    return { ok: false, url: null, reason: 'has_fragment' };
  }
  return { ok: true, url: resolved, reason: 'ok' };
}

/** Plaintext request: the destination the key would actually reach is `http:`. */
export function isPlaintextRequest(url: URL | null): boolean {
  return url !== null && url.protocol === 'http:';
}
