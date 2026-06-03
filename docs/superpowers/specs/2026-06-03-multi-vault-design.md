# Multi-Vault Support Design

## Context

Keya currently supports only one `.keya` database per sync folder. Users want to manage multiple vaults (e.g., work vs. personal) within the same sync folder, each with its own password. This requires changes to the storage layer, data model, store, and UI components.

## Data Model

### KeyaDatabase changes (`src/core/types.ts`)

Rename `file_id` to `vault_id` and add metadata fields:

```typescript
interface KeyaDatabase {
  version: number
  vault_id: string       // was file_id — unique vault identifier (UUID)
  created_at: string
  updated_at: string
  name: string           // display name, defaults to filename without extension
  description: string    // optional vault description
  icon: string           // emoji or icon identifier
  color: string          // accent color, e.g. '#3b82f6'
  api_keys: ApiKey[]
  groups: Group[]
  settings: Settings
}
```

- `vault_id`: generated once at creation, never changes, used as the primary identifier everywhere
- `name`: defaults to filename stem (e.g., `work.keya` → `work`), editable by user
- `icon`/`color`: for visual identification in vault lists
- Entry stats (key count, group count) are computed at runtime, not stored

### IndexedDB vault metadata cache

Stored in the existing `keya-meta` database, new object store `vault-meta`:

```typescript
interface CachedVaultMeta {
  vault_id: string       // primary key — matches KeyaDatabase.vault_id
  fileName: string       // current filename for display
  name: string           // display name
  icon: string
  color: string
  keyCount: number       // snapshot at cache time
  updatedAt: string      // snapshot at cache time
}
```

Cached after each successful unlock or save. On the welcome page, if no cache exists for a vault, only the filename is shown.

### WorkspaceEntry change (`src/app/lib/storage.ts`)

Remove `fileName` — the workspace is the folder, not a single file:

```typescript
interface WorkspaceEntry {
  id: 'main'
  directoryHandle: FileSystemDirectoryHandle
}
```

## Storage Layer (`src/app/lib/storage.ts`)

New methods:

| Method | Description |
|--------|-------------|
| `listVaultFiles()` | Scan folder, return all `.keya` filenames sorted alphabetically |
| `openVault(fileName, password)` | Decrypt specific vault file, cache metadata, return `Database` |
| `createVault(fileName, password, meta?)` | Create new `.keya` file with initial metadata |
| `saveVault(fileName, db, password)` | Encrypt and save to specific file (replaces current `save`) |
| `cacheVaultMeta(fileName, db)` | Update IndexedDB cache after unlock/save |
| `getCachedVaultMetas()` | Read all cached vault metadata from IndexedDB |
| `deleteVaultMeta(vaultId)` | Remove cache entry when a vault is deleted |

Remove or repurpose:
- `autoOpen()` → replaced by `listVaultFiles()` + `openVault()`
- `setupWorkspace()` → simplified, only picks folder (no file detection)
- `save()` → replaced by `saveVault()`

## Store (`src/app/store/useStore.ts`)

New state:

```typescript
activeVaultFileName: string | null  // currently open vault file
```

- `scheduleSave` uses `saveVault(activeVaultFileName, ...)` instead of `save()`
- `lock()` clears `activeVaultFileName` along with existing state
- Auto-save debouncer uses `activeVaultFileName` to know which file to save

## UI Changes

### Welcome Page (`src/app/components/welcome/WelcomePage.tsx`)

New flow:

1. Check if workspace folder exists (IndexedDB)
2. **Has folder**: scan and display vault cards (name, icon, color, cached stats)
3. **No folder**: show "Choose sync folder" button
4. User clicks a vault card → `unlock` mode (enter password for that vault)
5. User clicks "New vault" → `new` mode (create vault in current folder)

Vault card display priority: cached metadata → filename stem only.

### Sidebar Vault Switcher (`src/app/components/layout/Sidebar.tsx`)

New component at the top of the sidebar:

- Shows current vault name + icon
- Click to expand dropdown:
  - List of all vaults in the folder (name, icon, color)
  - Active vault highlighted
  - "New vault" option at bottom
- Select another vault → password dialog → switch on success
- Switching locks current vault first, then unlocks the selected one

### Password Dialog

New reusable component for:
- Unlocking a vault from the welcome page
- Switching vaults from the sidebar
- First-time unlock after creating a new vault

## Migration

- Existing `file_id` field is renamed to `vault_id` in the type definition
- Existing `.keya` files with `file_id` field are compatible — the deserialization reads the field by either name during a migration period
- `WorkspaceEntry.fileName` removal: on first run after update, the old entry is still in IndexedDB. Code should handle both old (with fileName) and new (without) formats gracefully — read the directoryHandle and ignore fileName

## Security Considerations

- All vault metadata stays encrypted inside `.keya` files
- IndexedDB cache only stores non-sensitive display info (name, icon, color, counts)
- No sidecar files — the sync folder only contains `.keya` encrypted files
- Vault password is never stored, only held in memory during the session

## Files to Modify

| File | Change |
|------|--------|
| `src/core/types.ts` | Rename `file_id` → `vault_id`, add metadata fields |
| `src/core/database.ts` | Update constructor to set defaults for new fields |
| `src/core/schema.ts` | Handle backward-compatible `file_id`/`vault_id` reading |
| `src/app/lib/storage.ts` | New methods, remove `fileName` from WorkspaceEntry |
| `src/app/store/useStore.ts` | Add `activeVaultFileName`, update save/lock logic |
| `src/app/App.tsx` | No routing changes needed |
| `src/app/components/welcome/WelcomePage.tsx` | Vault list UI, multi-vault flow |
| `src/app/components/layout/Sidebar.tsx` | Vault switcher component |
| `src/app/components/layout/AppLayout.tsx` | Integrate vault switcher |
| New: `src/app/components/vault/VaultCard.tsx` | Vault card for welcome page |
| New: `src/app/components/vault/VaultSwitcher.tsx` | Sidebar vault switcher dropdown |
| New: `src/app/components/vault/VaultPasswordDialog.tsx` | Reusable password dialog |
