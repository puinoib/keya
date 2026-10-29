/**
 * Creating a vault must not leave a file behind when it cannot finish.
 *
 * The writer derives the key and seals the payload before it touches the folder:
 * creating the file first means a KDF that lost the cross-tab lock (or a chunk
 * that will not load) leaves a zero-byte `.keya` that blocks every retry under
 * that name and only ever opens as `file_too_short`.
 */

import { describe, expect, it, vi } from 'vitest';
import type { Workspace } from '../workspace';

const behaviour = vi.hoisted(() => ({
  failure: 'busy' as 'busy' | 'memory',
}));

vi.mock('../../../core/format/kdf', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../../core/format/kdf')>();
  return {
    ...actual,
    deriveFileKey: async () => {
      throw new actual.KdfError(behaviour.failure);
    },
  };
});

import { createVault } from '../platform';

describe('createVault', () => {
  it('creates no file when the key cannot be derived', async () => {
    // The write lock is a named Web Lock in the browser; node has none.
    vi.stubGlobal('navigator', {
      locks: {
        request: (
          _name: string,
          _options: unknown,
          task: () => Promise<unknown>
        ) => task(),
      },
    });

    const createFilePort = vi.fn(async () => {
      throw new Error('the folder must not be touched');
    });
    const remove = vi.fn(async () => undefined);
    const workspace = { createFilePort, remove } as unknown as Workspace;

    const result = await createVault(
      workspace,
      'work.keya',
      'a sufficiently long synthetic passphrase',
      { name: 'Work', icon: '' }
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.failure).toBe('kdf_busy');
    expect(createFilePort).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });
});
