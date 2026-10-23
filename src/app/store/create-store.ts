/**
 * Application state.
 *
 * Holds the unlocked vault, rebuilds the view the screens render from, and
 * routes every action to the vault's edit transactions, the device-local store
 * or the probe pipeline.
 *
 * The master password is never part of this state (I16). It is used for the
 * unlock derivation and for the two gestures that need it again (enabling
 * biometric unlock, changing the password), then dropped.
 */

import { create, type StoreApi, type UseBoundStore } from 'zustand';
import { toast } from 'sonner';
import type { EditFailure, SaveFailure, Vault } from '../vault/vault';
import type { VaultSession } from '../runtime/session';
import type { LocalState, Preferences } from '../storage/local/state';
import type { Observation } from '../../core/runtime/observations';
import { summarizeIssues, type Issue } from '../../core/payload/validate';
import type { Expiry } from '../../core/time/expiry';
import type { Group, Key } from '../../core/payload/types';
import {
  draftToProvider,
  providerLabel,
  type ProviderDraft,
} from '../state/providers';
import { buildVaultView, keyById, type VaultView } from '../state/view';
import { describeSaveFailure } from '../state/presentation';
import { fetchUsage, usageRequestUrl, type UsageEntry } from '../lib/usage';
import {
  clearUsageVault,
  dropUsageSnapshot,
  pruneUsageCache,
  readUsageCache,
  writeUsageSnapshot,
} from '../lib/usage-cache';
import type { OpenedVault } from '../lib/storage';
import {
  SHORTCUT_DEFINITIONS,
  readShortcutMap,
  writeShortcutMap,
  type ShortcutMap,
} from '../lib/shortcuts';
import { describePasswordVerdict, judgePassword } from '../lib/password-policy';
import { isBiometricRegistered, removeBiometric } from '../lib/biometric';
import { clearClipboardNow } from '../lib/clipboard';

/** A prefilled form state; the clipboard scanner that used to build it is gone. */
export interface AddKeyDraft {
  name: string;
  secret: string;
  providerId: string | null;
  endpoint: string;
  description: string;
  groupId: string | null;
}

export type VaultStorageMode = 'folder' | 'download';

/** Everything the store needs from the outside world, so tests can supply it. */
export interface StoreDeps {
  /** Device-local state: preferences and observations. */
  local: LocalState;
  clock?: () => Date;
  timeZone?: () => string;
  /** Ids for keys and groups; injected so tests stay deterministic. */
  newId?: () => string;
  /** How long edits are coalesced before a write. */
  saveDelayMs?: number;
  /**
   * How a manual check asks the user to approve the real destination. Injected
   * so tests can answer without a toast.
   */
  confirmDestination?: (resolvedHref: string) => Promise<boolean>;
}

export interface ManualCheckResult {
  success: boolean;
  latency_ms: number;
  error?: string;
  kind: 'credential' | 'request';
}

export interface AppStore {
  useStore: UseBoundStore<StoreApi<AppState>>;
  flushSave: () => Promise<boolean>;
  exportVaultBytes: (markClean?: boolean) => Promise<Uint8Array | null>;
  runManualCheck: (keyId: string) => Promise<ManualCheckResult | null>;
}

/** Fields a caller may change on a stored key; the rest is the vault's own. */
export interface KeyPatch {
  name?: string;
  description?: string;
  providerId?: string | null;
  endpoint?: string;
  secret?: string;
  groupId?: string | null;
  expiry?: Expiry | null;
  archivedAt?: string | null;
}

/** What the add form hands over: a new key with its provider already resolved. */
export interface NewKeyInput {
  name: string;
  secret: string;
  providerId: string | null;
  endpoint: string;
  description: string;
  groupId: string | null;
  expiry: Expiry | null;
}

/** The settings page writes device preferences and, separately, providers. */
export interface SettingsPatch {
  auto_lock_minutes?: number;
  hidden_presets?: string[];
  providers?: ProviderDraft[];
}
type WorkspaceState = 'welcome' | 'unlocked';

interface Runtime {
  vault: Vault;
  session: VaultSession;
  local: LocalState;
  fileName: string;
  fingerprint: string;
  preferences: Preferences;
}

export interface AppState {
  workspaceState: WorkspaceState;
  view: VaultView | null;
  activeVaultFileName: string | null;
  storageMode: VaultStorageMode;
  hasUnsavedChanges: boolean;
  /** Why the last save failed, or null. Cleared by the next successful save. */
  saveFailure: SaveFailure | null;

