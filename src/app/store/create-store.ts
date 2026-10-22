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
import type { Vault } from '../vault/vault';
import type { VaultSession } from '../runtime/session';
import type { LocalState, Preferences } from '../storage/local/state';
import type { Observation } from '../../core/runtime/observations';
import type { Expiry } from '../../core/time/expiry';
import type { Group, Key } from '../../core/payload/types';
import {
  draftToProvider,
  providerLabel,
  type ProviderDraft,
} from '../state/providers';
import {
  buildVaultView,
  hasDuplicateSecret,
  keyById,
  type ReminderRow,
  type VaultView,
} from '../state/view';
import { fetchUsage, usageRequestUrl, type UsageEntry } from '../lib/usage';
import {
  dropUsageSnapshot,
  pruneUsageCache,
  readUsageCache,
  writeUsageSnapshot,
} from '../lib/usage-cache';
import type { OpenedVault } from '../lib/storage';
import {
  tryDetectClipboardKey,
  type AddKeyDraft,
  type ClipboardKeyCandidate,
} from '../lib/clipboard-intake';
import {
  SHORTCUT_DEFINITIONS,
  readShortcutMap,
  writeShortcutMap,
  type ShortcutMap,
} from '../lib/shortcuts';
import { describePasswordVerdict, judgePassword } from '../lib/password-policy';

export type VaultStorageMode = 'folder' | 'download';

/** Everything the store needs from the outside world, so tests can supply it. */
export interface StoreDeps {
  /** Device-local state: preferences, observations, dismissals, grants. */
  local: LocalState;
  clock?: () => Date;
  timeZone?: () => string;
  /** Ids for keys and groups; injected so tests stay deterministic. */
  newId?: () => string;
  /** How long edits are coalesced before a write. */
  saveDelayMs?: number;
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
  exportVaultBytes: () => Promise<Uint8Array | null>;
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
  auto_probe_on_save?: boolean;
  auto_probe_daily?: boolean;
  clipboard_detection_on_add?: boolean;
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

  searchQuery: string;
  showAddForm: boolean;
  addKeyDraft: AddKeyDraft | null;
  clipboardCandidate: ClipboardKeyCandidate | null;
  theme: 'dark' | 'light' | 'system';
  keyboardShortcuts: ShortcutMap;

  filterGroupId: string | null;
  filterProvider: string | null;
  filterTestStatus: string | null;
  filterExpiryStatus: string | null;
  showArchived: boolean;

  selectedKeyId: string | null;
  usage: Record<string, UsageEntry>;
  biometricPrompt: { vaultId: string; password: string } | null;
  inboxVersion: number;
  lastInboxSyncAt: string | null;
  lastInboxSyncResult: {
    added: number;
    updated: number;
    archived: number;
  } | null;

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
  setBiometricPrompt: (
    prompt: { vaultId: string; password: string } | null
  ) => void;
  setSearchQuery: (query: string) => void;
  setShowAddForm: (show: boolean) => void;
  beginAddKeyFlow: () => Promise<void>;
  confirmClipboardCandidate: () => void;
  skipClipboardCandidate: () => void;
  dismissClipboardCandidate: () => void;
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
  changePassword: (oldPassword: string, newPassword: string) => Promise<void>;
  setReminderDismissed: (row: ReminderRow, dismissed: boolean) => void;
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
    dismissals: await state.session.dismissed(),
  });
}

