import { create } from 'zustand';
import type { Database } from '../../core/database';
import type { ApiKey, Group } from '../../core/types';
import { FileStorage } from '../lib/storage';
import { saveSession, clearSession, loadSession } from '../lib/session';

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
  theme: 'dark' | 'light' | 'system';
  biometricPrompt: { vaultId: string; password: string } | null;

  // Smart filters
  filterGroupId: string | null;
  filterProvider: string | null;
  filterTestStatus: string | null;

  // Selection
  selectedKeyId: string | null;

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
  setBiometricPrompt: (
    prompt: { vaultId: string; password: string } | null
  ) => void;
  setFilterGroupId: (id: string | null) => void;
  setFilterProvider: (p: string | null) => void;
  setFilterTestStatus: (s: string | null) => void;
  clearFilters: () => void;
  clearSmartFilters: () => void;
  setSelectedKeyId: (id: string | null) => void;

  // Actions - Groups
  addGroup: (group: Omit<Group, 'id'>) => void;
  updateGroup: (id: string, updates: Partial<Group>) => void;
  deleteGroup: (id: string) => void;

  // Actions - Settings
  updateSettings: (updates: Record<string, unknown>) => void;

  // Actions - Vault Meta
  updateMeta: (updates: Partial<{ name: string; icon: string }>) => void;
}

// ── Save debouncer ──

let saveTimer: ReturnType<typeof setTimeout> | null = null;

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

// ── Store ──

const FILTER_DEFAULTS = {
  filterGroupId: null as string | null,
  filterProvider: null as string | null,
  filterTestStatus: null as string | null,
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
    biometricPrompt: null,
    theme:
      (localStorage.getItem('keya-theme') as 'dark' | 'light' | 'system') ||
      'system',
    ...FILTER_DEFAULTS,
    selectedKeyId: null,

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
        ...FILTER_DEFAULTS,
        selectedKeyId: null,
      });
    },

    unlock: (db, password, fileName) => {
      saveSession(fileName, password);
      set({
        workspaceState: 'unlocked',
        db,
        password,
        activeVaultFileName: fileName,
      });
    },

    addKey: (key) => {
      const created = get().db?.addApiKey(key);
      set({ showAddForm: false });
      scheduleSave();
      return created;
    },

    updateKey: (id, updates) => {
      get().db?.updateApiKey(id, updates);
      set({});
      scheduleSave();
    },

    deleteKey: (id) => {
      get().db?.deleteApiKey(id);
      set({});
      scheduleSave();
    },

    setSearchQuery: (q) => set({ searchQuery: q }),
    setShowAddForm: (show) => set({ showAddForm: show }),
    setBiometricPrompt: (prompt) => set({ biometricPrompt: prompt }),
    setFilterGroupId: (id) => set({ filterGroupId: id }),
    setFilterProvider: (p) => set({ filterProvider: p }),
    setFilterTestStatus: (s) => set({ filterTestStatus: s }),
    clearFilters: () => set(FILTER_DEFAULTS),
    clearSmartFilters: () =>
      set({ filterProvider: null, filterTestStatus: null }),
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

    updateMeta: (updates) => {
      get().db?.updateMeta(updates);
      set({});
      scheduleSave();
    },
  };
});
