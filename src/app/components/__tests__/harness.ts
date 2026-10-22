/**
 * A real store, built on in-memory dependencies, for component tests.
 *
 * Components import the browser binding; each test file replaces that module
 * with this store, so the components under test run their real code against a
 * vault the test controls.
 */

import { createAppStore, type AppStore } from '../../store/create-store';
import type { ViewInput } from '../../state/view';
import { type Harness, openHarness } from '../../store/__tests__/fixtures';
import type { KeyaFile } from '../../../core/payload/types';

export interface ComponentHarness {
  api: AppStore;
  vault: Harness;
}

export async function buildComponentStore(
  options: { payload?: KeyaFile; storageMode?: 'folder' | 'download' } = {}
): Promise<ComponentHarness> {
  const vault = await openHarness({ payload: options.payload });
  let generated = 0;

  const api = createAppStore({
    local: vault.local,
    clock: () => new Date('2026-03-01T12:00:00.000Z'),
    timeZone: () => 'UTC',
    newId: () => {
      generated += 1;
      return `bbbbbbbb-bbbb-4bbb-8bbb-${String(generated).padStart(12, '0')}`;
    },
    saveDelayMs: 0,
    confirmDestination: async () => true,
  });

  await api.useStore
    .getState()
    .unlock(vault.opened, 'work.keya', options.storageMode ?? 'folder');

  return { api, vault };
}

/** The view the store currently exposes; tests assert against this. */
export function currentView(harness: ComponentHarness) {
  const view = harness.api.useStore.getState().view;
  if (!view) throw new Error('store is not unlocked');
  return view;
}

export type { ViewInput };
