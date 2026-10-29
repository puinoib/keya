import { describe, expect, it } from 'vitest';
import { cloneFile, IDS } from '../../../core/__tests__/fixtures';
import { classifyRecipe } from '../../../core/presets/classify';
import type { Observation } from '../../../core/runtime/observations';
import { DEFAULT_PREFERENCES } from '../../storage/local/state';
import {
  activeKeys,
  archivedKeys,
  buildVaultView,
  checkOf,
  expiryOf,
  hasDuplicateSecret,
  keyById,
  plaintextTargetOf,
  searchKeys,
  sortedGroups,
  type ViewInput,
} from '../view';
import {
  checkStateHint,
  checkStatusLabel,
  dateToExpiry,
  daysUntilExpiry,
  expiryStatusLabel,
  expiryToDate,
  expiryVerdict,
} from '../presentation';

function bindingsFor(file = cloneFile()) {
  const state = classifyRecipe(
    { provider_id: IDS.providerId, endpoint: file.keys[0].endpoint },
    file.providers
  );
  if (state.kind === 'not_executable') throw new Error('fixture not runnable');
  return new Map([
    [
      IDS.key,
      {
        keyId: IDS.key,
        plan: state.plan,
        send: 'send-fingerprint',
        binding: 'observation-binding',
      },
    ],
  ]);
}

function input(overrides: Partial<ViewInput> = {}): ViewInput {
  return {
    file: cloneFile(),
    preferences: DEFAULT_PREFERENCES,
    now: new Date('2026-03-01T12:00:00.000Z'),
    timeZone: 'UTC',
    checks: new Map(),
    bindings: bindingsFor(),
    ...overrides,
  };
}

function observation(overrides: Partial<Observation> = {}): Observation {
  return {
    observation_id: 'obs-1',
    vault_id: IDS.vault,
    key_id: IDS.key,
    binding: 'observation-binding',
    kind: 'credential',
    outcome: 'ok',
    detail_code: null,
    http_status: 200,
    latency_ms: 42,
    started_at: '2026-03-01T11:00:00.000Z',
    finished_at: '2026-03-01T11:00:00.042Z',
    ...overrides,
  };
}

describe('expiry verdicts', () => {
  it('judges a calendar day in the device time zone', () => {
    const expiry = { kind: 'date' as const, value: '2026-03-02' };
    const now = new Date('2026-03-01T16:00:00.000Z');

    expect(daysUntilExpiry(expiry, now, 'Asia/Tokyo')).toBe(0);
    expect(expiryVerdict(expiry, now, 'Asia/Tokyo')).toBe('expiring_soon');
    expect(daysUntilExpiry(expiry, now, 'UTC')).toBe(1);
  });

  it('keeps the view selector and the helper in step', () => {
    const file = cloneFile();
    file.keys[0].expiry = {
      kind: 'instant',
      value: '2026-03-01T11:00:00.000Z',
    };

    const view = buildVaultView(input({ file }));
    const key = keyById(view, IDS.key);

    expect(expiryOf(view, key!)).toEqual({ status: 'expired', days: 0 });
  });

  it('round-trips a picked day and an exact instant', () => {
    const day = dateToExpiry(new Date(2026, 2, 5));
    expect(day).toEqual({ kind: 'date', value: '2026-03-05' });
    expect(expiryToDate(day)).toEqual(new Date(2026, 2, 5));

    const instant = dateToExpiry(new Date('2026-03-05T09:30:00.000Z'));
    expect(instant).toEqual({
      kind: 'instant',
      value: '2026-03-05T09:30:00.000Z',
    });
  });

  it('has copy for every verdict', () => {
    expect(expiryStatusLabel('expired')).toBe('Expired');
    expect(expiryStatusLabel('expiring_soon')).toBe('Expiring soon');
    expect(expiryStatusLabel('valid')).toBe('Valid');
    expect(expiryStatusLabel('none')).toBe('No expiry');
  });
});

