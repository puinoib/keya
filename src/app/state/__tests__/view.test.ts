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
  reminderDisplay,
  searchKeys,
  sortedGroups,
  type ViewInput,
} from '../view';
import {
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
    dismissals: { business: [], observation: [] },
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

describe('reminder rows', () => {
  it('derives the core rules for the key', () => {
    const file = cloneFile();
    file.keys[0].expiry = { kind: 'date', value: '2026-03-05' };

    const rows = buildVaultView(input({ file })).reminders;

    expect(rows.map((row) => row.reminder.rule).sort()).toEqual([
      'expiry_upcoming',
      'never_probed',
    ]);
    expect(rows.every((row) => row.key.id === IDS.key)).toBe(true);
    expect(rows.every((row) => !row.dismissed)).toBe(true);
  });

  it('marks a dismissed fact as archived without dropping the row', () => {
    const file = cloneFile();
    file.keys[0].expiry = { kind: 'date', value: '2026-03-05' };

    const view = buildVaultView(
      input({
        file,
        dismissals: {
          business: [
            {
              vault_id: IDS.vault,
              key_id: IDS.key,
              rule: 'expiry_upcoming',
              condition: 'date:2026-03-05',
              dismissed_at: '2026-03-01T12:00:00.000Z',
            },
          ],
          observation: [],
        },
      })
    );

    const upcoming = view.reminders.find(
      (row) => row.reminder.rule === 'expiry_upcoming'
    );
    expect(upcoming?.dismissed).toBe(true);
  });

  it('drops an observation row for a result that is no longer current', () => {
    const view = buildVaultView(
      input({
        checks: new Map([
          [IDS.key, observation({ binding: 'an-older-binding' })],
        ]),
      })
    );

    expect(
      view.reminders.some((row) => row.reminder.rule === 'never_probed')
    ).toBe(true);
  });

  it('prints the key, provider and check facts', () => {
    const unchecked = buildVaultView(input());
    const row = unchecked.reminders[0];

    const display = reminderDisplay(unchecked, row, () => 'Edge Gateway');
    expect(display.keyName).toBe('Edge key');
    expect(display.provider).toBe('Edge Gateway');
    expect(display.checkedAt).toBeNull();
    expect(display.failureText).toBeNull();
    expect(display.endpoint).toBeNull();
  });

  it('carries the failure text and the endpoint of a live row', () => {
    const failed = buildVaultView(
      input({
        checks: new Map([[IDS.key, observation({ outcome: 'auth_failed' })]]),
      })
    );
    const failedRow = failed.reminders.find(
      (entry) => entry.reminder.rule === 'probe_failed'
    )!;
    expect(reminderDisplay(failed, failedRow, () => 'Edge').failureText).toBe(
      'the service rejected the credential'
    );

    const insecure = cloneFile();
    insecure.keys[0].endpoint = 'http://edge.example.com/v1';
    const insecureView = buildVaultView(input({ file: insecure }));
    const insecureRow = insecureView.reminders.find(
      (entry) => entry.reminder.rule === 'insecure_endpoint'
    )!;
    expect(
      reminderDisplay(insecureView, insecureRow, () => 'Edge').endpoint
    ).toBe('http://edge.example.com/v1');
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

  it('matches name, description and secret', () => {
    const keys = cloneFile().keys;

    expect(searchKeys(keys, 'edge')).toHaveLength(1);
    expect(searchKeys(keys, 'staging')).toHaveLength(1);
    expect(searchKeys(keys, 'sk-synthetic')).toHaveLength(1);
    expect(searchKeys(keys, 'nothing')).toHaveLength(0);
    expect(searchKeys(keys, '   ')).toHaveLength(1);
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

  it('calls a non-ok outcome failed', () => {
    const view = buildVaultView(
      input({
        checks: new Map([[IDS.key, observation({ outcome: 'auth_failed' })]]),
      })
    );
    const check = checkOf(view, keyById(view, IDS.key)!);

    expect(check.status).toBe('failed');
    expect(checkStatusLabel(check.status, check.kind)).toBe('Failed');
  });
});
