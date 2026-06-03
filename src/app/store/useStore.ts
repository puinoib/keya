import { create } from 'zustand'
import { Database } from '../../core/database'
import type { ApiKey, Group } from '../../core/types'
import { FileStorage } from '../lib/storage'

type WorkspaceState = 'welcome' | 'locked' | 'unlocked'

interface AppState {
  // Workspace
  workspaceState: WorkspaceState
  db: Database | null
  password: string | null

  // UI
  searchQuery: string
  showAddForm: boolean
  theme: 'dark' | 'light' | 'system'

  // Smart filters
  filterGroupId: string | null
  filterProvider: string | null
  filterStatus: string | null
  filterTestStatus: string | null

  // Actions - Workspace
  setWorkspaceState: (state: WorkspaceState) => void
  setDb: (db: Database) => void
  setPassword: (pw: string) => void
  lock: () => void
  setTheme: (theme: 'dark' | 'light' | 'system') => void

  // Actions - Keys
  addKey: (key: Omit<ApiKey, 'id' | 'created_at' | 'updated_at'>) => void
  updateKey: (id: string, updates: Partial<ApiKey>) => void
  deleteKey: (id: string) => void

  // Actions - UI
  setSearchQuery: (q: string) => void
  setShowAddForm: (show: boolean) => void
  setFilterGroupId: (id: string | null) => void
  setFilterProvider: (p: string | null) => void
  setFilterStatus: (s: string | null) => void
  setFilterTestStatus: (s: string | null) => void
  clearFilters: () => void

  // Actions - Groups
  addGroup: (group: Omit<Group, 'id'>) => void
  updateGroup: (id: string, updates: Partial<Group>) => void
  deleteGroup: (id: string) => void
}

// ── Save debouncer ──

let saveTimer: ReturnType<typeof setTimeout> | null = null

function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(async () => {
    const { db, password } = useStore.getState()
    if (!db || !password) return
    try {
      if ("showDirectoryPicker" in window) {
        await FileStorage.save(db.getData(), password)
      } else {
        await FileStorage.saveViaDownload(db.getData(), password)
      }
    } catch (e) {
      console.error('Auto-save failed:', e)
    }
  }, 500)
}

// ── Store ──

const FILTER_DEFAULTS = {
  filterGroupId: null as string | null,
  filterProvider: null as string | null,
  filterStatus: null as string | null,
  filterTestStatus: null as string | null,
}

export const useStore = create<AppState>((set, get) => ({
  workspaceState: 'welcome',
  db: null,
  password: null,
  searchQuery: '',
  showAddForm: false,
  theme: (localStorage.getItem('keya-theme') as 'dark' | 'light' | 'system') || 'system',
  ...FILTER_DEFAULTS,

  setWorkspaceState: (state) => set({ workspaceState: state }),
  setDb: (db) => set({ db }),
  setPassword: (pw) => set({ password: pw }),
  setTheme: (theme) => {
    localStorage.setItem('keya-theme', theme)
    set({ theme })
  },

  lock: () =>
    set({
      workspaceState: 'welcome',
      db: null,
      password: null,
      searchQuery: '',
      showAddForm: false,
      ...FILTER_DEFAULTS,
    }),

  addKey: (key) => {
    get().db?.addApiKey(key)
    set({ showAddForm: false })
    scheduleSave()
  },

  updateKey: (id, updates) => {
    get().db?.updateApiKey(id, updates)
    set({})
    scheduleSave()
  },

  deleteKey: (id) => {
    get().db?.deleteApiKey(id)
    set({})
    scheduleSave()
  },

  setSearchQuery: (q) => set({ searchQuery: q }),
  setShowAddForm: (show) => set({ showAddForm: show }),
  setFilterGroupId: (id) => set({ filterGroupId: id }),
  setFilterProvider: (p) => set({ filterProvider: p }),
  setFilterStatus: (s) => set({ filterStatus: s }),
  setFilterTestStatus: (s) => set({ filterTestStatus: s }),
  clearFilters: () => set(FILTER_DEFAULTS),

  addGroup: (group) => {
    get().db?.addGroup(group)
    set({})
    scheduleSave()
  },

  updateGroup: (id, updates) => {
    get().db?.updateGroup(id, updates)
    set({})
    scheduleSave()
  },

  deleteGroup: (id) => {
    get().db?.deleteGroup(id)
    set({})
    scheduleSave()
  },
}))
