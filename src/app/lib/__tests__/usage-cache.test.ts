import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  USAGE_FRESH_MS,
  USAGE_MAX_AGE_MS,
  dropUsageSnapshot,
  isStaleSnapshot,
  pruneUsageCache,
  readUsageCache,
  writeUsageSnapshot,
} from '../usage-cache';
import type { UsageSnapshot } from '../usage';

/** Minimal sessionStorage, since the node test environment has none. */
class MemoryStorage implements Storage {
  private map = new Map<string, string>();
  get length() {
    return this.map.size;
  }
  clear() {
    this.map.clear();
  }
  getItem(key: string) {
    return this.map.get(key) ?? null;
  }
  key(index: number) {
    return [...this.map.keys()][index] ?? null;
  }
  removeItem(key: string) {
    this.map.delete(key);
  }
  setItem(key: string, value: string) {
    this.map.set(key, value);
  }
}

const VAULT = 'vault-1';
const now = new Date('2026-10-20T12:00:00.000Z');

function snapshotAt(iso: string, percent = 42): UsageSnapshot {
  return {
    provider: 'OpenCode Go',
    checked_at: iso,
    windows: [
      {
        id: 'weekly',
        label: '7 days',
        percent_used: percent,
        resets_at: '2026-10-26T00:00:00.000Z',
      },
    ],
  };
}

let storage: MemoryStorage;

beforeEach(() => {
  storage = new MemoryStorage();
  Object.defineProperty(globalThis, 'sessionStorage', {
    value: storage,
    configurable: true,
    writable: true,
  });
});

afterEach(() => {
  Reflect.deleteProperty(globalThis, 'sessionStorage');
});

describe('usage cache', () => {
  it('returns a snapshot written moments ago', () => {
    writeUsageSnapshot(VAULT, 'key-1', snapshotAt(now.toISOString()));

    const entries = readUsageCache(VAULT, now);

    expect(entries['key-1']?.state).toBe('ok');
    expect(entries['key-1']?.snapshot?.windows[0]).toEqual({
      id: 'weekly',
      label: '7 days',
      percent_used: 42,
      resets_at: '2026-10-26T00:00:00.000Z',
    });
  });

  it('keeps a snapshot inside the cache horizon but marks it stale', () => {
    const checked = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString();
    writeUsageSnapshot(VAULT, 'key-1', snapshotAt(checked));

    const entries = readUsageCache(VAULT, now);

    expect(entries['key-1']?.snapshot?.checked_at).toBe(checked);
    expect(isStaleSnapshot(checked, now)).toBe(true);
    expect(isStaleSnapshot(now.toISOString(), now)).toBe(false);
    expect(USAGE_FRESH_MS).toBeLessThan(USAGE_MAX_AGE_MS);
  });

  it('drops a snapshot past the horizon instead of showing old numbers', () => {
    const checked = new Date(
      now.getTime() - USAGE_MAX_AGE_MS - 1000
    ).toISOString();
    writeUsageSnapshot(VAULT, 'key-1', snapshotAt(checked));

    expect(readUsageCache(VAULT, now)).toEqual({});
    // The entry is forgotten, not just hidden.
    expect(storage.getItem('keya-usage:v1:vault-1')).toBeNull();
  });

  it('never mixes vaults', () => {
    writeUsageSnapshot('vault-a', 'key-1', snapshotAt(now.toISOString()));

    expect(readUsageCache('vault-b', now)).toEqual({});
    expect(readUsageCache('vault-a', now)['key-1']).toBeTruthy();
  });

  it('drops a deleted or archived key', () => {
    writeUsageSnapshot(VAULT, 'key-1', snapshotAt(now.toISOString()));
    writeUsageSnapshot(VAULT, 'key-2', snapshotAt(now.toISOString()));

    dropUsageSnapshot(VAULT, 'key-1');

    expect(Object.keys(readUsageCache(VAULT, now))).toEqual(['key-2']);
  });

  it('prunes entries for keys the vault no longer has', () => {
    writeUsageSnapshot(VAULT, 'key-1', snapshotAt(now.toISOString()));
    writeUsageSnapshot(VAULT, 'key-2', snapshotAt(now.toISOString()));

    pruneUsageCache(VAULT, ['key-2']);

    expect(Object.keys(readUsageCache(VAULT, now))).toEqual(['key-2']);
  });

  it('ignores a corrupt or foreign payload', () => {
    storage.setItem('keya-usage:v1:vault-1', 'not json');
    expect(readUsageCache(VAULT, now)).toEqual({});

    storage.setItem(
      'keya-usage:v1:vault-1',
      JSON.stringify({ entries: { 'key-1': { state: 'ok' } } })
    );
    expect(readUsageCache(VAULT, now)).toEqual({});
  });

  it('survives storage being unavailable', () => {
    Object.defineProperty(globalThis, 'sessionStorage', {
      value: undefined,
      configurable: true,
      writable: true,
    });

    expect(() =>
      writeUsageSnapshot(VAULT, 'key-1', snapshotAt(now.toISOString()))
    ).not.toThrow();
    expect(readUsageCache(VAULT, now)).toEqual({});
  });

  it('writes an empty cache away rather than keeping an empty record', () => {
    writeUsageSnapshot(VAULT, 'key-1', snapshotAt(now.toISOString()));
    dropUsageSnapshot(VAULT, 'key-1');

    expect(storage.getItem('keya-usage:v1:vault-1')).toBeNull();
  });
});
