import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cloneFile, IDS } from '../../../core/__tests__/fixtures';
import { createAppStore } from '../create-store';
import { readUsageCache, writeUsageSnapshot } from '../../lib/usage-cache';
import { providerToDraft } from '../../state/providers';

const RECENT = new Date().toISOString();
import { FIXED_NOW, openHarness, type Harness } from './fixtures';

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

  it('runs the daily check once per local day', async () => {
    const payload = cloneFile();
    const first = await openHarness({ payload });
    await first.local.setPreferences({ auto_probe_daily: true });
    const firstProbe = vi.spyOn(first.session, 'probe');
    const store = makeStore(first);

    await store.useStore.getState().unlock(first.opened, 'work.keya', 'folder');
    await vi.waitFor(async () =>
      expect((await first.local.getPreferences()).last_daily_probe_day).toBe(
        '2026-03-01'
      )
    );
    expect(firstProbe.mock.calls.length).toBeGreaterThan(0);

    // A second session the same day shares the preference and must skip it.
    const second = await openHarness({ payload });
    second.local = first.local;
    const secondProbe = vi.spyOn(second.session, 'probe');
    const reopened = makeStore(second);
    await reopened.useStore
      .getState()
      .unlock(second.opened, 'work.keya', 'folder');
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(secondProbe).not.toHaveBeenCalled();
  });
});

describe('reminder announcements', () => {
  it('announces only the reminders that appeared during the session', async () => {
    const h = await openHarness();
    const store = makeStore(h);
    await store.useStore.getState().unlock(h.opened, 'work.keya', 'folder');

    // Unlocking is a baseline, not an announcement.
    expect(store.useStore.getState().lastInboxSyncAt).toBeNull();

    store.useStore.getState().addKey({
      name: 'Adds a never-checked reminder',
      secret: 'sk-synthetic-reminder',
      providerId: 'preset:openai',
      endpoint: 'https://api.openai.com/v1',
      description: '',
      groupId: null,
      expiry: null,
    });

    await vi.waitFor(() =>
      expect(store.useStore.getState().lastInboxSyncResult).toEqual({
        added: 1,
        updated: 0,
        archived: 0,
      })
    );
    expect(store.useStore.getState().lastInboxSyncAt).toBe(FIXED_NOW);
  });

  it('starts from a clean baseline after a lock and unlock', async () => {
    const payload = cloneFile();
    const h = await openHarness({ payload });
    const store = makeStore(h);
    await store.useStore.getState().unlock(h.opened, 'work.keya', 'folder');
    store.useStore.getState().addKey({
      name: 'First',
      secret: 'sk-synthetic-first',
      providerId: 'preset:openai',
      endpoint: 'https://api.openai.com/v1',
      description: '',
      groupId: null,
      expiry: null,
    });
    await vi.waitFor(() =>
      expect(store.useStore.getState().lastInboxSyncResult?.added).toBe(1)
    );

    // Unlocking again (a fresh session on the same content) is a baseline, not
    // an announcement: the backlog that is already open is not news.
    const reopened = await openHarness({ payload });
    const next = makeStore(reopened);
    await next.useStore
      .getState()
      .unlock(reopened.opened, 'work.keya', 'folder');
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(next.useStore.getState().lastInboxSyncAt).toBeNull();
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

  it('keeps a failing daily run from rejecting out of unlock', async () => {
    const h = await openHarness();
    await h.local.setPreferences({ auto_probe_daily: true });
    // The exact failure a lock produces: the session's payload is gone.
    const probe = vi
      .spyOn(h.session, 'probe')
      .mockRejectedValue(new Error('vault is locked'));
    const store = makeStore(h);

    await expect(
      store.useStore.getState().unlock(h.opened, 'work.keya', 'folder')
    ).resolves.toBeUndefined();
    await vi.waitFor(() => expect(probe).toHaveBeenCalled());
    // Give an escaping rejection a turn to surface.
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(store.useStore.getState().workspaceState).toBe('unlocked');
  });

  it('keeps sweeping the remaining keys when one of them fails', async () => {
    const payload = cloneFile();
    payload.keys.push({
      ...payload.keys[0],
      id: '11111111-1111-4111-8111-111111111111',
      name: 'Second key',
      secret: 'sk-synthetic-second',
    });

    const h = await openHarness({ payload });
    await h.local.setPreferences({ auto_probe_daily: true });
    const probe = vi
      .spyOn(h.session, 'probe')
      .mockRejectedValueOnce(new Error('this one broke'))
      .mockResolvedValue({ status: 'no_key' });
    const store = makeStore(h);

    await store.useStore.getState().unlock(h.opened, 'work.keya', 'folder');
    await vi.waitFor(() => expect(probe).toHaveBeenCalledTimes(2));

    expect(store.useStore.getState().workspaceState).toBe('unlocked');
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
