import { create } from 'zustand';
import type { Database } from '../../core/database';
import type { ApiKey, Group, InboxItem } from '../../core/types';
import { ApiTester } from '../lib/api-tester';
import { toConnectionCheck } from '../lib/test-feedback';
import {
  tryDetectClipboardKey,
  type AddKeyDraft,
  type ClipboardKeyCandidate,
} from '../lib/clipboard-intake';
import { FileStorage } from '../lib/storage';
import { collectAllAlerts, syncInboxWithAlerts } from '../../core/inbox';
import { toast } from 'sonner';

type WorkspaceState = 'welcome' | 'unlocked';
export type VaultStorageMode = 'folder' | 'download';

interface AppState {
  // Workspace
  workspaceState: WorkspaceState;
  db: Database | null;
  password: string | null;
  activeVaultFileName: string | null;
  storageMode: VaultStorageMode;
  hasUnsavedChanges: boolean;

  // UI
  searchQuery: string;
  showAddForm: boolean;
  addKeyDraft: AddKeyDraft | null;
  clipboardCandidate: ClipboardKeyCandidate | null;
  theme: 'dark' | 'light' | 'system';
  keyboardShortcuts: Record<string, string>;
  biometricPrompt: { vaultId: string; password: string } | null;

  // Smart filters
  filterGroupId: string | null;
  filterProvider: string | null;
  filterTestStatus: string | null;
  filterExpiryStatus: string | null;

  // Selection
  selectedKeyId: string | null;
  inboxVersion: number;
  lastInboxSyncAt: string | null;
  lastInboxSyncResult: {
    added: number;
    updated: number;
    archived: number;
  } | null;

  // Actions - Workspace
  setDb: (db: Database) => void;
  lock: () => void;
  unlock: (
    db: Database,
    password: string,
    fileName: string,
    storageMode?: VaultStorageMode
  ) => Promise<void>;
  markExported: () => void;
  setTheme: (theme: 'dark' | 'light' | 'system') => void;
  updateKeyboardShortcuts: (shortcuts: Record<string, string>) => void;

  // Actions - Keys
  addKey: (
    key: Omit<ApiKey, 'id' | 'created_at' | 'updated_at'>
  ) => ApiKey | undefined;
  updateKey: (id: string, updates: Partial<ApiKey>) => void;
  deleteKey: (id: string) => void;

  // Actions - UI
  setSearchQuery: (q: string) => void;
  setShowAddForm: (show: boolean) => void;
  beginAddKeyFlow: () => Promise<void>;
  confirmClipboardCandidate: () => void;
  skipClipboardCandidate: () => void;
  dismissClipboardCandidate: () => void;
  clearAddKeyDraft: () => void;
  setBiometricPrompt: (
    prompt: { vaultId: string; password: string } | null
  ) => void;
  setFilterGroupId: (id: string | null) => void;
  setFilterProvider: (p: string | null) => void;
  setFilterTestStatus: (s: string | null) => void;
  setFilterExpiryStatus: (s: string | null) => void;
  clearFilters: () => void;
  clearSmartFilters: () => void;
  setSelectedKeyId: (id: string | null) => void;

  // Actions - Groups
  addGroup: (group: Omit<Group, 'id'>) => void;
  updateGroup: (id: string, updates: Partial<Group>) => void;
  deleteGroup: (id: string) => void;

  // Actions - Settings
  updateSettings: (updates: Record<string, unknown>) => void;
  changePassword: (oldPassword: string, newPassword: string) => Promise<void>;
  runInboxChecks: () => { added: number; updated: number; archived: number };
  archiveInboxItem: (id: string) => InboxItem | null;

  // Actions - Vault Meta
  updateMeta: (updates: Partial<{ name: string; icon: string }>) => void;
}

// ── Save debouncer ──

let saveTimer: ReturnType<typeof setTimeout> | null = null;
const DAILY_AUTO_TEST_PREFIX = 'keya-daily-auto-test:';
const DAILY_AUTO_TEST_CONCURRENCY = 3;

