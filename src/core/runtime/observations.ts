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
  /**
   * Device-monotonic sequence, assigned when the record is stored.
   *
   * `finished_at` is a wall clock and the spec forbids ordering by it: a clock
   * change would make an older result look newest and could hide a rejection.
   * Records written before this field existed read as 0, so they sort behind
   * every newly recorded result.
   */
  seq?: number;
}

/** Newest first by the device sequence, falling back to the wall clock. */
export function compareObservationsNewestFirst(
  left: Observation,
  right: Observation
): number {
  const bySeq = (right.seq ?? 0) - (left.seq ?? 0);
  if (bySeq !== 0) return bySeq;
  const byTime = right.finished_at.localeCompare(left.finished_at);
  if (byTime !== 0) return byTime;
  return right.observation_id.localeCompare(left.observation_id);
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

/** Outcomes in which the service judged the credential itself. */
export const REJECTED_OUTCOMES = [
  'auth_failed',
  'forbidden',
] as const satisfies readonly ObservationOutcome[];

export type RejectedOutcome = (typeof REJECTED_OUTCOMES)[number];

/**
 * Failures that say nothing about the credential: the request never reached a
 * verdict, or the service refused for a reason that is not the secret.
 */
export const UNVERIFIED_OUTCOMES = [
  'rate_limited',
  'server_error',
  'failed',
  'timeout',
  'network',
] as const satisfies readonly ObservationOutcome[];

export const FAILED_OUTCOMES: readonly ObservationOutcome[] = [
  ...REJECTED_OUTCOMES,
  ...UNVERIFIED_OUTCOMES,
];

/** The service answered, and its answer was about the credential. */
export function isRejected(
  observation: Observation
): observation is Observation & { outcome: RejectedOutcome } {
  return (REJECTED_OUTCOMES as readonly string[]).includes(observation.outcome);
}

/** The check could not establish anything about the credential. */
export function isUnverified(observation: Observation): boolean {
  return (UNVERIFIED_OUTCOMES as readonly string[]).includes(
    observation.outcome
  );
}

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
    .sort(compareObservationsNewestFirst)
    .slice(0, limit);
}
