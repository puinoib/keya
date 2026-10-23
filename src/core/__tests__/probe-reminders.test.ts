/**
 * §9.2 / §9.3 / §10.3 — request construction, interpretation, Inbox facts.
 */

import { describe, expect, it } from 'vitest';
import {
  PROBE_POLICY,
  base64OfUtf8,
  buildProbeRequest,
  interpretResponse,
  outcomeForStatus,
} from '../probe/request';
import {
  attentionFacts,
  attentionPriority,
  deviceVerifications,
  sortAttention,
} from '../reminders';
import { classifyRecipe, type RecipePlan } from '../presets/classify';
import type { Observation } from '../runtime/observations';
import type { KeyaFile } from '../payload/types';
import { cloneFile, IDS } from './fixtures';

const TS = '2026-03-01T00:00:00.000Z';

const plan = (overrides: Partial<RecipePlan> = {}): RecipePlan => ({
  resolvedHref: 'https://api.example.com/v1/models',
  target: 'models',
  auth: { mode: 'bearer' },
  headers: [],
  interpreterId: 'custom/1',
  verifies: 'request',
  providerId: `custom:${IDS.provider}`,
  ...overrides,
});

describe('§9.2 request policy', () => {
  it('is GET only, without redirects, cookies, cache or referrer', () => {
    expect(PROBE_POLICY).toEqual({
      method: 'GET',
      redirect: 'error',
      credentials: 'omit',
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
      mode: 'cors',
    });
  });

  it('injects the secret into the documented slot only', () => {
    const bearer = buildProbeRequest(plan(), 'sk-1');
    expect(bearer.headers.authorization).toBe('Bearer sk-1');
    expect(bearer.url).toBe('https://api.example.com/v1/models');

    const basic = buildProbeRequest(
      plan({ auth: { mode: 'basic' } }),
      'user:pass'
    );
    expect(basic.headers.authorization).toBe(
      `Basic ${base64OfUtf8('user:pass')}`
    );
    expect(atob(base64OfUtf8('user:pass'))).toBe('user:pass');

    const header = buildProbeRequest(
      plan({ auth: { mode: 'header', name: 'x-api-key' } }),
      'sk-2'
    );
    expect(header.headers['x-api-key']).toBe('sk-2');

    const query = buildProbeRequest(
      plan({ auth: { mode: 'query', param: 'key' } }),
      'sk-3'
    );
    expect(query.url).toBe('https://api.example.com/v1/models?key=sk-3');
    expect(query.headers.authorization).toBeUndefined();
  });

  it('sends static headers verbatim', () => {
    const built = buildProbeRequest(
      plan({
        headers: [
          { name: 'anthropic-version', value: '2023-06-01' },
          { name: 'accept', value: 'application/json' },
        ],
      }),
      'sk'
    );
    expect(built.headers['anthropic-version']).toBe('2023-06-01');
    expect(built.headers.accept).toBe('application/json');
  });

  it('keeps the credential out of the fingerprinted url', () => {
    const built = buildProbeRequest(
      plan({ auth: { mode: 'query', param: 'key' } }),
      'sk-secret'
    );
    expect(built.url).toContain('sk-secret');
    // The plan (and therefore the fingerprint) never changes.
    expect(
      plan({ auth: { mode: 'query', param: 'key' } }).resolvedHref
    ).not.toContain('sk-secret');
  });
});

describe('§9.3 interpretation', () => {
  it('maps statuses to outcomes', () => {
    expect(outcomeForStatus(200)).toBe('ok');
    expect(outcomeForStatus(204)).toBe('ok');
    expect(outcomeForStatus(301)).toBe('failed');
    expect(outcomeForStatus(401)).toBe('auth_failed');
    expect(outcomeForStatus(403)).toBe('forbidden');
    expect(outcomeForStatus(429)).toBe('rate_limited');
    expect(outcomeForStatus(503)).toBe('server_error');
  });

  it('never claims credential validity for a generic recipe', () => {
    const result = interpretResponse(plan(), {
      status: 200,
      contentType: 'application/json',
    });
    expect(result).toEqual({
      kind: 'request',
      outcome: 'ok',
      detail_code: null,
    });
  });

  it('allows a preset with explicit semantics to say credential', () => {
    const result = interpretResponse(plan({ verifies: 'credential' }), {
      status: 200,
      contentType: 'application/json',
    });
    expect(result.kind).toBe('credential');
    expect(result.outcome).toBe('ok');
  });

  it('treats an HTML page as a failed check, not a success', () => {
    const result = interpretResponse(plan(), {
      status: 200,
      contentType: 'text/html; charset=utf-8',
    });
    expect(result).toEqual({
      kind: 'request',
      outcome: 'failed',
      detail_code: 'unexpected_html',
    });
  });

  it('records controlled detail codes rather than provider text', () => {
    expect(
      interpretResponse(plan(), { status: 401, contentType: null }).detail_code
    ).toBe('credential_rejected');
    expect(
      interpretResponse(plan(), { status: 418, contentType: null }).detail_code
    ).toBe('http_418');
  });
});