let dirty = false;
let saveQueue: Promise<void> = Promise.resolve();

function enqueueSave(task: () => Promise<void>): Promise<void> {
  const next = saveQueue.then(task);
  saveQueue = next.catch(() => {});
  return next;
}

export function flushSave(): Promise<void> {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = null;
  return enqueueSave(async () => {
    if (!dirty) return;
    const { db, password, activeVaultFileName, storageMode } =
      useStore.getState();

    // Without an active vault there is nothing to persist. Clear the flag so
    // a stale async result cannot leave the next unlock in a dirty loop.
    if (!db || !password || !activeVaultFileName) {
      dirty = false;
      useStore.setState({ hasUnsavedChanges: false });
      return;
    }

    if (storageMode === 'download') {
      throw new Error(
        'Download mode: export a .keya file to save changes before locking or switching vaults.'
      );
    }

    const snapshot = structuredClone(db.getData());
    dirty = false;
    try {
      await FileStorage.saveVault(activeVaultFileName, snapshot, password);
      try {
        await FileStorage.cacheVaultMeta(activeVaultFileName, db);
      } catch (error) {
        // Cached summaries are optional; the vault file is already saved.
        console.warn('Failed to update cached vault metadata:', error);
      }
      if (!dirty) useStore.setState({ hasUnsavedChanges: false });
    } catch (error) {
      dirty = true;
      useStore.setState({ hasUnsavedChanges: true });
      throw error;
    }
  });
}

async function flushUntilClean(): Promise<void> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await flushSave();
    if (!dirty) return;
  }
  throw new Error('Vault is still changing. Retry saving before continuing.');
}

function scheduleSave() {
  const { db, password, activeVaultFileName, storageMode } =
    useStore.getState();
  if (!db || !password || !activeVaultFileName) return;

  dirty = true;
  useStore.setState({ hasUnsavedChanges: true });

  // Download mode has no safe automatic destination. Keep changes in memory
  // and require an explicit encrypted export instead of downloading per edit.
  if (storageMode === 'download') return;

  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    void flushSave().catch(() => {
      toast.error(
        'Vault was not saved. Keep this page open and export your changes.'
      );
    });
  }, 500);
}

function inboxSummaryChanged(summary: {
  added: unknown[];
  updated: unknown[];
  archived: unknown[];
}): boolean {
  return (
    summary.added.length > 0 ||
    summary.updated.length > 0 ||
    summary.archived.length > 0
  );
}

function runInboxChecksForDatabase(db: Database) {
  const alerts = collectAllAlerts(db.getApiKeys(), db.getData().vault_id);
  const summary = syncInboxWithAlerts(db.getData(), alerts);

  if (
    summary.added.length > 0 ||
    summary.updated.length > 0 ||
    summary.archived.length > 0
  ) {
    db.updateMeta({});
  }

  return summary;
}

function getLocalDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  task: (item: T) => Promise<void>
): Promise<void> {
  let nextIndex = 0;
  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (nextIndex < items.length) {
        const item = items[nextIndex++];
        await task(item);
      }
    }
  );
  await Promise.all(workers);
}

function maybeRunDailyAutoTest(db: Database) {
  const settings = db.getSettings();
  if (!settings.auto_test_daily) return;

  const vaultId = db.getData().vault_id;
  const storageKey = `${DAILY_AUTO_TEST_PREFIX}${vaultId}`;
  const today = getLocalDateKey();
  if (localStorage.getItem(storageKey) === today) return;

  // Mark the attempt first so reloads do not repeatedly hit provider APIs.
  localStorage.setItem(storageKey, today);
  const keys = [...db.getApiKeys()];
  if (keys.length === 0) return;

  runWithConcurrency(keys, DAILY_AUTO_TEST_CONCURRENCY, async (key) => {
    if (useStore.getState().db !== db) return;
    const result = await ApiTester.testKey(key, settings);
    if (useStore.getState().db !== db) return;
    useStore.getState().updateKey(key.id, {
      connection_check: toConnectionCheck(result),
    });
  }).catch((e) => {
    console.error('Daily auto-test failed:', e);
  });
}

