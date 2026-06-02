import { create } from 'zustand'
import { Database } from '../../core/database'
import type { ApiKey, Category, Tag } from '../../core/types'
import { FileStorage } from '../lib/storage'

type WorkspaceState = 'welcome' | 'locked' | 'unlocked'

interface AppState {
  // Workspace
  workspaceState: WorkspaceState
  db: Database | null
  password: string | null

  // UI
  searchQuery: string
  selectedTagIds: string[]
  showAddForm: boolean
  theme: 'dark' | 'light' | 'system'

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
  toggleTagFilter: (tagId: string) => void
  setShowAddForm: (show: boolean) => void

  // Actions - Categories & Tags
  addCategory: (cat: Omit<Category, 'id'>) => void
  updateCategory: (id: string, updates: Partial<Category>) => void
  deleteCategory: (id: string) => void
  addTag: (tag: Omit<Tag, 'id'>) => void
  deleteTag: (id: string) => void
}

// ── Save debouncer ──

let saveTimer: ReturnType<typeof setTimeout> | null = null

function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(async () => {
    const { db, password } = useStore.getState()
    if (!db || !password) return
    try {
      await FileStorage.save(db.getData(), password)
    } catch (e) {
      console.error('Auto-save failed:', e)
    }
  }, 500)
}

// ── Store ──

export const useStore = create<AppState>((set, get) => ({
  workspaceState: 'welcome',
  db: null,
  password: null,
  searchQuery: '',
  selectedTagIds: [],
  showAddForm: false,
  theme: 'dark',

  setWorkspaceState: (state) => set({ workspaceState: state }),
  setDb: (db) => set({ db }),
  setPassword: (pw) => set({ password: pw }),
  setTheme: (theme) => set({ theme }),

  lock: () =>
    set({
      workspaceState: 'welcome',
      db: null,
      password: null,
      searchQuery: '',
      selectedTagIds: [],
      showAddForm: false,
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

  toggleTagFilter: (tagId) => {
    const current = get().selectedTagIds
    set({
      selectedTagIds: current.includes(tagId)
        ? current.filter((id) => id !== tagId)
        : [...current, tagId],
    })
  },

  setShowAddForm: (show) => set({ showAddForm: show }),

  addCategory: (cat) => {
    get().db?.addCategory(cat)
    set({})
    scheduleSave()
  },

  updateCategory: (id, updates) => {
    get().db?.updateCategory(id, updates)
    set({})
    scheduleSave()
  },

  deleteCategory: (id) => {
    get().db?.deleteCategory(id)
    set({})
    scheduleSave()
  },

  addTag: (tag) => {
    get().db?.addTag(tag)
    set({})
    scheduleSave()
  },

  deleteTag: (id) => {
    get().db?.deleteTag(id)
    set({})
    scheduleSave()
  },
}))
