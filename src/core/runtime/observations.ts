/**
 * Observation rules (§10.1).
 *
 * Rules only: storage lives on the device, but "which result counts" is part of
 * the format's semantics, so it is a pure function here and testable without a
 * browser.
 */

export type ObservationKind = 'credential' | 'request';

export type ObservationOutcome =
  | 'ok'
  | 'auth_failed'
  | 'forbidden'
  | 'rate_limited'
  | 'server_error'
  | 'failed'
  | 'timeout'
  | 'network';

export interface Observation {
  observation_id: string;
  vault_id: string;
  key_id: string;
  /** HMAC over what was actually sent, including the secret (§7.2). */
  binding: string;
  kind: ObservationKind;
  outcome: ObservationOutcome;
  detail_code: string | null;
  http_status: number | null;
  latency_ms: number | null;
  started_at: string;
  finished_at: string;
}

export interface AdoptionContext {
  /** Session id of the currently unlocked vault. */
  sessionId: string;
  keyExists: boolean;
  keyArchived: boolean;
  /** Current binding for this key. */
  binding: string;
  /** Highest `request_seq` already adopted for this key, or -1. */
  lastAdoptedSeq: number;
}

export interface Candidate {
  sessionId: string;
  requestSeq: number;
  binding: string;
}

export type Adoption = 'adopt' | 'discard';

/**
 * Product semantics: the last *started* check wins. Order is decided by
 * `request_seq`, never by `finished_at`, so changing the system clock cannot
 * reorder results.
 */
export function shouldAdopt(
  candidate: Candidate,
  context: AdoptionContext
): Adoption {
  if (candidate.sessionId !== context.sessionId) return 'discard';
  if (!context.keyExists) return 'discard';
  if (context.keyArchived) return 'discard';
  if (candidate.binding !== context.binding) return 'discard';
  if (candidate.requestSeq <= context.lastAdoptedSeq) return 'discard';
  return 'adopt';
}

/** Outcomes that describe a failed check rather than a working one. */
export const FAILED_OUTCOMES: readonly ObservationOutcome[] = [
  'auth_failed',
  'forbidden',
  'server_error',
  'failed',
  'timeout',
  'network',
];

export function isFailure(observation: Observation): boolean {
  return FAILED_OUTCOMES.includes(observation.outcome);
}

export function isStale(
  observation: Observation,
  now: Date,
  staleDays: number
): boolean {
  const finished = Date.parse(observation.finished_at);
  if (Number.isNaN(finished)) return true;
  return now.getTime() - finished > staleDays * 24 * 60 * 60 * 1000;
}

/**
 * Most recent observations under the current binding, newest first, capped at
 * the retention limit. Mismatched bindings are kept out: they describe a
 * configuration that no longer exists.
 */
export function relevantObservations(
  observations: readonly Observation[],
  binding: string,
  limit: number
): Observation[] {
  return observations
    .filter((observation) => observation.binding === binding)
    .sort((left, right) => right.finished_at.localeCompare(left.finished_at))
    .slice(0, limit);
}
