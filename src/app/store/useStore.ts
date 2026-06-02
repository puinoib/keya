import { create } from 'zustand'
import { Database, createEmptyDatabase } from '../../core/database'
import type { ApiKey, Category, Tag } from '../../core/types'

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
  },

  updateKey: (id, updates) => {
    get().db?.updateApiKey(id, updates)
    set({})
  },

  deleteKey: (id) => {
    get().db?.deleteApiKey(id)
    set({})
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
  },

  updateCategory: (id, updates) => {
    get().db?.updateCategory(id, updates)
    set({})
  },

  deleteCategory: (id) => {
    get().db?.deleteCategory(id)
    set({})
  },

  addTag: (tag) => {
    get().db?.addTag(tag)
    set({})
  },

  deleteTag: (id) => {
    get().db?.deleteTag(id)
    set({})
  },
}))
