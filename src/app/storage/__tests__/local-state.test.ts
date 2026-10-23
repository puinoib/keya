/**
 * §11 — device-local state.
 *
 * The storage adapter is a plain Map, so these tests describe the bookkeeping
 * rules rather than IndexedDB behaviour: retention, pruning by fact, and the
 * two-row move that a password change performs.
 */

import { describe, expect, it } from 'vitest';
import { LocalState } from '../local/state';
import type { KeyValuePort } from '../local/state';
import type { Observation } from '../../../core/runtime/observations';

class MemoryKv implements KeyValuePort {
  private map = new Map<string, unknown>();

  async get<T>(key: string): Promise<T | undefined> {
    return this.map.get(key) as T | undefined;
  }

  async set<T>(key: string, value: T): Promise<void> {
    this.map.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.map.delete(key);
  }

  async keys(prefix: string): Promise<string[]> {
    return [...this.map.keys()].filter((key) => key.startsWith(prefix));
  }

  size(): number {
    return this.map.size;
  }
}

const VAULT = '11111111-1111-4111-8111-111111111111';
const KEY = '33333333-3333-4333-8333-333333333333';

const observation = (id: string, finished: string): Observation => ({
  observation_id: id,
  vault_id: VAULT,
  key_id: KEY,
  binding: 'binding-1',
  kind: 'request',
  outcome: 'ok',
  detail_code: null,
  http_status: 200,
  latency_ms: 5,
  started_at: finished,
  finished_at: finished,
});

const state = () => new LocalState(new MemoryKv());

describe('containers registry', () => {
  const record = {
    fingerprint: 'fp-new',
    file_name: 'work.keya',
    vault_id: VAULT,
    name: 'Work',
    icon: '🔑',
    key_count: 3,
    content_updated_at: '2026-06-01T00:00:00.000Z',
    last_opened_at: '2026-06-02T00:00:00.000Z',
  };

  it('round-trips a record', async () => {
    const local = state();
    await local.putContainer(record);
    expect(await local.getContainer('fp-new')).toEqual(record);
    expect(await local.listContainers()).toHaveLength(1);
  });

  it('moves a record to a new fingerprint, dropping the old row', async () => {
    const local = state();
    await local.putContainer({ ...record, fingerprint: 'fp-old' });
    await local.moveContainer({ ...record, fingerprint: 'fp-new' }, 'fp-old');

    expect(await local.getContainer('fp-old')).toBeUndefined();
    expect(await local.getContainer('fp-new')).toEqual(record);
    expect(await local.listContainers()).toHaveLength(1);
  });

  it('leaves at most an orphan row when the move is interrupted', async () => {
    const local = state();
    await local.putContainer({ ...record, fingerprint: 'fp-old' });
    // Only the first half of the move: the new row exists, the old one too.
    await local.putContainer({ ...record, fingerprint: 'fp-new' });
    const rows = await local.listContainers();
    expect(rows.map((row) => row.fingerprint).sort()).toEqual([
      'fp-new',
      'fp-old',
    ]);
  });
});

describe('observations', () => {
  it('keeps only the most recent ten per key', async () => {
    const local = state();
    for (let index = 0; index < 14; index += 1) {
      const finished = `2026-06-01T00:00:${String(index).padStart(2, '0')}.000Z`;
      await local.recordObservation(observation(`obs-${index}`, finished));
    }

    const kept = await local.listObservations(VAULT, KEY);
    expect(kept).toHaveLength(10);
    expect(kept[0].observation_id).toBe('obs-13');
    expect(kept.at(-1)!.observation_id).toBe('obs-4');
  });

  it('forgets everything about a deleted key', async () => {
    const local = state();
    await local.recordObservation(
      observation('obs-1', '2026-06-01T00:00:00.000Z')
    );
    await local.putBusinessDismissal({
      vault_id: VAULT,
      key_id: KEY,
      rule: 'expiry_upcoming',
      condition: 'date:2026-03-01',
      dismissed_at: '2026-06-01T00:00:00.000Z',
    });
    await local.putObservationDismissal({
      vault_id: VAULT,
      key_id: KEY,
      rule: 'probe_failed',
      binding: 'binding-1',
      dismissed_at: '2026-06-01T00:00:00.000Z',
    });

    await local.forgetKey(VAULT, KEY);

    expect(await local.listObservations(VAULT, KEY)).toEqual([]);
    expect(await local.listBusinessDismissals(VAULT)).toEqual([]);
    expect(await local.listObservationDismissals(VAULT)).toEqual([]);
  });
});