describe('inbox attention', () => {
  it('reports one expiry fact and no device chore as attention', () => {
    const file = cloneFile();
    file.keys[0].expiry = { kind: 'date', value: '2026-03-05' };

    const view = buildVaultView(input({ file }));

    expect(view.attention.map((row) => row.fact.kind)).toEqual(['expiry']);
    expect(view.attention[0].fact).toMatchObject({
      phase: 'due',
      days_left: 4,
    });
    expect(view.attention[0].key.id).toBe(IDS.key);
  });

  it('carries a rejection from the current binding only', () => {
    const rejected = buildVaultView(
      input({
        checks: new Map([
          [
            IDS.key,
            observation({
              outcome: 'forbidden',
              binding: 'observation-binding',
            }),
          ],
        ]),
      })
    );
    expect(rejected.attention[0].fact).toMatchObject({
      kind: 'rejected',
      outcome: 'forbidden',
    });

    const oldBinding = buildVaultView(
      input({
        checks: new Map([
          [
            IDS.key,
            observation({
              outcome: 'auth_failed',
              binding: 'an-older-binding',
            }),
          ],
        ]),
      })
    );
    expect(
      oldBinding.attention.some((row) => row.fact.kind === 'rejected')
    ).toBe(false);
    expect(oldBinding.device[0].never_verified).toBe(true);
  });

  it('keeps an unverifiable result out of both attention and the device list', () => {
    const file = cloneFile();
    file.providers[0].probe = null;

    const view = buildVaultView(
      input({
        file,
        bindings: new Map(),
        checks: new Map([[IDS.key, observation({ outcome: 'auth_failed' })]]),
      })
    );

    expect(view.attention).toEqual([]);
    expect(view.device).toEqual([]);
  });

  it('keeps device verification separate from attention', () => {
    const fresh = buildVaultView(
      input({ checks: new Map([[IDS.key, observation()]]) })
    );
    expect(fresh.attention).toEqual([]);
    expect(fresh.device[0]).toMatchObject({
      never_verified: false,
      stale: false,
    });

    const never = buildVaultView(input());
    expect(never.attention).toEqual([]);
    expect(never.device[0].never_verified).toBe(true);
  });

  it('treats a plaintext destination as a key property, not a reminder', () => {
    const file = cloneFile();
    file.keys[0].endpoint = 'http://edge.example.com/v1';

    const view = buildVaultView(input({ file }));
    expect(view.attention).toEqual([]);
    expect(plaintextTargetOf(view, view.file.keys[0])?.origin).toBe(
      'http://edge.example.com'
    );
  });

  it('sorts attention by urgency, not by insertion order', () => {
    const file = cloneFile();
    const second = structuredClone(file.keys[0]);
    second.id = '66666666-6666-4666-8666-666666666666';
    second.name = 'Second';
    second.expiry = { kind: 'date', value: '2026-03-02' };
    file.keys[0].expiry = { kind: 'date', value: '2026-03-07' };
    file.keys.push(second);

    const view = buildVaultView(input({ file }));
    expect(view.attention.map((row) => row.key.name)).toEqual([
      'Second',
      'Edge key',
    ]);
  });
});

describe('list behaviour', () => {
  it('splits live keys from archived ones', () => {
    const file = cloneFile();
    const archived = structuredClone(file.keys[0]);
    archived.id = '66666666-6666-4666-8666-666666666666';
    archived.name = 'Retired key';
    archived.archived_at = '2026-03-02T00:00:00.000Z';
    file.keys.push(archived);

    const view = buildVaultView(input({ file }));

    expect(activeKeys(view).map((key) => key.name)).toEqual(['Edge key']);
    expect(archivedKeys(view).map((key) => key.name)).toEqual(['Retired key']);
  });

  it('matches name, description and provider label', () => {
    const view = buildVaultView(input());
    const keys = view.file.keys;

    expect(searchKeys(view, keys, 'edge')).toHaveLength(1);
    expect(searchKeys(view, keys, 'staging')).toHaveLength(1);
    expect(searchKeys(view, keys, 'gateway')).toHaveLength(1);
    expect(searchKeys(view, keys, 'nothing')).toHaveLength(0);
    expect(searchKeys(view, keys, '   ')).toHaveLength(1);
  });

  it('ignores archived keys and the edited key itself', () => {
    const file = cloneFile();
    const archived = structuredClone(file.keys[0]);
    archived.id = '66666666-6666-4666-8666-666666666666';
    archived.archived_at = '2026-03-02T00:00:00.000Z';
    file.keys.push(archived);

    const view = buildVaultView(input({ file }));

    expect(hasDuplicateSecret(view, 'sk-synthetic')).toBe(true);
    expect(hasDuplicateSecret(view, 'sk-synthetic', IDS.key)).toBe(false);
    expect(hasDuplicateSecret(view, 'sk-other')).toBe(false);
  });

  it('orders groups by their own order field', () => {
    const file = cloneFile();
    file.groups.unshift({
      id: '77777777-7777-4777-8777-777777777777',
      name: 'First',
      icon: '1️⃣',
      order: -1,
    });

    const view = buildVaultView(input({ file }));

    expect(sortedGroups(view).map((group) => group.name)).toEqual([
      'First',
      'Production',
    ]);
  });
});

