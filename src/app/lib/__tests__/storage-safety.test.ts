import { beforeEach, expect, it, vi } from 'vitest';

vi.mock('../../../core', async (original) => ({
  ...(await original<typeof import('../../../core')>()),
  serializeToFile: vi.fn(async (_data, password) =>
    new TextEncoder().encode(password)
  ),
  deserializeFromFile: vi.fn(async () =>
    new (await import('../../../core/database')).Database().getData()
  ),
}));
import { Database } from '../../../core/database';
import { FileStorage } from '../storage';

let bytes: Uint8Array;
let exists = true;
const write = vi.fn(async (blob: Blob) => {
  bytes = new Uint8Array(await blob.arrayBuffer());
});
const directory = {
  queryPermission: async () => 'granted',
  getFileHandle: vi.fn(async (_name: string, options?: { create: boolean }) => {
    if (!exists && !options?.create)
      throw new DOMException('missing', 'NotFoundError');
    exists = true;
    return {
      getFile: async () => new Blob([new Uint8Array(bytes)]),
      createWritable: async () => ({
        write,
        close: async () => {},
        abort: async () => {},
      }),
    };
  }),
};

beforeEach(() => {
  bytes = new TextEncoder().encode('original');
  exists = true;
  write.mockClear();
  let tail = Promise.resolve();
  vi.stubGlobal('navigator', {
    locks: {
      request: (_name: string, task: () => Promise<void>) => {
        const next = tail.then(task);
        tail = next.catch(() => {});
        return next;
      },
    },
  });
  vi.stubGlobal('indexedDB', {
    open: () => {
      const req: Record<string, unknown> = {};
      queueMicrotask(() => {
        req.result = {
          transaction: () => {
            const tx: Record<string, unknown> = {
              objectStore: () => ({
                get: () => {
                  const getReq: Record<string, unknown> = {};
                  queueMicrotask(() => {
                    getReq.result = { directoryHandle: directory };
                    (getReq.onsuccess as () => void)();
                  });
                  return getReq;
                },
                put: () =>
                  queueMicrotask(() => (tx.oncomplete as () => void)()),
              }),
            };
            return tx;
          },
        };
        (req.onsuccess as () => void)();
      });
      return req;
    },
  });
});

it('rejects creating an existing vault without touching it', async () => {
  await expect(
    FileStorage.createVault('existing.keya', 'new-password')
  ).rejects.toThrow('already exists');
  expect(write).not.toHaveBeenCalled();
  expect(new TextDecoder().decode(bytes)).toBe('original');
});

it('creates a missing vault', async () => {
  exists = false;
  await FileStorage.createVault('new.keya', 'new-password');
  expect(write).toHaveBeenCalledTimes(1);
});

it('rejects changes made by another writer since opening', async () => {
  const db = await FileStorage.openVault('existing.keya', 'password');
  bytes = new TextEncoder().encode('external change');
  await expect(
    FileStorage.saveVault('existing.keya', db.getData(), 'password')
  ).rejects.toThrow('changed outside');
  expect(write).not.toHaveBeenCalled();
});

it('serializes writes and updates the expected revision', async () => {
  const db = await FileStorage.openVault('existing.keya', 'password');
  await Promise.all([
    FileStorage.saveVault('existing.keya', db.getData(), 'first'),
    FileStorage.saveVault('existing.keya', db.getData(), 'second'),
  ]);
  expect(new TextDecoder().decode(bytes)).toBe('second');
  expect(write).toHaveBeenCalledTimes(2);
});

it('refuses writes to unopened files', async () => {
  await expect(
    FileStorage.saveVault('unknown.keya', new Database().getData(), 'password')
  ).rejects.toThrow('Reopen');
});
