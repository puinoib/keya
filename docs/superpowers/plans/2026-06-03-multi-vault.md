# Multi-Vault Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Support multiple `.keya` vault files in a single sync folder, with per-vault passwords, vault metadata, and vault switching from the sidebar.

**Architecture:** The core `KeyaDatabase` type gains metadata fields (`vault_id`, `name`, `description`, `icon`, `color`). The storage layer switches from single-file to multi-file operations (list/open/create/save by filename). IndexedDB caches non-sensitive vault metadata for display on the welcome page before decryption. A new vault switcher in the sidebar enables switching between vaults with a password prompt.

**Tech Stack:** React, Zustand, TypeScript, File System Access API, IndexedDB, Vitest, libsodium

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `src/core/types.ts` | Add vault metadata fields to `KeyaDatabase`, rename `file_id` → `vault_id` |
| Modify | `src/core/database.ts` | Update `createEmptyDatabase()` to set defaults for new fields |
| Modify | `src/core/schema.ts` | Backward-compatible `file_id`/`vault_id` read, update `serializeToFile` |
| Modify | `src/app/lib/storage.ts` | Multi-vault storage methods, remove `fileName` from `WorkspaceEntry`, upgrade IndexedDB schema |
| Modify | `src/app/store/useStore.ts` | Add `activeVaultFileName`, update save/lock logic |
| Modify | `src/app/components/welcome/WelcomePage.tsx` | Vault list UI, multi-vault unlock/create flow |
| Modify | `src/app/components/layout/Sidebar.tsx` | Integrate vault switcher |
| Modify | `src/app/components/layout/AppLayout.tsx` | Wire vault switcher state |
| Create | `src/app/components/vault/VaultCard.tsx` | Single vault card for welcome page |
| Create | `src/app/components/vault/VaultSwitcher.tsx` | Sidebar dropdown for vault switching |
| Create | `src/app/components/vault/VaultPasswordDialog.tsx` | Reusable password input dialog |
| Modify | `src/core/__tests__/database.test.ts` | Update tests for new fields |
| Modify | `src/core/__tests__/schema.test.ts` | Test backward-compatible deserialization |

---

### Task 1: Update core types — rename `file_id` to `vault_id` and add metadata fields

**Files:**
- Modify: `src/core/types.ts:36-44`
- Modify: `src/core/__tests__/database.test.ts`

- [ ] **Step 1: Update `KeyaDatabase` interface in `src/core/types.ts`**

Replace the interface at lines 36–44:

```typescript
export interface KeyaDatabase {
  version: '1.0';
  vault_id: string;
  created_at: string;
  updated_at: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  api_keys: ApiKey[];
  groups: Group[];
  settings: Settings;
}
```

- [ ] **Step 2: Run type check to see all breakages**

Run: `npx tsc --noEmit 2>&1 | head -40`

Expected: Errors in `database.ts`, `schema.ts`, `storage.ts`, test files — all referencing `file_id`.

- [ ] **Step 3: Commit**

```bash
git add src/core/types.ts
git commit -m "feat: rename file_id to vault_id and add vault metadata fields"
```

---

### Task 2: Update `Database` class and `createEmptyDatabase` for new fields

**Files:**
- Modify: `src/core/database.ts`
- Modify: `src/core/__tests__/database.test.ts`

- [ ] **Step 1: Update `createEmptyDatabase()` in `src/core/database.ts`**

Replace the function at lines 4–19:

```typescript
export function createEmptyDatabase(name?: string): KeyaDatabase {
  const now = new Date().toISOString();
  return {
    version: '1.0',
    vault_id: crypto.randomUUID(),
    created_at: now,
    updated_at: now,
    name: name ?? '',
    description: '',
    icon: '🔐',
    color: '#3b82f6',
    api_keys: [],
    groups: DEFAULT_GROUPS.map((g, i) => ({
      ...g,
      id: crypto.randomUUID(),
      order: i + 1,
    })),
    settings: { ...DEFAULT_SETTINGS },
  };
}
```

- [ ] **Step 2: Update database tests in `src/core/__tests__/database.test.ts`**

In the "creates empty database with defaults" test, change `file_id` to `vault_id`:

```typescript
  it('creates empty database with defaults', () => {
    const db = new Database()
    const data = db.getData()
    expect(data.version).toBe('1.0')
    expect(data.vault_id).toBeTruthy()
    expect(data.name).toBe('')
    expect(data.icon).toBe('🔐')
    expect(data.color).toBe('#3b82f6')
    expect(data.api_keys).toEqual([])
    expect(data.groups.length).toBeGreaterThanOrEqual(3)
    expect(data.settings.theme).toBe('system')
  })
```

In "accepts existing data" test:

```typescript
  it('accepts existing data', () => {
    const existing = createEmptyDatabase()
    const db = new Database(existing)
    expect(db.getData().vault_id).toBe(existing.vault_id)
  })
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run src/core/__tests__/database.test.ts`

Expected: All database tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/core/database.ts src/core/__tests__/database.test.ts
git commit -m "feat: update Database class with vault metadata defaults"
```

---

### Task 3: Update schema.ts for backward compatibility

**Files:**
- Modify: `src/core/schema.ts:181-253`
- Modify: `src/core/__tests__/schema.test.ts`

- [ ] **Step 1: Update `serializeToFile` to use `vault_id` in `src/core/schema.ts`**

At line 190, change `db.file_id` to `db.vault_id`:

```typescript
  const header = createHeader(db.vault_id, new Date(db.created_at));
```

- [ ] **Step 2: Add backward-compatible read in `deserializeFromFile` in `src/core/schema.ts`**

After line 247 (`const db = JSON.parse(json) as KeyaDatabase;`), add migration:

```typescript
  const db = JSON.parse(json) as KeyaDatabase;

  // Backward compatibility: migrate file_id → vault_id
  if (!db.vault_id && (db as any).file_id) {
    db.vault_id = (db as any).file_id;
    delete (db as any).file_id;
  }

  // Default vault metadata for old files without these fields
  if (!db.name) db.name = '';
  if (!db.description) db.description = '';
  if (!db.icon) db.icon = '🔐';
  if (!db.color) db.color = '#3b82f6';
```

- [ ] **Step 3: Update schema tests in `src/core/__tests__/schema.test.ts`**

Change `restored.file_id` to `restored.vault_id` in the round-trip test at line 55:

```typescript
    expect(restored.vault_id).toBe(db.vault_id)
```

Add a new test for backward compatibility after the existing tests:

```typescript
  it('reads old files with file_id instead of vault_id', async () => {
    const db = makeTestDb()
    // Simulate old format by using file_id key
    const oldFormat = { ...db, file_id: db.vault_id } as any
    delete oldFormat.vault_id
    const bytes = await serializeToFile(oldFormat as KeyaDatabase, password)
    const restored = await deserializeFromFile(bytes, password)
    expect(restored.vault_id).toBe(db.vault_id)
    expect(restored.name).toBe('')
    expect(restored.icon).toBe('🔐')
  })
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/core/__tests__/schema.test.ts`

Expected: All schema tests pass, including the new backward-compat test.

- [ ] **Step 5: Commit**

```bash
git add src/core/schema.ts src/core/__tests__/schema.test.ts
git commit -m "feat: backward-compatible file_id → vault_id migration in schema"
```

---

### Task 4: Overhaul storage layer for multi-vault

**Files:**
- Modify: `src/app/lib/storage.ts`

This is the largest task. The entire `storage.ts` is rewritten to support multiple vaults.

- [ ] **Step 1: Rewrite `src/app/lib/storage.ts`**

Replace the entire file with:

```typescript
/**
 * Storage layer — File System Access API
 *
 * Manages the user's sync folder and multiple .keya vault files.
 * IndexedDB stores: workspace folder reference + cached vault metadata.
 */

import { serializeToFile, deserializeFromFile, type KeyaDatabase, Database } from '../../core';

const DB_NAME = 'keya-meta';
const DB_VERSION = 2;
const WORKSPACE_STORE = 'workspace';
const VAULT_META_STORE = 'vault-meta';

// ── Types ──

interface WorkspaceEntry {
  id: 'main';
  directoryHandle: FileSystemDirectoryHandle;
}

export interface CachedVaultMeta {
  vault_id: string;
  fileName: string;
  name: string;
  icon: string;
  color: string;
  keyCount: number;
  updatedAt: string;
}

// ── IndexedDB helpers ──

function openMetaDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(WORKSPACE_STORE)) {
        db.createObjectStore(WORKSPACE_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(VAULT_META_STORE)) {
        db.createObjectStore(VAULT_META_STORE, { keyPath: 'vault_id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getWorkspace(): Promise<WorkspaceEntry | null> {
  const db = await openMetaDB();
  return new Promise((resolve) => {
    const tx = db.transaction(WORKSPACE_STORE, 'readonly');
    const req = tx.objectStore(WORKSPACE_STORE).get('main');
    req.onsuccess = () => {
      const result = req.result ?? null;
      // Gracefully handle old entries that have fileName
      resolve(result);
    };
    req.onerror = () => resolve(null);
  });
}

async function saveWorkspace(entry: WorkspaceEntry): Promise<void> {
  const db = await openMetaDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(WORKSPACE_STORE, 'readwrite');
    tx.objectStore(WORKSPACE_STORE).put(entry);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getAllCachedMetas(): Promise<CachedVaultMeta[]> {
  const db = await openMetaDB();
  return new Promise((resolve) => {
    const tx = db.transaction(VAULT_META_STORE, 'readonly');
    const req = tx.objectStore(VAULT_META_STORE).getAll();
    req.onsuccess = () => resolve(req.result ?? []);
    req.onerror = () => resolve([]);
  });
}

async function putCachedMeta(meta: CachedVaultMeta): Promise<void> {
  const db = await openMetaDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(VAULT_META_STORE, 'readwrite');
    tx.objectStore(VAULT_META_STORE).put(meta);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function deleteCachedMeta(vaultId: string): Promise<void> {
  const db = await openMetaDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(VAULT_META_STORE, 'readwrite');
    tx.objectStore(VAULT_META_STORE).delete(vaultId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ── Helpers ──

async function ensurePermission(dirHandle: FileSystemDirectoryHandle): Promise<boolean> {
  const perm = await dirHandle.queryPermission({ mode: 'readwrite' });
  if (perm === 'granted') return true;
  const req = await dirHandle.requestPermission({ mode: 'readwrite' });
  return req === 'granted';
}

function fileNameToStem(fileName: string): string {
  return fileName.replace(/\.keya$/, '');
}

// ── FileStorage ──

export class FileStorage {
  /**
   * Pick a sync folder and save workspace reference.
   */
  static async setupWorkspace(): Promise<FileSystemDirectoryHandle> {
    const dirHandle = await window.showDirectoryPicker({
      mode: 'readwrite',
      startIn: 'documents',
    });
    await saveWorkspace({ id: 'main', directoryHandle: dirHandle });
    return dirHandle;
  }

  /**
   * List all .keya filenames in the workspace folder, sorted alphabetically.
   */
  static async listVaultFiles(): Promise<string[]> {
    const ws = await getWorkspace();
    if (!ws) return [];
    if (!(await ensurePermission(ws.directoryHandle))) return [];

    const files: string[] = [];
    for await (const [name] of (ws.directoryHandle as any).entries()) {
      if (name.endsWith('.keya')) files.push(name);
    }
    return files.sort();
  }

  /**
   * Open and decrypt a specific vault file.
   */
  static async openVault(fileName: string, password: string): Promise<Database> {
    const ws = await getWorkspace();
    if (!ws) throw new Error('No workspace configured');

    const fileHandle = await ws.directoryHandle.getFileHandle(fileName);
    const file = await fileHandle.getFile();
    const buffer = await file.arrayBuffer();
    const data = await deserializeFromFile(new Uint8Array(buffer), password);

    // Migrate old data (file_id → vault_id, add missing fields)
    const db = new Database(data);

    // Cache metadata
    await FileStorage.cacheVaultMeta(fileName, db);

    return db;
  }

  /**
   * Create a new vault file in the workspace folder.
   */
  static async createVault(
    fileName: string,
    password: string,
    meta?: { name?: string; icon?: string; color?: string },
  ): Promise<Database> {
    const ws = await getWorkspace();
    if (!ws) throw new Error('No workspace configured');

    const displayName = meta?.name || fileNameToStem(fileName);
    const db = new Database(
      undefined,
      { name: displayName, icon: meta?.icon ?? '🔐', color: meta?.color ?? '#3b82f6' },
    );

    await FileStorage.saveVault(fileName, db.getData(), password);
    await FileStorage.cacheVaultMeta(fileName, db);
    return db;
  }

  /**
   * Encrypt and save to a specific vault file.
   */
  static async saveVault(fileName: string, db: KeyaDatabase, password: string): Promise<void> {
    const ws = await getWorkspace();
    if (!ws) throw new Error('No workspace configured');

    await ensurePermission(ws.directoryHandle);
    const bytes = await serializeToFile(db, password);
    const fileHandle = await ws.directoryHandle.getFileHandle(fileName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(bytes);
    await writable.close();
  }

  /**
   * Cache vault metadata to IndexedDB for display without decryption.
   */
  static async cacheVaultMeta(fileName: string, db: Database): Promise<void> {
    const data = db.getData();
    await putCachedMeta({
      vault_id: data.vault_id,
      fileName,
      name: data.name || fileNameToStem(fileName),
      icon: data.icon,
      color: data.color,
      keyCount: data.api_keys.length,
      updatedAt: data.updated_at,
    });
  }

  /**
   * Get all cached vault metadata (for welcome page display).
   */
  static async getCachedVaultMetas(): Promise<CachedVaultMeta[]> {
    return getAllCachedMetas();
  }

  /**
   * Remove cached metadata for a vault.
   */
  static async deleteVaultMeta(vaultId: string): Promise<void> {
    await deleteCachedMeta(vaultId);
  }

  /**
   * Clear workspace reference (for switching folders).
   */
  static async clearWorkspace(): Promise<void> {
    const db = await openMetaDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(WORKSPACE_STORE, 'readwrite');
      tx.objectStore(WORKSPACE_STORE).delete('main');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  static async hasWorkspace(): Promise<boolean> {
    const ws = await getWorkspace();
    return ws !== null;
  }

  static async getWorkspaceName(): Promise<string | null> {
    const ws = await getWorkspace();
    return ws?.directoryHandle?.name ?? null;
  }

  /**
   * Legacy save via download (for browsers without File System Access API).
   */
  static async saveViaDownload(db: KeyaDatabase, password: string, fileName = 'my-keys.keya'): Promise<void> {
    const bytes = await serializeToFile(db, password);
    const blob = new Blob([bytes], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}
```

- [ ] **Step 2: Update `Database` constructor to accept optional initial metadata**

In `src/core/database.ts`, update the constructor:

```typescript
  constructor(data?: KeyaDatabase, meta?: { name?: string; icon?: string; color?: string }) {
    this.data = data ?? createEmptyDatabase(meta?.name);
  }
```

- [ ] **Step 3: Run type check**

Run: `npx tsc --noEmit 2>&1 | head -30`

Expected: Errors only in `WelcomePage.tsx`, `useStore.ts`, `KeysPage.tsx` (the files that call old `FileStorage` methods). Zero errors in `storage.ts` and `database.ts`.

- [ ] **Step 4: Commit**

```bash
git add src/app/lib/storage.ts src/core/database.ts
git commit -m "feat: multi-vault storage layer with IndexedDB metadata cache"
```

---

### Task 5: Update store for multi-vault

**Files:**
- Modify: `src/app/store/useStore.ts`

- [ ] **Step 1: Add `activeVaultFileName` and update save/lock logic in `src/app/store/useStore.ts`**

Add `activeVaultFileName` to `AppState` interface (after `password: string | null`):

```typescript
  activeVaultFileName: string | null
```

Add to initial state (after `password: null,`):

```typescript
  activeVaultFileName: null,
```

Update `lock` action to clear `activeVaultFileName`:

```typescript
  lock: () =>
    set({
      workspaceState: 'welcome',
      db: null,
      password: null,
      activeVaultFileName: null,
      searchQuery: '',
      showAddForm: false,
      ...FILTER_DEFAULTS,
    }),
```

Update `scheduleSave` function to use `saveVault`:

```typescript
function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(async () => {
    const { db, password, activeVaultFileName } = useStore.getState()
    if (!db || !password || !activeVaultFileName) return
    try {
      if ("showDirectoryPicker" in window) {
        await FileStorage.saveVault(activeVaultFileName, db.getData(), password)
      } else {
        await FileStorage.saveViaDownload(db.getData(), password, activeVaultFileName)
      }
    } catch (e) {
      console.error('Auto-save failed:', e)
    }
  }, 500)
}
```

- [ ] **Step 2: Run type check**

Run: `npx tsc --noEmit 2>&1 | head -20`

Expected: Fewer errors now. Remaining errors are in UI components only.

- [ ] **Step 3: Commit**

```bash
git add src/app/store/useStore.ts
git commit -m "feat: add activeVaultFileName to store and update save logic"
```

---

### Task 6: Create VaultCard component

**Files:**
- Create: `src/app/components/vault/VaultCard.tsx`

- [ ] **Step 1: Create the component**

```bash
mkdir -p src/app/components/vault
```

```typescript
// src/app/components/vault/VaultCard.tsx
import type { CachedVaultMeta } from '../../lib/storage'

interface VaultCardProps {
  fileName: string
  meta?: CachedVaultMeta
  onClick: () => void
}

export function VaultCard({ fileName, meta, onClick }: VaultCardProps) {
  const displayName = meta?.name || fileName.replace(/\.keya$/, '')

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md bg-surface-2 border border-line hover:bg-surface-3 hover:border-line-subtle transition-colors text-left"
    >
      <div
        className="flex items-center justify-center size-8 rounded-lg text-sm shrink-0"
        style={{ backgroundColor: `${meta?.color ?? '#3b82f6'}20`, color: meta?.color ?? '#3b82f6' }}
      >
        {meta?.icon ?? '🔐'}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-ink-primary truncate">{displayName}</p>
        <p className="text-2xs text-ink-quaternary">
          {meta
            ? `${meta.keyCount} keys · Updated ${new Date(meta.updatedAt).toLocaleDateString()}`
            : fileName}
        </p>
      </div>
    </button>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/components/vault/VaultCard.tsx
git commit -m "feat: add VaultCard component for welcome page"
```

---

### Task 7: Create VaultPasswordDialog component

**Files:**
- Create: `src/app/components/vault/VaultPasswordDialog.tsx`

- [ ] **Step 1: Create the component**

```typescript
// src/app/components/vault/VaultPasswordDialog.tsx
import { useState } from 'react'
import { Loader2, ArrowRight } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface VaultPasswordDialogProps {
  mode: 'unlock' | 'new'
  vaultName: string
  onSubmit: (password: string) => Promise<void>
  onCancel: () => void
}

export function VaultPasswordDialog({ mode, vaultName, onSubmit, onCancel }: VaultPasswordDialogProps) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const isCreate = mode === 'new'
  const canSubmit = isCreate
    ? password.length >= 8 && password === confirm
    : password.length > 0

  const handleSubmit = async () => {
    if (!canSubmit) return
    setLoading(true)
    setError('')
    try {
      await onSubmit(password)
    } catch {
      setError(isCreate ? 'Failed to create vault.' : 'Wrong password. Try again.')
    }
    setLoading(false)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2.5 mb-2">
        <div className="flex items-center justify-center size-8 rounded-lg bg-accent/15 text-accent-bright">
          <span className="text-sm">🔐</span>
        </div>
        <div>
          <p className="text-sm font-medium text-ink-primary">
            {isCreate ? 'Create' : 'Unlock'}: {vaultName}
          </p>
          <p className="text-2xs text-ink-quaternary">
            {isCreate ? 'Set a master password' : 'Enter your master password'}
          </p>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs text-ink-tertiary">Master Password</Label>
        <Input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={isCreate ? 'Choose a strong password...' : 'Enter password...'}
          onKeyDown={(e) => e.key === 'Enter' && canSubmit && handleSubmit()}
        />
      </div>

      {isCreate && (
        <div className="space-y-1.5">
          <Label className="text-xs text-ink-tertiary">Confirm Password</Label>
          <Input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Re-enter your password..."
            className={confirm && password !== confirm ? 'border-red-500/50' : ''}
            onKeyDown={(e) => e.key === 'Enter' && canSubmit && handleSubmit()}
          />
          {confirm && password !== confirm && (
            <p className="text-2xs text-danger">Passwords don't match</p>
          )}
        </div>
      )}

      {error && <p className="text-xs text-danger">{error}</p>}

      <button
        onClick={handleSubmit}
        disabled={loading || !canSubmit}
        className="w-full flex items-center justify-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-bright transition-colors disabled:opacity-50"
      >
        {loading ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
        {isCreate ? 'Create' : 'Unlock'}
      </button>

      <button
        onClick={onCancel}
        className="w-full text-xs text-ink-quaternary hover:text-ink-tertiary transition-colors py-1"
      >
        ← Back
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/components/vault/VaultPasswordDialog.tsx
git commit -m "feat: add VaultPasswordDialog component"
```

---

### Task 8: Create VaultSwitcher component

**Files:**
- Create: `src/app/components/vault/VaultSwitcher.tsx`

- [ ] **Step 1: Create the component**

```typescript
// src/app/components/vault/VaultSwitcher.tsx
import { useState, useEffect, useRef } from 'react'
import { useStore } from '../../store/useStore'
import { FileStorage, type CachedVaultMeta } from '../../lib/storage'
import { VaultPasswordDialog } from './VaultPasswordDialog'
import { Database } from '../../../core/database'
import { ChevronDown, Plus } from 'lucide-react'

export function VaultSwitcher() {
  const { db, activeVaultFileName } = useStore()
  const [open, setOpen] = useState(false)
  const [vaults, setVaults] = useState<string[]>([])
  const [metas, setMetas] = useState<Record<string, CachedVaultMeta>>({})
  const [switchTarget, setSwitchTarget] = useState<string | null>(null)
  const [showNewVault, setShowNewVault] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    FileStorage.listVaultFiles().then(setVaults)
    FileStorage.getCachedVaultMetas().then((list) => {
      const map: Record<string, CachedVaultMeta> = {}
      for (const m of list) map[m.fileName] = m
      setMetas(map)
    })
  }, [activeVaultFileName])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const currentName = db?.getData().name || activeVaultFileName?.replace(/\.keya$/, '') || 'Vault'
  const currentIcon = db?.getData().icon || '🔐'
  const currentColor = db?.getData().color || '#3b82f6'

  const handleSwitch = async (fileName: string, password: string) => {
    const newDb = await FileStorage.openVault(fileName, password)
    useStore.getState().lock()
    useStore.setState({
      db: newDb,
      password,
      activeVaultFileName: fileName,
      workspaceState: 'unlocked',
    })
    setSwitchTarget(null)
    setOpen(false)
  }

  const handleCreate = async (password: string) => {
    const fileName = `vault-${Date.now()}.keya`
    const newDb = await FileStorage.createVault(fileName, password)
    useStore.getState().lock()
    useStore.setState({
      db: newDb,
      password,
      activeVaultFileName: fileName,
      workspaceState: 'unlocked',
    })
    setShowNewVault(false)
    setOpen(false)
  }

  if (switchTarget) {
    return (
      <div className="p-3 border-b border-line-subtle">
        <VaultPasswordDialog
          mode="unlock"
          vaultName={metas[switchTarget]?.name || switchTarget.replace(/\.keya$/, '')}
          onSubmit={(pw) => handleSwitch(switchTarget, pw)}
          onCancel={() => setSwitchTarget(null)}
        />
      </div>
    )
  }

  if (showNewVault) {
    return (
      <div className="p-3 border-b border-line-subtle">
        <VaultPasswordDialog
          mode="new"
          vaultName="New Vault"
          onSubmit={handleCreate}
          onCancel={() => setShowNewVault(false)}
        />
      </div>
    )
  }

  return (
    <div ref={ref} className="relative border-b border-line-subtle">
      <button
        onClick={() => setOpen(!open)}
        className="w-full h-12 flex items-center gap-2 px-4 hover:bg-surface-3 transition-colors"
      >
        <div
          className="flex items-center justify-center size-6 rounded-md text-xs shrink-0"
          style={{ backgroundColor: `${currentColor}20`, color: currentColor }}
        >
          {currentIcon}
        </div>
        <span className="text-sm font-semibold tracking-tight text-ink-primary truncate flex-1 text-left">
          {currentName}
        </span>
        <ChevronDown className={`size-3.5 text-ink-quaternary transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-50 bg-canvas-panel border border-line rounded-b-md shadow-lg py-1 max-h-64 overflow-y-auto">
          {vaults.map((f) => {
            const meta = metas[f]
            const isActive = f === activeVaultFileName
            const name = meta?.name || f.replace(/\.keya$/, '')
            return (
              <button
                key={f}
                disabled={isActive}
                onClick={() => { setSwitchTarget(f) }}
                className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs transition-colors
                  ${isActive ? 'bg-surface-4 text-ink-secondary' : 'text-ink-tertiary hover:bg-surface-3 hover:text-ink-primary'}`}
              >
                <span className="text-sm">{meta?.icon ?? '🔐'}</span>
                <span className="truncate">{name}</span>
                {isActive && <span className="ml-auto text-2xs text-ink-quaternary">active</span>}
              </button>
            )
          })}
          <div className="border-t border-line-subtle mt-1 pt-1">
            <button
              onClick={() => setShowNewVault(true)}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-ink-quaternary hover:text-ink-tertiary hover:bg-surface-3 transition-colors"
            >
              <Plus className="size-3" />
              <span>New Vault</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/components/vault/VaultSwitcher.tsx
git commit -m "feat: add VaultSwitcher sidebar component"
```

---

### Task 9: Update Sidebar to integrate VaultSwitcher

**Files:**
- Modify: `src/app/components/layout/Sidebar.tsx`

- [ ] **Step 1: Replace the brand header with VaultSwitcher**

In `src/app/components/layout/Sidebar.tsx`, add the import:

```typescript
import { VaultSwitcher } from '../vault/VaultSwitcher'
```

Replace the brand div (lines 30–35) with:

```typescript
        <VaultSwitcher />
```

Remove unused `Key` from lucide imports if no longer used.

- [ ] **Step 2: Commit**

```bash
git add src/app/components/layout/Sidebar.tsx
git commit -m "feat: integrate VaultSwitcher into sidebar"
```

---

### Task 10: Rewrite WelcomePage for multi-vault

**Files:**
- Modify: `src/app/components/welcome/WelcomePage.tsx`

This is the second-largest task. The welcome page must show a list of vaults instead of a single "Open Vault" button.

- [ ] **Step 1: Rewrite `src/app/components/welcome/WelcomePage.tsx`**

```typescript
import { useState, useEffect, useRef } from 'react'
import { FileStorage, type CachedVaultMeta } from '../../lib/storage'
import { Database } from '../../../core/database'
import { useStore } from '../../store/useStore'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { VaultCard } from '../vault/VaultCard'
import { VaultPasswordDialog } from '../vault/VaultPasswordDialog'
import { FolderOpen, Key, ArrowRight, Loader2, Upload, AlertTriangle, Sun, Moon, Monitor, Plus } from 'lucide-react'

const supportsFSA = typeof window !== 'undefined' && 'showDirectoryPicker' in window

type Mode = 'home' | 'unlock' | 'new'

export function WelcomePage() {
  const [mode, setMode] = useState<Mode>('home')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [folderName, setFolderName] = useState<string | null>(null)
  const [vaultFiles, setVaultFiles] = useState<string[]>([])
  const [cachedMetas, setCachedMetas] = useState<Record<string, CachedVaultMeta>>({})
  const [selectedVault, setSelectedVault] = useState<string | null>(null)
  const [newVaultName, setNewVaultName] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { setWorkspaceState, setDb, setPassword: setStorePassword, theme, setTheme } = useStore()

  // Load folder info and vault list
  useEffect(() => {
    if (mode !== 'home') return
    if (supportsFSA) {
      FileStorage.getWorkspaceName().then(setFolderName)
      FileStorage.listVaultFiles().then((files) => {
        setVaultFiles(files)
      })
      FileStorage.getCachedVaultMetas().then((list) => {
        const map: Record<string, CachedVaultMeta> = {}
        for (const m of list) map[m.fileName] = m
        setCachedMetas(map)
      })
    }
  }, [mode])

  // ── Handlers ──

  const handleChooseFolder = async () => {
    setLoading(true)
    setError('')
    try {
      const dirHandle = await FileStorage.setupWorkspace()
      setFolderName(dirHandle.name)
      const files = await FileStorage.listVaultFiles()
      setVaultFiles(files)
    } catch { /* cancelled */ }
    setLoading(false)
  }

  const handleUnlockVault = async (fileName: string, password: string) => {
    const db = await FileStorage.openVault(fileName, password)
    useStore.setState({
      db,
      password,
      activeVaultFileName: fileName,
      workspaceState: 'unlocked',
    })
  }

  const handleCreateVault = async (password: string) => {
    const fileName = newVaultName
      ? `${newVaultName.replace(/\.keya$/, '')}.keya`
      : `vault-${Date.now()}.keya`
    const db = await FileStorage.createVault(fileName, password)
    useStore.setState({
      db,
      password,
      activeVaultFileName: fileName,
      workspaceState: 'unlocked',
    })
  }

  const handleSwitchFolder = async () => {
    await FileStorage.clearWorkspace()
    setFolderName(null)
    setVaultFiles([])
    setCachedMetas({})
  }

  // ── Legacy (mobile) ──

  const handleLegacyFilePicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    ;(window as any).__legacyFile = file
    setSelectedVault(file.name)
    setMode('unlock')
  }

  const handleLegacyUnlock = async (password: string) => {
    const file = (window as any).__legacyFile as File | undefined
    if (!file) throw new Error('Please select a .keya file first.')
    const buffer = await file.arrayBuffer()
    const { deserializeFromFile } = await import('../../../core/schema')
    const data = await deserializeFromFile(new Uint8Array(buffer), password)
    const db = new Database(data)
    useStore.setState({
      db,
      password,
      activeVaultFileName: file.name,
      workspaceState: 'unlocked',
    })
  }

  // ── Render ──

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-canvas-deepest">
      {/* Theme toggle */}
      <div className="absolute top-4 right-4 flex items-center gap-1 bg-surface-2 rounded-md border border-line p-0.5">
        {([['system', Monitor], ['light', Sun], ['dark', Moon]] as const).map(([t, Icon]) => (
          <button key={t} onClick={() => setTheme(t)}
                  className={`p-1.5 rounded transition-colors ${theme === t ? 'bg-surface-5 text-ink-primary' : 'text-ink-quaternary hover:text-ink-secondary'}`}>
            <Icon className="size-3.5" />
          </button>
        ))}
      </div>
      <div className="w-full max-w-xs">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center justify-center size-11 rounded-xl bg-accent text-white mb-3.5 shadow-lg shadow-accent/20">
            <Key className="size-5" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-ink-primary">Keya</h1>
          <p className="text-xs text-ink-tertiary mt-1">Your Key Guardian</p>
        </div>

        {/* Browser warning */}
        {!supportsFSA && mode === 'home' && (
          <div className="mb-4 flex items-start gap-2 px-3 py-2.5 rounded-md bg-amber-500/10 border border-amber-500/20">
            <AlertTriangle className="size-3.5 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-2xs text-amber-300 leading-relaxed">
              Your browser doesn't support automatic file syncing. Use desktop Chrome for the best experience.
            </p>
          </div>
        )}

        {/* Mode: Home — vault list */}
        {mode === 'home' && supportsFSA && (
          <div className="space-y-2.5">
            {folderName ? (
              <>
                <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-surface-2 border border-line">
                  <FolderOpen className="size-4 text-ink-quaternary shrink-0" />
                  <span className="text-xs text-ink-secondary truncate">{folderName}</span>
                </div>

                {vaultFiles.length > 0 ? (
                  <div className="space-y-1.5">
                    {vaultFiles.map((f) => (
                      <VaultCard
                        key={f}
                        fileName={f}
                        meta={cachedMetas[f]}
                        onClick={() => { setSelectedVault(f); setMode('unlock') }}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-ink-quaternary text-center py-2">No vaults found</p>
                )}

                <button onClick={() => setMode('new')}
                        className="w-full flex items-center justify-center gap-2 rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-bright transition-colors">
                  <Plus className="size-4" /> New Vault
                </button>
                <button onClick={handleSwitchFolder}
                        className="w-full text-xs text-ink-quaternary hover:text-ink-tertiary transition-colors py-1">
                  Change Sync Folder
                </button>
              </>
            ) : (
              <button onClick={handleChooseFolder} disabled={loading}
                      className="w-full flex items-center justify-center gap-2 rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-bright transition-colors disabled:opacity-50">
                {loading ? <Loader2 className="size-4 animate-spin" /> : <FolderOpen className="size-4" />}
                Choose Sync Folder
              </button>
            )}
          </div>
        )}

        {/* Mode: Home — legacy (mobile) */}
        {mode === 'home' && !supportsFSA && (
          <div className="space-y-2.5">
            <button onClick={() => fileInputRef.current?.click()} disabled={loading}
                    className="w-full flex items-center justify-center gap-2 rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-bright transition-colors disabled:opacity-50">
              <Upload className="size-4" /> Open .keya File
            </button>
            <input ref={fileInputRef} type="file" accept=".keya" className="hidden" onChange={handleLegacyFilePicked} />
          </div>
        )}

        {/* Mode: Unlock */}
        {mode === 'unlock' && selectedVault && (
          <VaultPasswordDialog
            mode="unlock"
            vaultName={cachedMetas[selectedVault]?.name || selectedVault.replace(/\.keya$/, '')}
            onSubmit={supportsFSA
              ? (pw) => handleUnlockVault(selectedVault, pw)
              : handleLegacyUnlock}
            onCancel={() => { setMode('home'); setSelectedVault(null) }}
          />
        )}

        {/* Mode: New */}
        {mode === 'new' && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-ink-tertiary">Vault Name</Label>
              <Input
                value={newVaultName}
                onChange={(e) => setNewVaultName(e.target.value)}
                placeholder="My Vault"
              />
            </div>
            <VaultPasswordDialog
              mode="new"
              vaultName={newVaultName || 'New Vault'}
              onSubmit={handleCreateVault}
              onCancel={() => { setMode('home'); setNewVaultName('') }}
            />
          </div>
        )}

        {error && <p className="text-xs text-danger text-center mt-2">{error}</p>}

        <p className="text-center text-2xs text-ink-quaternary mt-10">
          Your keys stay on your device. Encrypted end-to-end.
        </p>
        <a href="https://github.com/puinoib/keya" target="_blank" rel="noopener noreferrer"
           className="block text-center text-2xs text-ink-quaternary hover:text-ink-tertiary transition-colors mt-2">
          GitHub
        </a>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/components/welcome/WelcomePage.tsx
git commit -m "feat: rewrite WelcomePage for multi-vault selection"
```

---

### Task 11: Update KeysPage lock button

**Files:**
- Modify: `src/app/components/keys/KeysPage.tsx`

- [ ] **Step 1: Verify KeysPage still works**

The current `KeysPage.tsx` already uses `useStore.getState().lock()` which was updated in Task 5. No changes needed. Verify the file still compiles.

Read `src/app/components/keys/KeysPage.tsx` and confirm it references `useStore` and not `FileStorage` directly.

- [ ] **Step 2: Commit (only if changes were needed)**

---

### Task 12: Fix remaining type errors and run full test suite

**Files:**
- Various

- [ ] **Step 1: Run full type check**

Run: `npx tsc --noEmit`

Expected: Zero errors.

Fix any remaining issues.

- [ ] **Step 2: Run full test suite**

Run: `npx vitest run`

Expected: All tests pass.

- [ ] **Step 3: Run build**

Run: `npx vite build`

Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "fix: resolve remaining type errors after multi-vault migration"
```

---

## Verification

1. **Create a vault:** Open the app → Choose sync folder → Click "New Vault" → Enter name + password → Verify redirected to /keys
2. **Create a second vault:** Click vault switcher in sidebar → "New Vault" → Enter password → Verify switched to new vault
3. **Switch vaults:** Click vault switcher → Select another vault → Enter password → Verify switched
4. **Lock and return:** Click Lock → Verify welcome page shows both vaults with cached metadata
5. **Open existing vault:** Click a vault card → Enter password → Verify correct data loads
6. **Legacy browser:** Test on mobile/Safari — file picker → unlock → works
7. **Backward compatibility:** Open an old `.keya` file (with `file_id` field) → Verify it loads and migrates to `vault_id`
8. **Run tests:** `npx vitest run` — all pass
9. **Type check:** `npx tsc --noEmit` — zero errors
