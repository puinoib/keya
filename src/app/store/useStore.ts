/**
 * Application state.
 *
 * Holds the unlocked vault, rebuilds the view the screens render from, and
 * routes every action to the vault's edit transactions, the device-local store
 * or the probe pipeline. The password is never kept here: it is handed to
 * `unlock` and discarded.
 */

import { create } from 'zustand';
import { toast } from 'sonner';
import type { Vault } from '../vault/vault';
import type { VaultSession } from '../runtime/session';
import type { LocalState, Preferences } from '../storage/local/state';
import { deviceTimeZone, localState } from '../storage/platform';
import type {
  BusinessRule,
  ObservationRule,
} from '../../core/runtime/dismissals';
import type { Observation } from '../../core/runtime/observations';
import type { ProbeAuth, Provider } from '../../core/payload/types';
import { providerIdForLabel } from '../view/catalog';
import { buildDatabase, type ViewDatabase } from '../view/build';
import { isoToExpiry, keyToView } from '../view/convert';
import type {
  ApiKey,
  CustomProvider,
  Group,
  NewApiKey,
  Settings,
} from '../view/types';
import { fetchUsage, usageRequestUrl, type UsageEntry } from '../lib/usage';
import { writeUsageSnapshot } from '../lib/usage-cache';
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
type WorkspaceState = 'welcome' | 'unlocked';

interface Runtime {
  vault: Vault;
  password: string;
  session: VaultSession;
  local: LocalState;
  fileName: string;
  fingerprint: string;
  preferences: Preferences;
}

let runtime: Runtime | null = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;

interface AppState {
  workspaceState: WorkspaceState;
  /** Session-only, so biometric enrollment can wrap it. Saves never use it. */
  password: string | null;
  db: ViewDatabase | null;
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

  setDb: (db: ViewDatabase) => void;
  lock: () => Promise<void>;
  unlock: (
    opened: OpenedVault,
    password: string,
    fileName: string,
    storageMode?: VaultStorageMode
  ) => Promise<void>;
  markExported: () => void;
  setTheme: (theme: 'dark' | 'light' | 'system') => void;
  updateKeyboardShortcuts: (shortcuts: ShortcutMap) => void;
  refresh: () => Promise<void>;

  addKey: (key: NewApiKey) => ApiKey | undefined;
  updateKey: (id: string, updates: Partial<ApiKey>) => void;
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
  updateGroup: (id: string, updates: Partial<Group>) => void;
  deleteGroup: (id: string) => void;

  updateSettings: (updates: Partial<Settings>) => void;
  changePassword: (oldPassword: string, newPassword: string) => Promise<void>;
  runInboxChecks: () => { added: number; updated: number; archived: number };
  archiveInboxItem: (id: string) => void;
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
}): Promise<ViewDatabase> {
  const file = state.vault.getPayload();
  const bindings = await state.session.bindings();
  const observations = new Map<string, Observation>();

  for (const key of file.keys) {
    const binding = bindings.get(key.id);
    if (!binding) continue;
    const list = await state.local.listObservations(file.vault.id, key.id);
    const latest = list.find((entry) => entry.binding === binding.binding);
    if (latest) observations.set(key.id, latest);
  }

  const dismissals = await state.session.dismissed();

  return buildDatabase({
    file,
    observations,
    bindings,
    dismissals,
    preferences: state.preferences,
    now: new Date(),
    timeZone: deviceTimeZone(),
  });
}

