/**
 * The application store, bound to this browser.
 *
 * All of the behaviour lives in `createAppStore`; this module only supplies the
 * real adapters. Tests build their own store with in-memory dependencies.
 */

import { toast } from 'sonner';
import { deviceTimeZone, localState } from '../storage/platform';
import { createAppStore } from './create-store';
import { describeSaveFailure } from '../state/presentation';
import { clearClipboardNow } from '../lib/clipboard';

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

/**
 * A hidden tab throttles timers, so the debounce is not a guarantee. Flush when
 * the page is hidden or goes away; `pagehide` cannot await, so this is the last
 * chance rather than an atomic commit.
 */
function flushBeforeLeaving(): void {
  void clearClipboardNow();
  void browserStore.flushSave().then(
    (ok) => {
      if (ok) return;
      const failure = browserStore.useStore.getState().saveFailure;
      toast.error('The last edits were not saved.', {
        description: describeSaveFailure(failure ?? 'io_failed'),
      });
    },
    () => undefined
  );
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushBeforeLeaving();
  });
  window.addEventListener('pagehide', flushBeforeLeaving);
}

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
