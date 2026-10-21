/**
 * §9.2 / §9.3 / §10.3 — request construction, interpretation, reminders.
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
  businessAlerts,
  observationAlerts,
  visibleReminders,
} from '../reminders';
import { classifyRecipe, type RecipePlan } from '../presets/classify';
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

describe('§10.3 reminders', () => {
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

  it('produces expiry and plaintext reminders for active keys', () => {
    const data = file();
    const reminders = businessAlerts(data, context);
    expect(reminders.map((reminder) => reminder.rule)).toEqual([
      'expiry_upcoming',
    ]);

    data.keys[0].endpoint = 'http://192.168.1.5:8080/v1';
    const insecure = businessAlerts(data, context).find(
      (reminder) => reminder.rule === 'insecure_endpoint'
    );
    expect(insecure?.condition).toBe('http:http://192.168.1.5:8080');
  });

  it('sees a plaintext absolute target even when the endpoint is https', () => {
    const data = file();
    data.providers[0].probe = {
      target: 'http://192.168.1.5:8080/models',
      auth: { mode: 'bearer' },
      headers: [],
    };
    const reminders = businessAlerts(data, context);
    expect(
      reminders.some((reminder) => reminder.rule === 'insecure_endpoint')
    ).toBe(true);
  });

  it('ignores archived keys entirely', () => {
    const data = file();
    data.keys[0].archived_at = TS;
    expect(businessAlerts(data, context)).toEqual([]);
  });

  it('never reports "never probed" for a recipe that cannot run', () => {
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

    const reminders = observationAlerts(data, () => null, [], context);
    expect(reminders).toEqual([]);
  });

  it('reports never probed, failure and staleness per binding', () => {
    const data = file();
    const binding = () => 'binding-1';

    expect(observationAlerts(data, binding, [], context)[0].rule).toBe(
      'never_probed'
    );

    const failed = [
      {
        observation_id: 'a',
        vault_id: data.vault.id,
        key_id: data.keys[0].id,
        binding: 'binding-1',
        kind: 'request' as const,
        outcome: 'auth_failed' as const,
        detail_code: 'credential_rejected',
        http_status: 401,
        latency_ms: 10,
        started_at: TS,
        finished_at: TS,
      },
    ];
    expect(observationAlerts(data, binding, failed, context)[0].rule).toBe(
      'probe_failed'
    );

    const ok = [{ ...failed[0], outcome: 'ok' as const }];
    const stale = observationAlerts(data, binding, ok, {
      now: new Date('2026-12-01T00:00:00.000Z'),
      timeZone: 'UTC',
    });
    expect(stale[0].rule).toBe('probe_stale');
  });

  it('hides dismissed reminders and shows the rest', () => {
    const data = file();
    const reminders = businessAlerts(data, context);
    const dismissed = [
      {
        vault_id: data.vault.id,
        key_id: data.keys[0].id,
        rule: 'expiry_upcoming' as const,
        condition: reminders[0].condition,
      },
    ];

    expect(visibleReminders(reminders, dismissed, [])).toHaveLength(0);

    // A different fact (a new expiry date) is not covered by that dismissal.
    data.keys[0].expiry = { kind: 'date', value: '2026-03-06' };
    const changed = businessAlerts(data, context);
    expect(visibleReminders(changed, dismissed, [])).toHaveLength(1);
  });
});
