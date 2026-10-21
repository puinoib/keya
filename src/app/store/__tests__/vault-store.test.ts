/**
 * Store behaviour against a fake platform: unlock, edit, save, lock.
 *
 * These are the paths a screen triggers, so they are worth testing without a
 * browser: the store must never hold a password, must surface failures, and
 * must refuse to lock with unwritten changes.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { createVaultStore, type VaultPlatform } from '../vault-store';
import { VaultSession } from '../../runtime/session';
import { Vault } from '../../vault/vault';
import { LocalState, type KeyValuePort } from '../../storage/local/state';
import {
  MemoryFile,
  fixedClock,
  memoryPorts,
} from '../../vault/__tests__/memory-port';
import { sealContainer } from '../../../core/format/container';
import { deriveFileKeyInline } from '../../../core/format/kdf';
import { serializePayload } from '../../../core/payload/serialize';
import { importDeviceKey } from '../../../core/fingerprint';
import { cloneFile, IDS } from '../../../core/__tests__/fixtures';
import type { KeyaFile } from '../../../core/payload/types';
import type { ProbeFetch } from '../../probe/execute';

const PASSWORD = 'a fairly long synthetic passphrase';
const SALT = new Uint8Array([...Array(16).keys()]);
const KDF = { ops: 2, mem: 19_922_944 };
const NOW = '2026-03-01T12:00:00.000Z';

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
}

async function bytesFor(payload: KeyaFile): Promise<Uint8Array> {
  const fileKey = await deriveFileKeyInline({
    password: PASSWORD,
    salt: SALT,
    kdf: KDF,
  });
  return sealContainer({
    payload: serializePayload(payload),
    fileKey,
    container: { kdf: KDF, salt: SALT },
    nonce: new Uint8Array(24).fill(5),
  });
}

async function harness(options: { failWrite?: boolean } = {}) {
  const payload = cloneFile();
  const file = new MemoryFile(await bytesFor(payload));
  file.failNextWrite = options.failWrite ?? false;
  const clock = fixedClock(NOW);
  const local = new LocalState(new MemoryKv(), { now: () => NOW });
  const deviceKey = await importDeviceKey(new Uint8Array(32).fill(4));

  const fetchImpl: ProbeFetch = async () => ({
    status: 200,
    contentType: 'application/json',
  });

  const openWith = async (password: string) => {
    const opened = await Vault.open(memoryPorts(file, clock), { password });
    if (!opened.ok) return { ok: false as const, failure: opened.failure };
    return {
      ok: true as const,
      opened: {
        vault: opened.vault,
        fingerprint: opened.vault.containerInfo.fingerprint,
        record: {
          fingerprint: opened.vault.containerInfo.fingerprint,
          file_name: 'work.keya',
          vault_id: payload.vault.id,
          name: payload.vault.name,
          icon: payload.vault.icon,
          key_count: payload.keys.length,
          content_updated_at: payload.vault.content_updated_at,
          last_opened_at: NOW,
        },
        session: new VaultSession({
          vault: opened.vault,
          local,
          deviceKey,
          fetch: fetchImpl,
          clock: () => new Date(NOW),
          timeZone: 'UTC',
        }),
      },
    };
  };

  const platform: VaultPlatform = {
    restoreWorkspace: async () => ({ name: 'Keya' }),
    pickWorkspace: async () => ({ name: 'Keya' }),
    listFiles: async () => ['work.keya', 'other.keya'],
    openSession: (_fileName, password) => openWith(password),
    createVault: async () => ({ ok: false, failure: 'not used here' }),
    listContainers: async () => [],
  };

  return { platform, file, payload };
}

describe('vault store', () => {
  let store: ReturnType<typeof createVaultStore>;

  beforeEach(async () => {
    const { platform } = await harness();
    store = createVaultStore(platform);
  });

  it('restores the workspace on init', async () => {
    await store.getState().init();
    expect(store.getState()).toMatchObject({
      ready: true,
      workspaceName: 'Keya',
      files: ['work.keya', 'other.keya'],
    });
  });

  it('unlocks with a password and never stores it', async () => {
    await store.getState().init();
    const ok = await store.getState().unlock('work.keya', PASSWORD);

    expect(ok).toBe(true);
    const state = store.getState();
    expect(state.payload?.keys[0].name).toBe('Edge key');
    expect(state.saveState).toBe('clean');
    // The store state must not contain the password anywhere.
    expect(JSON.stringify(Object.keys(state))).not.toContain('password');
    expect(JSON.stringify(state.payload)).not.toContain(PASSWORD);
  });

  it('surfaces a wrong password instead of throwing', async () => {
    await store.getState().init();
    const ok = await store.getState().unlock('work.keya', 'wrong passphrase');
    expect(ok).toBe(false);
    expect(store.getState().error).toBe('auth_failed');
    expect(store.getState().session).toBeNull();
  });

  it('marks dirty on edit, then saves', async () => {
    await store.getState().init();
    await store.getState().unlock('work.keya', PASSWORD);

    const key = { ...store.getState().payload!.keys[0], name: 'Renamed' };
    await store.getState().saveKey(key);

    expect(store.getState().saveState).toBe('dirty');
    expect(store.getState().payload!.keys[0].name).toBe('Renamed');

    expect(await store.getState().save()).toBe(true);
    expect(store.getState().saveState).toBe('clean');
  });

  it('reports a conflicting rejection without changing the payload', async () => {
    await store.getState().init();
    await store.getState().unlock('work.keya', PASSWORD);

    // Deleting a provider that a key still references must be refused.
    await store.getState().removeProvider(IDS.providerId);
    expect(store.getState().error).toBe('provider_in_use');
    expect(store.getState().payload!.providers).toHaveLength(1);
    expect(store.getState().saveState).toBe('clean');
  });

  it('refuses to lock while a save fails', async () => {
    const { platform, file } = await harness({ failWrite: true });
    const failing = createVaultStore(platform);
    await failing.getState().init();
    await failing.getState().unlock('work.keya', PASSWORD);

    const key = { ...failing.getState().payload!.keys[0], name: 'Unsaved' };
    await failing.getState().saveKey(key);

    await failing.getState().lock();
    expect(failing.getState().session).not.toBeNull();
    expect(failing.getState().saveState).toBe('error');
    expect(file.bytes).not.toBeNull();
  });

  it('locks after a successful save and clears the payload', async () => {
    await store.getState().init();
    await store.getState().unlock('work.keya', PASSWORD);

    await store.getState().lock();
    expect(store.getState().session).toBeNull();
    expect(store.getState().payload).toBeNull();
    expect(store.getState().reminders).toEqual([]);
  });

  it('keeps reminders in sync with edits', async () => {
    await store.getState().init();
    await store.getState().unlock('work.keya', PASSWORD);

    const before = store.getState().reminders.length;
    const key = {
      ...store.getState().payload!.keys[0],
      expiry: { kind: 'date' as const, value: '2026-03-05' },
    };
    await store.getState().saveKey(key);

    expect(before).toBeGreaterThan(0);
    expect(
      store
        .getState()
        .reminders.some((entry) => entry.reminder.rule === 'expiry_upcoming')
    ).toBe(true);
  });
});
