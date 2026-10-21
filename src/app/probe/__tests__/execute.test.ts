/**
 * §16.5 — probe execution with a fake transport.
 *
 * No real network: the point is that policy, classification and the observation
 * record are correct regardless of what the service answers.
 */

import { describe, expect, it } from 'vitest';
import {
  describeOutcome,
  runProbe,
  type ProbeFetch,
  type ProbeRequestInput,
} from '../execute';
import type { RecipePlan } from '../../../core/presets/classify';
import { shouldAdopt } from '../../../core/runtime/observations';

const plan = (overrides: Partial<RecipePlan> = {}): RecipePlan => ({
  resolvedHref: 'https://api.example.com/v1/models',
  target: 'models',
  auth: { mode: 'bearer' },
  headers: [{ name: 'accept', value: 'application/json' }],
  interpreterId: 'custom/1',
  verifies: 'request',
  providerId: 'custom:44444444-4444-4444-8444-444444444444',
  ...overrides,
});

const input = (
  overrides: Partial<ProbeRequestInput> = {}
): ProbeRequestInput => ({
  plan: plan(),
  secret: 'sk-synthetic',
  binding: 'binding-1',
  vaultId: '11111111-1111-4111-8111-111111111111',
  keyId: '33333333-3333-4333-8333-333333333333',
  sessionId: 'session-a',
  requestSeq: 1,
  ...overrides,
});

const respond =
  (
    status: number,
    contentType: string | null = 'application/json'
  ): ProbeFetch =>
  async () => ({ status, contentType });

describe('probe execution', () => {
  it('applies the fixed policy and sends the credential', async () => {
    let seen: { url: string; init: Record<string, unknown> } | null = null;
    const fetchImpl: ProbeFetch = async (url, init) => {
      seen = { url, init: init as unknown as Record<string, unknown> };
      return { status: 200, contentType: 'application/json' };
    };

    await runProbe(input(), fetchImpl);

    expect(seen!.url).toBe('https://api.example.com/v1/models');
    expect(seen!.init).toMatchObject({
      method: 'GET',
      redirect: 'error',
      credentials: 'omit',
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
      mode: 'cors',
    });
    const headers = seen!.init.headers as Record<string, string>;
    expect(headers.authorization).toBe('Bearer sk-synthetic');
    expect(headers.accept).toBe('application/json');
  });

  it('records status, latency and stamp on success', async () => {
    const { observation } = await runProbe(input(), respond(200));
    expect(observation).toMatchObject({
      kind: 'request',
      outcome: 'ok',
      http_status: 200,
      detail_code: null,
      binding: 'binding-1',
    });
    expect(observation.latency_ms).toBeGreaterThanOrEqual(0);
    expect(observation.started_at <= observation.finished_at).toBe(true);
    expect(observation.observation_id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('never persists provider text, only controlled codes', async () => {
    const { observation } = await runProbe(input(), respond(401));
    expect(observation.outcome).toBe('auth_failed');
    expect(observation.detail_code).toBe('credential_rejected');
    expect(JSON.stringify(observation)).not.toContain('invalid_api_key');
  });

  it('turns a rejected fetch into network, not into a credential verdict', async () => {
    const failing: ProbeFetch = async () => {
      throw new TypeError('Failed to fetch');
    };
    const { observation } = await runProbe(input(), failing);
    expect(observation.outcome).toBe('network');
    expect(describeOutcome(observation)).toContain('not proof');
  });

  it('turns an aborted request into timeout', async () => {
    const hanging: ProbeFetch = (_url, init) =>
      new Promise((_resolve, reject) => {
        init.signal.addEventListener('abort', () =>
          reject(new DOMException('aborted', 'AbortError'))
        );
      });

    const { observation } = await runProbe(input({ timeoutMs: 5 }), hanging);
    expect(observation.outcome).toBe('timeout');
    expect(observation.detail_code).toBe('timeout');
  });

  it('marks a 2xx HTML page as a failed check', async () => {
    const { observation } = await runProbe(
      input(),
      respond(200, 'text/html; charset=utf-8')
    );
    expect(observation.outcome).toBe('failed');
    expect(observation.detail_code).toBe('unexpected_html');
  });

  it('reports credential only for a recipe that declares it', async () => {
    const generic = await runProbe(input(), respond(200));
    expect(generic.observation.kind).toBe('request');

    const explicit = await runProbe(
      input({ plan: plan({ verifies: 'credential' }) }),
      respond(200)
    );
    expect(explicit.observation.kind).toBe('credential');
  });

  it('produces observations that the adoption rules accept once', async () => {
    const { observation } = await runProbe(
      input({ requestSeq: 4 }),
      respond(200)
    );
    const context = {
      sessionId: 'session-a',
      keyExists: true,
      keyArchived: false,
      binding: 'binding-1',
      lastAdoptedSeq: 3,
    };

    expect(
      shouldAdopt(
        {
          sessionId: 'session-a',
          requestSeq: 4,
          binding: observation.binding,
        },
        context
      )
    ).toBe('adopt');

    // A result from a previous unlock is discarded.
    expect(
      shouldAdopt(
        {
          sessionId: 'session-old',
          requestSeq: 9,
          binding: observation.binding,
        },
        context
      )
    ).toBe('discard');
  });
});