// ── Store ──

const FILTER_DEFAULTS = {
  filterGroupId: null as string | null,
  filterProvider: null as string | null,
  filterTestStatus: null as string | null,
  filterExpiryStatus: null as string | null,
};

export const useStore = create<AppState>((set, get) => {
  return {
    workspaceState: 'welcome',
    db: null,
    password: null,
    activeVaultFileName: null,
    storageMode: 'folder',
    hasUnsavedChanges: false,
    searchQuery: '',
    showAddForm: false,
    addKeyDraft: null,
    clipboardCandidate: null,
    biometricPrompt: null,
    theme:
      (localStorage.getItem('keya-theme') as 'dark' | 'light' | 'system') ||
      'system',
    keyboardShortcuts: (() => {
      try {
        return JSON.parse(localStorage.getItem('keya-shortcuts') || '{}');
      } catch {
        return {};
      }
    })(),
    ...FILTER_DEFAULTS,
    selectedKeyId: null,
    inboxVersion: 0,
    lastInboxSyncAt: null,
    lastInboxSyncResult: null,

    setDb: (db) => {
      set({ db });
      scheduleSave();
    },
    setTheme: (theme) => {
      localStorage.setItem('keya-theme', theme);
      set({ theme });
    },
    updateKeyboardShortcuts: (shortcuts) => {
      localStorage.setItem('keya-shortcuts', JSON.stringify(shortcuts));
      set({ keyboardShortcuts: shortcuts });
    },

    lock: () => {
      void (async () => {
        try {
          await flushUntilClean();
        } catch (error) {
          toast.error(
            error instanceof Error
              ? error.message
              : 'Cannot lock: unsaved changes. Export your vault or retry saving.'
          );
          return;
        }
        set({
          workspaceState: 'welcome',
          db: null,
          password: null,
          activeVaultFileName: null,
          storageMode: 'folder',
          hasUnsavedChanges: false,
          searchQuery: '',
          showAddForm: false,
          addKeyDraft: null,
          clipboardCandidate: null,
          ...FILTER_DEFAULTS,
          selectedKeyId: null,
          biometricPrompt: null,
        });
      })();
    },

    unlock: async (db, password, fileName, storageMode = 'folder') => {
      await flushUntilClean();
      const inboxSummary = runInboxChecksForDatabase(db);
      set((state) => ({
        workspaceState: 'unlocked',
        db,
        password,
        activeVaultFileName: fileName,
        storageMode,
        hasUnsavedChanges: false,
        inboxVersion: inboxSummaryChanged(inboxSummary)
          ? state.inboxVersion + 1
          : state.inboxVersion,
        lastInboxSyncAt: new Date().toISOString(),
        lastInboxSyncResult: {
          added: inboxSummary.added.length,
          updated: inboxSummary.updated.length,
          archived: inboxSummary.archived.length,
        },
      }));
      if (inboxSummaryChanged(inboxSummary)) {
        scheduleSave();
      }
      maybeRunDailyAutoTest(db);
    },

    markExported: () => {
      if (get().storageMode !== 'download') return;
      dirty = false;
      set({ hasUnsavedChanges: false });
    },

    addKey: (key) => {
      const created = get().db?.addApiKey(key);
      const summary = get().db ? runInboxChecksForDatabase(get().db!) : null;
      set((state) => ({
        showAddForm: false,
        addKeyDraft: null,
        inboxVersion:
          summary && inboxSummaryChanged(summary)
            ? state.inboxVersion + 1
            : state.inboxVersion,
      }));
      scheduleSave();
      return created;
    },

    updateKey: (id, updates) => {
      get().db?.updateApiKey(id, updates);
      const summary = get().db ? runInboxChecksForDatabase(get().db!) : null;
      set((state) => ({
        lastInboxSyncAt: new Date().toISOString(),
        lastInboxSyncResult: null,
        inboxVersion:
          summary && inboxSummaryChanged(summary)
            ? state.inboxVersion + 1
            : state.inboxVersion,
      }));
      scheduleSave();
    },

    deleteKey: (id) => {
      get().db?.deleteApiKey(id);
      const summary = get().db ? runInboxChecksForDatabase(get().db!) : null;
      set((state) => ({
        lastInboxSyncAt: new Date().toISOString(),
        lastInboxSyncResult: null,
        inboxVersion:
          summary && inboxSummaryChanged(summary)
            ? state.inboxVersion + 1
            : state.inboxVersion,
      }));
      scheduleSave();
    },

    setSearchQuery: (q) => set({ searchQuery: q }),
    setShowAddForm: (show) => set({ showAddForm: show }),
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
          ?.getApiKeys()
          .some((existingKey) => existingKey.key === candidate.raw)
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
    dismissClipboardCandidate: () => set({ clipboardCandidate: null }),
    clearAddKeyDraft: () => set({ addKeyDraft: null }),
    setBiometricPrompt: (prompt) => set({ biometricPrompt: prompt }),
    setFilterGroupId: (id) => set({ filterGroupId: id }),
    setFilterProvider: (p) => set({ filterProvider: p }),
    setFilterTestStatus: (s) => set({ filterTestStatus: s }),
    setFilterExpiryStatus: (s) => set({ filterExpiryStatus: s }),
    clearFilters: () => set(FILTER_DEFAULTS),
    clearSmartFilters: () =>
      set({
        filterProvider: null,
        filterTestStatus: null,
        filterExpiryStatus: null,
      }),
    setSelectedKeyId: (id) => set({ selectedKeyId: id }),

    addGroup: (group) => {
      get().db?.addGroup(group);
      set({});
      scheduleSave();
    },

    updateGroup: (id, updates) => {
      get().db?.updateGroup(id, updates);
      set({});
      scheduleSave();
    },

    deleteGroup: (id) => {
      get().db?.deleteGroup(id);
      set({});
      scheduleSave();
    },

    updateSettings: (updates) => {
      get().db?.updateSettings(updates);
      set({});
      scheduleSave();
    },

    changePassword: async (oldPassword, newPassword) => {
      const { db, password, activeVaultFileName } = get();
      if (!db || !password || !activeVaultFileName)
        throw new Error('No vault open');
      if (oldPassword !== password)
        throw new Error('Current password is incorrect');
      await flushUntilClean();
      await enqueueSave(async () => {
        if (get().db !== db)
          throw new Error('Vault changed during password update.');
        await FileStorage.backupVault(activeVaultFileName);
        await FileStorage.saveVault(
          activeVaultFileName,
          db.getData(),
          newPassword
        );
        set({ password: newPassword });
      });
    },

    runInboxChecks: () => {
      const db = get().db;
      if (!db) return { added: 0, updated: 0, archived: 0 };
      const summary = runInboxChecksForDatabase(db);
      set((state) => ({
        lastInboxSyncAt: new Date().toISOString(),
        lastInboxSyncResult: {
          added: summary.added.length,
          updated: summary.updated.length,
          archived: summary.archived.length,
        },
        inboxVersion: inboxSummaryChanged(summary)
          ? state.inboxVersion + 1
          : state.inboxVersion,
      }));
      if (inboxSummaryChanged(summary)) {
        scheduleSave();
      }
      return {
        added: summary.added.length,
        updated: summary.updated.length,
        archived: summary.archived.length,
      };
    },

    archiveInboxItem: (id) => {
      const db = get().db;
      const archived = db?.archiveInboxItem(id) ?? null;
      if (archived) {
        set((s) => ({ inboxVersion: s.inboxVersion + 1 }));
        scheduleSave();
      }
      return archived;
    },

    updateMeta: (updates) => {
      get().db?.updateMeta(updates);
      set({});
      scheduleSave();
    },
  };
});
