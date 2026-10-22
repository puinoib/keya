/**
 * When the store writes: the debounce, the delay it uses, and the mode where
 * there is nothing to write.
 */

import { describe, expect, it, vi } from 'vitest';

const sonner = vi.hoisted(() => {
  const messages: string[] = [];
  const toast = Object.assign(
    (message: string) => {
      messages.push(message);
    },
    {
      error: (message: string) => {
        messages.push(`error:${message}`);
      },
      success: (message: string) => {
        messages.push(`success:${message}`);
      },
      message: (message: string) => {
        messages.push(message);
      },
    }
  );
  return { messages, toast };
});

vi.mock('sonner', () => ({ toast: sonner.toast }));

import { createAppStore } from '../create-store';
import { FIXED_NOW, type Harness, openHarness } from './fixtures';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function storeOn(h: Harness, saveDelayMs?: number) {
  return createAppStore({
    local: h.local,
    clock: () => new Date(FIXED_NOW),
    timeZone: () => 'UTC',
    saveDelayMs,
  });
}

const NEW_KEY = {
  name: 'Synthetic',
  secret: 'sk-synthetic-scheduling',
  providerId: null,
  endpoint: '',
  description: '',
  groupId: null,
  expiry: null,
} as const;

describe('save scheduling', () => {
  it('waits for the configured delay before writing', async () => {
    const h = await openHarness();
    const store = storeOn(h, 5_000);
    await store.useStore.getState().unlock(h.opened, 'w.keya', 'folder');

    store.useStore.getState().addKey(NEW_KEY);
    await sleep(150);
    expect(h.file.writes).toBe(0);
    expect(store.useStore.getState().hasUnsavedChanges).toBe(true);

    // An explicit flush does not wait for the debounce.
    await expect(store.flushSave()).resolves.toBe(true);
    expect(h.file.writes).toBe(1);
    expect(store.useStore.getState().hasUnsavedChanges).toBe(false);
  });

  it('coalesces a burst of edits into one write', async () => {
    const h = await openHarness();
    const store = storeOn(h, 0);
    await store.useStore.getState().unlock(h.opened, 'w.keya', 'folder');

    store.useStore.getState().addKey({ ...NEW_KEY, name: 'One' });
    store.useStore.getState().addKey({ ...NEW_KEY, name: 'Two' });
    store.useStore.getState().addKey({
      ...NEW_KEY,
      name: 'Three',
      secret: 'sk-synthetic-three',
    });

    await vi.waitFor(() => expect(h.file.writes).toBe(1));
    expect(h.vault.getPayload().keys).toHaveLength(4);
  });

  it('does not schedule a write for a download-mode vault', async () => {
    const h = await openHarness();
    const store = storeOn(h, 0);
    await store.useStore.getState().unlock(h.opened, 'w.keya', 'download');

    store.useStore.getState().addKey(NEW_KEY);
    await sleep(100);

    // Nothing was written, and no "export before leaving" reminder was raised:
    // that message belongs to the paths that actually leave the vault.
    expect(h.file.writes).toBe(0);
    expect(sonner.messages).toEqual([]);
    expect(store.useStore.getState().hasUnsavedChanges).toBe(true);

    // Locking is one of those paths, so it still refuses.
    await store.useStore.getState().lock();
    expect(sonner.messages[0]).toBe(
      'error:Export a .keya file to save changes before leaving.'
    );
    expect(store.useStore.getState().workspaceState).toBe('unlocked');
  });
});