  searchQuery: string;
  showAddForm: boolean;
  addKeyDraft: AddKeyDraft | null;
  theme: 'dark' | 'light' | 'system';
  keyboardShortcuts: ShortcutMap;

  filterGroupId: string | null;
  filterProvider: string | null;
  filterTestStatus: string | null;
  filterExpiryStatus: string | null;
  showArchived: boolean;

  selectedKeyId: string | null;
  usage: Record<string, UsageEntry>;
  biometricPrompt: { vaultId: string } | null;

  lock: () => Promise<void>;
  unlock: (
    opened: OpenedVault,
    fileName: string,
    storageMode?: VaultStorageMode
  ) => Promise<void>;
  /** Re-derive and compare, without retaining the password. */
  verifyPassword: (password: string) => Promise<boolean>;
  markExported: () => void;
  setTheme: (theme: 'dark' | 'light' | 'system') => void;
  updateKeyboardShortcuts: (shortcuts: ShortcutMap) => void;
  refresh: () => Promise<void>;

  addKey: (input: NewKeyInput) => Key | undefined;
  updateKey: (id: string, patch: KeyPatch) => boolean;
  deleteKey: (id: string) => void;
  archiveKey: (id: string) => void;
  restoreKey: (id: string) => void;

  refreshUsage: (keyId: string) => Promise<void>;
  setBiometricPrompt: (prompt: { vaultId: string } | null) => void;
  setSearchQuery: (query: string) => void;
  setShowAddForm: (show: boolean) => void;
  beginAddKeyFlow: () => void;
  clearAddKeyDraft: () => void;
  setFilterGroupId: (id: string | null) => void;
  setFilterProvider: (provider: string | null) => void;
  setFilterTestStatus: (status: string | null) => void;
  setFilterExpiryStatus: (status: string | null) => void;
  setShowArchived: (show: boolean) => void;
  clearFilters: () => void;
  clearSmartFilters: () => void;
  setSelectedKeyId: (id: string | null) => void;

  addGroup: (group: Omit<Group, 'id'>) => void;
  updateGroup: (
    id: string,
    patch: Partial<Pick<Group, 'name' | 'icon' | 'order'>>
  ) => void;
  deleteGroup: (id: string) => void;

  updateSettings: (patch: SettingsPatch) => void;
  changePassword: (
    oldPassword: string,
    newPassword: string
  ) => Promise<{ ok: true } | { ok: false; reason: string }>;
  /**
   * Drop this device's knowledge of the open vault: check results, cached
   * allowances and the biometric binding. The file is never touched — it is the
   * only durable copy and this is not a delete.
   */
  forgetDeviceState: () => Promise<void>;
  updateMeta: (updates: Partial<{ name: string; icon: string }>) => void;
}

function readTheme(): 'dark' | 'light' | 'system' {
  if (typeof localStorage === 'undefined') return 'system';
  const stored = localStorage.getItem('keya-theme');
  return stored === 'light' || stored === 'dark' || stored === 'system'
    ? stored
    : 'system';
}

async function buildView(state: {
  vault: Vault;
  session: VaultSession;
  local: LocalState;
  preferences: Preferences;
  now: Date;
  timeZone: string;
}): Promise<VaultView> {
  const file = state.vault.getPayload();
  const bindings = await state.session.bindings();
  const checks = new Map<string, Observation>();

  for (const [keyId, binding] of bindings) {
    const list = await state.local.listObservations(file.vault.id, keyId);
    const latest = list.find((entry) => entry.binding === binding.binding);
    if (latest) checks.set(keyId, latest);
  }

  return buildVaultView({
    file,
    preferences: state.preferences,
    now: state.now,
    timeZone: state.timeZone,
    checks,
    bindings,
  });
}

/**
 * Show the address the credential would actually reach, and wait for a gesture.
 * `resolvedHref` is the string the fingerprint covers, so what the user
 * approves is exactly what is sent.
 */
function askDestination(resolvedHref: string): Promise<boolean> {
  let target: URL;
  try {
    target = new URL(resolvedHref);
  } catch {
    return Promise.resolve(false);
  }
  const plaintext = target.protocol === 'http:';
  const where = `${target.origin}${target.pathname}${target.search}`;

  return new Promise((resolve) => {
    let settled = false;
    const settle = (value: boolean) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    toast(plaintext ? 'Send this key over plain http?' : 'Send this key?', {
      description: plaintext
        ? `${where} — this travels in clear text and is never remembered.`
        : `${where} — this destination has not been allowed permanently.`,
      duration: 20_000,
      action: {
        label: plaintext ? 'Send in clear text' : 'Send',
        onClick: () => settle(true),
      },
      onDismiss: () => settle(false),
      onAutoClose: () => settle(false),
    });
  });
}

