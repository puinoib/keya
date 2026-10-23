/**
 * §16.4 / §16.5 / §16.7 — the pure parts of the runtime rules.
 *
 * Storage and UI come later; what is tested here is the decision logic that the
 * spec pins down: adoption order, outcome classification, grant matching.
 */

import { describe, expect, it } from 'vitest';
import {
  type Observation,
  isFailure,
  isRejected,
  isStale,
  isUnverified,
  relevantObservations,
  shouldAdopt,
} from '../runtime/observations';
import {
  addGrant,
  allowsPersistentGrant,
  consumeApproval,
  hasGrant,
  type Grant,
} from '../runtime/grants';

const VAULT = '11111111-1111-4111-8111-111111111111';
const KEY = '33333333-3333-4333-8333-333333333333';
const SESSION = 'session-a';
const NOW = '2026-05-01T00:00:00.000Z';

const observation = (overrides: Partial<Observation> = {}): Observation => ({
  observation_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  vault_id: VAULT,
  key_id: KEY,
  binding: 'binding-1',
  kind: 'request',
  outcome: 'ok',
  detail_code: null,
  http_status: 200,
  latency_ms: 42,
  started_at: NOW,
  finished_at: NOW,
  ...overrides,
});

describe('§10.1 adoption', () => {
  const context = {
    sessionId: SESSION,
    keyExists: true,
    keyArchived: false,
    binding: 'binding-1',
    lastAdoptedSeq: 3,
  };

  it('adopts only a newer result from the same session and binding', () => {
    expect(
      shouldAdopt(
        { sessionId: SESSION, requestSeq: 4, binding: 'binding-1' },
        context
      )
    ).toBe('adopt');
  });

  it('discards late results from a previous session', () => {
    expect(
      shouldAdopt(
        { sessionId: 'session-old', requestSeq: 99, binding: 'binding-1' },
        context
      )
    ).toBe('discard');
  });

  it('discards results for a rotated secret or changed destination', () => {
    expect(
      shouldAdopt(
        { sessionId: SESSION, requestSeq: 4, binding: 'binding-2' },
        context
      )
    ).toBe('discard');
  });

  it('discards stale sequence numbers, regardless of finish time', () => {
    expect(
      shouldAdopt(
        { sessionId: SESSION, requestSeq: 3, binding: 'binding-1' },
        context
      )
    ).toBe('discard');
    expect(
      shouldAdopt(
        { sessionId: SESSION, requestSeq: 2, binding: 'binding-1' },
        context
      )
    ).toBe('discard');
  });

  it('discards results for archived or deleted keys', () => {
    const candidate = {
      sessionId: SESSION,
      requestSeq: 9,
      binding: 'binding-1',
    };
    expect(shouldAdopt(candidate, { ...context, keyArchived: true })).toBe(
      'discard'
    );
    expect(shouldAdopt(candidate, { ...context, keyExists: false })).toBe(
      'discard'
    );
  });

  it('classifies failures and staleness', () => {
    expect(isFailure(observation({ outcome: 'auth_failed' }))).toBe(true);
    expect(isFailure(observation({ outcome: 'timeout' }))).toBe(true);
    expect(isFailure(observation({ outcome: 'ok' }))).toBe(false);

    // Only a service verdict about the credential counts as a rejection; the
    // rest could not establish anything.
    expect(isRejected(observation({ outcome: 'auth_failed' }))).toBe(true);
    expect(isRejected(observation({ outcome: 'forbidden' }))).toBe(true);
    expect(isRejected(observation({ outcome: 'timeout' }))).toBe(false);
    expect(isRejected(observation({ outcome: 'server_error' }))).toBe(false);
    expect(isUnverified(observation({ outcome: 'network' }))).toBe(true);
    expect(isUnverified(observation({ outcome: 'forbidden' }))).toBe(false);

    expect(
      isStale(
        observation({ finished_at: '2026-03-01T00:00:00.000Z' }),
        new Date(NOW),
        30
      )
    ).toBe(true);
    expect(isStale(observation({ finished_at: NOW }), new Date(NOW), 30)).toBe(
      false
    );
  });

  it('keeps only the newest observations under the current binding', () => {
    const list = [
      observation({
        observation_id: 'a',
        binding: 'old',
        finished_at: '2026-04-30T00:00:00.000Z',
      }),
      observation({
        observation_id: 'b',
        finished_at: '2026-04-01T00:00:00.000Z',
      }),
      observation({
        observation_id: 'c',
        finished_at: '2026-04-29T00:00:00.000Z',
      }),
    ];
    const result = relevantObservations(list, 'binding-1', 10);
    expect(result.map((entry) => entry.observation_id)).toEqual(['c', 'b']);
    expect(relevantObservations(list, 'binding-1', 1)).toHaveLength(1);
  });
});

describe('§10.2 grants', () => {
  const grant: Grant = {
    fingerprint: 'fp-1',
    vault_id: VAULT,
    origin: 'https://api.example.com',
    path: '/v1/models',
    approved_at: NOW,
  };

  it('matches by fingerprint only', () => {
    expect(hasGrant([grant], 'fp-1')).toBe(true);
    expect(hasGrant([grant], 'fp-2')).toBe(false);
    expect(hasGrant([{ ...grant, origin: 'https://other' }], 'fp-1')).toBe(
      true
    );
  });

  it('adding an existing fingerprint does not duplicate it', () => {
    expect(addGrant([grant], grant)).toHaveLength(1);
  });

  it('a one-shot approval is consumed by exactly one request', () => {
    const approvals = [{ fingerprint: 'fp-1', keyId: KEY, sessionId: SESSION }];
    const request = { fingerprint: 'fp-1', keyId: KEY, sessionId: SESSION };

    const first = consumeApproval(approvals, request);
    expect(first.ok).toBe(true);
    expect(first.remaining).toHaveLength(0);

    const second = consumeApproval(first.remaining, request);
    expect(second.ok).toBe(false);
  });

  it('an approval for a different key or session does not apply', () => {
    const approvals = [{ fingerprint: 'fp-1', keyId: KEY, sessionId: SESSION }];
    expect(
      consumeApproval(approvals, {
        fingerprint: 'fp-1',
        keyId: 'other',
        sessionId: SESSION,
      }).ok
    ).toBe(false);
    expect(
      consumeApproval(approvals, {
        fingerprint: 'fp-1',
        keyId: KEY,
        sessionId: 'other',
      }).ok
    ).toBe(false);
  });

  it('plaintext targets never keep a persistent grant', () => {
    expect(allowsPersistentGrant(true)).toBe(false);
    expect(allowsPersistentGrant(false)).toBe(true);
  });
});
