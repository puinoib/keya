import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Database } from '../../../core/database';
import type { NewApiKey } from '../../../core/types';

vi.mock('../storage', () => ({
  FileStorage: {
    saveVault: vi.fn(async () => {}),
    saveViaDownload: vi.fn(async () => {}),
    cacheVaultMeta: vi.fn(async () => {}),
    backupVault: vi.fn(async () => {}),
  },
}));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

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

const GO_KEY: NewApiKey = {
  name: 'Go subscription',
  description: '',
  provider: 'OpenCode Go',
  endpoint: 'https://opencode.ai/zen/go/v1',
  key: 'sk-go-test',
  group_id: null,
  expires_at: null,
  connection_check: {
    status: 'untested',
    checked_at: null,
    latency_ms: null,
    error_message: null,
  },
};

beforeAll(() => {
  const local = new MemoryStorage();
  vi.stubGlobal('localStorage', local);
  vi.stubGlobal('window', { showDirectoryPicker: () => {} });
});

beforeEach(() => {
  vi.stubGlobal('sessionStorage', new MemoryStorage());
});

async function unlockedVault() {
  const { useStore } = await import('../../store/useStore');
  const { writeUsageSnapshot } = await import('../usage-cache');
  const db = new Database();
  const key = db.addApiKey(GO_KEY);
  await useStore.getState().unlock(db, 'pw', 'vault.keya');
  return {
    useStore,
    db,
    key,
    writeUsageSnapshot,
    vaultId: db.getData().vault_id,
  };
}

const SNAPSHOT = {
  provider: 'OpenCode Go',
  checked_at: '2026-10-20T12:00:00.000Z',
  windows: [
    { id: 'weekly', label: '7 days', percent_used: 42, resets_at: null },
  ],
};

describe('usage in the store', () => {
  it("brings back this vault's cached allowance when it is unlocked", async () => {
    const { useStore, key, writeUsageSnapshot, vaultId, db } =
      await unlockedVault();
    writeUsageSnapshot(vaultId, key.id, SNAPSHOT);

    // A reload: the store starts empty and the same vault is opened again.
    useStore.setState({ usage: {} });
    await useStore.getState().unlock(db, 'pw', 'vault.keya');

    expect(useStore.getState().usage[key.id]?.snapshot?.windows[0]).toEqual(
      SNAPSHOT.windows[0]
    );
  });

  it('forgets cached allowances whose key is gone', async () => {
    const { useStore, key, writeUsageSnapshot, vaultId, db } =
      await unlockedVault();
    writeUsageSnapshot(vaultId, key.id, SNAPSHOT);

    useStore.setState({ usage: {} });
    db.deleteApiKey(key.id);
    await useStore.getState().unlock(db, 'pw', 'vault.keya');

    expect(useStore.getState().usage).toEqual({});
  });

  it('drops a snapshot when the credential it describes changes', async () => {
    const { useStore, key, writeUsageSnapshot, vaultId } =
      await unlockedVault();
    writeUsageSnapshot(vaultId, key.id, SNAPSHOT);
    useStore.setState({
      usage: {
        [key.id]: {
          state: 'ok',
          vault_id: vaultId,
          checked_at: SNAPSHOT.checked_at,
          snapshot: SNAPSHOT,
        },
      },
    });

    useStore.getState().updateKey(key.id, { key: 'sk-go-rotated' });

    expect(useStore.getState().usage[key.id]).toBeUndefined();
  });

  it('keeps a snapshot when only a label changes', async () => {
    const { useStore, key, writeUsageSnapshot, vaultId } =
      await unlockedVault();
    writeUsageSnapshot(vaultId, key.id, SNAPSHOT);
    useStore.setState({
      usage: {
        [key.id]: {
          state: 'ok',
          vault_id: vaultId,
          checked_at: SNAPSHOT.checked_at,
          snapshot: SNAPSHOT,
        },
      },
    });

    useStore.getState().updateKey(key.id, { name: 'Renamed' });

    expect(useStore.getState().usage[key.id]?.snapshot).toEqual(SNAPSHOT);
  });

  it('frees the memory entry when a key is deleted', async () => {
    const { useStore, key, writeUsageSnapshot, vaultId } =
      await unlockedVault();
    writeUsageSnapshot(vaultId, key.id, SNAPSHOT);
    useStore.setState({
      usage: {
        [key.id]: {
          state: 'ok',
          vault_id: vaultId,
          checked_at: SNAPSHOT.checked_at,
          snapshot: SNAPSHOT,
        },
      },
    });

    useStore.getState().deleteKey(key.id);

    expect(useStore.getState().usage[key.id]).toBeUndefined();
  });
});