export const useStore = create<AppState>()((set, get) => {
  const scheduleSave = () => {
    set({ hasUnsavedChanges: true });
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      void flushSave().catch(() => {
        toast.error('The vault was not saved. Keep this page open.');
      });
    }, 500);
  };

  const afterChange = async () => {
    scheduleSave();
    await get().refresh();
  };

  return {
    workspaceState: 'welcome',
    password: null,
    db: null,
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

    setDb: (db) => set({ db }),

    unlock: async (opened, _password, fileName, storageMode = 'folder') => {
      const preferences = await localState.getPreferences();
      runtime = {
        vault: opened.vault,
        password: _password,
        session: opened.session,
        local: localState,
        fileName,
        fingerprint: opened.fingerprint,
        preferences,
      };
      set({
        workspaceState: 'unlocked',
        password: _password,
        activeVaultFileName: fileName,
        storageMode,
        hasUnsavedChanges: false,
        inboxVersion: get().inboxVersion + 1,
      });
      await get().refresh();
      void runDailyProbe();
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
        password: null,
        db: null,
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
      const db = await buildView(runtime);
      set({ db, inboxVersion: get().inboxVersion + 1 });
    },

    addKey: (input) => {
      if (!runtime) return undefined;
      const file = runtime.vault.getPayload();
      const now = new Date().toISOString();
      const id = crypto.randomUUID();
      const key = {
        id,
        name: input.name,
        description: input.description,
        provider_id: providerIdForLabel(input.provider, file.providers),
        endpoint: input.endpoint.trim() || null,
        secret: input.key,
        group_id: input.group_id,
        expiry: isoToExpiry(input.expires_at),
        archived_at: input.archived_at ?? null,
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
      return saved
        ? keyToView(saved, runtime.vault.getPayload(), undefined, {
            now: new Date(),
            timeZone: deviceTimeZone(),
          })
        : undefined;
    },

    updateKey: (id, updates) => {
      if (!runtime) return;
      const file = runtime.vault.getPayload();
      const existing = file.keys.find((key) => key.id === id);
      if (!existing) return;

      const view = get().db?.getApiKey(id);
      const next = {
        ...existing,
        name: updates.name ?? existing.name,
        description: updates.description ?? existing.description,
        provider_id:
          updates.provider !== undefined
            ? providerIdForLabel(updates.provider, file.providers)
            : existing.provider_id,
        endpoint:
          updates.endpoint !== undefined
            ? updates.endpoint.trim() || null
            : existing.endpoint,
        secret: updates.key ?? existing.secret,
        group_id:
          updates.group_id !== undefined ? updates.group_id : existing.group_id,
        expiry:
          updates.expires_at !== undefined
            ? isoToExpiry(updates.expires_at)
            : existing.expiry,
        archived_at:
          updates.archived_at !== undefined
            ? updates.archived_at
            : existing.archived_at,
        created_at: existing.created_at,
        content_updated_at: new Date().toISOString(),
      };

      void view;
      const result = runtime.vault.saveKey(next);
      if (!result.ok) {
        toast.error(result.reason);
        return;
      }
      void afterChange();
    },

    deleteKey: (id) => {
      if (!runtime) return;
      const result = runtime.vault.removeKey(id);
      if (!result.ok) {
        toast.error(result.reason);
        return;
      }
      void runtime.local.forgetKey(runtime.vault.getPayload().vault.id, id);
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
      const view = get().db?.getApiKey(keyId);
      if (!view) return;

      // The click is the gesture: approve this one request shape, then let the
      // session decide whether it may go out.
      const url = usageRequestUrl({
        provider: view.provider,
        endpoint: view.endpoint,
      });
      if (url) await active.session.approveUsageOnce(keyId, url);

      const result = await fetchUsage(
        {
          provider: view.provider,
          endpoint: view.endpoint,
          secret: view.key,
        },
        { authorize: (target) => active.session.authorizeUsage(keyId, target) }
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
      const settings = get().db?.getSettings();
      if (!settings?.clipboard_detection_on_add) {
        set({ showAddForm: true, addKeyDraft: null, clipboardCandidate: null });
        return;
      }

      const activeDb = get().db;
      const candidate = await tryDetectClipboardKey(settings);
      const db = get().db;
      if (db !== activeDb) return;

      if (
        candidate &&
        db
          ?.getActiveApiKeys()
          .some((existing) => existing.key === candidate.raw)
      ) {
        toast('This credential is already saved');
        set({ showAddForm: true, addKeyDraft: null, clipboardCandidate: null });
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
      set({ clipboardCandidate: null, addKeyDraft: null, showAddForm: false }),

    clearAddKeyDraft: () => set({ addKeyDraft: null }),

    setFilterGroupId: (filterGroupId) => set({ filterGroupId }),
    setFilterProvider: (filterProvider) => set({ filterProvider }),
    setFilterTestStatus: (filterTestStatus) => set({ filterTestStatus }),
    setFilterExpiryStatus: (filterExpiryStatus) => set({ filterExpiryStatus }),
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

    updateSettings: (updates) => {
      if (!runtime) return;
      const preferences: Preferences = { ...runtime.preferences };

      if (updates.auto_lock_minutes !== undefined) {
        preferences.auto_lock_minutes = updates.auto_lock_minutes;
      }
      if (updates.auto_test_on_save !== undefined) {
        preferences.auto_probe_on_save = updates.auto_test_on_save;
      }
      if (updates.auto_test_daily !== undefined) {
        preferences.auto_probe_daily = updates.auto_test_daily;
      }
      if (updates.clipboard_detection_on_add !== undefined) {
        preferences.clipboard_detection_on_add =
          updates.clipboard_detection_on_add;
      }
      if (updates.disabled_providers !== undefined) {
        preferences.hidden_presets = updates.disabled_providers;
      }
      runtime.preferences = preferences;
      void localState.setPreferences(preferences);

      if (updates.custom_providers) {
        void applyProviders(runtime, updates.custom_providers);
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
      await localState.moveContainer(
        {
          fingerprint: runtime.vault.containerInfo.fingerprint,
          file_name: runtime.fileName,
          vault_id: payload.vault.id,
          name: payload.vault.name,
          icon: payload.vault.icon,
          key_count: payload.keys.length,
          content_updated_at: payload.vault.content_updated_at,
          last_opened_at: new Date().toISOString(),
        },
        before
      );

      runtime.fingerprint = runtime.vault.containerInfo.fingerprint;
      // Biometric enrollment wraps whatever is held here, so it must follow.
      runtime.password = newPassword;
      set({ hasUnsavedChanges: false, password: newPassword });
      await get().refresh();
      toast.success('Password changed.');
    },

    runInboxChecks: () => {
      void get().refresh();
      const items = get().db?.getInboxItems() ?? [];
      const open = items.filter((item) => item.status === 'open').length;
      const archived = items.length - open;
      const previous = get().lastInboxSyncResult;
      const added = Math.max(
        0,
        open - (previous?.added ?? 0) - (previous?.updated ?? 0)
      );
      const result = { added, updated: 0, archived };
      set({
        lastInboxSyncAt: new Date().toISOString(),
        lastInboxSyncResult: result,
      });
      return result;
    },

    archiveInboxItem: (id) => {
      if (!runtime) return;
      const item = get()
        .db?.getInboxItems()
        .find((entry) => entry.id === id);
      if (!item) return;

      const rule = toRule(item.type);
      if (item.status === 'open') {
        const reminder = get()
          .db?.getInboxItems()
          .find((entry) => entry.id === id);
        void dismissReminder(item.entity_id, rule, reminder?.metadata);
      } else {
        void restoreReminder(item.entity_id, rule);
      }
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
export async function runManualCheck(keyId: string): Promise<{
  success: boolean;
  latency_ms: number;
  error?: string;
  kind: 'credential' | 'request';
} | null> {
  const active = runtime;
  if (!active) return null;
  const payload = active.vault.getPayload();
  if (!payload.keys.some((key) => key.id === keyId)) return null;

  await active.session.approveOnce(keyId);
  const outcome = await active.session.probe(keyId, 'manual');
  // A switch mid-check must not repaint the vault that did not ask for it.
  if (runtime === active) await useStore.getState().refresh();
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
}

/**
 * A manual check is consent for one request. Daily auto-test can only reuse
 * persistent consent, so offer it once the destination has actually answered.
 */
async function offerStandingApproval(keyId: string): Promise<void> {
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
}

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
async function runDailyProbe(): Promise<void> {
  const active = runtime;
  if (!active || !active.preferences.auto_probe_daily) return;

  const day = localDay(new Date(), deviceTimeZone());
  if (active.preferences.last_daily_probe_day === day) return;

  active.preferences = { ...active.preferences, last_daily_probe_day: day };
  await localState.setPreferences({ last_daily_probe_day: day });

  const keys = active.vault
    .getPayload()
    .keys.filter((key) => key.archived_at === null)
    .map((key) => key.id);

  for (const keyId of keys) {
    if (runtime !== active) return;
    await active.session.probe(keyId, 'automatic');
  }

  if (runtime === active) await useStore.getState().refresh();
}

async function dismissReminder(
  keyId: string,
  rule: BusinessRule | ObservationRule,
  _metadata: unknown
): Promise<void> {
  if (!runtime) return;
  const vaultId = runtime.vault.getPayload().vault.id;
  const now = new Date().toISOString();

  if (isBusinessRule(rule)) {
    const condition = await businessCondition(keyId, rule);
    if (!condition) return;
    await runtime.local.putBusinessDismissal({
      vault_id: vaultId,
      key_id: keyId,
      rule,
      condition,
      dismissed_at: now,
    });
    return;
  }

  const binding = (await runtime.session.bindings()).get(keyId)?.binding;
  if (!binding) return;
  await runtime.local.putObservationDismissal({
    vault_id: vaultId,
    key_id: keyId,
    rule,
    binding,
    dismissed_at: now,
  });
}

async function restoreReminder(
  keyId: string,
  rule: BusinessRule | ObservationRule
): Promise<void> {
  if (!runtime) return;
  const vaultId = runtime.vault.getPayload().vault.id;
  if (isBusinessRule(rule)) {
    await runtime.local.removeBusinessDismissal(vaultId, keyId, rule);
    return;
  }
  await runtime.local.removeObservationDismissal(vaultId, keyId, rule);
}

async function businessCondition(
  keyId: string,
  rule: BusinessRule
): Promise<string | null> {
  if (!runtime) return null;
  const db = await buildView(runtime);
  const item = db.getInboxItems().find((entry) => entry.entity_id === keyId);
  if (!item) return null;

  if (rule === 'insecure_endpoint') {
    const key = runtime.vault
      .getPayload()
      .keys.find((entry) => entry.id === keyId);
    if (!key?.endpoint) return null;
    try {
      return `http:${new URL(key.endpoint).origin}`;
    } catch {
      return null;
    }
  }

  const key = runtime.vault
    .getPayload()
    .keys.find((entry) => entry.id === keyId);
  const expiry = key?.expiry;
  if (!expiry) return null;
  return `${expiry.kind === 'date' ? 'date' : 'instant'}:${expiry.value}`;
}

function isBusinessRule(
  rule: BusinessRule | ObservationRule
): rule is BusinessRule {
  return (
    rule === 'expiry_upcoming' ||
    rule === 'expiry_expired' ||
    rule === 'insecure_endpoint'
  );
}

function toRule(type: string): BusinessRule | ObservationRule {
  switch (type) {
    case 'key_expiry_upcoming':
      return 'expiry_upcoming';
    case 'key_expiry_expired':
      return 'expiry_expired';
    case 'insecure_endpoint':
      return 'insecure_endpoint';
    case 'connection_failed':
      return 'probe_failed';
    case 'never_tested':
      return 'never_probed';
    default:
      return 'probe_stale';
  }
}

async function applyProviders(
  state: Runtime,
  providers: CustomProvider[]
): Promise<void> {
  const file = state.vault.getPayload();
  const byId = new Map(
    file.providers.map((provider) => [provider.id, provider])
  );
  const byName = new Map(
    file.providers.map((provider) => [provider.name, provider])
  );

  // Match on id first: a rename must keep the id the keys already point at.
  const kept = new Set<string>();
  for (const provider of providers) {
    const previous =
      (provider.id ? byId.get(provider.id) : undefined) ??
      byName.get(provider.name);
    const id = previous?.id ?? `custom:${crypto.randomUUID()}`;
    kept.add(id);

    const saved = state.vault.saveProvider(toStoredProvider(provider, id));
    if (!saved.ok) toast.error(saved.reason);
  }

  for (const provider of file.providers) {
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

function toStoredProvider(provider: CustomProvider, id: string): Provider {
  const check = provider.check;
  let probe: Provider['probe'] = null;

  if (check) {
    const auth: ProbeAuth =
      check.auth === 'x-api-key'
        ? { mode: 'header', name: 'x-api-key' }
        : check.auth === 'header'
          ? { mode: 'header', name: check.header_name?.trim() || 'x-api-key' }
          : check.auth === 'query'
            ? { mode: 'query', param: check.query_param?.trim() || 'key' }
            : check.auth === 'basic'
              ? { mode: 'basic' }
              : { mode: 'bearer' };

    probe = {
      target: (check.path ?? '').trim() || '.',
      auth,
      headers: (check.headers ?? [])
        .filter((header) => header.name.trim() && header.value.trim())
        .map((header) => ({
          name: header.name.trim().toLowerCase(),
          value: header.value.trim(),
        })),
    };
  }

  return {
    id,
    name: provider.name,
    description: '',
    default_endpoint: provider.endpoint.trim() || null,
    probe,
  };
}

/** Bytes of the current vault, for "Export .keya". */
export async function exportVaultBytes(): Promise<Uint8Array | null> {
  if (!runtime) return null;
  const result = await runtime.vault.exportBytes();
  return result.ok ? result.bytes : null;
}

/**
 * Flush pending edits. Returns false when the write failed, so callers can keep
 * the vault open instead of silently dropping changes.
 */
export async function flushSave(): Promise<boolean> {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  if (!runtime) return true;

  if (useStore.getState().storageMode === 'download') {
    // This mode has no writable copy: the exported file is the save. Only
    // pending edits block leaving, so an exported vault can lock normally.
    if (!useStore.getState().hasUnsavedChanges) return true;
    toast.error('Export a .keya file to save changes before leaving.');
    return false;
  }

  const result = await runtime.vault.flush();
  if (!result.ok) {
    useStore.setState({ hasUnsavedChanges: true });
    return false;
  }

  useStore.setState({ hasUnsavedChanges: false });
  await useStore.getState().refresh();
  return true;
}

export { SHORTCUT_DEFINITIONS };
export type { ShortcutMap };
