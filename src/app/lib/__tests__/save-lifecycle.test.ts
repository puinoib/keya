import { beforeAll, expect, it, vi } from 'vitest';
import { Database } from '../../../core/database';

vi.mock('../storage', () => ({
  FileStorage: {
    saveVault: vi.fn(async () => {}),
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
