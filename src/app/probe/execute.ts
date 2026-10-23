/**
 * Probe execution (§9.2, §10.1).
 *
 * One call = one request = one observation. Everything that decides what the
 * request does lives in `core/probe/request.ts`; this module only applies the
 * policy, measures, classifies and stamps the result with the identity needed
 * for adoption later.
 */

import {
  PROBE_POLICY,
  buildProbeRequest,
  interpretResponse,
} from '../../core/probe/request';
import type { RecipePlan } from '../../core/presets/classify';
import type {
  Observation,
  ObservationKind,
  ObservationOutcome,
} from '../../core/runtime/observations';

/** The only network dependency: a fetch-shaped function. */
export interface ProbeResponse {
  status: number;
  contentType: string | null;
}

export type ProbeFetch = (
  url: string,
  init: {
    method: 'GET';
    headers: Record<string, string>;
    redirect: 'error';
    credentials: 'omit';
    cache: 'no-store';
    referrerPolicy: 'no-referrer';
    mode: 'cors';
    signal: AbortSignal;
  }
) => Promise<ProbeResponse>;

export interface ProbeRequestInput {
  plan: RecipePlan;
  secret: string;
  /** Precomputed `observation_binding` for this key and configuration. */
  binding: string;
  vaultId: string;
  keyId: string;
  sessionId: string;
  requestSeq: number;
  timeoutMs?: number;
  signal?: AbortSignal;
}

export interface ProbeOutcome {
  observation: Observation;
  /** Raw HTTP status, kept for display only. */
  status: number | null;
}

const DEFAULT_TIMEOUT_MS = 10_000;

function stamp(): string {
  return new Date().toISOString();
}

/**
 * Run one probe. Never throws for expected conditions: a rejection becomes
 * `network`, a timeout becomes `timeout`. The result is always an observation
 * that the adoption rules can then accept or discard.
 */
export async function runProbe(
  input: ProbeRequestInput,
  fetchImpl: ProbeFetch
): Promise<ProbeOutcome> {
  const request = buildProbeRequest(input.plan, input.secret);
  const startedAt = stamp();

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    input.timeoutMs ?? DEFAULT_TIMEOUT_MS
  );
  const onExternalAbort = () => controller.abort();
  if (input.signal?.aborted) controller.abort();
  input.signal?.addEventListener('abort', onExternalAbort);

  const started = performance.now();
  try {
    const response = await fetchImpl(request.url, {
      method: PROBE_POLICY.method,
      headers: request.headers,
      redirect: PROBE_POLICY.redirect,
      credentials: PROBE_POLICY.credentials,
      cache: PROBE_POLICY.cache,
      referrerPolicy: PROBE_POLICY.referrerPolicy,
      mode: PROBE_POLICY.mode,
      signal: controller.signal,
    });

    const interpreted = interpretResponse(input.plan, response);
    return finish(input, interpreted.kind, interpreted.outcome, {
      status: response.status,
      latency: performance.now() - started,
      detailCode: interpreted.detail_code,
      startedAt,
    });
  } catch (error) {
    const aborted = controller.signal.aborted;
    const kind: ObservationKind =
      input.plan.verifies === 'credential' ? 'credential' : 'request';
    const outcome: ObservationOutcome = aborted ? 'timeout' : 'network';
    return finish(input, kind, outcome, {
      status: null,
      latency: performance.now() - started,
      detailCode: aborted ? 'timeout' : 'unreachable',
      startedAt,
      error,
    });
  } finally {
    clearTimeout(timeout);
    input.signal?.removeEventListener('abort', onExternalAbort);
  }
}

function finish(
  input: ProbeRequestInput,
  kind: ObservationKind,
  outcome: ObservationOutcome,
  extra: {
    status: number | null;
    latency: number;
    detailCode: string | null;
    startedAt: string;
    error?: unknown;
  }
): ProbeOutcome {
  const observation: Observation = {
    observation_id: crypto.randomUUID(),
    vault_id: input.vaultId,
    key_id: input.keyId,
    binding: input.binding,
    kind,
    outcome,
    detail_code: extra.detailCode,
    http_status: extra.status,
    latency_ms: Math.round(extra.latency),
    started_at: extra.startedAt,
    finished_at: stamp(),
  };

  return { observation, status: extra.status };
}

/**
 * Never persist provider text: an error message may echo a token prefix, an
 * account name or a balance. Only the controlled code survives.
 */
export function describeOutcome(observation: Observation): string {
  switch (observation.outcome) {
    case 'ok':
      return observation.kind === 'credential'
        ? 'The service accepted the credential.'
        : 'The request was accepted. This does not prove the credential is valid.';
    case 'auth_failed':
      return 'The service rejected the credential.';
    case 'forbidden':
      return 'The credential lacks permission for this request.';
    case 'rate_limited':
      return 'The service is rate limiting requests.';
    case 'server_error':
      return 'The service returned an error.';
    case 'failed':
      return observation.detail_code === 'unexpected_html'
        ? 'The address answered with a web page instead of an API response.'
        : 'The request was answered with an unexpected status.';
    case 'timeout':
      return 'The request did not finish in time.';
    case 'network':
      return 'The request could not be completed. This is not proof that the credential is invalid.';
  }
}
