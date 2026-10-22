import { describe, expect, it } from 'vitest';
import { cloneFile, IDS } from '../../../core/__tests__/fixtures';
import { classifyRecipe } from '../../../core/presets/classify';
import { buildDatabase, type ViewInput } from '../build';
import { DEFAULT_PREFERENCES } from '../../storage/local/state';

function input(overrides: Partial<ViewInput> = {}): ViewInput {
  return {
    file: cloneFile(),
    observations: new Map(),
    bindings: new Map(),
    dismissals: { business: [], observation: [] },
    preferences: DEFAULT_PREFERENCES,
    now: new Date('2026-03-01T12:00:00.000Z'),
    timeZone: 'UTC',
    ...overrides,
  };
}

describe('expiry in the view', () => {
  it('judges a calendar day against the device time zone', () => {
    const file = cloneFile();
    file.keys[0].expiry = { kind: 'date', value: '2026-03-02' };

    // 2026-03-01T16:00Z is already 2026-03-02 in Tokyo, so that day is today.
    const tokyo = buildDatabase(
      input({
        file,
        now: new Date('2026-03-01T16:00:00.000Z'),
        timeZone: 'Asia/Tokyo',
      })
    ).getApiKey(IDS.key);
    const utc = buildDatabase(
      input({
        file,
        now: new Date('2026-03-01T16:00:00.000Z'),
        timeZone: 'UTC',
      })
    ).getApiKey(IDS.key);

    expect(tokyo?.days_until_expiry).toBe(0);
    expect(tokyo?.expiry_status).toBe('expiring_soon');
    expect(utc?.days_until_expiry).toBe(1);
    expect(utc?.expiry_status).toBe('expiring_soon');
  });

  it('marks a passed instant as expired', () => {
    const file = cloneFile();
    file.keys[0].expiry = {
      kind: 'instant',
      value: '2026-03-01T11:00:00.000Z',
    };

    const key = buildDatabase(input({ file })).getApiKey(IDS.key);

    expect(key?.expiry_status).toBe('expired');
    expect(key?.days_until_expiry).toBe(0);
  });

  it('has no verdict without an expiry', () => {
    const file = cloneFile();
    file.keys[0].expiry = null;

    const key = buildDatabase(input({ file })).getApiKey(IDS.key);

    expect(key?.expiry_status).toBe('none');
    expect(key?.days_until_expiry).toBeNull();
  });
});

describe('inbox rows', () => {
  it('uses the core rule and keeps the key id', () => {
    const file = cloneFile();
    file.keys[0].expiry = { kind: 'date', value: '2026-03-05' };

    const state = classifyRecipe(
      { provider_id: IDS.providerId, endpoint: file.keys[0].endpoint },
      file.providers
    );
    if (state.kind === 'not_executable')
      throw new Error('fixture not runnable');

    const rows = buildDatabase(
      input({
        file,
        bindings: new Map([[IDS.key, { binding: 'b1', plan: state.plan }]]),
      })
    ).getInboxItems();
    const rules = rows.map((row) => row.rule).sort();

    expect(rules).toEqual(['expiry_upcoming', 'never_probed']);
    expect(rows.every((row) => row.entity_id === IDS.key)).toBe(true);
  });

  it('reports a plaintext destination', () => {
    const file = cloneFile();
    file.keys[0].endpoint = 'http://edge.example.com/v1';

    const rows = buildDatabase(input({ file })).getInboxItems();

    expect(rows.some((row) => row.rule === 'insecure_endpoint')).toBe(true);
  });

  it('keeps a dismissed row, marked archived', () => {
    const file = cloneFile();
    file.keys[0].expiry = { kind: 'date', value: '2026-03-05' };

    const rows = buildDatabase(
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
    ).getInboxItems();

    const upcoming = rows.find((row) => row.rule === 'expiry_upcoming');
    expect(upcoming?.status).toBe('archived');
  });
});

describe('settings in the view', () => {
  it('mirrors device preferences and the file providers', () => {
    const settings = buildDatabase(
      input({
        preferences: {
          ...DEFAULT_PREFERENCES,
          auto_lock_minutes: 15,
          auto_probe_on_save: true,
          hidden_presets: ['Exa'],
        },
      })
    ).getSettings();

    expect(settings.auto_lock_minutes).toBe(15);
    expect(settings.auto_test_on_save).toBe(true);
    expect(settings.disabled_providers).toEqual(['Exa']);
    expect(settings.custom_providers.map((provider) => provider.name)).toEqual([
      'Edge Gateway',
    ]);
    expect(settings.custom_providers[0].id).toBe(IDS.providerId);
  });
});
