import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cloneFile, IDS } from '../../../core/__tests__/fixtures';
import { createAppStore } from '../create-store';
import { readUsageCache, writeUsageSnapshot } from '../../lib/usage-cache';
import { providerToDraft } from '../../state/providers';

const RECENT = new Date().toISOString();
import { FIXED_NOW, PASSWORD, openHarness, type Harness } from './fixtures';
import { Vault } from '../../vault/vault';
import {
  MemoryFile,
  fixedClock,
  memoryPorts,
} from '../../vault/__tests__/memory-port';

/** Minimal sessionStorage, since the node test environment has none. */
class MemoryStorage {
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

function makeStore(h: Harness, saveDelayMs = 0) {
  let generated = 0;
  return createAppStore({
    local: h.local,
    clock: () => new Date(FIXED_NOW),
    timeZone: () => 'UTC',
    newId: () => {
      generated += 1;
      return `aaaaaaaa-aaaa-4aaa-8aaa-${String(generated).padStart(12, '0')}`;
    },
    saveDelayMs,
    confirmDestination: async () => true,
  });
}

const FIRST_GENERATED_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000001';

async function unlocked(harness?: Harness) {
  const h = harness ?? (await openHarness());
  const store = makeStore(h);
  await store.useStore.getState().unlock(h.opened, 'work.keya', 'folder');
  return { store, h };
}

beforeEach(() => {
  Object.defineProperty(globalThis, 'sessionStorage', {
    value: new MemoryStorage(),
    configurable: true,
  });
});

describe('addKey', () => {
  it('answers with the key it stored, without waiting for a refresh', async () => {
    const { store, h } = await unlocked();

    const created = store.useStore.getState().addKey({
      name: 'Fresh key',
      secret: 'sk-synthetic-fresh',
      providerId: 'preset:openai',
      endpoint: 'https://api.openai.com/v1',
      description: '',
      groupId: null,
      expiry: { kind: 'date', value: '2026-12-01' },
    });

    expect(created?.id).toBe(FIRST_GENERATED_ID);
    expect(created?.name).toBe('Fresh key');
    expect(
      h.vault.getPayload().keys.find((key) => key.id === created?.id)
    ).toMatchObject({
      secret: 'sk-synthetic-fresh',
      provider_id: 'preset:openai',
      expiry: { kind: 'date', value: '2026-12-01' },
    });
  });

  it('does nothing when no vault is unlocked', async () => {
    const h = await openHarness();
    const store = makeStore(h);
    const before = h.vault.getPayload().keys.length;

    const created = store.useStore.getState().addKey({
      name: 'No vault',
      secret: 'sk-synthetic-no-vault',
      providerId: null,
      endpoint: '',
      description: '',
      groupId: null,
      expiry: null,
    });

    expect(created).toBeUndefined();
    expect(h.vault.getPayload().keys).toHaveLength(before);
  });

  it('refuses a group the vault does not have', async () => {
    const { store, h } = await unlocked();
    const existing = h.vault.getPayload().keys[0];

    store.useStore.getState().updateKey(existing.id, {
      groupId: '00000000-0000-4000-8000-000000000000',
    });

    expect(h.vault.getPayload().keys[0].group_id).toBe(existing.group_id);
    expect(store.useStore.getState().view?.file.keys[0].group_id).toBe(
      existing.group_id
    );
  });
});

describe('updateKey', () => {
  it('drops the cached allowance when the request shape changes', async () => {
    const h = await openHarness();
    writeUsageSnapshot(h.payload.vault.id, IDS.key, {
      provider: 'OpenCode Go',
      checked_at: RECENT,
      windows: [
        { id: 'weekly', label: '7 days', percent_used: 40, resets_at: null },
      ],
    });
    const store = makeStore(h);
    await store.useStore.getState().unlock(h.opened, 'work.keya', 'folder');
    expect(store.useStore.getState().usage[IDS.key]).toBeDefined();

    store.useStore.getState().updateKey(IDS.key, { secret: 'sk-rotated' });

    expect(store.useStore.getState().usage[IDS.key]).toBeUndefined();
    expect(readUsageCache(h.payload.vault.id)[IDS.key]).toBeUndefined();
  });

  it('keeps the snapshot for a rename, which cannot change the request', async () => {
    const h = await openHarness();
    writeUsageSnapshot(h.payload.vault.id, IDS.key, {
      provider: 'OpenCode Go',
      checked_at: RECENT,
      windows: [
        { id: 'weekly', label: '7 days', percent_used: 40, resets_at: null },
      ],
    });
    const store = makeStore(h);
    await store.useStore.getState().unlock(h.opened, 'work.keya', 'folder');

    store.useStore.getState().updateKey(IDS.key, { name: 'Renamed only' });

    expect(store.useStore.getState().usage[IDS.key]).toBeDefined();
    expect(h.vault.getPayload().keys[0].name).toBe('Renamed only');
  });

  it('keeps the provider reference when the label round-trips', async () => {
    const { store } = await unlocked();

    store.useStore.getState().updateKey(IDS.key, {
      providerId: 'custom:44444444-4444-4444-8444-444444444444',
    });

    expect(store.useStore.getState().view?.file.providers[0].id).toBe(
      'custom:44444444-4444-4444-8444-444444444444'
    );
  });
});

describe('flushSave', () => {
  it('writes the file and clears the unsaved flag', async () => {
    const { store, h } = await unlocked();
    store.useStore.getState().addKey({
      name: 'Save me',
      secret: 'sk-synthetic-save',
      providerId: null,
      endpoint: '',
      description: '',
      groupId: null,
      expiry: null,
    });

    const saved = await store.flushSave();
    if (!saved) {
      const { validateKeyaFile } = await import(
        '../../../core/payload/validate'
      );
      const checked = validateKeyaFile(h.vault.getPayload());
      throw new Error(
        `flushSave=false, issues=${JSON.stringify(checked.ok ? [] : checked.issues)}`
      );
    }
    expect(store.useStore.getState().hasUnsavedChanges).toBe(false);
    expect(h.file.writes).toBeGreaterThan(0);
  });

  it('reports a write failure and keeps the edits marked unsaved', async () => {
    const { store, h } = await unlocked();
    store.useStore.getState().addKey({
      name: 'Do not lose me',
      secret: 'sk-synthetic-lose',
      providerId: null,
      endpoint: '',
      description: '',
      groupId: null,
      expiry: null,
    });
    h.file.failNextWrite = true;

    await expect(store.flushSave()).resolves.toBe(false);
    expect(store.useStore.getState().hasUnsavedChanges).toBe(true);
    expect(store.useStore.getState().workspaceState).toBe('unlocked');
  });

  it('can lock a download-mode vault after exporting its changes', async () => {
    const h = await openHarness();
    const store = makeStore(h);
    await store.useStore.getState().unlock(h.opened, 'work.keya', 'download');

    store.useStore.getState().addKey({
      name: 'Export then lock',
      secret: 'sk-synthetic-export-lock',
      providerId: null,
      endpoint: '',
      description: '',
      groupId: null,
      expiry: null,
    });
    expect(await store.exportVaultBytes(true)).not.toBeNull();
    store.useStore.getState().markExported();
    expect(store.useStore.getState().hasUnsavedChanges).toBe(false);

    await store.useStore.getState().lock();
    expect(store.useStore.getState().workspaceState).toBe('welcome');
    expect(h.vault.isLocked).toBe(true);
  });

  it('treats an exported download-mode vault as saved, and guards pending edits', async () => {
    const h = await openHarness();
    const store = makeStore(h);
    await store.useStore.getState().unlock(h.opened, 'work.keya', 'download');

    await expect(store.flushSave()).resolves.toBe(true);

    store.useStore.getState().addKey({
      name: 'Pending export',
      secret: 'sk-synthetic-pending',
      providerId: null,
      endpoint: '',
      description: '',
      groupId: null,
      expiry: null,
    });
    await expect(store.flushSave()).resolves.toBe(false);
    expect(store.useStore.getState().workspaceState).toBe('unlocked');
  });
});

describe('unlock', () => {
  it('hydrates the usage cache for keys that still exist and prunes the rest', async () => {
    const h = await openHarness();
    writeUsageSnapshot(h.payload.vault.id, IDS.key, {
      provider: 'OpenCode Go',
      checked_at: RECENT,
      windows: [
        { id: 'weekly', label: '7 days', percent_used: 12, resets_at: null },
      ],
    });
    writeUsageSnapshot(h.payload.vault.id, 'deleted-key', {
      provider: 'OpenCode Go',
      checked_at: RECENT,
      windows: [
        { id: 'weekly', label: '7 days', percent_used: 99, resets_at: null },
      ],
    });

    const store = makeStore(h);
    await store.useStore.getState().unlock(h.opened, 'work.keya', 'folder');

    expect(Object.keys(store.useStore.getState().usage)).toEqual([IDS.key]);
    expect(readUsageCache(h.payload.vault.id)['deleted-key']).toBeUndefined();
  });

  it('does not keep the master password in the store', async () => {
    const { store } = await unlocked();

    expect('password' in store.useStore.getState()).toBe(false);

    await store.useStore.getState().lock();

    expect(store.useStore.getState().workspaceState).toBe('welcome');
    expect(store.useStore.getState().view).toBeNull();
  });

  it('aborts and locks the previous session when switching vaults', async () => {
    const first = await openHarness();
    const store = makeStore(first);
    await store.useStore
      .getState()
      .unlock(first.opened, 'first.keya', 'folder');

    const second = await openHarness();
    await store.useStore
      .getState()
      .unlock(second.opened, 'second.keya', 'folder');

    expect(first.session.signal.aborted).toBe(true);
    expect(first.vault.isLocked).toBe(true);
    expect(store.useStore.getState().activeVaultFileName).toBe('second.keya');
  });
});

describe('inbox attention', () => {
  it('does not report a new key as attention, and clears its own chore', async () => {
    const h = await openHarness();
    const store = makeStore(h);
    await store.useStore.getState().unlock(h.opened, 'work.keya', 'folder');

    expect(store.useStore.getState().view?.attention).toEqual([]);
    // A key that was never verified is housekeeping, not an alert.
    expect(store.useStore.getState().view?.device).toHaveLength(1);

    store.useStore.getState().addKey({
      name: 'Never verified',
      secret: 'sk-synthetic-attention',
      providerId: 'preset:openai',
      endpoint: 'https://api.openai.com/v1',
      description: '',
      groupId: null,
      expiry: null,
    });

    await vi.waitFor(() =>
      expect(store.useStore.getState().view?.device).toHaveLength(2)
    );
    expect(store.useStore.getState().view?.attention).toEqual([]);
  });

  it('reports an expiry and clears it by editing the date', async () => {
    const payload = cloneFile();
    payload.keys[0].expiry = { kind: 'date', value: '2026-03-05' };
    const h = await openHarness({ payload });
    const store = makeStore(h);
    await store.useStore.getState().unlock(h.opened, 'work.keya', 'folder');

    expect(store.useStore.getState().view?.attention).toHaveLength(1);
    expect(store.useStore.getState().view?.attention[0].fact.kind).toBe(
      'expiry'
    );

    store.useStore.getState().updateKey(IDS.key, { expiry: null });

    await vi.waitFor(() =>
      expect(store.useStore.getState().view?.attention).toEqual([])
    );
  });
});

describe('manual checks', () => {
  it('records an observation for the key it checked', async () => {
    const { store, h } = await unlocked();

    const result = await store.runManualCheck(IDS.key);

    expect(result?.success).toBe(true);
    const observations = await h.local.listObservations(
      h.payload.vault.id,
      IDS.key
    );
    expect(observations).toHaveLength(1);
    expect(store.useStore.getState().view?.checks.get(IDS.key)?.outcome).toBe(
      'ok'
    );
  });

  it('returns null for a key that is not in the vault', async () => {
    const { store } = await unlocked();

    await expect(store.runManualCheck('not-a-key')).resolves.toBeNull();
  });

  it('exports the current payload as a file image', async () => {
    const { store, h } = await unlocked();

    const bytes = await store.exportVaultBytes();

    expect(bytes?.length).toBeGreaterThan(0);
    expect(h.vault.getPayload().keys).toHaveLength(cloneFile().keys.length);
  });
});

describe('a check that is still in flight', () => {
  it('settles instead of rejecting when the vault is locked underneath it', async () => {
    const h = await openHarness({
      fetch: async () => {
        await new Promise((resolve) => setTimeout(resolve, 30));
        return { status: 200, contentType: 'application/json' };
      },
    });
    const store = makeStore(h);
    await store.useStore.getState().unlock(h.opened, 'work.keya', 'folder');

    const pending = store.runManualCheck(IDS.key);
    await new Promise((resolve) => setTimeout(resolve, 5));
    await store.useStore.getState().lock();

    await expect(pending).resolves.toMatchObject({ kind: 'request' });
    expect(store.useStore.getState().workspaceState).toBe('welcome');
  });

  it('aborts an in-flight request when the vault locks', async () => {
    let signal: AbortSignal | undefined;
    const h = await openHarness({
      fetch: async (url, init) => {
        void url;
        return new Promise((_resolve, reject) => {
          signal = init.signal;
          init.signal.addEventListener('abort', () =>
            reject(new DOMException('aborted', 'AbortError'))
          );
        });
      },
    });
    const store = makeStore(h);
    await store.useStore.getState().unlock(h.opened, 'work.keya', 'folder');

    const pending = store.runManualCheck(IDS.key);
    await vi.waitFor(() => expect(signal).toBeDefined());
    await store.useStore.getState().lock();

    await expect(pending).resolves.toMatchObject({ kind: 'request' });
    expect(signal?.aborted).toBe(true);
  });

  it('drops a refresh that started before the vault locked', async () => {
    const h = await openHarness();
    const store = makeStore(h);
    await store.useStore.getState().unlock(h.opened, 'work.keya', 'folder');

    const original = h.local.observationsByKey.bind(h.local);
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let gated = false;
    h.local.observationsByKey = async (...args) => {
      // Park only the refresh under test: the lock runs its own refresh, and a
      // shared call counter would gate whichever of the two arrives first.
      if (!gated) {
        gated = true;
        await gate;
      }
      return original(...args);
    };

    const pending = store.useStore.getState().refresh();
    await vi.waitFor(() => expect(gated).toBe(true));
    await store.useStore.getState().lock();
    release();
    await pending;

    expect(store.useStore.getState().workspaceState).toBe('welcome');
    expect(store.useStore.getState().view).toBeNull();
  });

  it('cancels a lock when an edit lands after the flush', async () => {
    const h = await openHarness();
    const store = makeStore(h);
    await store.useStore.getState().unlock(h.opened, 'work.keya', 'folder');

    // Land the edit in the window between "the file is written" and "the lock
    // runs": the flush cannot cover it, so the lock must be refused and the
    // store must not claim a clean save.
    const originalFlush = h.vault.flush.bind(h.vault);
    let injected = false;
    h.vault.flush = async () => {
      const result = await originalFlush();
      if (!injected) {
        injected = true;
        store.useStore.getState().updateMeta({ name: 'Late edit' });
      }
      return result;
    };

    await store.useStore.getState().lock();

    // The vault is still dirty, so the lock was refused and the edit survives.
    expect(store.useStore.getState().workspaceState).toBe('unlocked');
    expect(store.useStore.getState().hasUnsavedChanges).toBe(true);
    expect(h.vault.hasUnsavedChanges).toBe(true);
    expect(h.vault.getPayload().vault.name).toBe('Late edit');
  });
});

describe('provider edits', () => {
  it('saves the payload and marks the change like any other edit', async () => {
    const { store, h } = await unlocked();
    const view = store.useStore.getState().view;
    if (!view) throw new Error('the vault should be unlocked');

    const drafts = [
      ...view.file.providers.map(providerToDraft),
      { name: 'Acme', endpoint: 'https://api.acme.test' },
    ];

    store.useStore.getState().updateSettings({ providers: drafts });
    // Providers are payload, not preferences: an edit has to be unsaved until
    // the write lands, otherwise a reload loses it without a warning.
    expect(store.useStore.getState().hasUnsavedChanges).toBe(true);

    await vi.waitFor(() => expect(h.file.writes).toBe(1));
    await vi.waitFor(() =>
      expect(store.useStore.getState().hasUnsavedChanges).toBe(false)
    );
    expect(h.vault.getPayload().providers.map((it) => it.name)).toContain(
      'Acme'
    );
  });
});

describe('changing the password', () => {
  const NEW_PASSWORD = 'another long synthetic passphrase 2';

  it('rejects a wrong current password without touching the file', async () => {
    const { store, h } = await unlocked();
    const before = h.file.bytes!.slice();

    const result = await store.useStore
      .getState()
      .changePassword('not the passphrase', NEW_PASSWORD);

    expect(result).toEqual({
      ok: false,
      reason: 'The current password is not correct.',
    });
    expect(h.file.bytes).toEqual(before);
  }, 30_000);

  it('writes a container that opens with the new password', async () => {
    const { store, h } = await unlocked();

    const result = await store.useStore
      .getState()
      .changePassword(PASSWORD, NEW_PASSWORD);
    expect(result.ok).toBe(true);

    const reopened = await Vault.open(
      memoryPorts(new MemoryFile(h.file.bytes), fixedClock()),
      { password: NEW_PASSWORD }
    );
    expect(reopened.ok).toBe(true);
  }, 30_000);

  it('marks a download-mode vault unsaved so the export is required', async () => {
    const h = await openHarness();
    const store = makeStore(h);
    await store.useStore.getState().unlock(h.opened, 'work.keya', 'download');

    const result = await store.useStore
      .getState()
      .changePassword(PASSWORD, NEW_PASSWORD);
    expect(result.ok).toBe(true);
    expect(store.useStore.getState().hasUnsavedChanges).toBe(true);

    // The in-memory file is the only copy of the new container; locking would
    // discard it, so the lock must be refused until the user exports.
    await store.useStore.getState().lock();
    expect(store.useStore.getState().workspaceState).toBe('unlocked');
  }, 30_000);
});

describe('deleting a key', () => {
  it('keeps its local history until the file write lands', async () => {
    const { store, h } = await unlocked();
    await h.local.recordObservation({
      observation_id: 'obs-review',
      vault_id: h.payload.vault.id,
      key_id: IDS.key,
      binding: 'synthetic-binding',
      kind: 'request',
      outcome: 'ok',
      detail_code: null,
      http_status: 200,
      latency_ms: 1,
      started_at: FIXED_NOW,
      finished_at: FIXED_NOW,
    });

    h.file.failNextWrite = true;
    store.useStore.getState().deleteKey(IDS.key);
    await vi.waitFor(() =>
      expect(store.useStore.getState().saveFailure).toBe('io_failed')
    );

    // The file still holds the key, so its history must still be there.
    expect(
      await h.local.listObservations(h.payload.vault.id, IDS.key)
    ).toHaveLength(1);
    const reopened = await Vault.open(
      memoryPorts(new MemoryFile(h.file.bytes), fixedClock()),
      { password: PASSWORD }
    );
    expect(reopened.ok).toBe(true);
    if (reopened.ok) {
      expect(
        reopened.vault.getPayload().keys.some((key) => key.id === IDS.key)
      ).toBe(true);
    }

    await expect(store.flushSave()).resolves.toBe(true);
    await vi.waitFor(async () =>
      expect(
        await h.local.listObservations(h.payload.vault.id, IDS.key)
      ).toHaveLength(0)
    );
  }, 30_000);
});

describe('a manual check asks about the destination', () => {
  it('sends nothing when the user declines', async () => {
    const h = await openHarness();
    const store = createAppStore({
      local: h.local,
      clock: () => new Date(FIXED_NOW),
      timeZone: () => 'UTC',
      saveDelayMs: 0,
      confirmDestination: async () => false,
    });
    await store.useStore.getState().unlock(h.opened, 'work.keya', 'folder');

    await expect(store.runManualCheck(IDS.key)).resolves.toBeNull();
    expect(h.requests).toHaveLength(0);
  });

  it('shows the resolved address before sending', async () => {
    const h = await openHarness();
    const asked: string[] = [];
    const store = createAppStore({
      local: h.local,
      clock: () => new Date(FIXED_NOW),
      timeZone: () => 'UTC',
      saveDelayMs: 0,
      confirmDestination: async (href) => {
        asked.push(href);
        return true;
      },
    });
    await store.useStore.getState().unlock(h.opened, 'work.keya', 'folder');

    await store.runManualCheck(IDS.key);
    expect(asked).toEqual(['https://edge.example.com/v1/models']);
    expect(h.requests).toEqual(['https://edge.example.com/v1/models']);
  });

  it('asks again for a plaintext target instead of reusing consent', async () => {
    const payload = cloneFile();
    payload.keys[0].endpoint = 'http://edge.example.com/v1';
    const h = await openHarness({ payload });
    const store = makeStore(h);
    await store.useStore.getState().unlock(h.opened, 'work.keya', 'folder');

    await store.runManualCheck(IDS.key);
    await store.runManualCheck(IDS.key);

    // Nothing stored stands in for the second click.
    expect(h.requests).toHaveLength(2);
  });
});

describe('two overlapping checks', () => {
  it('keeps the result of the later-started one', async () => {
    let call = 0;
    const h = await openHarness({
      fetch: async () => {
        call += 1;
        const mine = call;
        // The first request started first and answers last.
        await new Promise((resolve) =>
          setTimeout(resolve, mine === 1 ? 40 : 5)
        );
        return {
          status: mine === 1 ? 500 : 200,
          contentType: 'application/json',
        };
      },
    });
    const store = makeStore(h);
    await store.useStore.getState().unlock(h.opened, 'work.keya', 'folder');

    const first = store.runManualCheck(IDS.key);
    await new Promise((resolve) => setTimeout(resolve, 1));
    const second = store.runManualCheck(IDS.key);
    await Promise.all([first, second]);

    const observations = await h.local.listObservations(
      h.payload.vault.id,
      IDS.key
    );
    expect(observations).toHaveLength(1);
    expect(observations[0].outcome).toBe('ok');
  }, 30_000);
});

describe('provider drafts', () => {
  it('refuses two providers with the same name instead of dropping one', async () => {
    const { store, h } = await unlocked();

    store.useStore.getState().updateSettings({
      providers: [
        { name: 'Acme', endpoint: 'https://api.acme.test' },
        { name: 'Acme', endpoint: 'https://other.acme.test' },
      ],
    });

    await vi.waitFor(() =>
      expect(
        h.vault.getPayload().providers.some((p) => p.name === 'Acme')
      ).toBe(true)
    );
    expect(
      h.vault.getPayload().providers.filter((p) => p.name === 'Acme')
    ).toHaveLength(1);
  });

  it('renames a custom provider without changing its id', async () => {
    const { store, h } = await unlocked();
    const before = h.vault.getPayload().providers[0];

    store.useStore.getState().updateSettings({
      providers: [
        {
          id: before.id,
          name: 'Renamed gateway',
          endpoint: 'https://edge.example.com/v1',
        },
      ],
    });

    await vi.waitFor(() =>
      expect(
        h.vault.getPayload().providers.some((p) => p.name === 'Renamed gateway')
      ).toBe(true)
    );
    const after = h.vault
      .getPayload()
      .providers.find((p) => p.name === 'Renamed gateway');
    expect(after?.id).toBe(before.id);
    // The key still points at the renamed provider.
    expect(h.vault.getPayload().keys[0].provider_id).toBe(before.id);
  });
});

describe('switching vaults and re-querying usage', () => {
  it('clears the previous vault filters on the next unlock', async () => {
    const first = await openHarness();
    const store = makeStore(first);
    await store.useStore.getState().unlock(first.opened, 'work.keya', 'folder');
    store.useStore.getState().setFilterProvider('OpenAI');
    store.useStore.getState().setSearchQuery('edge');
    store.useStore.getState().setSelectedKeyId(IDS.key);

    const second = await openHarness();
    await store.useStore
      .getState()
      .unlock(second.opened, 'other.keya', 'folder');

    const state = store.useStore.getState();
    expect(state.filterProvider).toBeNull();
    expect(state.searchQuery).toBe('');
    expect(state.selectedKeyId).toBeNull();
  });

  it('marks a usage query as loading and ignores a second click', async () => {
    const payload = cloneFile();
    payload.keys[0].provider_id = 'preset:opencode-go';
    payload.keys[0].endpoint = 'https://opencode.ai/zen/go/v1';
    const h = await openHarness({ payload });
    const store = makeStore(h);
    await store.useStore.getState().unlock(h.opened, 'work.keya', 'folder');

    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => {
      await gate;
      return new Response(
        JSON.stringify({ usage: { rolling: { percent: 10 } } }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      );
    }) as typeof fetch;

    try {
      const first = store.useStore.getState().refreshUsage(IDS.key);
      expect(store.useStore.getState().usage[IDS.key]?.state).toBe('loading');

      // A second click while the first is in flight must not consume another
      // one-shot approval.
      await store.useStore.getState().refreshUsage(IDS.key);
      expect(store.useStore.getState().usage[IDS.key]?.state).toBe('loading');

      release();
      await first;
      expect(store.useStore.getState().usage[IDS.key]?.state).toBe('ok');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe('reading usage asks about the destination', () => {
  const usagePayload = () => {
    const payload = cloneFile();
    payload.keys[0].provider_id = 'preset:opencode-go';
    payload.keys[0].endpoint = 'https://opencode.ai/zen/go/v1';
    return payload;
  };

  it('names the endpoint-derived address before sending', async () => {
    const h = await openHarness({ payload: usagePayload() });
    const asked: { href: string; purpose: string }[] = [];
    const store = createAppStore({
      local: h.local,
      clock: () => new Date(FIXED_NOW),
      timeZone: () => 'UTC',
      saveDelayMs: 0,
      // The usage URL is derived from the key's endpoint, which is not always
      // the vendor's own host, so it needs the same approval a probe gets.
      confirmDestination: async (href, purpose) => {
        asked.push({ href, purpose });
        return false;
      },
    });
    await store.useStore.getState().unlock(h.opened, 'work.keya', 'folder');

    const fetchMock = vi.fn();
    const originalFetch = globalThis.fetch;
    globalThis.fetch = fetchMock as typeof fetch;
    try {
      await store.useStore.getState().refreshUsage(IDS.key);
    } finally {
      globalThis.fetch = originalFetch;
    }

    expect(asked).toEqual([
      {
        href: 'https://opencode.ai/inference/go/v1/usage',
        purpose: 'usage',
      },
    ]);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(store.useStore.getState().usage[IDS.key]?.state).toBe('failed');
  });
});

describe('housekeeping checks a batch with one destination prompt', () => {
  const SECOND_KEY = '44444444-4444-4444-8444-444444444444';
  const twoKeys = () => {
    const payload = cloneFile();
    payload.keys = [
      payload.keys[0],
      { ...payload.keys[0], id: SECOND_KEY, secret: 'sk-second' },
    ];
    return payload;
  };

  it('asks once, then sends one request per key', async () => {
    const h = await openHarness({ payload: twoKeys() });
    const batches: string[][] = [];
    const store = createAppStore({
      local: h.local,
      clock: () => new Date(FIXED_NOW),
      timeZone: () => 'UTC',
      saveDelayMs: 0,
      confirmBatchDestinations: async (hrefs) => {
        batches.push([...hrefs]);
        return true;
      },
    });
    await store.useStore.getState().unlock(h.opened, 'work.keya', 'folder');

    const result = await store.runManualChecks([IDS.key, SECOND_KEY]);

    expect(batches).toHaveLength(1);
    expect(batches[0]).toHaveLength(2);
    expect(result).toMatchObject({
      declined: false,
      checked: 2,
      succeeded: 2,
      failed: 0,
      discarded: 0,
    });
    expect(h.requests).toHaveLength(2);
  });

  it('sends nothing when the batch destination is declined', async () => {
    const h = await openHarness({ payload: twoKeys() });
    const store = createAppStore({
      local: h.local,
      clock: () => new Date(FIXED_NOW),
      timeZone: () => 'UTC',
      saveDelayMs: 0,
      confirmBatchDestinations: async () => false,
    });
    await store.useStore.getState().unlock(h.opened, 'work.keya', 'folder');

    const result = await store.runManualChecks([IDS.key, SECOND_KEY]);

    expect(result).toMatchObject({ declined: true, checked: 0, failed: 0 });
    expect(h.requests).toHaveLength(0);
  });
});