describe('dismissals', () => {
  it('retains records whose fact changed, so reverting can revive them', async () => {
    const local = state();
    await local.putBusinessDismissal({
      vault_id: VAULT,
      key_id: KEY,
      rule: 'expiry_upcoming',
      condition: 'date:2026-03-01',
      dismissed_at: '2026-06-01T00:00:00.000Z',
    });
    await local.putObservationDismissal({
      vault_id: VAULT,
      key_id: KEY,
      rule: 'probe_failed',
      binding: 'binding-old',
      dismissed_at: '2026-06-01T00:00:00.000Z',
    });

    const kept = await local.pruneDismissals(
      VAULT,
      [
        {
          vault_id: VAULT,
          key_id: KEY,
          rule: 'expiry_upcoming',
          condition: 'date:2026-04-01',
        },
      ],
      [
        {
          vault_id: VAULT,
          key_id: KEY,
          rule: 'probe_failed',
          binding: 'binding-new',
        },
      ]
    );

    // They no longer apply (the view compares the current fact), but the
    // records survive so changing the fact back revives the decision.
    expect(kept.business).toHaveLength(1);
    expect(kept.observation).toHaveLength(1);
    expect(await local.listBusinessDismissals(VAULT)).toHaveLength(1);
    expect(await local.listObservationDismissals(VAULT)).toHaveLength(1);
  });

  it('keeps a record whose fact still matches', async () => {
    const local = state();
    await local.putBusinessDismissal({
      vault_id: VAULT,
      key_id: KEY,
      rule: 'insecure_endpoint',
      condition: 'http:http://192.168.1.5:8080',
      dismissed_at: '2026-06-01T00:00:00.000Z',
    });

    const kept = await local.pruneDismissals(
      VAULT,
      [
        {
          vault_id: VAULT,
          key_id: KEY,
          rule: 'insecure_endpoint',
          condition: 'http:http://192.168.1.5:8080',
        },
      ],
      []
    );
    expect(kept.business).toHaveLength(1);
  });
});

describe('grants and preferences', () => {
  it('stores grants by fingerprint', async () => {
    const local = state();
    await local.putGrant({
      fingerprint: 'fp-1',
      vault_id: VAULT,
      origin: 'https://api.example.com',
      path: '/v1/models',
      approved_at: '2026-06-01T00:00:00.000Z',
    });

    expect(await local.hasGrant('fp-1')).toBe(true);
    expect(await local.hasGrant('fp-2')).toBe(false);

    await local.removeGrant('fp-1');
    expect(await local.hasGrant('fp-1')).toBe(false);
  });

  it('merges preference patches over the defaults', async () => {
    const local = state();
    expect(await local.getPreferences()).toMatchObject({
      auto_lock_minutes: 5,
      auto_probe_on_save: false,
    });

    await local.setPreferences({ auto_lock_minutes: 30 });
    expect(await local.getPreferences()).toMatchObject({
      auto_lock_minutes: 30,
      auto_probe_on_save: false,
    });
  });
});

describe('device key', () => {
  it('creates one non-extractable key and reuses it', async () => {
    const local = state();
    const first = await local.ensureDeviceKey();
    const second = await local.ensureDeviceKey();

    expect(first.extractable).toBe(false);
    expect(await local.hasDeviceKey()).toBe(true);
    expect(second).toBe(first);
  });
});

describe('the device key', () => {
  it('is created once when two callers race', async () => {
    const kv = new MemoryKv();
    const local = new LocalState(kv);

    const [first, second] = await Promise.all([
      local.ensureDeviceKey(),
      local.ensureDeviceKey(),
    ]);

    // Same CryptoKey object: the loser did not overwrite the stored key.
    expect(first).toBe(second);
    expect(await local.hasDeviceKey()).toBe(true);
  });
});