export function createAppStore(deps: StoreDeps): AppStore {
  const clock = deps.clock ?? (() => new Date());
  const timeZone = deps.timeZone ?? (() => 'UTC');
  const newId = deps.newId ?? (() => crypto.randomUUID());
  const saveDelayMs = deps.saveDelayMs ?? 500;

  let runtime: Runtime | null = null;
  let saveTimer: ReturnType<typeof setTimeout> | null = null;
  let inboxBaseline: { vaultId: string; open: string[] } | null = null;
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
      // there is nothing to debounce and the reminder belongs to leaving, not
      // to every edit.
      if (getState().storageMode === 'download') return;

      saveTimer = setTimeout(() => {
        void flushSave().catch(() => {
          toast.error('The vault was not saved. Keep this page open.');
        });
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

      searchQuery: '',
      showAddForm: false,
      addKeyDraft: null,
      clipboardCandidate: null,
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
      inboxVersion: 0,
      lastInboxSyncAt: null,
      lastInboxSyncResult: null,

      unlock: async (opened, fileName, storageMode = 'folder') => {
        const preferences = await deps.local.getPreferences();
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
          inboxVersion: get().inboxVersion + 1,
        });
        await get().refresh();

        // A cached allowance only describes keys this vault still has, and the
        // reminder baseline must start from what is already open so unlocking
        // does not announce a backlog the user has seen.
        const vaultId = opened.vault.getPayload().vault.id;
        const keyIds = opened.vault.getPayload().keys.map((key) => key.id);
        pruneUsageCache(vaultId, keyIds);
        inboxBaseline = { vaultId, open: openReminderIds(get().view) };
        set({ usage: readUsageCache(vaultId) });

        // Fire and forget: the daily run must never reject out of `unlock`.
        void runDailyProbe().catch(() => undefined);
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
        runtime?.vault.lock();
        runtime = null;
        set({
          workspaceState: 'welcome',
          view: null,
          activeVaultFileName: null,
          hasUnsavedChanges: false,
          selectedKeyId: null,
          usage: {},
          biometricPrompt: null,
          showAddForm: false,
          addKeyDraft: null,
          clipboardCandidate: null,
          filterGroupId: null,
          filterProvider: null,
          filterTestStatus: null,
          filterExpiryStatus: null,
          searchQuery: '',
        });
      },

      markExported: () => set({ hasUnsavedChanges: false }),

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
        if (!runtime) return;
        const view = await buildView({
          ...runtime,
          now: clock(),
          timeZone: timeZone(),
        });
        set({ view, inboxVersion: get().inboxVersion + 1 });
        announceNewReminders(view);
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
          toast.error(result.reason);
          return undefined;
        }

        // The rebuilt view lands after this call returns, so answer from the
        // payload itself: callers use the result to know the save took effect.
        const saved = runtime.vault
          .getPayload()
          .keys.find((entry) => entry.id === id);
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
          toast.error(result.reason);
          return false;
        }

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
          toast.error(result.reason);
          return;
        }
        void runtime.local.forgetKey(runtime.vault.getPayload().vault.id, id);
        dropUsageSnapshot(runtime.vault.getPayload().vault.id, id);
        set((state) => ({ usage: withoutKey(state.usage, id) }));
        if (get().selectedKeyId === id) set({ selectedKeyId: null });
        void afterChange();
      },

      archiveKey: (id) => {
        if (!runtime) return;
        const result = runtime.vault.archiveKey(id, true);
        if (!result.ok) return;
        void afterChange();
      },

      restoreKey: (id) => {
        if (!runtime) return;
        const result = runtime.vault.archiveKey(id, false);
        if (!result.ok) return;
        void afterChange();
      },

      refreshUsage: async (keyId) => {
        const active = runtime;
        if (!active) return;
        const view = get().view;
        const key = view ? keyById(view, keyId) : undefined;
        if (!view || !key) return;

        const provider = providerLabel(key.provider_id, view.file.providers);
        const endpoint = key.endpoint ?? '';

        // The click is the gesture: approve this one request shape, then let the
        // session decide whether it may go out.
        const url = usageRequestUrl({ provider, endpoint });
        if (url) await active.session.approveUsageOnce(keyId, url);

        const result = await fetchUsage(
          { provider, endpoint, secret: key.secret },
          {
            authorize: (target) => active.session.authorizeUsage(keyId, target),
          }
        );

        const vaultId = active.vault.getPayload().vault.id;
        if (runtime !== active) return;

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

      beginAddKeyFlow: async () => {
        const view = get().view;
        if (!view?.preferences.clipboard_detection_on_add) {
          set({
            showAddForm: true,
            addKeyDraft: null,
            clipboardCandidate: null,
          });
          return;
        }

        const vaultId = view.vaultId;
        const candidate = await tryDetectClipboardKey(
          view.preferences,
          view.file.providers
        );
        const current = get().view;
        if (!current || current.vaultId !== vaultId) return;

        if (candidate && hasDuplicateSecret(current, candidate.raw)) {
          toast('This credential is already saved');
          set({
            showAddForm: true,
            addKeyDraft: null,
            clipboardCandidate: null,
          });
          return;
        }

        if (candidate) {
          set({
            showAddForm: false,
            addKeyDraft: null,
            clipboardCandidate: candidate,
          });
          return;
        }

        set({ showAddForm: true, addKeyDraft: null, clipboardCandidate: null });
      },

      confirmClipboardCandidate: () => {
        const candidate = get().clipboardCandidate;
        if (!candidate) return;
        set({
          clipboardCandidate: null,
          addKeyDraft: candidate.draft,
          showAddForm: true,
        });
      },

      skipClipboardCandidate: () =>
        set({
          clipboardCandidate: null,
          addKeyDraft: null,
          showAddForm: true,
        }),

      dismissClipboardCandidate: () =>
        set({
          clipboardCandidate: null,
          addKeyDraft: null,
          showAddForm: false,
        }),

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
          toast.error(result.reason);
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
        if (!result.ok) return;
        void afterChange();
      },

      deleteGroup: (id) => {
        if (!runtime) return;
        const result = runtime.vault.removeGroup(id);
        if (!result.ok) {
          toast.error(result.reason);
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
        if (patch.auto_probe_on_save !== undefined) {
          preferences.auto_probe_on_save = patch.auto_probe_on_save;
        }
        if (patch.auto_probe_daily !== undefined) {
          preferences.auto_probe_daily = patch.auto_probe_daily;
        }
        if (patch.clipboard_detection_on_add !== undefined) {
          preferences.clipboard_detection_on_add =
            patch.clipboard_detection_on_add;
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
        if (!runtime) return;

        const verdict = await judgePassword(newPassword);
        if (!verdict.ok) {
          toast.error(describePasswordVerdict(verdict));
          return;
        }

        const before = runtime.vault.containerInfo.fingerprint;
        const result = await runtime.vault.changePassword(
          oldPassword,
          newPassword
        );
        if (!result.ok) {
          toast.error(
            result.failure === 'wrong_password'
              ? 'The current password is not correct.'
              : result.failure
          );
          return;
        }

        const payload = runtime.vault.getPayload();
        await deps.local.moveContainer(
          {
            fingerprint: runtime.vault.containerInfo.fingerprint,
            file_name: runtime.fileName,
            vault_id: payload.vault.id,
            name: payload.vault.name,
            icon: payload.vault.icon,
            key_count: payload.keys.length,
            content_updated_at: payload.vault.content_updated_at,
            last_opened_at: clock().toISOString(),
          },
          before
        );

        runtime.fingerprint = runtime.vault.containerInfo.fingerprint;
        set({ hasUnsavedChanges: false });
        await get().refresh();
        toast.success('Password changed.');
      },

      setReminderDismissed: (row, dismissed) => {
        if (!runtime) return;
        void (dismissed ? dismissReminder(row) : restoreReminder(row));
        void afterChange();
      },

      updateMeta: (updates) => {
        if (!runtime) return;
        const result = runtime.vault.updateMeta(updates);
        if (!result.ok) return;
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

    let outcome: Awaited<ReturnType<typeof active.session.probe>>;
    try {
      await active.session.approveOnce(keyId);
      outcome = await active.session.probe(keyId, 'manual');
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
    if (observation.outcome === 'ok') void offerStandingApproval(keyId);

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

  /**
   * A manual check is consent for one request. Daily auto-test can only reuse
   * persistent consent, so offer it once the destination has actually answered.
   */
  const offerStandingApproval = async (keyId: string): Promise<void> => {
    const active = runtime;
    if (!active) return;
    if (await active.session.hasGrant(keyId)) return;

    toast('Allow this destination permanently?', {
      description:
        'Daily auto-test only checks destinations you allowed permanently.',
      action: {
        label: 'Always allow',
        onClick: () => {
          void active.session.grant(keyId);
        },
      },
    });
  };

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

  /** The open reminder ids of one view, used to spot what appeared later. */
  function openReminderIds(view: VaultView | null): string[] {
    if (!view) return [];
    return view.reminders
      .filter((row) => !row.dismissed)
      .map((row) => `${row.reminder.rule}:${row.key.id}`);
  }

  /**
   * Announce reminders that appeared while the vault was open. The list itself is
   * computed, so "new" means new to this device since the last refresh.
   */
  const announceNewReminders = (view: VaultView): void => {
    const vaultId = view.vaultId;
    const open = openReminderIds(view);
    const previous = inboxBaseline;

    inboxBaseline = { vaultId, open };

    if (!previous || previous.vaultId !== vaultId) return;

    const before = new Set(previous.open);
    const now = new Set(open);
    const added = open.filter((id) => !before.has(id)).length;
    const archived = previous.open.filter((id) => !now.has(id)).length;
    if (added === 0 && archived === 0) return;

    setState({
      lastInboxSyncAt: clock().toISOString(),
      lastInboxSyncResult: { added, updated: 0, archived },
    });
  };

  /** Local `YYYY-MM-DD`, so "once a day" follows the device's clock. */
  function localDay(now: Date, timeZone: string): string {
    try {
      return new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(now);
    } catch {
      return now.toISOString().slice(0, 10);
    }
  }

  /**
   * Daily auto-test. It reuses standing grants only: a key the user never
   * approved permanently is left untouched instead of being sent silently.
   */
  const runDailyProbe = async (): Promise<void> => {
    const active = runtime;
    if (!active || !active.preferences.auto_probe_daily) return;

    const day = localDay(clock(), timeZone());
    if (active.preferences.last_daily_probe_day === day) return;

    active.preferences = { ...active.preferences, last_daily_probe_day: day };
    await deps.local.setPreferences({ last_daily_probe_day: day });

    const keys = active.vault
      .getPayload()
      .keys.filter((key) => key.archived_at === null)
      .map((key) => key.id);

    for (const keyId of keys) {
      if (runtime !== active) return;
      try {
        await active.session.probe(keyId, 'automatic');
      } catch {
        // One key's failure must not end the sweep. A lock or switch tears the
        // session down instead, which the runtime check above stops.
      }
    }

    if (runtime === active) await getState().refresh();
  };

  /**
   * Put a reminder away. The reminder already carries the fact it was computed
   * from — a condition or a binding — so the dismissal is written for exactly
   * that fact and stops applying once the fact changes.
   */
  async function dismissReminder(row: ReminderRow): Promise<void> {
    if (!runtime) return;
    const { reminder } = row;
    const vaultId = runtime.vault.getPayload().vault.id;
    const now = clock().toISOString();

    if (reminder.kind === 'business') {
      await runtime.local.putBusinessDismissal({
        vault_id: vaultId,
        key_id: reminder.key_id,
        rule: reminder.rule,
        condition: reminder.condition,
        dismissed_at: now,
      });
      return;
    }

    await runtime.local.putObservationDismissal({
      vault_id: vaultId,
      key_id: reminder.key_id,
      rule: reminder.rule,
      binding: reminder.binding,
      dismissed_at: now,
    });
  }

  async function restoreReminder(row: ReminderRow): Promise<void> {
    if (!runtime) return;
    const { reminder } = row;
    const vaultId = runtime.vault.getPayload().vault.id;

    if (reminder.kind === 'business') {
      await runtime.local.removeBusinessDismissal(
        vaultId,
        reminder.key_id,
        reminder.rule
      );
      return;
    }

    await runtime.local.removeObservationDismissal(
      vaultId,
      reminder.key_id,
      reminder.rule
    );
  }

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
    for (const draft of drafts) {
      const previous =
        (draft.id ? byId.get(draft.id) : undefined) ??
        byName.get(draft.name.trim().toLowerCase());
      const id = previous?.id ?? `custom:${newId()}`;
      kept.add(id);

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
  const exportVaultBytes = async (): Promise<Uint8Array | null> => {
    if (!runtime) return null;
    const result = await runtime.vault.exportBytes();
    return result.ok ? result.bytes : null;
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
      setState({ hasUnsavedChanges: true });
      return false;
    }

    setState({ hasUnsavedChanges: false });
    await getState().refresh();
    return true;
  };

  return { useStore, flushSave, exportVaultBytes, runManualCheck };
}

export { SHORTCUT_DEFINITIONS };
export type { ShortcutMap };
