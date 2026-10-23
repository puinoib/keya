/**
 * Inbox attention (§10.3).
 *
 * The Inbox shows only facts that can change on their own and that a real
 * action clears: an expiry that is close or past, and a check the service
 * answered by rejecting the credential. Everything else is a property of the
 * configuration (plain http, an unrunnable recipe) or of this device's own
 * history (never verified, verified long ago), and belongs on the key, not in
 * a list of things to do.
 *
 * Nothing here is stored. The list is a pure function of the payload, this
 * device's observations, the clock and the time zone, so the same file yields
 * the same attention list on every device.
 */

import type { Key, KeyaFile } from './payload/types';
import { daysUntilExpiry, expiryStatus } from './time/expiry';
import { EXPIRY_UPCOMING_DAYS, OBSERVATION_STALE_DAYS } from './payload/limits';
import { isRejected, type Observation } from './runtime/observations';

/** The only two facts that can ask for a decision. */
export type InboxRule = 'expiry' | 'rejected';

export type ExpiryPhase = 'expired' | 'due';

export interface ExpiryFact {
  kind: 'expiry';
  key_id: string;
  phase: ExpiryPhase;
  /** Calendar days from today to the expiry day; negative once passed. */
  days_left: number;
}

export interface RejectedFact {
  kind: 'rejected';
  key_id: string;
  observation_id: string;
  finished_at: string;
  /** Only the two outcomes in which the service judged the credential. */
  outcome: 'auth_failed' | 'forbidden';
  detail_code: string | null;
}

export type AttentionFact = ExpiryFact | RejectedFact;

export interface InboxContext {
  now: Date;
  timeZone: string;
  upcomingDays?: number;
}

/** What the key itself says about how much the fact matters. */
export interface AttentionSignals {
  /** The key belongs to a group, so it is organized rather than a stray. */
  grouped: boolean;
  /** The newest result under the current binding succeeded. */
  verified: boolean;
}

/** One key's standing on this device, independent of any inbox decision. */
export interface DeviceVerification {
  key_id: string;
  observation: Observation | null;
  days_since: number | null;
  never_verified: boolean;
  /** Long enough ago to be worth offering a fresh check. */
  stale: boolean;
}

const activeKeys = (file: KeyaFile): Key[] =>
  file.keys.filter((key) => key.archived_at === null);

const DAY = 24 * 60 * 60 * 1000;

function daysSinceTimestamp(finishedAt: string, now: Date): number | null {
  const finished = Date.parse(finishedAt);
  if (Number.isNaN(finished)) return null;
  return Math.floor((now.getTime() - finished) / DAY);
}

/**
 * The facts that need a decision now.
 *
 * A key whose recipe cannot run never reports a rejection: there is no request
 * to be rejected, and a permanent "failed" message would be meaningless.
 * Observation results are matched by binding, so a result recorded for an older
 * secret or destination cannot speak for the current one.
 */
export function attentionFacts(
  file: KeyaFile,
  bindingOf: (key: Key) => string | null,
  checks: ReadonlyMap<string, Observation>,
  context: InboxContext
): AttentionFact[] {
  const facts: AttentionFact[] = [];
  const upcomingDays = context.upcomingDays ?? EXPIRY_UPCOMING_DAYS;

  for (const key of activeKeys(file)) {
    const status = expiryStatus(
      key.expiry,
      context.now,
      context.timeZone,
      upcomingDays
    );
    const days = daysUntilExpiry(key.expiry, context.now, context.timeZone);

    if (status === 'expired' && days !== null) {
      facts.push({
        kind: 'expiry',
        key_id: key.id,
        phase: 'expired',
        days_left: days,
      });
    } else if (status === 'upcoming' && days !== null) {
      facts.push({
        kind: 'expiry',
        key_id: key.id,
        phase: 'due',
        days_left: days,
      });
    }

    const binding = bindingOf(key);
    if (binding === null) continue;

    const latest = checks.get(key.id);
    if (!latest || latest.binding !== binding) continue;
    if (!isRejected(latest)) continue;

    facts.push({
      kind: 'rejected',
      key_id: key.id,
      observation_id: latest.observation_id,
      finished_at: latest.finished_at,
      outcome: latest.outcome,
      detail_code: latest.detail_code,
    });
  }

  return facts;
}

/**
 * This device's verification standing for every key whose recipe can run.
 *
 * Not reminders: the result says "this device has not asked the provider
 * lately", which is true on a new device even when the same key was verified
 * elsewhere five minutes earlier. It is offered as a batch, never announced.
 */
export function deviceVerifications(
  file: KeyaFile,
  bindingOf: (key: Key) => string | null,
  checks: ReadonlyMap<string, Observation>,
  context: InboxContext
): DeviceVerification[] {
  const rows: DeviceVerification[] = [];

  for (const key of activeKeys(file)) {
    const binding = bindingOf(key);
    if (binding === null) continue;

    const latest = checks.get(key.id);
    const observation = latest && latest.binding === binding ? latest : null;
    const days =
      observation === null
        ? null
        : daysSinceTimestamp(observation.finished_at, context.now);

    rows.push({
      key_id: key.id,
      observation,
      days_since: days,
      never_verified: observation === null,
      stale: days !== null && days >= OBSERVATION_STALE_DAYS,
    });
  }

  return rows;
}

/**
 * How far up the list a fact belongs. Higher is more urgent.
 *
 * The order encodes a single judgement: an expired or rejected key is already
 * broken, a key whose expiry is days away is about to break, and a key the user
 * has organized and verified before matters more than a stray one. It is a pure
 * function of the fact, the key's signals and the clock so it can be tested.
 */
export function attentionPriority(
  fact: AttentionFact,
  signals: AttentionSignals,
  now: Date
): number {
  const consequence = (signals.grouped ? 6 : 0) + (signals.verified ? 4 : 0);

  if (fact.kind === 'rejected') {
    const days = daysSinceTimestamp(fact.finished_at, now);
    const recent = days !== null && days <= 7 ? 20 : 0;
    return 80 + recent + consequence;
  }

  if (fact.phase === 'expired') {
    const overdue = Math.min(10, Math.abs(fact.days_left));
    return 70 + 30 + overdue + consequence;
  }

  return 50 + (fact.days_left <= 3 ? 20 : 0) + consequence;
}

/**
 * Most urgent first. Ties fall back to the fact itself so the order is stable
 * across devices: the earliest expiry, then the most recent rejection, then the
 * key id.
 */
export function sortAttention(
  facts: readonly AttentionFact[],
  priorityOf: (fact: AttentionFact) => number
): AttentionFact[] {
  return [...facts].sort((left, right) => {
    const byPriority = priorityOf(right) - priorityOf(left);
    if (byPriority !== 0) return byPriority;

    const byDays = daysOf(left) - daysOf(right);
    if (byDays !== 0) return byDays;

    if (left.kind === 'rejected' && right.kind === 'rejected') {
      const byTime = right.finished_at.localeCompare(left.finished_at);
      if (byTime !== 0) return byTime;
    }

    return left.key_id < right.key_id ? -1 : left.key_id > right.key_id ? 1 : 0;
  });
}

function daysOf(fact: AttentionFact): number {
  return fact.kind === 'expiry' ? fact.days_left : Number.MAX_SAFE_INTEGER;
}
