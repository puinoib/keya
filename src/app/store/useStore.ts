/**
 * The application store, bound to this browser.
 *
 * All of the behaviour lives in `createAppStore`; this module only supplies the
 * real adapters. Tests build their own store with in-memory dependencies.
 */

import { deviceTimeZone, localState } from '../storage/platform';
import { createAppStore } from './create-store';

const browserStore = createAppStore({
  local: localState,
  clock: () => new Date(),
  timeZone: deviceTimeZone,
  newId: () => crypto.randomUUID(),
});

export const useStore = browserStore.useStore;
export const flushSave = browserStore.flushSave;
export const exportVaultBytes = browserStore.exportVaultBytes;
export const runManualCheck = browserStore.runManualCheck;

export { SHORTCUT_DEFINITIONS } from '../lib/shortcuts';
export type { ShortcutMap } from '../lib/shortcuts';
export type {
  AppState,
  KeyPatch,
  ManualCheckResult,
  NewKeyInput,
  SettingsPatch,
  StoreDeps,
  VaultStorageMode,
} from './create-store';