describe('§10.3 inbox attention', () => {
  const file = (): KeyaFile => {
    const base = cloneFile();
    base.keys[0].expiry = { kind: 'date', value: '2026-03-05' };
    base.keys[0].endpoint = 'https://edge.example.com/v1';
    base.providers[0].probe = {
      target: 'models',
      auth: { mode: 'header', name: 'x-api-key' },
      headers: [],
    };
    return base;
  };

  const context = {
    now: new Date('2026-03-01T12:00:00.000Z'),
    timeZone: 'UTC',
  };

  const binding = () => 'binding-1';

  const observation = (overrides: Partial<Observation> = {}): Observation => ({
    observation_id: 'a',
    vault_id: IDS.vault,
    key_id: IDS.key,
    binding: 'binding-1',
    kind: 'request',
    outcome: 'ok',
    detail_code: null,
    http_status: 200,
    latency_ms: 10,
    started_at: TS,
    finished_at: TS,
    ...overrides,
  });

  const checks = (entry: Observation) => new Map([[IDS.key, entry]]);

  it('reports a due expiry as one fact with its day count', () => {
    const facts = attentionFacts(file(), binding, new Map(), context);
    expect(facts).toEqual([
      { kind: 'expiry', key_id: IDS.key, phase: 'due', days_left: 4 },
    ]);
  });

  it('reports an expired key once, with a negative day count', () => {
    const data = file();
    data.keys[0].expiry = { kind: 'date', value: '2026-02-25' };

    expect(attentionFacts(data, binding, new Map(), context)).toEqual([
      { kind: 'expiry', key_id: IDS.key, phase: 'expired', days_left: -4 },
    ]);
  });

  it('does not report a plaintext endpoint: that is a property of the key', () => {
    const data = file();
    data.keys[0].expiry = null;
    data.keys[0].endpoint = 'http://192.168.1.5:8080/v1';

    expect(attentionFacts(data, binding, new Map(), context)).toEqual([]);
  });

  it('ignores archived keys entirely', () => {
    const data = file();
    data.keys[0].archived_at = TS;
    expect(attentionFacts(data, binding, new Map(), context)).toEqual([]);
  });

  it('reports only a service verdict about the credential', () => {
    const rejected = attentionFacts(
      file(),
      binding,
      checks(observation({ outcome: 'auth_failed' })),
      context
    ).filter((fact) => fact.kind === 'rejected');
    expect(rejected).toHaveLength(1);

    for (const outcome of [
      'forbidden',
      'rate_limited',
      'server_error',
      'failed',
      'timeout',
      'network',
      'ok',
    ] as const) {
      const facts = attentionFacts(
        file(),
        binding,
        checks(observation({ outcome })),
        context
      ).filter((fact) => fact.kind === 'rejected');
      expect(facts, outcome).toHaveLength(outcome === 'forbidden' ? 1 : 0);
    }
  });

  it('ignores a result recorded under another binding', () => {
    const facts = attentionFacts(
      file(),
      binding,
      checks(observation({ outcome: 'auth_failed', binding: 'old' })),
      context
    );
    expect(facts.some((fact) => fact.kind === 'rejected')).toBe(false);
  });

  it('never reports a rejection for a recipe that cannot run', () => {
    const data = file();
    data.providers[0].probe = null;
    const state = classifyRecipe(
      {
        provider_id: data.keys[0].provider_id,
        endpoint: data.keys[0].endpoint,
      },
      data.providers
    );
    expect(state.kind).toBe('not_executable');

    const facts = attentionFacts(
      data,
      () => null,
      checks(observation({ outcome: 'auth_failed' })),
      context
    );
    expect(facts.some((fact) => fact.kind === 'rejected')).toBe(false);
  });

  it('ranks a broken key above a due one and keeps the order stable', () => {
    const data = file();
    const second = structuredClone(data.keys[0]);
    second.id = '99999999-9999-4999-8999-999999999999';
    second.name = 'Second';
    second.expiry = { kind: 'date', value: '2026-03-02' };
    data.keys.push(second);

    const facts = attentionFacts(data, binding, new Map(), context);
    const priorities = new Map(
      facts.map((fact) => [
        fact,
        attentionPriority(
          fact,
          { grouped: false, verified: false },
          context.now
        ),
      ])
    );
    const ordered = sortAttention(facts, (fact) => priorities.get(fact) ?? 0);

    // Four days away is more urgent than six, and both stay above nothing.
    expect(ordered.map((fact) => fact.key_id)).toEqual([second.id, IDS.key]);

    const broken = attentionFacts(
      data,
      binding,
      new Map([
        [
          IDS.key,
          observation({
            outcome: 'auth_failed',
            finished_at: '2026-03-01T11:00:00.000Z',
          }),
        ],
      ]),
      context
    );
    const brokenOrder = sortAttention(broken, (fact) =>
      attentionPriority(fact, { grouped: false, verified: false }, context.now)
    );
    expect(brokenOrder[0].kind).toBe('rejected');
  });

  it('keeps device verification quiet: never, fresh and stale stay distinct', () => {
    const fresh = deviceVerifications(
      file(),
      binding,
      checks(observation()),
      context
    )[0];
    expect(fresh).toMatchObject({
      never_verified: false,
      stale: false,
      days_since: 0,
    });

    const never = deviceVerifications(file(), binding, new Map(), context)[0];
    expect(never).toMatchObject({
      never_verified: true,
      stale: false,
      days_since: null,
    });

    const stale = deviceVerifications(
      file(),
      binding,
      checks(observation({ finished_at: '2025-12-01T00:00:00.000Z' })),
      context
    )[0];
    expect(stale.never_verified).toBe(false);
    expect(stale.stale).toBe(true);
  });

  it('leaves keys that cannot be checked out of the device list', () => {
    const data = file();
    data.providers[0].probe = null;
    expect(deviceVerifications(data, () => null, new Map(), context)).toEqual(
      []
    );
  });
});