describe('check status', () => {
  it('reports an uncheckable provider without inventing a failure', () => {
    const view = buildVaultView(input({ bindings: new Map() }));
    const key = keyById(view, IDS.key)!;
    const check = checkOf(view, key);

    expect(check.status).toBe('untested');
    expect(check.checkable).toBe(false);
    expect(check.kind).toBe('unverifiable');
    expect(checkStatusLabel(check.status, check.kind)).toBe('Untested');
  });

  it('maps an observation onto the badge', () => {
    const view = buildVaultView(
      input({ checks: new Map([[IDS.key, observation()]]) })
    );
    const check = checkOf(view, keyById(view, IDS.key)!);

    expect(check.status).toBe('success');
    // A custom provider's check can only prove that the request passed.
    expect(check.kind).toBe('request');
    expect(checkStatusLabel(check.status, check.kind)).toBe('Reachable');
  });

  it('claims a credential only for a preset that requires one', () => {
    const file = cloneFile();
    file.keys[0].provider_id = 'preset:openai';
    const preset = classifyRecipe(
      { provider_id: 'preset:openai', endpoint: 'https://api.openai.com/v1' },
      []
    );
    if (preset.kind === 'not_executable')
      throw new Error('preset not runnable');

    const view = buildVaultView(
      input({
        file,
        checks: new Map([[IDS.key, observation()]]),
        bindings: new Map([
          [
            IDS.key,
            {
              keyId: IDS.key,
              plan: preset.plan,
              send: 'send',
              binding: 'observation-binding',
            },
          ],
        ]),
      })
    );
    const check = checkOf(view, keyById(view, IDS.key)!);

    expect(check.kind).toBe('credential');
    expect(checkStatusLabel(check.status, check.kind)).toBe('Verified');
  });

  it('separates a rejection from a request that never reached a verdict', () => {
    const rejected = buildVaultView(
      input({
        checks: new Map([[IDS.key, observation({ outcome: 'auth_failed' })]]),
      })
    );
    const rejectedCheck = checkOf(rejected, keyById(rejected, IDS.key)!);
    expect(rejectedCheck.status).toBe('failed');
    expect(checkStatusLabel(rejectedCheck.status, rejectedCheck.kind)).toBe(
      'Failed'
    );

    // Network, timeout, rate limits and 5xx say nothing about the credential
    // and must not be filtered or worded as a rejection (§10.3).
    for (const outcome of ['network', 'timeout', 'rate_limited'] as const) {
      const view = buildVaultView(
        input({ checks: new Map([[IDS.key, observation({ outcome })]]) })
      );
      const check = checkOf(view, keyById(view, IDS.key)!);
      expect(check.status).toBe('unverified');
      expect(checkStatusLabel(check.status, check.kind)).toBe('Not verified');
    }
  });
});

describe('recipe state in the view', () => {
  it('marks a plain http recipe as manual only', () => {
    const plain = cloneFile();
    plain.keys[0].endpoint = 'http://edge.example.com/v1';
    const view = buildVaultView(input({ file: plain }));

    const check = checkOf(view, view.file.keys[0]);
    expect(check.manualOnly).toBe(true);
    expect(checkStateHint(check)).toContain('Plain http');
  });

  it('names why a recipe cannot run at all', () => {
    const noEndpoint = cloneFile();
    noEndpoint.keys[0].endpoint = null;
    const view = buildVaultView(
      input({ file: noEndpoint, bindings: new Map() })
    );

    const check = checkOf(view, view.file.keys[0]);
    expect(check.checkable).toBe(false);
    expect(checkStateHint(check)).toBe('Add an endpoint to check this key');
  });
});
