/**
 * Turning a recipe plan into an actual request (§9.2, §9.3).
 *
 * The policy is deliberately narrow: GET only, no redirects, no cookies, no
 * cache, no referrer. Everything a probe can do is described here, which is why
 * a recipe cannot become a general request builder.
 */

import type { RecipePlan } from '../presets/classify';
import type {
  ObservationKind,
  ObservationOutcome,
} from '../runtime/observations';

/** Fixed request policy. Mirrored by the executor; kept here so it is testable. */
export const PROBE_POLICY = {
  method: 'GET',
  redirect: 'error',
  credentials: 'omit',
  cache: 'no-store',
  referrerPolicy: 'no-referrer',
  mode: 'cors',
} as const;

export interface BuiltRequest {
  url: string;
  method: 'GET';
  headers: Record<string, string>;
}

/** Base64 of the UTF-8 bytes, as RFC 7617 expects for the credential pair. */
export function base64OfUtf8(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

/**
 * Build the request for one probe.
 *
 * The secret is injected here and only here: `resolvedHref` stays secret-free so
 * fingerprints and grants describe the destination, not the credential.
 */
export function buildProbeRequest(
  plan: RecipePlan,
  secret: string
): BuiltRequest {
  const headers: Record<string, string> = {};
  for (const header of plan.headers) {
    headers[header.name] = header.value;
  }

  let url = plan.resolvedHref;

  switch (plan.auth.mode) {
    case 'bearer':
      headers.authorization = `Bearer ${secret}`;
      break;
    case 'basic':
      headers.authorization = `Basic ${base64OfUtf8(secret)}`;
      break;
    case 'header':
      headers[plan.auth.name] = secret;
      break;
    case 'query': {
      const target = new URL(plan.resolvedHref);
      target.searchParams.set(plan.auth.param, secret);
      url = target.href;
      break;
    }
  }

  return { url, method: 'GET', headers };
}

/** Status → outcome. 2xx is "the request was accepted", never more than that. */
export function outcomeForStatus(status: number): ObservationOutcome {
  if (status >= 200 && status < 300) return 'ok';
  if (status === 401) return 'auth_failed';
  if (status === 403) return 'forbidden';
  if (status === 429) return 'rate_limited';
  if (status >= 500 && status < 600) return 'server_error';
  return 'failed';
}

export interface Interpretation {
  kind: ObservationKind;
  outcome: ObservationOutcome;
  detail_code: string | null;
}

/**
 * Decide what a response means for this recipe.
 *
 * Only a preset that declares `verifies: 'credential'` may report
 * `credential/ok`; the generic executor tops out at `request/ok`.
 */
export function interpretResponse(
  plan: RecipePlan,
  response: { status: number; contentType: string | null }
): Interpretation {
  const kind: ObservationKind =
    plan.verifies === 'credential' ? 'credential' : 'request';

  const outcome = outcomeForStatus(response.status);

  if (outcome === 'ok' && response.contentType?.includes('text/html')) {
    // SPA fallbacks answer 200 with an HTML page; that is not an API response.
    return { kind, outcome: 'failed', detail_code: 'unexpected_html' };
  }

  return { kind, outcome, detail_code: detailFor(outcome, response.status) };
}

function detailFor(outcome: ObservationOutcome, status: number): string | null {
  switch (outcome) {
    case 'auth_failed':
      return 'credential_rejected';
    case 'forbidden':
      return 'scope_insufficient';
    case 'rate_limited':
      return 'rate_limited';
    case 'server_error':
      return 'upstream_error';
    case 'failed':
      return `http_${status}`;
    default:
      return null;
  }
}