export function createAppStore(deps: StoreDeps): AppStore {
  const clock = deps.clock ?? (() => new Date());
  const timeZone = deps.timeZone ?? (() => 'UTC');
  const newId = deps.newId ?? (() => crypto.randomUUID());
  const saveDelayMs = deps.saveDelayMs ?? 500;
  const confirmDestination = deps.confirmDestination ?? askDestination;

  let runtime: Runtime | null = null;
  /** Bumped whenever the session is replaced; stale async results check it. */
  let generation = 0;
  /** Monotonic refresh id: an older view must never overwrite a newer one. */
  let viewSeq = 0;
  /** Key deletions whose local records may go once the file write lands. */
  const pendingLocalCleanup: { vaultId: string; keyId: string }[] = [];
  let saveTimer: ReturnType<typeof setTimeout> | null = null;
  let setState!: StoreApi<AppState>['setState'];
  let getState!: StoreApi<AppState>['getState'];

  const useStore = create<AppState>()((set, get) => {
    setState = set;
    getState = get;

    const scheduleSave = () => {
      set({ hasUnsavedChanges: true });
      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = null;

      // A download-mode vault has no writable copy: the export is the save, so
      // there is nothing to debounce and the export belongs to leaving, not
      // to every edit.
      if (getState().storageMode === 'download') return;

      saveTimer = setTimeout(() => {
        void flushSave().then(
          (ok) => {
            if (ok) return;
            const failure = getState().saveFailure;
            toast.error('The vault was not saved. Keep this page open.', {
              description: failure
                ? describeSaveFailure(failure)
                : 'Export a copy before leaving.',
            });
          },
          () =>
            toast.error('The vault was not saved. Keep this page open.', {
              description: 'Export a copy before leaving.',
            })
        );
      }, saveDelayMs);
    };

    const afterChange = async () => {
      scheduleSave();
      await get().refresh();
    };

    return {
      workspaceState: 'welcome',
      view: null,
      activeVaultFileName: null,
      storageMode: 'folder',
      hasUnsavedChanges: false,
      saveFailure: null,

      searchQuery: '',
      showAddForm: false,
      addKeyDraft: null,
      theme: readTheme(),
      keyboardShortcuts: readShortcutMap(),

      filterGroupId: null,
      filterProvider: null,
      filterTestStatus: null,
      filterExpiryStatus: null,
      showArchived: false,

      selectedKeyId: null,
      usage: {},
      biometricPrompt: null,

      unlock: async (opened, fileName, storageMode = 'folder') => {
        // Switching vaults must end the previous session first: its in-flight
        // requests are aborted, its pending edits are flushed, and its file key
        // is dropped. Otherwise a probe from the old vault can still leave the
        // browser after the new one is on screen (I8 / §12.4).
        if (runtime) {
          const previous = runtime;
          if (
            getState().storageMode === 'download' &&
            previous.vault.hasUnsavedChanges
          ) {
            throw new Error(
              'Export the current download-mode vault before switching away.'
            );
          }
          if (saveTimer) {
            clearTimeout(saveTimer);
            saveTimer = null;
          }
          const saved = await previous.vault.flush().catch(() => null);
          if (!saved?.ok) {
            throw new Error(
              'The current vault could not be saved, so it was not closed.'
            );
          }
          const locked = previous.vault.lock();
          if (!locked.ok) {
            throw new Error(
              'The current vault could not be closed while it was busy.'
            );
          }
          // Only end the session after the old file is safely written and
          // locked; a failed flush must leave the old vault usable.
          previous.session.lock();
          await drainLocalCleanup();
        }

        const preferences = await deps.local.getPreferences();
        generation += 1;
        runtime = {
          vault: opened.vault,
          session: opened.session,
          local: deps.local,
          fileName,
          fingerprint: opened.fingerprint,
          preferences,
        };
        set({
          workspaceState: 'unlocked',
          activeVaultFileName: fileName,
          storageMode,
          hasUnsavedChanges: false,
          saveFailure: null,
          biometricPrompt: null,
          // Filters belong to the vault that was open when they were set.
          selectedKeyId: null,
          searchQuery: '',
          filterGroupId: null,
          filterProvider: null,
          filterTestStatus: null,
          filterExpiryStatus: null,
        });
        await get().refresh();

        // A cached allowance only describes keys this vault still has.
        const vaultId = opened.vault.getPayload().vault.id;
        const keyIds = opened.vault.getPayload().keys.map((key) => key.id);
        pruneUsageCache(vaultId, keyIds);
        set({ usage: readUsageCache(vaultId) });
      },

      verifyPassword: async (password) => {
        if (!runtime) return false;
        return runtime.vault.verifyPassword(password);
      },

      lock: async () => {
        const saved = await flushSave().catch(() => false);
        if (saved === false) {
          toast.error('Could not save. The vault stays unlocked.');
          return;
        }
        const active = runtime;
        if (!active) return;
        // I11: an edit can land while `flushSave` refreshes, in which case the
        // vault is still dirty and locking must be cancelled, not forced.
        const locked = active.vault.lock();
        if (!locked.ok) {
          toast.error(
            locked.failure === 'busy'
              ? 'A password change is running. The vault stays unlocked.'
              : 'Could not save. The vault stays unlocked.'
          );
          return;
        }
        generation += 1;
        active.session.lock();
        // A copied credential must not outlive the session it was copied from.
        void clearClipboardNow();
        runtime = null;
        set({
          workspaceState: 'welcome',
          view: null,
          activeVaultFileName: null,
          hasUnsavedChanges: false,
          saveFailure: null,
          selectedKeyId: null,
          usage: {},
          biometricPrompt: null,
          showAddForm: false,
          addKeyDraft: null,
          filterGroupId: null,
          filterProvider: null,
          filterTestStatus: null,
          filterExpiryStatus: null,
          searchQuery: '',
        });
      },

      markExported: () =>
        set({
          // The vault knows whether the exported snapshot still covers every
          // edit; never clear the flag just because a download started.
          hasUnsavedChanges: runtime?.vault.hasUnsavedChanges ?? false,
          saveFailure: runtime?.vault.hasUnsavedChanges
            ? get().saveFailure
            : null,
        }),

      setTheme: (theme) => {
        try {
          localStorage.setItem('keya-theme', theme);
        } catch {
          // The theme still applies for this session.
        }
        set({ theme });
      },

      updateKeyboardShortcuts: (shortcuts) => {
        writeShortcutMap(shortcuts);
        set({ keyboardShortcuts: shortcuts });
      },

      refresh: async () => {
        const active = runtime;
        if (!active) return;
        const run = generation;
        viewSeq += 1;
        const refreshId = viewSeq;
        let view: VaultView;
        try {
          view = await buildView({
            ...active,
            now: clock(),
            timeZone: timeZone(),
          });
        } catch (error) {
          // A lock can land while the view is being assembled; that refresh has
          // nothing left to render. Anything else is a real failure.
          if (
            runtime !== active ||
            generation !== run ||
            viewSeq !== refreshId ||
            active.vault.isLocked
          ) {
            return;
          }
          throw error;
        }
        // A refresh that started before a lock or switch must not repaint the
        // next session with the previous vault.
        if (runtime !== active || generation !== run || viewSeq !== refreshId)
          return;
        set({ view });
      },

      addKey: (input) => {
        if (!runtime) return undefined;
        const now = clock().toISOString();
        const id = newId();
        const key: Key = {
          id,
          name: input.name,
          description: input.description,
          provider_id: input.providerId,
          endpoint: input.endpoint.trim() || null,
          secret: input.secret,
          group_id: input.groupId,
          expiry: input.expiry,
          archived_at: null,
          created_at: now,
          content_updated_at: now,
        };

        const result = runtime.vault.saveKey(key);
        if (!result.ok) {
          toast.error(describeEditFailure(result.reason, result.issues));
          return undefined;
        }

        // The rebuilt view lands after this call returns, so answer from the
        // payload itself: callers use the result to know the save took effect.
        const saved = runtime.vault
          .getPayload()
          .keys.find((entry) => entry.id === id);
        if (saved && saved.secret !== input.secret) {
          // Normalization trimmed it; say so rather than changing bytes quietly.
          toast('Surrounding whitespace was removed from the credential.');
        }
        void afterChange();
        return saved;
      },

      updateKey: (id, patch) => {
        if (!runtime) return false;
        const file = runtime.vault.getPayload();
        const existing = file.keys.find((key) => key.id === id);
        if (!existing) return false;

        const next: Key = {
          ...existing,
          name: patch.name ?? existing.name,
          description: patch.description ?? existing.description,
          provider_id:
            patch.providerId !== undefined
              ? patch.providerId
              : existing.provider_id,
          endpoint:
            patch.endpoint !== undefined
              ? patch.endpoint.trim() || null
              : existing.endpoint,
          secret: patch.secret ?? existing.secret,
          group_id:
            patch.groupId !== undefined ? patch.groupId : existing.group_id,
          expiry: patch.expiry !== undefined ? patch.expiry : existing.expiry,
          archived_at:
            patch.archivedAt !== undefined
              ? patch.archivedAt
              : existing.archived_at,
          content_updated_at: clock().toISOString(),
        };

        const result = runtime.vault.saveKey(next);
        if (!result.ok) {
          toast.error(describeEditFailure(result.reason, result.issues));
          return false;
        }

        const stored = runtime.vault
          .getPayload()
          .keys.find((entry) => entry.id === id);
        if (stored && stored.secret !== next.secret) {
          toast('Surrounding whitespace was removed from the credential.');
        }

        // An edit that normalizes to the current state is a no-op; do not
        // schedule a write or a refresh for it.
        if (!result.changed) return true;

        // A snapshot describes the request that produced it; a rotated secret or
        // a moved endpoint makes it describe someone else's allowance.
        const requery =
          next.secret !== existing.secret ||
          next.endpoint !== existing.endpoint ||
          next.provider_id !== existing.provider_id;
        if (requery) {
          dropUsageSnapshot(runtime.vault.getPayload().vault.id, id);
          set((state) => ({ usage: withoutKey(state.usage, id) }));
        }

        void afterChange();
        return true;
      },

      deleteKey: (id) => {
        if (!runtime) return;
        const result = runtime.vault.removeKey(id);
        if (!result.ok) {
          toast.error(describeEditFailure(result.reason, result.issues));
          return;
        }
        const active = runtime;
        if (!active) return;
        const vaultId = active.vault.getPayload().vault.id;
        // §8: the file must no longer contain the key before its observations
        // are removed, or a failed save strands them.
        pendingLocalCleanup.push({ vaultId, keyId: id });
        dropUsageSnapshot(vaultId, id);
        set((state) => ({ usage: withoutKey(state.usage, id) }));
        if (get().selectedKeyId === id) set({ selectedKeyId: null });
        void afterChange();
        // A deletion is small and important enough to commit immediately; the
        // local cleanup runs only after this flush succeeds.
        void flushSave();
      },

      archiveKey: (id) => {
        if (!runtime) return;
        const result = runtime.vault.archiveKey(id, true);
        if (!result.ok) {
          toast.error(describeEditFailure(result.reason, result.issues));
          return;
        }
        void afterChange();
      },

      restoreKey: (id) => {
        if (!runtime) return;
        const result = runtime.vault.archiveKey(id, false);
        if (!result.ok) {
          toast.error(describeEditFailure(result.reason, result.issues));
          return;
        }
        void afterChange();
      },

      refreshUsage: async (keyId) => {
        const active = runtime;
        if (!active) return;
        const view = get().view;
        const key = view ? keyById(view, keyId) : undefined;
        if (!view || !key) return;
        // One request at a time per key: a second click would consume a second
        // one-shot approval for a query that is already running.
        if (get().usage[keyId]?.state === 'loading') return;

        const provider = providerLabel(key.provider_id, view.file.providers);
        const endpoint = key.endpoint ?? '';
        const secret = key.secret;
        const vaultId = active.vault.getPayload().vault.id;

        set((state) => ({
          usage: {
            ...state.usage,
            [keyId]: {
              state: 'loading',
              vault_id: vaultId,
              // Keep the last figures on screen while a refresh is in flight;
              // the button already says "Checking…", and swapping the card back
              // to its empty state would collapse an open disclosure.
              snapshot: state.usage[keyId]?.snapshot,
            },
          },
        }));

        // The click is the gesture: approve this one request shape, then let the
        // session decide whether it may go out.
        const url = usageRequestUrl({ provider, endpoint });
        if (url) await active.session.approveUsageOnce(keyId, url);

        const result = await fetchUsage(
          { provider, endpoint, secret },
          {
            authorize: (target) => active.session.authorizeUsage(keyId, target),
            signal: active.session.signal,
          }
        );

        if (runtime !== active) return;

        // A snapshot describes the request that produced it. If the secret or
        // destination changed while it was in flight, it is about a credential
        // this vault no longer holds.
        const current = active.vault
          .getPayload()
          .keys.find((entry) => entry.id === keyId);
        if (
          !current ||
          current.secret !== secret ||
          (current.endpoint ?? '') !== endpoint
        ) {
          return;
        }

        const entry: UsageEntry =
          result.ok === true
            ? { state: 'ok', snapshot: result.snapshot, vault_id: vaultId }
            : { state: 'failed', failure: result.failure, vault_id: vaultId };

        set((state) => ({ usage: { ...state.usage, [keyId]: entry } }));
        if (entry.state === 'ok' && entry.snapshot) {
          writeUsageSnapshot(entry.vault_id, keyId, entry.snapshot);
        }
      },

      setBiometricPrompt: (biometricPrompt) => set({ biometricPrompt }),

      setSearchQuery: (searchQuery) => set({ searchQuery }),
      setShowAddForm: (showAddForm) => set({ showAddForm }),

      beginAddKeyFlow: () => {
        set({ showAddForm: true, addKeyDraft: null });
      },

      clearAddKeyDraft: () => set({ addKeyDraft: null }),

      setFilterGroupId: (filterGroupId) => set({ filterGroupId }),
      setFilterProvider: (filterProvider) => set({ filterProvider }),
      setFilterTestStatus: (filterTestStatus) => set({ filterTestStatus }),
      setFilterExpiryStatus: (filterExpiryStatus) =>
        set({ filterExpiryStatus }),
      setShowArchived: (showArchived) => set({ showArchived }),
      clearFilters: () => set({ searchQuery: '', filterGroupId: null }),
      clearSmartFilters: () =>
        set({
          filterProvider: null,
          filterTestStatus: null,
          filterExpiryStatus: null,
        }),
      setSelectedKeyId: (selectedKeyId) => set({ selectedKeyId }),

      addGroup: (group) => {
        if (!runtime) return;
        const result = runtime.vault.saveGroup({
          id: crypto.randomUUID(),
          name: group.name,
          icon: group.icon,
          order: group.order,
        });
        if (!result.ok) {
          toast.error(describeEditFailure(result.reason, result.issues));
          return;
        }
        void afterChange();
      },

      updateGroup: (id, updates) => {
        if (!runtime) return;
        const file = runtime.vault.getPayload();
        const existing = file.groups.find((group) => group.id === id);
        if (!existing) return;
        const result = runtime.vault.saveGroup({ ...existing, ...updates });
        if (!result.ok) {
          toast.error(describeEditFailure(result.reason, result.issues));
          return;
        }
        void afterChange();
      },

      deleteGroup: (id) => {
        if (!runtime) return;
        const result = runtime.vault.removeGroup(id);
        if (!result.ok) {
          toast.error(describeEditFailure(result.reason, result.issues));
          return;
        }
        void afterChange();
      },

      updateSettings: (patch) => {
        if (!runtime) return;
        const preferences: Preferences = { ...runtime.preferences };

        if (patch.auto_lock_minutes !== undefined) {
          preferences.auto_lock_minutes = patch.auto_lock_minutes;
        }
        if (patch.hidden_presets !== undefined) {
          preferences.hidden_presets = patch.hidden_presets;
        }
        runtime.preferences = preferences;
        void deps.local.setPreferences(preferences);

        if (patch.providers) {
          // Providers live in the payload, so editing them is a vault change:
          // it has to be marked unsaved and scheduled like any other edit.
          applyProviders(runtime, patch.providers);
          void afterChange();
          return;
        }

        void get().refresh();
      },

      changePassword: async (oldPassword, newPassword) => {
        const active = runtime;
        if (!active) return { ok: false, reason: 'The vault is locked.' };

        const verdict = await judgePassword(newPassword);
        if (!verdict.ok) {
          return { ok: false, reason: describePasswordVerdict(verdict) };
        }

        const before = active.vault.containerInfo.fingerprint;
        const result = await active.vault.changePassword(
          oldPassword,
          newPassword
        );
        if (!result.ok) {
          const reason =
            result.failure === 'wrong_password'
              ? 'The current password is not correct.'
              : result.failure === 'locked'
                ? 'The vault locked while the password was changing.'
                : result.failure === 'busy'
                  ? 'Another password change is already running.'
                  : result.failure === 'kdf_busy'
                    ? 'Another tab is deriving a key. Try again in a moment.'
                    : result.failure === 'kdf_memory'
                      ? 'This device does not have enough memory to derive the new key.'
                      : result.failure === 'kdf_failed' ||
                          result.failure === 'kdf_cancelled'
                        ? 'The new key could not be derived. Nothing was changed.'
                        : result.failure;
          return { ok: false, reason };
        }

        const payload = active.vault.getPayload();
        try {
          await deps.local.moveContainer(
            {
              fingerprint: active.vault.containerInfo.fingerprint,
              file_name: active.fileName,
              vault_id: payload.vault.id,
              name: payload.vault.name,
              icon: payload.vault.icon,
              key_count: payload.keys.length,
              content_updated_at: payload.vault.content_updated_at,
              last_opened_at: clock().toISOString(),
            },
            before
          );
        } catch {
          // The password change itself is already committed. A stale local
          // registration is recoverable on the next unlock; reporting the whole
          // change as failed would be false.
          toast.error(
            'Password changed, but the local vault registration could not be updated.'
          );
        }

        active.fingerprint = active.vault.containerInfo.fingerprint;

        // Biometric records wrap the old password. Drop the stale record here,
        // not on a later unlock that would silently fail.
        try {
          if (await isBiometricRegistered(payload.vault.id)) {
            await removeBiometric(payload.vault.id);
          }
        } catch {
          // Best effort: the password change itself already succeeded.
        }

        // Download mode has no writable copy: the new container only reaches
        // disk when the user exports it.
        const download = getState().storageMode === 'download';
        set({ hasUnsavedChanges: download, saveFailure: null });
        await get().refresh();
        return { ok: true as const };
      },

      forgetDeviceState: async () => {
        const active = runtime;
        if (!active) return;
        const vaultId = active.vault.getPayload().vault.id;

        await active.local.forgetVault(vaultId);
        await removeBiometric(vaultId);
        clearUsageVault(vaultId);

        // A lock or a switch during the awaits owns the state now; its device
        // data is not ours to clear.
        if (runtime !== active) return;
        set({ usage: {} });
        await get().refresh();
      },

      updateMeta: (updates) => {
        if (!runtime) return;
        const result = runtime.vault.updateMeta(updates);
        if (!result.ok) {
          toast.error(describeEditFailure(result.reason, result.issues));
          return;
        }
        void afterChange();
      },
    };
  });

  /**
   * Run one manually triggered check for a stored key. The click is the gesture
   * that authorizes the request, so a one-shot approval is created here.
   */
  const runManualCheck = async (
    keyId: string
  ): Promise<ManualCheckResult | null> => {
    const active = runtime;
    if (!active) return null;
    const payload = active.vault.getPayload();
    if (!payload.keys.some((key) => key.id === keyId)) return null;

    const binding = (await active.session.bindings()).get(keyId);
    // Nothing is stored that could stand in for this click.
    if (binding && !(await confirmDestination(binding.plan.resolvedHref))) {
      return null;
    }

    let outcome: Awaited<ReturnType<typeof active.session.probe>>;
    try {
      await active.session.approveOnce(keyId);
      outcome = await active.session.probe(keyId);
    } catch (error) {
      // Locking (or switching) mid-flight tears the session down; the caller
      // still needs an answer instead of an unhandled rejection.
      return {
        success: false,
        latency_ms: 0,
        error:
          error instanceof Error
            ? error.message
            : 'The check could not finish.',
        kind: 'request' as const,
      };
    }
    // A switch mid-check must not repaint the vault that did not ask for it.
    if (runtime === active) await getState().refresh();
    if (outcome.status !== 'observed' && outcome.status !== 'discarded') {
      return {
        success: false,
        latency_ms: 0,
        error:
          outcome.status === 'not_executable' ? outcome.reason : outcome.status,
        kind: 'request',
      };
    }
    const observation = outcome.observation;

    return {
      success: observation.outcome === 'ok',
      latency_ms: observation.latency_ms ?? 0,
      error:
        observation.outcome === 'ok'
          ? undefined
          : (observation.detail_code ?? observation.outcome),
      kind: observation.kind,
    };
  };

  /** Turn a refused edit into the sentence the user sees. */
  function describeEditFailure(reason: EditFailure, issues?: Issue[]): string {
    if (reason === 'invalid_edit') {
      return issues && issues.length > 0
        ? summarizeIssues(issues)
        : 'Those values are not valid for this vault.';
    }
    if (reason === 'invalid_icon') {
      return 'An icon must be a single emoji.';
    }
    return reason;
  }

  /** Drop one key's entry without touching the rest of the map. */
  function withoutKey(
    usage: Record<string, UsageEntry>,
    id: string
  ): Record<string, UsageEntry> {
    if (!(id in usage)) return usage;
    const next = { ...usage };
    delete next[id];
    return next;
  }

  /** Local `YYYY-MM-DD`, so "once a day" follows the device's clock. */
  /**
   * Write the custom providers the settings page shows. Matching is by id first,
   * so renaming a provider keeps the references keys already point at.
   */
  function applyProviders(state: Runtime, drafts: ProviderDraft[]): void {
    const file = state.vault.getPayload();
    const existing = file.providers;

    const byId = new Map(existing.map((provider) => [provider.id, provider]));
    const byName = new Map(
      existing.map((provider) => [provider.name.trim().toLowerCase(), provider])
    );

    const kept = new Set<string>();
    const claimed = new Set<string>();
    const seenNames = new Set<string>();
    for (const draft of drafts) {
      const name = draft.name.trim();
      const nameKey = name.toLowerCase();
      // Two drafts with the same name cannot both exist (A 类 uniqueness), so
      // refuse the duplicate instead of letting one silently replace the other.
      if (seenNames.has(nameKey)) {
        toast.error(
          `Two providers are both named "${name}", so one was skipped.`
        );
        continue;
      }
      seenNames.add(nameKey);

      // Match by id first. A name-only fallback is allowed once per stored
      // provider, for settings state written before drafts carried ids.
      const byIdMatch = draft.id ? byId.get(draft.id) : undefined;
      const byNameMatch = byIdMatch ? undefined : byName.get(nameKey);
      const previous =
        byIdMatch ??
        (byNameMatch && !claimed.has(byNameMatch.id) ? byNameMatch : undefined);
      const id = previous?.id ?? `custom:${newId()}`;
      kept.add(id);
      claimed.add(id);

      const saved = state.vault.saveProvider(draftToProvider(draft, id));
      if (!saved.ok) toast.error(saved.reason);
    }

    for (const provider of existing) {
      if (kept.has(provider.id)) continue;
      const removed = state.vault.removeProvider(provider.id);
      if (!removed.ok) {
        toast.error(
          removed.reason === 'provider_in_use'
            ? `${provider.name} is still used by a saved key, so it was kept.`
            : removed.reason
        );
      }
    }
  }

  /** Bytes of the current vault, for "Export .keya". */
  const exportVaultBytes = async (
    markClean = false
  ): Promise<Uint8Array | null> => {
    if (!runtime) return null;
    const result = await runtime.vault.exportBytes({ markClean });
    return result.ok ? result.bytes : null;
  };

  /**
   * Local observations owed a delete. They are removed only after the file
   * write that dropped the key succeeded, and a failure puts the item back so a
   * later successful save retries it.
   */
  const drainLocalCleanup = async (): Promise<void> => {
    if (pendingLocalCleanup.length === 0) return;
    const pending = pendingLocalCleanup.splice(0);
    for (const item of pending) {
      try {
        await deps.local.forgetKey(item.vaultId, item.keyId);
      } catch {
        pendingLocalCleanup.push(item);
      }
    }
  };

  /**
   * Flush pending edits. Returns false when the write failed, so callers can keep
   * the vault open instead of silently dropping changes.
   */
  const flushSave = async (): Promise<boolean> => {
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    if (!runtime) return true;

    if (getState().storageMode === 'download') {
      // This mode has no writable copy: the exported file is the save. Only
      // pending edits block leaving, so an exported vault can lock normally.
      if (!getState().hasUnsavedChanges) return true;
      toast.error('Export a .keya file to save changes before leaving.');
      return false;
    }

    const result = await runtime.vault.flush();
    if (!result.ok) {
      setState({ hasUnsavedChanges: true, saveFailure: result.failure });
      return false;
    }

    setState({ hasUnsavedChanges: false, saveFailure: null });
    await drainLocalCleanup();
    await getState().refresh();
    return true;
  };

  return {
    useStore,
    flushSave,
    exportVaultBytes,
    runManualCheck,
  };
}

export { SHORTCUT_DEFINITIONS };
export type { ShortcutMap };
