import { beforeAll, expect, it, vi } from 'vitest';
import { Database } from '../../../core/database';

vi.mock('../storage', () => ({
  FileStorage: {
    saveVault: vi.fn(async () => {}),
    saveViaDownload: vi.fn(async () => {}),
    cacheVaultMeta: vi.fn(async () => {}),
    backupVault: vi.fn(async () => {}),
  },
}));
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));

beforeAll(() => {
  const storage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  };
  vi.stubGlobal('localStorage', storage);
  vi.stubGlobal('sessionStorage', storage);
  vi.stubGlobal('window', { showDirectoryPicker: () => {} });
});

it('saves edits before clearing a locked vault', async () => {
  const { useStore, flushSave } = await import('../../store/useStore');
  const { FileStorage } = await import('../storage');
  const db = new Database();
  useStore.setState({
    db,
    password: 'test-password',
    activeVaultFileName: 'test.keya',
    workspaceState: 'unlocked',
  });
  useStore.getState().updateMeta({ name: 'must survive lock' });
  useStore.getState().lock();
  await flushSave();
  await vi.waitFor(() => expect(useStore.getState().db).toBeNull());
  expect(FileStorage.saveVault).toHaveBeenCalledWith(
    'test.keya',
    expect.objectContaining({ name: 'must survive lock' }),
    'test-password'
  );
});

it('keeps unsaved data when locking fails to save', async () => {
  const { useStore, flushSave } = await import('../../store/useStore');
  const { FileStorage } = await import('../storage');
  vi.mocked(FileStorage.saveVault).mockRejectedValueOnce(new Error('conflict'));
  const db = new Database();
  useStore.setState({
    db,
    password: 'test-password',
    activeVaultFileName: 'test.keya',
    workspaceState: 'unlocked',
  });
  useStore.getState().updateMeta({ name: 'retain me' });
  useStore.getState().lock();
  await vi.waitFor(() =>
    expect(FileStorage.saveVault).toHaveBeenCalledTimes(2)
  );
  expect(useStore.getState().db).toBe(db);
  await flushSave();
});

it('flushes the previous vault before switching', async () => {
  const { useStore } = await import('../../store/useStore');
  const { FileStorage } = await import('../storage');
  const oldDb = useStore.getState().db!;
  useStore.getState().updateMeta({ name: 'old vault edit' });
  const nextDb = new Database();
  await useStore.getState().unlock(nextDb, 'next-password', 'next.keya');
  expect(FileStorage.saveVault).toHaveBeenLastCalledWith(
    'test.keya',
    expect.objectContaining({
      vault_id: oldDb.getData().vault_id,
      name: 'old vault edit',
    }),
    'test-password'
  );
  expect(useStore.getState().db).toBe(nextDb);
});

it('saves subsequent edits using the new password after rotation', async () => {
  const { useStore, flushSave } = await import('../../store/useStore');
  const { FileStorage } = await import('../storage');
  useStore.getState().updateMeta({ name: 'before rotation' });
  await useStore.getState().changePassword('next-password', 'rotated-password');
  useStore.getState().updateMeta({ name: 'after rotation' });
  await flushSave();
  expect(FileStorage.saveVault).toHaveBeenLastCalledWith(
    'next.keya',
    expect.objectContaining({ name: 'after rotation' }),
    'rotated-password'
  );
});

it('unlocks after a stale save was scheduled with no active vault', async () => {
  const { useStore, flushSave } = await import('../../store/useStore');
  useStore.setState({
    workspaceState: 'welcome',
    db: null,
    password: null,
    activeVaultFileName: null,
    storageMode: 'folder',
    hasUnsavedChanges: false,
  });

  // Simulates an async connection test finishing after Lock: no db exists,
  // so this must not leave the save state dirty.
  useStore.getState().updateKey('ghost', { name: 'ghost' });
  await flushSave();

  const nextDb = new Database();
  await useStore.getState().unlock(nextDb, 'next-password', 'next.keya');

  expect(useStore.getState().workspaceState).toBe('unlocked');
  expect(useStore.getState().db).toBe(nextDb);
});

it('does not auto-download and refuses to lock until the vault is exported', async () => {
  const { useStore } = await import('../../store/useStore');
  const { FileStorage } = await import('../storage');
  const db = useStore.getState().db!;
  vi.mocked(FileStorage.saveViaDownload).mockClear();

  useStore.setState({ storageMode: 'download', hasUnsavedChanges: false });
  useStore.getState().updateMeta({ name: 'download edit' });

  await new Promise((resolve) => setTimeout(resolve, 650));
  expect(FileStorage.saveViaDownload).not.toHaveBeenCalled();
  expect(useStore.getState().hasUnsavedChanges).toBe(true);

  useStore.getState().lock();
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(useStore.getState().db).toBe(db);

  useStore.getState().markExported();
  expect(useStore.getState().hasUnsavedChanges).toBe(false);

  useStore.getState().lock();
  await vi.waitFor(() => expect(useStore.getState().db).toBeNull());
});

it('still saves when the optional metadata cache write fails', async () => {
  const { useStore, flushSave } = await import('../../store/useStore');
  const { FileStorage } = await import('../storage');
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.mocked(FileStorage.saveVault).mockClear();
  vi.mocked(FileStorage.cacheVaultMeta).mockRejectedValueOnce(
    new Error('indexeddb unavailable')
  );

  useStore.setState({
    db: new Database(),
    password: 'test-password',
    activeVaultFileName: 'cache.keya',
    workspaceState: 'unlocked',
    storageMode: 'folder',
    hasUnsavedChanges: false,
  });
  useStore.getState().updateMeta({ name: 'cache failure' });

  await expect(flushSave()).resolves.toBeUndefined();
  expect(FileStorage.saveVault).toHaveBeenCalledTimes(1);
  expect(useStore.getState().hasUnsavedChanges).toBe(false);

  warn.mockRestore();
  useStore.setState({
    db: null,
    password: null,
    activeVaultFileName: null,
    workspaceState: 'welcome',
  });
});
