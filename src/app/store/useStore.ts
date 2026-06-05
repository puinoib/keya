import { create } from 'zustand';
import type { Database } from '../../core/database';
import type { ApiKey, Group, InboxItem } from '../../core/types';
import { ApiTester } from '../lib/api-tester';
import {
  tryDetectClipboardKey,
  type AddKeyDraft,
  type ClipboardKeyCandidate,
} from '../lib/clipboard-intake';
import { FileStorage } from '../lib/storage';
import { saveSession, clearSession, loadSession } from '../lib/session';
import { collectExpiryAlerts, syncInboxWithAlerts } from '../../core/inbox';
import { toast } from 'sonner';

type WorkspaceState = 'welcome' | 'locked' | 'unlocked';

interface AppState {
  // Workspace
  workspaceState: WorkspaceState;
  db: Database | null;
  password: string | null;
  activeVaultFileName: string | null;

  // UI
  searchQuery: string;
  showAddForm: boolean;
  addKeyDraft: AddKeyDraft | null;
  clipboardCandidate: ClipboardKeyCandidate | null;
  theme: 'dark' | 'light' | 'system';
  biometricPrompt: { vaultId: string; password: string } | null;

  // Smart filters
  filterGroupId: string | null;
  filterProvider: string | null;
  filterTestStatus: string | null;
  filterExpiryStatus: string | null;

  // Selection
  selectedKeyId: string | null;
  lastInboxSyncAt: string | null;
  lastInboxSyncResult: {
    added: number;
    updated: number;
    archived: number;
  } | null;

  // Actions - Workspace
  setWorkspaceState: (state: WorkspaceState) => void;
  setDb: (db: Database) => void;
  setPassword: (pw: string) => void;
  lock: () => void;
  unlock: (db: Database, password: string, fileName: string) => void;
  setTheme: (theme: 'dark' | 'light' | 'system') => void;

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
  runInboxChecks: () => { added: number; updated: number; archived: number };
  archiveInboxItem: (id: string) => InboxItem | null;

  // Actions - Vault Meta
  updateMeta: (updates: Partial<{ name: string; icon: string }>) => void;
}

// ── Save debouncer ──

let saveTimer: ReturnType<typeof setTimeout> | null = null;
const DAILY_AUTO_TEST_PREFIX = 'keya-daily-auto-test:';
const DAILY_AUTO_TEST_CONCURRENCY = 3;

function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    const { db, password, activeVaultFileName } = useStore.getState();
    if (!db || !password || !activeVaultFileName) return;
    try {
      if ('showDirectoryPicker' in window) {
        await FileStorage.saveVault(
          activeVaultFileName,
          db.getData(),
          password
        );
      } else {
        await FileStorage.saveViaDownload(
          db.getData(),
          password,
          activeVaultFileName
        );
      }
      await FileStorage.cacheVaultMeta(activeVaultFileName, db);
    } catch (e) {
      console.error('Auto-save failed:', e);
    }
  }, 500);
}

function runInboxChecksForDatabase(db: Database) {
  const alerts = collectExpiryAlerts(db.getApiKeys(), db.getData().vault_id);
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
    const result = await ApiTester.testKey(key);
    useStore.getState().updateKey(key.id, {
      connection_check: {
        status: result.success ? 'success' : 'failed',
        checked_at: new Date().toISOString(),
        latency_ms: result.latency_ms ?? null,
        error_message: result.success ? null : (result.error ?? null),
      },
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
  // Check for existing session on initialization
  const session = loadSession();
  const initialWorkspaceState = session ? 'locked' : 'welcome';
  const initialFileName = session?.fileName ?? null;

  return {
    workspaceState: initialWorkspaceState,
    db: null,
    password: null,
    activeVaultFileName: initialFileName,
    searchQuery: '',
    showAddForm: false,
    addKeyDraft: null,
    clipboardCandidate: null,
    biometricPrompt: null,
    theme:
      (localStorage.getItem('keya-theme') as 'dark' | 'light' | 'system') ||
      'system',
    ...FILTER_DEFAULTS,
    selectedKeyId: null,
    lastInboxSyncAt: null,
    lastInboxSyncResult: null,

    setWorkspaceState: (state) => set({ workspaceState: state }),
    setDb: (db) => set({ db }),
    setPassword: (pw) => set({ password: pw }),
    setTheme: (theme) => {
      localStorage.setItem('keya-theme', theme);
      set({ theme });
    },

    lock: () => {
      clearSession();
      set({
        workspaceState: 'welcome',
        db: null,
        password: null,
        activeVaultFileName: null,
        searchQuery: '',
        showAddForm: false,
        addKeyDraft: null,
        clipboardCandidate: null,
        ...FILTER_DEFAULTS,
        selectedKeyId: null,
      });
    },

    unlock: (db, password, fileName) => {
      saveSession(fileName, password);
      const inboxSummary = runInboxChecksForDatabase(db);
      set({
        workspaceState: 'unlocked',
        db,
        password,
        activeVaultFileName: fileName,
        lastInboxSyncAt: new Date().toISOString(),
        lastInboxSyncResult: {
          added: inboxSummary.added.length,
          updated: inboxSummary.updated.length,
          archived: inboxSummary.archived.length,
        },
      });
      if (
        inboxSummary.added.length > 0 ||
        inboxSummary.updated.length > 0 ||
        inboxSummary.archived.length > 0
      ) {
        scheduleSave();
      }
      maybeRunDailyAutoTest(db);
    },

    addKey: (key) => {
      const created = get().db?.addApiKey(key);
      if (created && get().db) {
        runInboxChecksForDatabase(get().db!);
      }
      set({ showAddForm: false, addKeyDraft: null });
      scheduleSave();
      return created;
    },

    updateKey: (id, updates) => {
      get().db?.updateApiKey(id, updates);
      if (get().db) {
        runInboxChecksForDatabase(get().db!);
      }
      set({
        lastInboxSyncAt: new Date().toISOString(),
        lastInboxSyncResult: null,
      });
      scheduleSave();
    },

    deleteKey: (id) => {
      get().db?.deleteApiKey(id);
      if (get().db) {
        runInboxChecksForDatabase(get().db!);
      }
      set({
        lastInboxSyncAt: new Date().toISOString(),
        lastInboxSyncResult: null,
      });
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

      const candidate = await tryDetectClipboardKey(settings);
      const db = get().db;
      if (
        candidate &&
        db
          ?.getApiKeys()
          .some((existingKey) => existingKey.key === candidate.raw)
      ) {
        toast('This API key is already saved');
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

    runInboxChecks: () => {
      const db = get().db;
      if (!db) return { added: 0, updated: 0, archived: 0 };
      const summary = runInboxChecksForDatabase(db);
      set({
        lastInboxSyncAt: new Date().toISOString(),
        lastInboxSyncResult: {
          added: summary.added.length,
          updated: summary.updated.length,
          archived: summary.archived.length,
        },
      });
      if (
        summary.added.length > 0 ||
        summary.updated.length > 0 ||
        summary.archived.length > 0
      ) {
        scheduleSave();
      }
      return {
        added: summary.added.length,
        updated: summary.updated.length,
        archived: summary.archived.length,
      };
    },

    archiveInboxItem: (id) => {
      const archived = get().db?.archiveInboxItem(id) ?? null;
      if (archived) {
        set({});
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
